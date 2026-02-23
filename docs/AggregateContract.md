# Aggregate Contract (Restart v1)

Purpose: define deterministic aggregate and module-health update logic for restart architecture.

Status: approved baseline for rebuild.
Last updated: 2026-02-15.

Canonical companions:

- `docs/Architecture.md`
- `docs/ComplianceDecisionTable.md`
- `docs/DataContract.md`

---

## 1. Aggregate Documents

Shared aggregate paths:

- `orgs/{orgId}/aggregates/orgCompliance`
- `orgs/{orgId}/aggregates/school_{schoolId}`

Module health path:

- `orgs/{orgId}/moduleHealth/{moduleId}`

### Shared aggregate required fields

- `compliantCount: number`
- `nonCompliantCount: number`
- `expiringSoonCount: number`
- `lastCalculatedAt: Timestamp`

### Module health required fields

- `state: 'green' | 'amber' | 'red' | 'grey'`
- `openRiskCount: number`
- `lastCalculatedAt: Timestamp`

Optional operational fields:

- `version: number`
- `source: 'delta' | 'reconciliation'`

---

## 2. Source States and Mapping

TrainingTrack staff state set:

- `compliant`
- `expiring_soon`
- `non_compliant`

Counter mapping:

- `compliant` -> `compliantCount +1`
- `expiring_soon` -> `expiringSoonCount +1`
- `non_compliant` -> `nonCompliantCount +1`

Module health mapping (TrainingTrack):

- `red` when `nonCompliantCount > 0`
- `amber` when `nonCompliantCount == 0` and `expiringSoonCount > 0`
- `green` when `nonCompliantCount == 0` and `expiringSoonCount == 0` and `compliantCount > 0`
- `grey` when no active scoped staff or data unavailable

---

## 3. Delta Update Contract (On Write)

### 3.1 Trigger Events

Run delta updates when:

- training record create/update/delete
- staff `isActive` change
- staff `schoolIds` change
- staff `employmentRole` change
- training type requirement change

### 3.2 Impact Scope

Compute impacted schools as union of:

- previous `staff.schoolIds`
- next `staff.schoolIds`

Always update:

- impacted school aggregates
- org aggregate
- module health (`moduleHealth/trainingTrack`)

### 3.3 Deterministic Delta Formula

For each impacted school:

1. Evaluate `oldStaffState` and `newStaffState`.
2. If unchanged, no counter mutation.
3. If changed, decrement old bucket and increment new bucket.
4. Update `lastCalculatedAt` and `version`.

Then:

- Org delta is sum of school deltas in same transaction boundary.
- Module health is recalculated from updated aggregate totals.

### 3.4 Write Strategy

- Use Firestore transaction per mutation batch.
- Use atomic increments for counters.
- Avoid recomputing unaffected schools.
- For high-fanout events, enqueue reconciliation mode.

---

## 4. Event Handling Rules

### 4.1 Training Record Create/Update/Delete

- Recompute targeted staff member.
- Update all linked school aggregates.
- Update org aggregate.
- Refresh `moduleHealth/trainingTrack`.

### 4.2 Staff Active Flag Change

- `true -> false`: remove contribution from linked school buckets.
- `false -> true`: add contribution from computed state.

### 4.3 Staff School Membership Change

- Removed school IDs: decrement old state in removed schools.
- Added school IDs: increment new state in added schools.
- Unchanged school IDs: apply state delta only if changed.

### 4.4 Staff Employment Role Change

- Recompute required set and state.
- Apply deltas to linked schools, org, and module health.

### 4.5 Training Type Requirement Change

- Scoped change: enqueue scoped recalculation.
- Broad change: mark org for reconciliation and avoid high-fanout transaction writes.

---

## 5. Reconciliation Contract

Schedule: nightly per org.

### 5.1 Reconciliation Steps

1. Load active staff per school.
2. Recompute staff states using canonical rules.
3. Rebuild school counters.
4. Rebuild org counters from school totals.
5. Recompute module health state and open risk count.
6. Upsert docs with `source='reconciliation'` and fresh `lastCalculatedAt`.

### 5.2 Drift Handling

Drift conditions:

- negative counter
- counter sum mismatch
- missing aggregate/module health doc

Response:

- trigger school-level rebuild
- trigger full org rebuild if repeated

---

## 6. Performance and Cost Controls

- Dashboard read path: shared aggregates.
- Sidebar indicator read path: `moduleHealth/*`.
- Delta read path: target staff + relevant training types + records.
- Write path: impacted school docs + org doc + module health doc.
- Batch large fanout operations via queue/worker.

---

## 7. Failure and Idempotency Rules

- Use deterministic idempotency key per event.
- Replay must not apply delta twice.
- Retry failed transaction with fresh read.
- Reconciliation is correction layer and must be idempotent.

---

## 8. Acceptance Tests

1. Training record update flips staff `compliant -> non_compliant` and updates school/org aggregates correctly.
2. Staff linked to 3 schools becomes `expiring_soon`; all 3 school aggregates update.
3. Staff deactivation removes contributions from counters.
4. Staff moved from school A to B updates both school docs correctly.
5. Reconciliation repairs corrupted counters.
6. Replay same event twice does not double-apply.
7. `moduleHealth/trainingTrack` turns red when non-compliant count > 0.
8. Sidebar indicator reads only module health docs in normal path.

---

## 9. Sign-Off Checklist

- Delta formula is deterministic and documented.
- Impact scope rules are explicit for all triggers.
- Module health computation is defined and testable.
- Reconciliation and drift response are defined.
- Cost controls and idempotency behavior are defined.
