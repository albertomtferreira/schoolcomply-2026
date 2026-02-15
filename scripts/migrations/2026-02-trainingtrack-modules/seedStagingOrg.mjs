#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const MODULE_ID = "trainingTrack";
const SEED_VERSION = "2026-02-trainingtrack-staging-seed-v1";
const DEFAULT_ORG_ID = "stgPilotOrgA";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
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

function parseArgs(argv) {
  const args = {
    orgId: DEFAULT_ORG_ID,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--org") {
      const value = argv[i + 1];
      if (value) {
        args.orgId = value;
      }
      i += 1;
      continue;
    }
    if (token === "--dry-run") {
      args.dryRun = true;
    }
  }

  return args;
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
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    });
  }

  return initializeApp({ projectId });
}

function ts(input) {
  return Timestamp.fromDate(new Date(input));
}

function dataset(orgId) {
  const createdAt = ts("2026-01-10T09:00:00.000Z");
  const updatedAt = ts("2026-02-15T12:00:00.000Z");
  const calculatedAt = ts("2026-02-15T12:05:00.000Z");

  const schoolNorth = "school_north";
  const schoolSouth = "school_south";

  const staff = [
    {
      id: "staff_alice",
      data: {
        fullName: "Alice Carter",
        email: "alice.carter@example.org",
        schoolIds: [schoolNorth],
        employmentRole: "teacher",
        jobTitle: "Year 6 Teacher",
        isActive: true,
        createdAt,
        updatedAt,
      },
    },
    {
      id: "staff_ben",
      data: {
        fullName: "Ben Holmes",
        email: "ben.holmes@example.org",
        schoolIds: [schoolNorth],
        employmentRole: "support",
        jobTitle: "Teaching Assistant",
        isActive: true,
        createdAt,
        updatedAt,
      },
    },
    {
      id: "staff_chloe",
      data: {
        fullName: "Chloe Reed",
        email: "chloe.reed@example.org",
        schoolIds: [schoolSouth],
        employmentRole: "teacher",
        jobTitle: "Science Teacher",
        isActive: true,
        createdAt,
        updatedAt,
      },
    },
    {
      id: "staff_dan",
      data: {
        fullName: "Dan Lewis",
        email: "dan.lewis@example.org",
        schoolIds: [schoolSouth],
        employmentRole: "admin",
        jobTitle: "Office Administrator",
        isActive: true,
        createdAt,
        updatedAt,
      },
    },
  ];

  const trainingTypes = [
    {
      id: "tt_safeguarding",
      data: {
        name: "Safeguarding Level 1",
        code: "SAFE-L1",
        expires: true,
        defaultValidityDays: 365,
        required: true,
        requiredForRoles: ["teacher", "support", "admin"],
        createdAt,
        updatedAt,
      },
    },
    {
      id: "tt_first_aid",
      data: {
        name: "First Aid",
        code: "FA-STD",
        expires: true,
        defaultValidityDays: 1095,
        required: true,
        requiredForRoles: ["teacher", "support"],
        createdAt,
        updatedAt,
      },
    },
    {
      id: "tt_fire_safety",
      data: {
        name: "Fire Safety",
        code: "FIRE-ANNUAL",
        expires: true,
        defaultValidityDays: 365,
        required: true,
        requiredForRoles: ["teacher", "support", "admin"],
        createdAt,
        updatedAt,
      },
    },
  ];

  const trainingRecords = [
    {
      id: "rec_alice_safe",
      data: {
        staffId: "staff_alice",
        schoolId: schoolNorth,
        trainingTypeId: "tt_safeguarding",
        issuedAt: ts("2025-12-01T00:00:00.000Z"),
        expiresAt: ts("2026-12-01T00:00:00.000Z"),
        provider: "EduSafe UK",
        notes: "Annual refresher",
        createdBy: "seed-script",
        createdAt,
        updatedAt,
        status: "valid",
        daysToExpiry: 290,
      },
    },
    {
      id: "rec_alice_fire",
      data: {
        staffId: "staff_alice",
        schoolId: schoolNorth,
        trainingTypeId: "tt_fire_safety",
        issuedAt: ts("2025-02-20T00:00:00.000Z"),
        expiresAt: ts("2026-02-20T00:00:00.000Z"),
        provider: "SafeCampus",
        notes: "Due soon",
        createdBy: "seed-script",
        createdAt,
        updatedAt,
        status: "expiring",
        daysToExpiry: 5,
      },
    },
    {
      id: "rec_ben_safe",
      data: {
        staffId: "staff_ben",
        schoolId: schoolNorth,
        trainingTypeId: "tt_safeguarding",
        issuedAt: ts("2024-01-10T00:00:00.000Z"),
        expiresAt: ts("2025-01-10T00:00:00.000Z"),
        provider: "EduSafe UK",
        notes: "Expired record",
        createdBy: "seed-script",
        createdAt,
        updatedAt,
        status: "expired",
        daysToExpiry: -401,
      },
    },
    {
      id: "rec_ben_firstaid",
      data: {
        staffId: "staff_ben",
        schoolId: schoolNorth,
        trainingTypeId: "tt_first_aid",
        issuedAt: ts("2025-01-15T00:00:00.000Z"),
        expiresAt: ts("2028-01-15T00:00:00.000Z"),
        provider: "St John",
        notes: "Current",
        createdBy: "seed-script",
        createdAt,
        updatedAt,
        status: "valid",
        daysToExpiry: 699,
      },
    },
    {
      id: "rec_chloe_safe",
      data: {
        staffId: "staff_chloe",
        schoolId: schoolSouth,
        trainingTypeId: "tt_safeguarding",
        issuedAt: ts("2025-08-10T00:00:00.000Z"),
        expiresAt: ts("2026-08-10T00:00:00.000Z"),
        provider: "EduSafe UK",
        notes: "Current",
        createdBy: "seed-script",
        createdAt,
        updatedAt,
        status: "valid",
        daysToExpiry: 176,
      },
    },
    {
      id: "rec_chloe_firstaid",
      data: {
        staffId: "staff_chloe",
        schoolId: schoolSouth,
        trainingTypeId: "tt_first_aid",
        issuedAt: ts("2025-11-05T00:00:00.000Z"),
        expiresAt: ts("2028-11-05T00:00:00.000Z"),
        provider: "St John",
        notes: "Current",
        createdBy: "seed-script",
        createdAt,
        updatedAt,
        status: "valid",
        daysToExpiry: 994,
      },
    },
    {
      id: "rec_alice_firstaid",
      data: {
        staffId: "staff_alice",
        schoolId: schoolNorth,
        trainingTypeId: "tt_first_aid",
        issuedAt: ts("2025-09-01T00:00:00.000Z"),
        expiresAt: ts("2028-09-01T00:00:00.000Z"),
        provider: "St John",
        notes: "Current",
        createdBy: "seed-script",
        createdAt,
        updatedAt,
        status: "valid",
        daysToExpiry: 928,
      },
    },
    {
      id: "rec_chloe_fire",
      data: {
        staffId: "staff_chloe",
        schoolId: schoolSouth,
        trainingTypeId: "tt_fire_safety",
        issuedAt: ts("2025-10-15T00:00:00.000Z"),
        expiresAt: ts("2026-10-15T00:00:00.000Z"),
        provider: "SafeCampus",
        notes: "Current",
        createdBy: "seed-script",
        createdAt,
        updatedAt,
        status: "valid",
        daysToExpiry: 242,
      },
    },
    {
      id: "rec_dan_safe",
      data: {
        staffId: "staff_dan",
        schoolId: schoolSouth,
        trainingTypeId: "tt_safeguarding",
        issuedAt: ts("2025-07-01T00:00:00.000Z"),
        expiresAt: ts("2026-07-01T00:00:00.000Z"),
        provider: "EduSafe UK",
        notes: "Current",
        createdBy: "seed-script",
        createdAt,
        updatedAt,
        status: "valid",
        daysToExpiry: 136,
      },
    },
    {
      id: "rec_dan_firstaid",
      data: {
        staffId: "staff_dan",
        schoolId: schoolSouth,
        trainingTypeId: "tt_first_aid",
        issuedAt: ts("2025-06-10T00:00:00.000Z"),
        expiresAt: ts("2028-06-10T00:00:00.000Z"),
        provider: "St John",
        notes: "Current",
        createdBy: "seed-script",
        createdAt,
        updatedAt,
        status: "valid",
        daysToExpiry: 846,
      },
    },
    {
      id: "rec_dan_fire",
      data: {
        staffId: "staff_dan",
        schoolId: schoolSouth,
        trainingTypeId: "tt_fire_safety",
        issuedAt: ts("2025-09-20T00:00:00.000Z"),
        expiresAt: ts("2026-09-20T00:00:00.000Z"),
        provider: "SafeCampus",
        notes: "Current",
        createdBy: "seed-script",
        createdAt,
        updatedAt,
        status: "valid",
        daysToExpiry: 217,
      },
    },
  ];

  const auditLogs = [
    {
      id: "audit_seed_001",
      data: {
        actorUserId: "seed-script",
        action: "create",
        entityType: "trainingRecord",
        entityId: "rec_ben_safe",
        moduleId: MODULE_ID,
        createdAt: updatedAt,
        after: {
          status: "expired",
          staffId: "staff_ben",
        },
      },
    },
  ];

  return {
    org: {
      id: orgId,
      data: {
        name: "Staging Pilot Federation A",
        slug: "staging-pilot-fed-a",
        status: "active",
        createdAt,
        updatedAt,
      },
    },
    schools: [
      {
        id: schoolNorth,
        data: {
          name: "Northview Primary",
          code: "NVP",
          status: "active",
          createdAt,
          updatedAt,
        },
      },
      {
        id: schoolSouth,
        data: {
          name: "Southfield Primary",
          code: "SFP",
          status: "active",
          createdAt,
          updatedAt,
        },
      },
    ],
    users: [
      {
        id: "stg_org_admin_1",
        data: {
          uid: "stg_org_admin_1",
          fullName: "Olivia Morgan",
          email: "olivia.morgan@example.org",
          role: "org_admin",
          orgId,
          enabledModules: [MODULE_ID],
          isActive: true,
          createdAt,
          updatedAt,
        },
      },
      {
        id: "stg_school_admin_1",
        data: {
          uid: "stg_school_admin_1",
          fullName: "Noah Patel",
          email: "noah.patel@example.org",
          role: "school_admin",
          orgId,
          schoolIds: [schoolNorth],
          enabledModules: [MODULE_ID],
          isActive: true,
          createdAt,
          updatedAt,
        },
      },
      {
        id: "stg_viewer_1",
        data: {
          uid: "stg_viewer_1",
          fullName: "Ava Turner",
          email: "ava.turner@example.org",
          role: "viewer",
          orgId,
          schoolIds: [schoolSouth],
          enabledModules: [MODULE_ID],
          isActive: true,
          createdAt,
          updatedAt,
        },
      },
    ],
    staff,
    moduleTrainingTypes: trainingTypes,
    moduleTrainingRecords: trainingRecords,
    moduleAuditLogs: auditLogs,
    aggregates: [
      {
        id: "orgCompliance",
        data: {
          compliantCount: 2,
          expiringSoonCount: 1,
          nonCompliantCount: 1,
          lastCalculatedAt: calculatedAt,
          version: 1,
          source: "seed",
          seedVersion: SEED_VERSION,
        },
      },
      {
        id: `school_${schoolNorth}`,
        data: {
          compliantCount: 0,
          expiringSoonCount: 1,
          nonCompliantCount: 1,
          lastCalculatedAt: calculatedAt,
          version: 1,
          source: "seed",
          seedVersion: SEED_VERSION,
        },
      },
      {
        id: `school_${schoolSouth}`,
        data: {
          compliantCount: 2,
          expiringSoonCount: 0,
          nonCompliantCount: 0,
          lastCalculatedAt: calculatedAt,
          version: 1,
          source: "seed",
          seedVersion: SEED_VERSION,
        },
      },
    ],
    moduleHealth: {
      id: MODULE_ID,
      data: {
        state: "red",
        openRiskCount: 2,
        lastCalculatedAt: calculatedAt,
        summary: "1 non-compliant staff, 1 expiring soon",
        source: "seed",
        seedVersion: SEED_VERSION,
      },
    },
  };
}

