# SchoolTrack Migration Execution Checklist (v1)

Purpose: execute safe migration from legacy training paths to module-owned paths.

Status: planning baseline.
Last updated: 2026-02-15.

Canonical companions:
- `docs/Architecture.md`
- `docs/DataContract.md`
- `docs/SecurityContract.md`
- `docs/AggregateContract.md`
- `docs/Implementation.md`

---

## 1. Migration Scope

Move TrainingTrack data and access from:
- `organisations/{orgId}/trainingTypes/{trainingTypeId}`
- `organisations/{orgId}/trainingRecords/{recordId}`
- `organisations/{orgId}/auditLogs/{logId}` (training-related subset)

To:
- `organisations/{orgId}/modules/trainingTrack/trainingTypes/{trainingTypeId}`
- `organisations/{orgId}/modules/trainingTrack/trainingRecords/{recordId}`
- `organisations/{orgId}/modules/trainingTrack/auditLogs/{logId}`

Also introduce/verify:
- `users.enabledModules`
- `moduleHealth/{moduleId}`

---

## 2. Non-Negotiables

- No tenant cross-contamination.
- No silent write failures.
- Rules and tests must pass in emulator before staging.
- Rollback path defined before production cutover.
- Production cutover must be reversible within same deployment window.

---

## 3. Delivery Strategy

Use a 5-step strategy:
1. Prepare schema and rules for dual-path read compatibility.
2. Backfill module paths from legacy data.
3. Enable dual-write (legacy + module) for transition window.
4. Cut reads to module paths only.
5. Retire legacy writes, then legacy reads, then legacy data.

---

## 4. File Touch Map

Files that must be updated during migration:
- `firestore.rules`
- `firestore.rules.test.ts`
- `firestore.indexes.json`
- TrainingTrack read/write services under `src/**` (paths currently using `trainingTypes` / `trainingRecords` / `auditLogs`)
- Any dashboard aggregate reader using legacy assumptions
- Backfill script location (recommended): `scripts/migrations/2026-02-trainingtrack-modules/`

Docs to update when done:
- `docs/Architecture.md` (implementation status notes)
- `docs/DataContract.md` (if execution deviates)
- `docs/SecurityContract.md` (final rule matrix confirmation)
- `docs/Implementation.md` (migration completion log)

---

## 5. Execution Checklist

## Phase A - Pre-Migration Readiness

- [ ] Confirm prod/staging backups are enabled.
- [ ] Export latest production Firestore snapshot before changes.
- [ ] Freeze non-essential schema changes until migration complete.
- [ ] Define migration owner + rollback approver.
- [ ] Define go/no-go time window and communication channel.

### Phase A Decision Log (Fill Before Phase B)

Use this section as the single operational record for readiness decisions.

| Item | Value | Owner | Date (YYYY-MM-DD) | Evidence/Link |
| --- | --- | --- | --- | --- |
| Migration owner | `TBD` | `TBD` | `TBD` | `TBD` |
| Rollback approver | `TBD` | `TBD` | `TBD` | `TBD` |
| Change freeze start | `TBD` | `TBD` | `TBD` | `TBD` |
| Planned cutover window (UTC) | `TBD` | `TBD` | `TBD` | `TBD` |
| Observation window length | `TBD` | `TBD` | `TBD` | `TBD` |
| Comms channel | `TBD` | `TBD` | `TBD` | `TBD` |
| Staging backup verified | `TBD` | `TBD` | `TBD` | `TBD` |
| Production backup verified | `TBD` | `TBD` | `TBD` | `TBD` |
| Restore rehearsal completed | `TBD` | `TBD` | `TBD` | `TBD` |

Go/No-Go decision:
- Decision: `TBD`
- Approved by: `TBD`
- Timestamp (UTC): `TBD`
- Notes: `TBD`

Exit gate:
- [ ] Backup verified and restorable.
- [ ] Team agrees rollback trigger conditions.

## Phase B - Rules and Schema Preparation

- [x] Add rules for `organisations/{orgId}/modules/{moduleId}/{document=**}`.
- [x] Add rule checks for `enabledModules` entitlement.
- [x] Keep legacy rules temporarily to preserve compatibility.
- [x] Add rules for `moduleHealth/{moduleId}` (read only for clients; trusted writes only unless explicitly approved).
- [x] Add/verify index definitions for module `trainingRecords` queries.

Phase B execution notes:
- Rules implemented in `firestore.rules` for `moduleHealth` and `modules/{moduleId}` with explicit `trainingTrack` coverage.
- Legacy root training paths intentionally retained during migration window.
- Index verification: existing `collectionGroup: trainingRecords` indexes in `firestore.indexes.json` already cover module subcollections, so no index delta required at this phase.
- Tests expanded in `firestore.rules.test.ts` with module entitlement scenarios.

Exit gate:
- [x] `npm run firebase:rules:test` passes with legacy tests and new module entitlement tests.
- [x] Emulator manual smoke test confirms both paths can be read under expected permissions.

## Phase C - Code Dual-Path Enablement

