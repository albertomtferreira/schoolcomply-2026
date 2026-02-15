#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const MIGRATION_VERSION = "2026-02-trainingtrack-modules-v1";
const MODULE_ID = "trainingTrack";
const TRAINING_AUDIT_ENTITY_TYPES = new Set(["trainingRecord", "trainingType"]);

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
    dryRun: false,
    orgId: undefined,
    sampleSize: 10,
    limit: undefined,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }

    if (token === "--org") {
      args.orgId = argv[i + 1];
      i += 1;
      continue;
    }

    if (token === "--sample-size") {
      const parsed = Number.parseInt(argv[i + 1] ?? "", 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        args.sampleSize = parsed;
      }
      i += 1;
      continue;
    }

    if (token === "--limit") {
      const parsed = Number.parseInt(argv[i + 1] ?? "", 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        args.limit = parsed;
      }
      i += 1;
      continue;
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

function legacyCollectionPath(orgId, collection) {
  return `organisations/${orgId}/${collection}`;
}

function moduleCollectionPath(orgId, collection) {
  return `organisations/${orgId}/modules/${MODULE_ID}/${collection}`;
}

function shouldMigrateAuditLog(data) {
  if (!data || typeof data !== "object") {
    return false;
  }
  return TRAINING_AUDIT_ENTITY_TYPES.has(data.entityType);
}

function pickSample(items, sampleSize) {
  if (items.length <= sampleSize) {
    return items;
  }

  const step = items.length / sampleSize;
  const sample = [];
  for (let i = 0; i < sampleSize; i += 1) {
    sample.push(items[Math.floor(i * step)]);
  }
  return sample;
}

function sourceSubsetMatchesTarget(sourceData, targetData) {
  if (!sourceData || !targetData) {
    return false;
  }

  for (const [key, value] of Object.entries(sourceData)) {
    const targetValue = targetData[key];
    if (JSON.stringify(targetValue) !== JSON.stringify(value)) {
      return false;
    }
  }
  return true;
}

async function getOrgIds(db, orgId) {
  if (orgId) {
    return [orgId];
  }

  const snap = await db.collection("organisations").get();
  return snap.docs.map((doc) => doc.id);
}

async function migrateCollection({
  db,
  orgId,
  collection,
  dryRun,
  sampleSize,
  limit,
  filterFn,
}) {
  const sourceRef = db.collection(legacyCollectionPath(orgId, collection));
  const targetRef = db.collection(moduleCollectionPath(orgId, collection));

  let sourceSnap = await sourceRef.get();
  let sourceDocs = sourceSnap.docs;

  if (typeof filterFn === "function") {
    sourceDocs = sourceDocs.filter((doc) => filterFn(doc.data()));
  }

  if (typeof limit === "number") {
    sourceDocs = sourceDocs.slice(0, limit);
  }

  let writeCount = 0;
  if (!dryRun) {
    let batch = db.batch();
    let batchCount = 0;
    const now = FieldValue.serverTimestamp();

    for (const sourceDoc of sourceDocs) {
      const targetDocRef = targetRef.doc(sourceDoc.id);
      batch.set(
        targetDocRef,
        {
          ...sourceDoc.data(),
          migrationMeta: {
            version: MIGRATION_VERSION,
            sourcePath: sourceDoc.ref.path,
            migratedAt: now,
          },
        },
        { merge: true },
      );
      batchCount += 1;
      writeCount += 1;

      if (batchCount >= 400) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }
  }

  const targetSnap = await targetRef.get();
  const targetById = new Map(targetSnap.docs.map((doc) => [doc.id, doc]));

  let missingTargetCount = 0;
  for (const sourceDoc of sourceDocs) {
    if (!targetById.has(sourceDoc.id)) {
      missingTargetCount += 1;
    }
  }

  const sampleDocs = pickSample(sourceDocs, sampleSize);
  let sampleMismatchCount = 0;

  for (const sourceDoc of sampleDocs) {
    const targetDoc = targetById.get(sourceDoc.id);
    if (!targetDoc) {
      sampleMismatchCount += 1;
      continue;
    }

    if (!sourceSubsetMatchesTarget(sourceDoc.data(), targetDoc.data())) {
      sampleMismatchCount += 1;
    }
  }

  return {
    collection,
    sourcePath: sourceRef.path,
    targetPath: targetRef.path,
    sourceCount: sourceDocs.length,
    targetCount: targetSnap.size,
    writeCount,
    missingTargetCount,
    sampleChecked: sampleDocs.length,
    sampleMismatchCount,
  };
}

async function run() {
  loadLocalEnv();

  const args = parseArgs(process.argv.slice(2));
  initAdmin();
  const db = getFirestore();

  const orgIds = await getOrgIds(db, args.orgId);
  const report = {
    migrationVersion: MIGRATION_VERSION,
    moduleId: MODULE_ID,
    dryRun: args.dryRun,
    orgCount: orgIds.length,
    orgs: [],
    startedAt: new Date().toISOString(),
  };

  for (const orgId of orgIds) {
    const orgReport = {
      orgId,
      collections: [],
      totals: {
        sourceCount: 0,
        writeCount: 0,
        missingTargetCount: 0,
        sampleMismatchCount: 0,
      },
    };

    const trainingTypes = await migrateCollection({
      db,
      orgId,
      collection: "trainingTypes",
      dryRun: args.dryRun,
      sampleSize: args.sampleSize,
      limit: args.limit,
    });

    const trainingRecords = await migrateCollection({
      db,
      orgId,
      collection: "trainingRecords",
      dryRun: args.dryRun,
      sampleSize: args.sampleSize,
      limit: args.limit,
    });

    const auditLogs = await migrateCollection({
      db,
      orgId,
      collection: "auditLogs",
      dryRun: args.dryRun,
      sampleSize: args.sampleSize,
      limit: args.limit,
      filterFn: shouldMigrateAuditLog,
    });

    orgReport.collections.push(trainingTypes, trainingRecords, auditLogs);

    for (const c of orgReport.collections) {
      orgReport.totals.sourceCount += c.sourceCount;
      orgReport.totals.writeCount += c.writeCount;
      orgReport.totals.missingTargetCount += c.missingTargetCount;
      orgReport.totals.sampleMismatchCount += c.sampleMismatchCount;
    }

    report.orgs.push(orgReport);
  }

  report.finishedAt = new Date().toISOString();

  const hasParityIssues = report.orgs.some(
    (org) => org.totals.missingTargetCount > 0 || org.totals.sampleMismatchCount > 0,
  );

  console.log(JSON.stringify(report, null, 2));

  if (!args.dryRun && hasParityIssues) {
    process.exitCode = 2;
  }
}

run().catch((error) => {
  console.error("[trainingTrack backfill] failed:", error);
  process.exitCode = 1;
});
