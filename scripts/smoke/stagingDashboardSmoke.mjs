#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const MODULE_ID = "trainingTrack";
const DEFAULT_ORG_ID = "stgPilotOrgA";
const EXPIRING_WINDOW_DAYS = 60;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const idx = trimmed.indexOf("=");
    if (idx <= 0) {
      continue;
    }
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function loadLocalEnv() {
  const root = process.cwd();
  loadEnvFile(path.join(root, ".env.local"));
  loadEnvFile(path.join(root, ".env"));
}

function initAdmin() {
  if (getApps().length) {
    return getApps()[0];
  }
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "schooltrack-dev";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
  }
  return initializeApp({ projectId });
}

function parseArgs(argv) {
  const args = { orgId: DEFAULT_ORG_ID };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--org" && argv[i + 1]) {
      args.orgId = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function toMillis(value) {
  if (!value) {
    return undefined;
  }
  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  return undefined;
}

function isRequiredForStaff(trainingType, staff) {
  if (!trainingType || !staff) {
    return false;
  }
  if (trainingType.required === true) {
    return true;
  }
  if (trainingType.required === false) {
    const roles = Array.isArray(trainingType.requiredForRoles) ? trainingType.requiredForRoles : [];
    return roles.includes(staff.employmentRole);
  }
  return false;
}

function pickEffectiveRecord(records, trainingType) {
  if (!records.length) {
    return undefined;
  }
  const sorted = [...records].sort((a, b) => {
    if (trainingType?.expires === false) {
      const aIssued = toMillis(a.issuedAt) ?? 0;
      const bIssued = toMillis(b.issuedAt) ?? 0;
      if (aIssued !== bIssued) {
        return bIssued - aIssued;
      }
      const aUpdated = toMillis(a.updatedAt) ?? 0;
      const bUpdated = toMillis(b.updatedAt) ?? 0;
      return bUpdated - aUpdated;
    }

    const aExpires = toMillis(a.expiresAt) ?? Number.NEGATIVE_INFINITY;
    const bExpires = toMillis(b.expiresAt) ?? Number.NEGATIVE_INFINITY;
    if (aExpires !== bExpires) {
      return bExpires - aExpires;
    }
    const aUpdated = toMillis(a.updatedAt) ?? 0;
    const bUpdated = toMillis(b.updatedAt) ?? 0;
    return bUpdated - aUpdated;
  });
  return sorted[0];
}

function evaluateRecordStatus(record, trainingType, nowMs) {
  if (!record) {
    return "missing";
  }
  if (trainingType?.expires === false) {
    return "valid";
  }
  const expiresMs = toMillis(record.expiresAt);
  if (expiresMs === undefined) {
    return "missing";
  }
  if (expiresMs < nowMs) {
    return "expired";
  }
  const windowMs = EXPIRING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  if (expiresMs <= nowMs + windowMs) {
    return "expiring";
  }
  return "valid";
}

function evaluateStaffState(requiredStatuses) {
  if (requiredStatuses.some((s) => s === "missing" || s === "expired")) {
    return "non_compliant";
  }
  if (requiredStatuses.some((s) => s === "expiring")) {
    return "expiring_soon";
  }
  return "compliant";
}

function tally(states) {
  const counts = {
    compliantCount: 0,
    expiringSoonCount: 0,
    nonCompliantCount: 0,
  };
  for (const s of states) {
    if (s === "compliant") {
      counts.compliantCount += 1;
    } else if (s === "expiring_soon") {
      counts.expiringSoonCount += 1;
    } else if (s === "non_compliant") {
      counts.nonCompliantCount += 1;
    }
  }
  return counts;
}

function sameCounts(a, b) {
  return a.compliantCount === b.compliantCount
    && a.expiringSoonCount === b.expiringSoonCount
    && a.nonCompliantCount === b.nonCompliantCount;
}

function expectedModuleHealth(orgCounts) {
  if (orgCounts.nonCompliantCount > 0) {
    return { state: "red", openRiskCount: orgCounts.nonCompliantCount + orgCounts.expiringSoonCount };
  }
  if (orgCounts.expiringSoonCount > 0) {
    return { state: "amber", openRiskCount: orgCounts.expiringSoonCount };
  }
  if (orgCounts.compliantCount > 0) {
    return { state: "green", openRiskCount: 0 };
  }
  return { state: "grey", openRiskCount: 0 };
}

async function run() {
  loadLocalEnv();
  const args = parseArgs(process.argv.slice(2));
  initAdmin();
  const db = getFirestore();
  const nowMs = Date.now();

  const orgRef = db.doc(`organisations/${args.orgId}`);
  const schoolsRef = db.collection(`organisations/${args.orgId}/schools`);
  const staffRef = db.collection(`organisations/${args.orgId}/staff`);
  const ttRef = db.collection(`organisations/${args.orgId}/modules/${MODULE_ID}/trainingTypes`);
  const trRef = db.collection(`organisations/${args.orgId}/modules/${MODULE_ID}/trainingRecords`);
  const aggRef = db.collection(`organisations/${args.orgId}/aggregates`);
  const mhRef = db.doc(`organisations/${args.orgId}/moduleHealth/${MODULE_ID}`);

  const [orgSnap, schoolsSnap, staffSnap, ttSnap, trSnap, aggSnap, mhSnap] = await Promise.all([
    orgRef.get(),
    schoolsRef.get(),
    staffRef.get(),
    ttRef.get(),
    trRef.get(),
    aggRef.get(),
    mhRef.get(),
  ]);

  if (!orgSnap.exists) {
    throw new Error(`Org not found: ${args.orgId}`);
  }

  const schools = schoolsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const activeStaff = staffSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((s) => s.isActive === true);
  const trainingTypes = ttSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const trainingRecords = trSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const aggregates = new Map(aggSnap.docs.map((d) => [d.id, d.data()]));
  const moduleHealth = mhSnap.data() || {};

  const recordsByStaffType = new Map();
  for (const record of trainingRecords) {
    const key = `${record.staffId}::${record.trainingTypeId}`;
    const existing = recordsByStaffType.get(key) ?? [];
    existing.push(record);
    recordsByStaffType.set(key, existing);
  }

  const staffStates = new Map();
  for (const staff of activeStaff) {
    const requiredStatuses = [];
    for (const tt of trainingTypes) {
      if (!isRequiredForStaff(tt, staff)) {
        continue;
      }
      const key = `${staff.id}::${tt.id}`;
      const pool = recordsByStaffType.get(key) ?? [];
      const selected = pickEffectiveRecord(pool, tt);
      requiredStatuses.push(evaluateRecordStatus(selected, tt, nowMs));
    }
    staffStates.set(staff.id, evaluateStaffState(requiredStatuses));
  }

  const schoolResults = [];
  for (const school of schools) {
    const scopedStaff = activeStaff.filter((s) => Array.isArray(s.schoolIds) && s.schoolIds.includes(school.id));
    const counts = tally(scopedStaff.map((s) => staffStates.get(s.id)));
    const actual = aggregates.get(`school_${school.id}`) || {};
    schoolResults.push({
      schoolId: school.id,
      expected: counts,
      actual: {
        compliantCount: actual.compliantCount ?? 0,
        expiringSoonCount: actual.expiringSoonCount ?? 0,
        nonCompliantCount: actual.nonCompliantCount ?? 0,
      },
      pass: sameCounts(
        counts,
        {
          compliantCount: actual.compliantCount ?? 0,
          expiringSoonCount: actual.expiringSoonCount ?? 0,
          nonCompliantCount: actual.nonCompliantCount ?? 0,
        },
      ),
    });
  }

  const orgExpected = tally(activeStaff.map((s) => staffStates.get(s.id)));
  const orgActualRaw = aggregates.get("orgCompliance") || {};
  const orgActual = {
    compliantCount: orgActualRaw.compliantCount ?? 0,
    expiringSoonCount: orgActualRaw.expiringSoonCount ?? 0,
    nonCompliantCount: orgActualRaw.nonCompliantCount ?? 0,
  };
  const orgPass = sameCounts(orgExpected, orgActual);

  const mhExpected = expectedModuleHealth(orgExpected);
  const mhActual = {
    state: moduleHealth.state ?? "unknown",
    openRiskCount: moduleHealth.openRiskCount ?? -1,
  };
  const moduleHealthPass = mhExpected.state === mhActual.state && mhExpected.openRiskCount === mhActual.openRiskCount;

  const result = {
    orgId: args.orgId,
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "unknown",
    checkedAt: new Date().toISOString(),
    counts: {
      schools: schools.length,
      activeStaff: activeStaff.length,
      trainingTypes: trainingTypes.length,
      trainingRecords: trainingRecords.length,
    },
    orgAggregate: {
      expected: orgExpected,
      actual: orgActual,
      pass: orgPass,
    },
    schoolAggregates: schoolResults,
    moduleHealth: {
      expected: mhExpected,
      actual: mhActual,
      pass: moduleHealthPass,
    },
  };

  result.pass = result.orgAggregate.pass
    && result.moduleHealth.pass
    && result.schoolAggregates.every((s) => s.pass);

  console.log(JSON.stringify(result, null, 2));
  if (!result.pass) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error("[staging dashboard smoke] failed:", error);
  process.exitCode = 1;
});
