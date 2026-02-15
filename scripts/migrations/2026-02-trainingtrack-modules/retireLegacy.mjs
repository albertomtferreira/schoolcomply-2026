#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const MODULE_ID = "trainingTrack";
const RETIREMENT_VERSION = "2026-02-trainingtrack-legacy-retirement-v1";
const LEGACY_COLLECTIONS = ["trainingTypes", "trainingRecords", "auditLogs"];

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
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
    orgId: undefined,
    dryRun: false,
    archiveOnly: false,
    force: false,
    limit: undefined,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--org") {
      args.orgId = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (token === "--archive-only") {
      args.archiveOnly = true;
      continue;
    }
    if (token === "--force") {
      args.force = true;
      continue;
    }
    if (token === "--limit") {
      const parsed = Number.parseInt(argv[i + 1] ?? "", 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        args.limit = parsed;
      }
      i += 1;
    }
  }

  return args;
}

function initAdmin() {
  if (getApps().length) return getApps()[0];

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

async function getOrgIds(db, orgId) {
  if (orgId) return [orgId];
  const snap = await db.collection("organisations").get();
  return snap.docs.map((d) => d.id);
}

function archiveDocPath(orgId, collection, docId) {
  return `organisations/${orgId}/modules/${MODULE_ID}/_legacyArchive/${collection}/items/${docId}`;
}

async function processCollection({ db, orgId, collection, dryRun, archiveOnly, force, limit }) {
  const sourceRef = db.collection(`organisations/${orgId}/${collection}`);
  const snap = await sourceRef.get();
  let docs = snap.docs;
  if (typeof limit === "number") {
    docs = docs.slice(0, limit);
  }

  let archivedCount = 0;
  let deletedCount = 0;

  if (!dryRun) {
    let batch = db.batch();
    let batchCount = 0;
    const now = FieldValue.serverTimestamp();

    for (const docSnap of docs) {
      const archiveRef = db.doc(archiveDocPath(orgId, collection, docSnap.id));
      batch.set(
        archiveRef,
        {
          ...docSnap.data(),
          retirementMeta: {
            version: RETIREMENT_VERSION,
            sourcePath: docSnap.ref.path,
            archivedAt: now,
          },
        },
        { merge: true },
      );
      archivedCount += 1;
      batchCount += 1;

      if (!archiveOnly && force) {
        batch.delete(docSnap.ref);
        deletedCount += 1;
        batchCount += 1;
      }

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

  return {
    collection,
    sourceCount: docs.length,
    archivedCount,
    deletedCount,
  };
}

async function run() {
  loadLocalEnv();
  const args = parseArgs(process.argv.slice(2));
  if (!args.dryRun && !args.archiveOnly && !args.force) {
    throw new Error("Refusing to delete legacy docs without --force. Use --archive-only or --force.");
  }

  initAdmin();
  const db = getFirestore();
  const orgIds = await getOrgIds(db, args.orgId);

  const report = {
    version: RETIREMENT_VERSION,
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "unknown",
    dryRun: args.dryRun,
    archiveOnly: args.archiveOnly,
    forceDelete: args.force && !args.archiveOnly,
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
        archivedCount: 0,
        deletedCount: 0,
      },
    };

    for (const collection of LEGACY_COLLECTIONS) {
      const c = await processCollection({
        db,
        orgId,
        collection,
        dryRun: args.dryRun,
        archiveOnly: args.archiveOnly,
        force: args.force,
        limit: args.limit,
      });
      orgReport.collections.push(c);
      orgReport.totals.sourceCount += c.sourceCount;
      orgReport.totals.archivedCount += c.archivedCount;
      orgReport.totals.deletedCount += c.deletedCount;
    }

    report.orgs.push(orgReport);
  }

  report.finishedAt = new Date().toISOString();
  console.log(JSON.stringify(report, null, 2));
}

run().catch((error) => {
  console.error("[trainingTrack legacy retirement] failed:", error);
  process.exitCode = 1;
});