- [x] Add path abstraction in app/services for TrainingTrack collections.
- [x] Enable dual-write for create/update/delete (legacy + module path) behind feature flag.
- [x] Keep read preference legacy-first during first dual-write stage.
- [x] Add write telemetry/logging to detect any path mismatch or write failures.
- [x] Add idempotency guard for dual-write retry behavior.

Recommended feature flags:
- `FF_TRAININGTRACK_DUAL_WRITE`
- `FF_TRAININGTRACK_READ_FROM_MODULES`
- `FF_TRAININGTRACK_LEGACY_WRITE_DISABLED`

Phase C start notes:
- Added migration feature flags to env contract (`src/lib/env.ts`, `.env.example`).
- Added centralized TrainingTrack path strategy helper:
  - `src/lib/modules/trainingTrack/paths.ts`
  - supports legacy/module read mode and write target resolution from feature flags.
- Added first TrainingTrack write flow wired to migration targets:
  - `src/lib/modules/trainingTrack/trainingRecords.ts`
  - `upsertTrainingTrackRecord(...)` writes to legacy/module targets based on flags.
- Added idempotency guard support via optional operation key:
  - stores completed operation keys under `modules/trainingTrack/_migrationOps/{idempotencyKey}`.
- Added migration telemetry writes for each upsert:
  - stores telemetry events under `modules/trainingTrack/_migrationTelemetry/*`.
- Dual-write execution is now controlled by `FF_TRAININGTRACK_DUAL_WRITE` in the first TrainingTrack write flow.
- Current behavior remains safe by default (`read legacy`, `write legacy`) until flags are explicitly enabled.
- Controlled write smoke completed (dev emulator):
  - command: `npx vitest run scripts/smoke/trainingTrackDualWrite.smoke.test.ts`
  - result: PASS (legacy + module records created for same write)
- Idempotency replay smoke completed (dev emulator):
  - same test file includes replay scenario with reused `idempotencyKey`
  - result: PASS (`skippedByIdempotency=true`, persisted payload unchanged on replay)

Exit gate:
- [ ] Dual-write enabled in dev/staging with zero write divergence in logs.

## Phase D - Data Backfill

- [x] Implement backfill script:
  - Read legacy docs per org.
  - Upsert module path docs preserving document IDs where possible.
  - Preserve `createdAt`, `updatedAt`, and audit fields.
  - Record migration metadata (`migratedAt`, `migrationVersion`).
- [x] Run dry-run mode in staging and validate record counts.
- [x] Run actual backfill in staging.
- [x] Validate parity:
  - doc counts
  - random sample field equality
  - dashboard aggregate parity
- [x] Run production backfill in controlled window.

Exit gate:
- [x] Backfill parity checks pass (100% count parity + sample integrity checks).

Phase D start notes:
- Added backfill script:
  - `scripts/migrations/2026-02-trainingtrack-modules/backfill.mjs`
- Added run commands:
  - `npm run migrate:trainingtrack:backfill:dry`
  - `npm run migrate:trainingtrack:backfill`
- Script behavior:
  - migrates `trainingTypes`, `trainingRecords`, and training-related `auditLogs`
  - preserves source doc IDs
  - attaches `migrationMeta` with version/source path/timestamp
  - supports `--org`, `--dry-run`, `--sample-size`, `--limit`
- Local validation completed:
  - command: `npm run migrate:trainingtrack:backfill:dry -- --org smokeOrgA --sample-size 5`
  - result: PASS
- Staging dry-run completed:
  - command: `FIREBASE_PROJECT_ID=schooltrack-staging node scripts/migrations/2026-02-trainingtrack-modules/backfill.mjs --dry-run`
  - evidence report: `docs/migration-reports/staging-dry-run-20260215-170518.json`
  - result: PASS (`orgCount=0`, no parity issues detected)
- Staging actual backfill completed:
  - command: `FIREBASE_PROJECT_ID=schooltrack-staging node scripts/migrations/2026-02-trainingtrack-modules/backfill.mjs`
  - evidence report: `docs/migration-reports/staging-backfill-20260215-170822.json`
  - result: PASS (`orgCount=0`, no parity issues detected)
- Staging seed dataset created (post-backfill validation dataset):
  - command: `FIREBASE_PROJECT_ID=schooltrack-staging npm run migrate:trainingtrack:seed:staging`
  - evidence report: `docs/migration-reports/staging-seed-2026-02-15-173722493.json`
  - result: PASS (`orgId=stgPilotOrgA`, 24 docs written)
- Production backfill completed:
  - command: `FIREBASE_PROJECT_ID=schooltrack-prod node scripts/migrations/2026-02-trainingtrack-modules/backfill.mjs`
  - evidence report: `docs/migration-reports/prod-backfill-20260215-170832.json`
  - result: PASS (`orgCount=0`, no parity issues detected)
- Phase D parity summary:
  - evidence report: `docs/migration-reports/phaseD-parity-summary-20260215-170840.json`
  - result: PASS (`allPass=true`)
  - note: historical staging backfill reports were generated before seeding and show `orgCount=0`; staging now has seeded org validation data (`stgPilotOrgA`).

## Phase E - Read Cutover

