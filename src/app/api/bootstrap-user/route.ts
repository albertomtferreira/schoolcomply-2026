import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getServerEnv } from "@/lib/env";
import { MODULE_CATALOG } from "@/lib/modules/catalog";

export const runtime = "nodejs";

const DEFAULT_ENABLED_MODULES = ["trainingTrack"];
const DEFAULT_SCHOOL_ID = "school_main";

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

function normalizeName(email: string | undefined, uid: string): string {
  if (!email) {
    return `User ${uid.slice(0, 6)}`;
  }

  const localPart = email.split("@")[0] ?? "user";
  return localPart.replace(/[._-]+/g, " ").trim() || `User ${uid.slice(0, 6)}`;
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function defaultOrgId(uid: string): string {
  return `org_${uid.slice(0, 12)}`;
}

type DecodedIdentity = {
  uid: string;
  email?: string;
  orgId?: string;
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const payloadSegment = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payloadSegment.padEnd(
      Math.ceil(payloadSegment.length / 4) * 4,
      "=",
    );
    const json = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function resolveIdentityFromToken(
  token: string,
): Promise<DecodedIdentity> {
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: typeof decoded.email === "string" ? decoded.email : undefined,
      orgId: typeof decoded.orgId === "string" ? decoded.orgId : undefined,
    };
  } catch (error) {
    const env = getServerEnv();
    if (env.FIREBASE_USE_EMULATORS !== "true") {
      throw error;
    }

    // In local emulator mode, project aliases can differ and break aud verification.
    // We only allow payload decoding fallback when emulators are explicitly enabled.
    const payload = decodeJwtPayload(token);
    const uid = typeof payload?.user_id === "string" ? payload.user_id : null;
    if (!uid) {
      throw error;
    }

    return {
      uid,
      email: typeof payload?.email === "string" ? payload.email : undefined,
      orgId: typeof payload?.orgId === "string" ? payload.orgId : undefined,
    };
  }
}