async function setMany(db, docs, dryRun) {
  if (!docs.length) {
    return;
  }

  if (dryRun) {
    return;
  }

  let batch = db.batch();
  let count = 0;

  for (const item of docs) {
    batch.set(item.ref, item.data, { merge: true });
    count += 1;
    if (count >= 400) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }
}

async function run() {
  loadLocalEnv();
  const args = parseArgs(process.argv.slice(2));
  initAdmin();

  const db = getFirestore();
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "unknown";
  const payload = dataset(args.orgId);

  const docs = [];
  const orgBase = `organisations/${payload.org.id}`;

  docs.push({ ref: db.doc(orgBase), data: payload.org.data });

  for (const school of payload.schools) {
    docs.push({
      ref: db.doc(`${orgBase}/schools/${school.id}`),
      data: school.data,
    });
  }

  for (const user of payload.users) {
    docs.push({
      ref: db.doc(`${orgBase}/users/${user.id}`),
      data: user.data,
    });
  }

  for (const person of payload.staff) {
    docs.push({
      ref: db.doc(`${orgBase}/staff/${person.id}`),
      data: person.data,
    });
  }

  for (const tt of payload.moduleTrainingTypes) {
    docs.push({
      ref: db.doc(`${orgBase}/modules/${MODULE_ID}/trainingTypes/${tt.id}`),
      data: tt.data,
    });
  }

  for (const tr of payload.moduleTrainingRecords) {
    docs.push({
      ref: db.doc(`${orgBase}/modules/${MODULE_ID}/trainingRecords/${tr.id}`),
      data: tr.data,
    });
  }

  for (const log of payload.moduleAuditLogs) {
    docs.push({
      ref: db.doc(`${orgBase}/modules/${MODULE_ID}/auditLogs/${log.id}`),
      data: log.data,
    });
  }

  for (const agg of payload.aggregates) {
    docs.push({
      ref: db.doc(`${orgBase}/aggregates/${agg.id}`),
      data: agg.data,
    });
  }

  docs.push({
    ref: db.doc(`${orgBase}/moduleHealth/${payload.moduleHealth.id}`),
    data: payload.moduleHealth.data,
  });

  await setMany(db, docs, args.dryRun);

  const summary = {
    version: SEED_VERSION,
    projectId,
    dryRun: args.dryRun,
    orgId: payload.org.id,
    totals: {
      docsPrepared: docs.length,
      schools: payload.schools.length,
      users: payload.users.length,
      staff: payload.staff.length,
      trainingTypes: payload.moduleTrainingTypes.length,
      trainingRecords: payload.moduleTrainingRecords.length,
      auditLogs: payload.moduleAuditLogs.length,
      aggregates: payload.aggregates.length,
      moduleHealth: 1,
    },
    writtenAt: new Date().toISOString(),
  };

  const reportsDir = path.join(process.cwd(), "docs", "migration-reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  const file = `staging-seed-${new Date().toISOString().replaceAll(":", "").replaceAll(".", "").replace("T", "-").replace("Z", "")}.json`;
  const reportPath = path.join(reportsDir, file);
  fs.writeFileSync(reportPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log(`[trainingTrack staging seed] project=${projectId} org=${payload.org.id} dryRun=${args.dryRun}`);
  console.log(`[trainingTrack staging seed] wrote ${docs.length} docs`);
  console.log(`[trainingTrack staging seed] report=${path.relative(process.cwd(), reportPath)}`);
}

run().catch((error) => {
  console.error("[trainingTrack staging seed] failed:", error);
  process.exitCode = 1;
});