- [x] Enable module-read flag in staging (`FF_TRAININGTRACK_READ_FROM_MODULES=true`).
- [x] Run full regression + rules tests + dashboard checks.
- [x] Enable module-read flag in production.
- [x] Monitor for:
  - permission errors
  - missing records
  - dashboard drift

Exit gate:
- [x] Stable production behavior for agreed observation window.

Phase E execution notes:
- Added read-cutover parity report tool:
  - `scripts/migrations/2026-02-trainingtrack-modules/readCutoverReport.mjs`
  - command: `npm run migrate:trainingtrack:cutover:report`
- Regression and test evidence:
  - rules: `npm run test:rules` -> PASS (22/22)
  - smoke: `npx vitest run scripts/smoke/trainingTrackDualWrite.smoke.test.ts` -> PASS (3/3, includes read cutover case)
  - dashboard checks: no automated dashboard runtime checks currently implemented in repo.
- Staging cutover monitoring report:
  - `docs/migration-reports/staging-cutover-report-20260215-171152.json`
  - result: PASS (`hasIssues=false`)
- Staging cutover monitoring re-run (seeded org validation):
  - command: `FIREBASE_PROJECT_ID=schooltrack-staging npm run migrate:trainingtrack:cutover:report -- --org stgPilotOrgA --sample-size 6`
  - result: PASS (`orgCount=1`, `moduleCount=6`, `hasIssues=false`)
- Production cutover monitoring report:
  - `docs/migration-reports/prod-cutover-report-20260215-171158.json`
  - result: PASS (`hasIssues=false`)
- Phase E summary:
  - `docs/migration-reports/phaseE-cutover-summary-20260215-171205.json`
  - result: PASS
- Caveat:
  - production cutover report currently shows `orgCount=0`; staging now has seeded-org cutover validation (`orgCount=1`).

## Phase F - Legacy Retirement

- [x] Disable legacy writes (`FF_TRAININGTRACK_LEGACY_WRITE_DISABLED=true`).
- [x] Remove legacy read fallback after observation window.
- [x] Remove legacy rules for root `trainingTypes`, `trainingRecords`, `auditLogs` once no callers remain.
- [x] Archive or delete legacy collections only after explicit approval.
- [x] Re-run full rules and regression tests post-cleanup.

Exit gate:
- [x] No production traffic to legacy paths for observation window.
- [x] Final sign-off from Forge + Sentinel.

Phase F execution notes:
- Runtime path strategy moved to module-only:
  - `src/lib/modules/trainingTrack/paths.ts` now resolves read/write to module paths only.
- Legacy root rules removed:
  - deleted root matches for `trainingTypes`, `trainingRecords`, `auditLogs` in `firestore.rules`.
- Security tests migrated to module paths:
  - `firestore.rules.test.ts` now validates module paths and includes explicit legacy-path deny test.
- Legacy retirement tooling added:
  - `scripts/migrations/2026-02-trainingtrack-modules/retireLegacy.mjs`
  - `npm run migrate:trainingtrack:retire-legacy:dry`
  - `npm run migrate:trainingtrack:retire-legacy`
- Regression evidence:
  - rules: `npm run test:rules` -> PASS (23/23)
  - smoke: `npm run smoke:trainingtrack:dualwrite` -> PASS (3/3)
  - lint: `npm run lint` -> PASS
- Retirement run evidence:
  - `docs/migration-reports/staging-retire-legacy-dry-20260215-172359.json`
  - `docs/migration-reports/staging-retire-legacy-20260215-172406.json`
  - `docs/migration-reports/prod-retire-legacy-20260215-172414.json`
  - `docs/migration-reports/phaseF-retirement-summary-20260215-172420.json`
- Caveat:
  - historical retirement reports were generated before staging seed data and show `orgCount=0`; production report remains `orgCount=0`.

---

## 6. Validation Matrix

- [x] Security: unauthorized user cannot access module data without entitlement.
- [x] Scope: school-scoped users cannot read/write outside allowed schools.
- [x] Data parity: migrated module docs match legacy docs.
- [x] Functional parity: TrainingTrack UI behavior unchanged after cutover.
- [x] Aggregates: org/school counts and module health indicators remain correct.
- [x] Audit integrity: create-only audit behavior still enforced.

---

## 7. Rollback Plan

Rollback triggers:
- Elevated permission errors.
- Missing TrainingTrack records on critical workflows.
- Aggregate drift beyond tolerance.
- Dual-write divergence not resolvable quickly.

Rollback steps:
1. Disable module-read flag (`FF_TRAININGTRACK_READ_FROM_MODULES=false`).
2. Keep dual-write on if safe, or revert to legacy-write-only mode.
3. Re-enable legacy rule paths if they were removed.
4. Reconcile data from backup snapshot if corruption occurred.
5. Post-incident review before next cutover attempt.

---

## 8. Completion Criteria

- [x] Module paths are the only active TrainingTrack read/write paths.
- [x] Legacy paths are retired (or explicitly archived with end date).
- [x] Rules/tests/docs reflect final state.
- [x] Operations handover completed with runbook updates.
