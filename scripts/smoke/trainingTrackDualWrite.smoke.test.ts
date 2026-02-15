import { describe, expect, it } from "vitest";

describe("TrainingTrack write/read smoke", () => {
  it("writes module records only (legacy retired)", async () => {
    process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? "schooltrack-dev";
    process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
    process.env.FF_TRAININGTRACK_DUAL_WRITE = "false";
    process.env.FF_TRAININGTRACK_READ_FROM_MODULES = "true";
    process.env.FF_TRAININGTRACK_LEGACY_WRITE_DISABLED = "true";

    const orgId = "smokeOrgA";
    const recordId = `smoke_record_${Date.now()}`;

    const { upsertTrainingTrackRecord } = await import("@/lib/modules/trainingTrack/trainingRecords");
    const { adminDb } = await import("@/lib/firebase/admin");

    const result = await upsertTrainingTrackRecord(orgId, recordId, {
      staffId: "st1",
      schoolId: "s1",
      trainingTypeId: "tt1",
      createdBy: "smokeTest",
      provider: "smoke",
      notes: "module only smoke",
      status: "valid",
      daysToExpiry: 100,
    });

    expect(result.readMode).toBe("module");
    expect(result.writeTargets.sort()).toEqual(["module"]);
    expect(result.skippedByIdempotency).toBe(false);

    const legacyRef = adminDb.doc(`organisations/${orgId}/trainingRecords/${recordId}`);
    const moduleRef = adminDb.doc(
      `organisations/${orgId}/modules/trainingTrack/trainingRecords/${recordId}`,
    );

    const [legacySnap, moduleSnap] = await Promise.all([legacyRef.get(), moduleRef.get()]);

    expect(legacySnap.exists).toBe(false);
    expect(moduleSnap.exists).toBe(true);
    expect(moduleSnap.data()?.staffId).toBe("st1");
  });

  it("skips replay when idempotencyKey is reused", async () => {
    process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? "schooltrack-dev";
    process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
    process.env.FF_TRAININGTRACK_DUAL_WRITE = "false";
    process.env.FF_TRAININGTRACK_READ_FROM_MODULES = "true";
    process.env.FF_TRAININGTRACK_LEGACY_WRITE_DISABLED = "true";

    const orgId = "smokeOrgA";
    const recordId = `smoke_record_idem_${Date.now()}`;
    const idempotencyKey = `idem_${recordId}`;

    const { upsertTrainingTrackRecord } = await import("@/lib/modules/trainingTrack/trainingRecords");
    const { adminDb } = await import("@/lib/firebase/admin");

    const first = await upsertTrainingTrackRecord(
      orgId,
      recordId,
      {
        staffId: "st1",
        schoolId: "s1",
        trainingTypeId: "tt1",
        createdBy: "smokeTest",
        provider: "first-write",
        notes: "first",
        status: "valid",
        daysToExpiry: 90,
      },
      {
        idempotencyKey,
        source: "idempotency-smoke",
      },
    );

    expect(first.skippedByIdempotency).toBe(false);

    const second = await upsertTrainingTrackRecord(
      orgId,
      recordId,
      {
        staffId: "st1",
        schoolId: "s1",
        trainingTypeId: "tt1",
        createdBy: "smokeTest",
        provider: "second-write-should-not-apply",
        notes: "second",
        status: "expired",
        daysToExpiry: 0,
      },
      {
        idempotencyKey,
        source: "idempotency-smoke",
      },
    );

    expect(second.skippedByIdempotency).toBe(true);
    expect(second.writeTargets.sort()).toEqual(["module"]);

    const legacyRef = adminDb.doc(`organisations/${orgId}/trainingRecords/${recordId}`);
    const moduleRef = adminDb.doc(
      `organisations/${orgId}/modules/trainingTrack/trainingRecords/${recordId}`,
    );

    const [legacySnap, moduleSnap] = await Promise.all([legacyRef.get(), moduleRef.get()]);

    expect(legacySnap.exists).toBe(false);
    expect(moduleSnap.exists).toBe(true);
    expect(moduleSnap.data()?.provider).toBe("first-write");
    expect(moduleSnap.data()?.status).toBe("valid");
  });

  it("reads from module path when read cutover flag is enabled", async () => {
    process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? "schooltrack-dev";
    process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
    process.env.FF_TRAININGTRACK_DUAL_WRITE = "false";
    process.env.FF_TRAININGTRACK_READ_FROM_MODULES = "true";
    process.env.FF_TRAININGTRACK_LEGACY_WRITE_DISABLED = "true";

    const orgId = "smokeOrgA";
    const recordId = `smoke_record_read_cutover_${Date.now()}`;

    const { adminDb } = await import("@/lib/firebase/admin");
    const { getTrainingTrackRecord } = await import("@/lib/modules/trainingTrack/trainingRecords");

    await adminDb.doc(`organisations/${orgId}/trainingRecords/${recordId}`).set({
      staffId: "st1",
      schoolId: "s1",
      trainingTypeId: "tt1",
      provider: "legacy-provider",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await adminDb.doc(`organisations/${orgId}/modules/trainingTrack/trainingRecords/${recordId}`).set({
      staffId: "st1",
      schoolId: "s1",
      trainingTypeId: "tt1",
      provider: "module-provider",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await getTrainingTrackRecord(orgId, recordId);

    expect(result.mode).toBe("module");
    expect(result.exists).toBe(true);
    expect(result.data?.provider).toBe("module-provider");
  });
});
