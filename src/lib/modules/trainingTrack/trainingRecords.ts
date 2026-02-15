import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase/admin";
import {
  getTrainingTrackDocumentPath,
  getTrainingTrackPathTargets,
  type TrainingTrackReadMode,
} from "@/lib/modules/trainingTrack/paths";

export type TrainingTrackRecordWriteInput = {
  staffId: string;
  schoolId: string;
  trainingTypeId: string;
  createdBy: string;
  issuedAt?: string | null;
  expiresAt?: string | null;
  provider?: string | null;
  certificateUrl?: string | null;
  notes?: string | null;
  status?: "valid" | "expiring" | "expired";
  daysToExpiry?: number;
};

export type TrainingTrackRecordWriteResult = {
  recordId: string;
  readMode: TrainingTrackReadMode;
  writeTargets: Array<TrainingTrackReadMode>;
  skippedByIdempotency: boolean;
};

export type TrainingTrackRecordReadResult = {
  recordId: string;
  mode: TrainingTrackReadMode;
  exists: boolean;
  data: Record<string, unknown> | null;
};

function uniqueModes(modes: Array<TrainingTrackReadMode>): Array<TrainingTrackReadMode> {
  return Array.from(new Set(modes));
}

function migrationOpsDocPath(orgId: string, idempotencyKey: string): string {
  return `organisations/${orgId}/modules/trainingTrack/_migrationOps/${idempotencyKey}`;
}

function migrationTelemetryCollectionPath(orgId: string): string {
  return `organisations/${orgId}/modules/trainingTrack/_migrationTelemetry`;
}

export type TrainingTrackRecordWriteOptions = {
  idempotencyKey?: string;
  source?: string;
};

export async function upsertTrainingTrackRecord(
  orgId: string,
  recordId: string,
  input: TrainingTrackRecordWriteInput,
  options?: TrainingTrackRecordWriteOptions,
): Promise<TrainingTrackRecordWriteResult> {
  const { readMode, writeTargets } = getTrainingTrackPathTargets();
  const targets = uniqueModes(writeTargets);
  const now = FieldValue.serverTimestamp();
  let skippedByIdempotency = false;

  await adminDb.runTransaction(async (tx) => {
    const targetRefs = targets.map((mode) => ({
      mode,
      ref: adminDb.doc(getTrainingTrackDocumentPath(orgId, "trainingRecords", recordId, mode)),
    }));

    if (options?.idempotencyKey) {
      const opRef = adminDb.doc(migrationOpsDocPath(orgId, options.idempotencyKey));
      const existingOp = await tx.get(opRef);
      if (existingOp.exists) {
        skippedByIdempotency = true;
        return;
      }
    }

    const existingSnapshots = await Promise.all(
      targetRefs.map(async ({ ref }) => ({
        ref,
        snap: await tx.get(ref),
      })),
    );

    for (const { ref, snap } of existingSnapshots) {
      const payload: Record<string, unknown> = {
        ...input,
        updatedAt: now,
      };

      if (!snap.exists) {
        payload.createdAt = now;
      }

      tx.set(ref, payload, { merge: true });
    }

    if (options?.idempotencyKey) {
      const opRef = adminDb.doc(migrationOpsDocPath(orgId, options.idempotencyKey));
      tx.set(opRef, {
        type: "trainingRecordsUpsert",
        recordId,
        readMode,
        writeTargets: targets,
        source: options.source ?? "unknown",
        completedAt: now,
      });
    }
  });

  // Lightweight migration telemetry to support divergence monitoring during Phase C.
  await adminDb.collection(migrationTelemetryCollectionPath(orgId)).doc().set({
    type: "trainingRecordsUpsert",
    recordId,
    readMode,
    writeTargets: targets,
    skippedByIdempotency,
    source: options?.source ?? "unknown",
    createdAt: now,
  });

  return {
    recordId,
    readMode,
    writeTargets: targets,
    skippedByIdempotency,
  };
}

export async function getTrainingTrackRecord(
  orgId: string,
  recordId: string,
): Promise<TrainingTrackRecordReadResult> {
  const { readMode } = getTrainingTrackPathTargets();
  const ref = adminDb.doc(getTrainingTrackDocumentPath(orgId, "trainingRecords", recordId, readMode));
  const snap = await ref.get();

  return {
    recordId,
    mode: readMode,
    exists: snap.exists,
    data: snap.exists ? (snap.data() ?? null) : null,
  };
}
