import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getServerEnv } from "@/lib/env";

export const runtime = "nodejs";

type DecodedIdentity = {
  uid: string;
  orgId?: string;
};

type AggregateCounts = {
  compliantCount: number;
  expiringSoonCount: number;
  nonCompliantCount: number;
};

function getBearerToken(header: string | null): string | null {
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }
  return token;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }
  try {
    const payloadSegment = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payloadSegment.padEnd(Math.ceil(payloadSegment.length / 4) * 4, "=");
    const json = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function resolveIdentityFromToken(token: string): Promise<DecodedIdentity> {
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return {
      uid: decoded.uid,
      orgId: typeof decoded.orgId === "string" ? decoded.orgId : undefined,
    };
  } catch (error) {
    const env = getServerEnv();
    if (env.FIREBASE_USE_EMULATORS !== "true") {
      throw error;
    }
    const payload = decodeJwtPayload(token);
    const uid = typeof payload?.user_id === "string" ? payload.user_id : null;
    if (!uid) {
      throw error;
    }
    return {
      uid,
      orgId: typeof payload?.orgId === "string" ? payload.orgId : undefined,
    };
  }
}

function toCounts(records: Array<{ status: string }>): AggregateCounts {
  return records.reduce<AggregateCounts>(
    (acc, record) => {
      if (record.status === "valid") {
        acc.compliantCount += 1;
      } else if (record.status === "expiring") {
        acc.expiringSoonCount += 1;
      } else {
        acc.nonCompliantCount += 1;
      }
      return acc;
    },
    {
      compliantCount: 0,
      expiringSoonCount: 0,
      nonCompliantCount: 0,
    },
  );
}

function deriveModuleHealth(
  counts: AggregateCounts,
  totalRecords: number,
): {
  state: "green" | "amber" | "red" | "grey";
  openRiskCount: number;
  summary: string;
} {
  if (totalRecords === 0) {
    return {
      state: "grey",
      openRiskCount: 0,
      summary: "Data unavailable",
    };
  }

  if (counts.nonCompliantCount > 0) {
    return {
      state: "red",
      openRiskCount: counts.nonCompliantCount + counts.expiringSoonCount,
      summary: "Non-compliant records require action.",
    };
  }

  if (counts.expiringSoonCount > 0) {
    return {
      state: "amber",
      openRiskCount: counts.expiringSoonCount,
      summary: "Upcoming expiries need attention.",
    };
  }

  return {
    state: "green",
    openRiskCount: 0,
    summary: "All tracked records are compliant.",
  };
}

export async function POST(request: Request) {
  try {
    const token = getBearerToken(request.headers.get("authorization"));
    if (!token) {
      return NextResponse.json({ error: "Missing auth token." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { orgId?: string };
    const decoded = await resolveIdentityFromToken(token);
    const orgId = decoded.orgId ?? body.orgId ?? null;
    if (!orgId) {
      return NextResponse.json({ error: "Organisation scope missing." }, { status: 400 });
    }

    const userSnap = await adminDb.doc(`organisations/${orgId}/users/${decoded.uid}`).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "User does not belong to organisation." }, { status: 403 });
    }

    const recordsSnap = await adminDb
      .collection(`organisations/${orgId}/modules/trainingTrack/trainingRecords`)
      .get();

    const records = recordsSnap.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        schoolId: typeof data.schoolId === "string" ? data.schoolId : "",
        status: typeof data.status === "string" ? data.status : "expired",
      };
    });

    const orgCounts = toCounts(records);
    const bySchool = new Map<string, Array<{ status: string }>>();
    for (const record of records) {
      if (!record.schoolId) {
        continue;
      }
      const current = bySchool.get(record.schoolId) ?? [];
      current.push({ status: record.status });
      bySchool.set(record.schoolId, current);
    }

    const moduleHealth = deriveModuleHealth(orgCounts, records.length);
    const now = FieldValue.serverTimestamp();
    const batch = adminDb.batch();

    batch.set(adminDb.doc(`organisations/${orgId}/aggregates/orgCompliance`), {
      compliantCount: orgCounts.compliantCount,
      nonCompliantCount: orgCounts.nonCompliantCount,
      expiringSoonCount: orgCounts.expiringSoonCount,
      lastCalculatedAt: now,
      source: "reconciliation",
    });

    for (const [schoolId, schoolRecords] of bySchool.entries()) {
      const schoolCounts = toCounts(schoolRecords);
      batch.set(adminDb.doc(`organisations/${orgId}/aggregates/school_${schoolId}`), {
        compliantCount: schoolCounts.compliantCount,
        nonCompliantCount: schoolCounts.nonCompliantCount,
        expiringSoonCount: schoolCounts.expiringSoonCount,
        lastCalculatedAt: now,
        source: "reconciliation",
      });
    }

    batch.set(adminDb.doc(`organisations/${orgId}/moduleHealth/trainingTrack`), {
      state: moduleHealth.state,
      openRiskCount: moduleHealth.openRiskCount,
      summary: moduleHealth.summary,
      reasonCodes:
        moduleHealth.state === "red"
          ? ["expired_required_record"]
          : moduleHealth.state === "amber"
            ? ["expiring_soon_required_record"]
            : moduleHealth.state === "grey"
              ? ["no_active_staff"]
              : [],
      ruleIds:
        moduleHealth.state === "red"
          ? ["CDT-3-NON-COMPLIANT-EXPIRED-OR-MISSING"]
          : moduleHealth.state === "amber"
            ? ["CDT-3-EXPIRING-SOON"]
            : moduleHealth.state === "grey"
              ? ["CDT-4-NO-ACTIVE-STAFF"]
              : ["CDT-3-COMPLIANT"],
      lastCalculatedAt: now,
      source: "reconciliation",
    });

    await batch.commit();

    return NextResponse.json({
      ok: true,
      orgId,
      records: records.length,
      orgCounts,
      moduleHealth,
    });
  } catch (error) {
    console.error("refresh-aggregates failed", error);
    return NextResponse.json(
      { error: "Failed to refresh training aggregates." },
      { status: 500 },
    );
  }
}
