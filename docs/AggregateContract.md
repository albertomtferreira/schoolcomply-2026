# Aggregate Contract (v1)

Purpose: define deterministic aggregate update logic and nightly reconciliation for compliance dashboards.

Status: Phase 0.4 baseline for MVP implementation.
Last updated: 2026-02-15.

Canonical companions:
- `docs/Architecture.md`
- `docs/ComplianceDecisionTable.md`
- `docs/DataContract.md`

---

## 1. Aggregate Documents

Paths:
- `organisations/{orgId}/aggregates/orgCompliance`
- `organisations/{orgId}/aggregates/school_{schoolId}`

Required fields:
- `compliantCount: number`
- `nonCompliantCount: number`
- `expiringSoonCount: number`
- `lastCalculatedAt: Timestamp`

Optional operational fields (recommended):
- `version: number` (increment on each aggregate write)
- `source: 'delta' | 'reconciliation'`

---

## 2. Source States and Mapping

Staff state set (from `docs/ComplianceDecisionTable.md`):
- `compliant`
- `expiring_soon`
- `non_compliant`
- `no_active_staff` is school-level only, not a staff state

Counter mapping per staff member:
- `compliant` -> `compliantCount +1`
- `expiring_soon` -> `expiringSoonCount +1`
- `non_compliant` -> `nonCompliantCount +1`

Invariant:
- For any school aggregate: `compliantCount + expiringSoonCount + nonCompliantCount == activeStaffCountInSchool`.

---

## 3. Delta Update Contract (On Write)

### 3.1 Trigger Events

Run delta updates when any of these events occurs:
- training record create/update/delete
- staff `isActive` change
- staff `schoolIds` change
- staff `employmentRole` change
- training type requirement change (`required`, `requiredForRoles`, `expires`)

### 3.2 Impact Scope

Compute impacted schools as union of:
- previous `staff.schoolIds` (if previous state exists)
- next `staff.schoolIds` (if next state exists)

Always include org aggregate for any impacted school change.

### 3.3 Deterministic Delta Formula

For each impacted school:
1. Evaluate `oldStaffState` (before event) and `newStaffState` (after event) for each impacted staff member.
2. If unchanged, no counter mutation.
3. If changed:
   - decrement old state bucket by 1
   - increment new state bucket by 1
4. Update `lastCalculatedAt` and increment `version`.

Org delta is sum of school deltas in the same transaction boundary.

### 3.4 Write Strategy

- Use Firestore transaction for each aggregate mutation batch.
- Use atomic increments for counters.
- Do not recompute unaffected schools.
- If event affects many staff (for example training type global change), switch to queued reconciliation mode.

---

## 4. Event Handling Rules

### 4.1 Training Record Create/Update/Delete

- Recompute only the targeted staff member.
- Update all schools in that staff member's `schoolIds`.
- Apply org delta from school deltas.

### 4.2 Staff Active Flag Change

- `true -> false`: remove staff contribution from each linked school bucket.
- `false -> true`: add staff contribution based on current computed state.

### 4.3 Staff School Membership Change

- Removed school IDs: decrement old state in removed schools.
- Added school IDs: increment new state in added schools.
- Unchanged school IDs: apply state delta only if state changed.

### 4.4 Staff Employment Role Change

- Recompute required training set and staff state.
- Apply delta to all linked schools.

### 4.5 Training Type Requirement Change

- If scope is narrow (single role or school subset), enqueue scoped recalculation job.
- If scope is broad (global requirement change), mark org for reconciliation run and avoid high-fanout transaction writes.

---

## 5. Nightly Reconciliation Contract

Schedule: once nightly per org (off-peak window).

### 5.1 Reconciliation Steps

1. Load active staff per school.
2. Recompute staff state using canonical rule contract.
3. Rebuild school counters from scratch.
4. Rebuild org counters as sum of school counters.
5. Upsert aggregate docs with `source='reconciliation'` and fresh `lastCalculatedAt`.
6. Log reconciliation summary in audit/ops logs.

### 5.2 Drift Handling

Drift condition:
- Any negative counter
- Counter sum mismatch against active staff count
- Missing aggregate doc for active school

Response:
- Immediately trigger school-level rebuild
- If repeated drift in same org, trigger full org rebuild and alert

---

## 6. Performance and Cost Controls

- Read path for dashboard: aggregates only.
- Delta path reads:
  - target staff
  - required training types for staff role
  - target staff training records
- Write path:
  - only impacted school aggregate docs + org aggregate doc
- Batch large fanout operations via queue/worker, not client requests.

---

## 7. Failure and Idempotency Rules

- Use deterministic idempotency key per processed event:
  - example: `eventType:entityId:updatedAtEpoch`
- If an event is replayed, do not apply delta twice.
- If transaction fails after partial compute, retry with fresh read.
- Reconciliation is source-of-truth correction layer and must be idempotent.

---

## 8. Acceptance Tests (Phase 0.4 Minimum)

1. Training record update changes staff from `compliant` to `non_compliant` -> decrements compliant, increments non-compliant in all linked schools and org.
2. Staff linked to 3 schools becomes `expiring_soon` -> all 3 school aggregates update correctly.
3. Staff deactivated -> removed from all aggregate buckets.
4. Staff moved from school A to B -> A decremented, B incremented, org unchanged except state changes.
5. Reconciliation rebuild corrects intentionally corrupted counters.
6. Replay same event twice -> no double delta.
7. Dashboard query uses only aggregate docs in normal path.

---

## 9. Sign-Off Checklist (Phase 0.4)

- Delta formula is deterministic and documented.
- Impact scope rules are explicit for all trigger events.
- Nightly reconciliation strategy and drift response are defined.
- Cost controls and idempotency behavior are defined.
- Acceptance test list is implementation-ready.

