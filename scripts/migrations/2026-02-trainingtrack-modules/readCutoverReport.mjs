#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const MODULE_ID = "trainingTrack";
const REPORT_VERSION = "2026-02-trainingtrack-read-cutover-v1";

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

function parseArgs(argv) {
  const args = {
    orgId: undefined,
    sampleSize: 10,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
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

async function getOrgIds(db, orgId) {
  if (orgId) {
    return [orgId];
  }
  const snap = await db.collection("organisations").get();
  return snap.docs.map((doc) => doc.id);
}

function stableSubset(data) {
  if (!data || typeof data !== "object") {
    return {};
  }
  const {
    staffId,
    schoolId,
    trainingTypeId,
    status,
    provider,
    notes,
    issuedAt,
    expiresAt,
    daysToExpiry,
    createdBy,
  } = data;

  return {
    staffId,
    schoolId,
    trainingTypeId,
    status,
    provider,
    notes,
    issuedAt,
    expiresAt,
    daysToExpiry,
    createdBy,
  };
}

async function run() {
  loadLocalEnv();
  const args = parseArgs(process.argv.slice(2));
  initAdmin();

  const db = getFirestore();
  const orgIds = await getOrgIds(db, args.orgId);

  const report = {
    reportVersion: REPORT_VERSION,
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "unknown",
    moduleId: MODULE_ID,
    orgCount: orgIds.length,
    orgs: [],
    startedAt: new Date().toISOString(),
  };

  for (const orgId of orgIds) {
    const legacySnap = await db.collection(`organisations/${orgId}/trainingRecords`).get();
    const moduleSnap = await db.collection(
      `organisations/${orgId}/modules/${MODULE_ID}/trainingRecords`,
    ).get();

    const legacyById = new Map(legacySnap.docs.map((d) => [d.id, d.data()]));
    const moduleById = new Map(moduleSnap.docs.map((d) => [d.id, d.data()]));

    const missingInModule = [];
    const moduleOnly = [];
    const commonIds = [];

    for (const legacyId of legacyById.keys()) {
      if (!moduleById.has(legacyId)) {
        missingInModule.push(legacyId);
      } else {
        commonIds.push(legacyId);
      }
    }

    for (const moduleId of moduleById.keys()) {
      if (!legacyById.has(moduleId)) {
        moduleOnly.push(moduleId);
      }
    }

    const sampleIds = pickSample(commonIds, args.sampleSize);
    let sampleMismatchCount = 0;

    for (const id of sampleIds) {
      const legacySubset = stableSubset(legacyById.get(id));
      const moduleSubset = stableSubset(moduleById.get(id));
      if (JSON.stringify(legacySubset) !== JSON.stringify(moduleSubset)) {
        sampleMismatchCount += 1;
      }
    }

    report.orgs.push({
      orgId,
      legacyCount: legacySnap.size,
      moduleCount: moduleSnap.size,
      missingInModuleCount: missingInModule.length,
      moduleOnlyCount: moduleOnly.length,
      sampleChecked: sampleIds.length,
      sampleMismatchCount,
    });
  }

  report.finishedAt = new Date().toISOString();
  report.hasIssues = report.orgs.some(
    (org) => org.missingInModuleCount > 0 || org.sampleMismatchCount > 0,
  );

  console.log(JSON.stringify(report, null, 2));
}

run().catch((error) => {
  console.error("[trainingTrack read cutover report] failed:", error);
  process.exitCode = 1;
});