export async function POST(request: Request) {
  try {
    const env = getServerEnv();
    const token = getBearerToken(request.headers.get("authorization"));
    if (!token) {
      return NextResponse.json(
        { error: "Missing auth token." },
        { status: 401 },
      );
    }

    const decoded = await resolveIdentityFromToken(token);
    const uid = decoded.uid;
    const email =
      decoded.email && decoded.email.length > 0 ? decoded.email : undefined;
    const orgId =
      typeof decoded.orgId === "string" && decoded.orgId.length > 0
        ? decoded.orgId
        : defaultOrgId(uid);
    const displayName = normalizeName(email, uid);
    const orgName = `${displayName} Organisation`;
    const orgSlug = toSlug(orgName) || `org-${uid.slice(0, 8)}`;
    const defaultSchoolName = "Main School";
    const staffId = `staff_${uid}`;

    const orgRef = adminDb.doc(`organisations/${orgId}`);
    const schoolRef = adminDb.doc(
      `organisations/${orgId}/schools/${DEFAULT_SCHOOL_ID}`,
    );
    const userRef = adminDb.doc(`organisations/${orgId}/users/${uid}`);
    const staffRef = adminDb.doc(`organisations/${orgId}/staff/${staffId}`);

    let createdOrg = false;
    let createdSchool = false;
    let createdUser = false;
    let createdStaff = false;
    let createdModuleHealth = 0;
    let patchedUser = false;
    let enabledModulesForUser: string[] = DEFAULT_ENABLED_MODULES;

    await adminDb.runTransaction(async (tx) => {
      const [orgSnap, schoolSnap, userSnap, staffSnap] = await Promise.all([
        tx.get(orgRef),
        tx.get(schoolRef),
        tx.get(userRef),
        tx.get(staffRef),
      ]);
      const now = FieldValue.serverTimestamp();
      const existingUserData = userSnap.exists ? (userSnap.data() ?? {}) : {};

      enabledModulesForUser =
        userSnap.exists &&
        Array.isArray(existingUserData.enabledModules) &&
        existingUserData.enabledModules.length > 0
          ? existingUserData.enabledModules.filter(
              (value): value is string => typeof value === "string",
            )
          : DEFAULT_ENABLED_MODULES;

      const validModuleIds = new Set(
        MODULE_CATALOG.map((moduleItem) => moduleItem.id),
      );
      const moduleIdsToEnsure = enabledModulesForUser.filter((moduleId) =>
        validModuleIds.has(moduleId),
      );
      const moduleHealthRefs = moduleIdsToEnsure.map((moduleId) =>
        adminDb.doc(`organisations/${orgId}/moduleHealth/${moduleId}`),
      );
      const moduleHealthSnaps = await Promise.all(
        moduleHealthRefs.map((moduleHealthRef) => tx.get(moduleHealthRef)),
      );

      if (!orgSnap.exists) {
        tx.set(orgRef, {
          name: orgName,
          slug: orgSlug,
          status: "active",
          createdAt: now,
          updatedAt: now,
        });
        createdOrg = true;
      }

      if (!schoolSnap.exists) {
        tx.set(schoolRef, {
          name: defaultSchoolName,
          status: "active",
          createdAt: now,
          updatedAt: now,
        });
        createdSchool = true;
      }

      if (!staffSnap.exists) {
        tx.set(staffRef, {
          fullName: displayName,
          email: email ?? `${uid}@unknown.local`,
          schoolIds: [DEFAULT_SCHOOL_ID],
          employmentRole: "staff",
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
        createdStaff = true;
      }

      if (!userSnap.exists) {
        enabledModulesForUser = DEFAULT_ENABLED_MODULES;
        tx.set(userRef, {
          uid,
          fullName: displayName,
          email: email ?? `${uid}@unknown.local`,
          role: "org_admin",
          orgId,
          schoolIds: [DEFAULT_SCHOOL_ID],
          staffId,
          enabledModules: DEFAULT_ENABLED_MODULES,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
        createdUser = true;
      } else {
        const userPatch: Record<string, unknown> = {};

        if (
          typeof existingUserData.fullName !== "string" ||
          existingUserData.fullName.length === 0
        ) {
          userPatch.fullName = displayName;
        }
        if (
          typeof existingUserData.email !== "string" ||
          existingUserData.email.length === 0
        ) {
          userPatch.email = email ?? `${uid}@unknown.local`;
        }
        if (
          typeof existingUserData.orgId !== "string" ||
          existingUserData.orgId.length === 0
        ) {
          userPatch.orgId = orgId;
        }
        if (
          typeof existingUserData.role !== "string" ||
          existingUserData.role.length === 0
        ) {
          userPatch.role = "org_admin";
        }
        if (
          !Array.isArray(existingUserData.enabledModules) ||
          existingUserData.enabledModules.length === 0
        ) {
          userPatch.enabledModules = DEFAULT_ENABLED_MODULES;
          enabledModulesForUser = DEFAULT_ENABLED_MODULES;
        }
        if (typeof existingUserData.isActive !== "boolean") {
          userPatch.isActive = true;
        }
        if (
          !Array.isArray(existingUserData.schoolIds) ||
          existingUserData.schoolIds.length === 0
        ) {
          userPatch.schoolIds = [DEFAULT_SCHOOL_ID];
        }
        if (
          typeof existingUserData.staffId !== "string" ||
          existingUserData.staffId.length === 0
        ) {
          userPatch.staffId = staffId;
        }

        if (Object.keys(userPatch).length > 0) {
          tx.set(
            userRef,
            {
              ...userPatch,
              updatedAt: now,
            },
            { merge: true },
          );
          patchedUser = true;
        }
      }

      for (let index = 0; index < moduleIdsToEnsure.length; index += 1) {
        const moduleHealthRef = moduleHealthRefs[index];
        const moduleHealthSnap = moduleHealthSnaps[index];
        if (!moduleHealthSnap.exists) {
          tx.set(moduleHealthRef, {
            state: "grey",
            openRiskCount: 0,
            summary: "Data unavailable",
            lastCalculatedAt: now,
          });
          createdModuleHealth += 1;
        }
      }
    });

    let mergedEnabledModules: string[] = DEFAULT_ENABLED_MODULES;

    if (env.FIREBASE_USE_EMULATORS !== "true") {
      const authUser = await adminAuth.getUser(uid);
      const existingClaims = authUser.customClaims ?? {};
      const mergedClaims = {
        ...existingClaims,
        orgId,
        enabledModules:
          Array.isArray(existingClaims.enabledModules) &&
          existingClaims.enabledModules.length > 0
            ? existingClaims.enabledModules
            : DEFAULT_ENABLED_MODULES,
      };
      await adminAuth.setCustomUserClaims(uid, mergedClaims);
      mergedEnabledModules = mergedClaims.enabledModules;
    }

    return NextResponse.json({
      ok: true,
      orgId,
      createdOrg,
      createdSchool,
      createdUser,
      createdStaff,
      createdModuleHealth,
      patchedUser,
      enabledModules: mergedEnabledModules,
    });
  } catch (error) {
    console.error("bootstrap-user failed", error);
    return NextResponse.json(
      { error: "Failed to bootstrap Firestore user profile." },
      { status: 500 },
    );
  }
}
