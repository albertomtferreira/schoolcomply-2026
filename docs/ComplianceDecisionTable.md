# Compliance Decision Table (Rule Contract v1)

Purpose: single source of truth for compliance outcomes used by product, engineering, and QA.
Contract owners: Forge (architecture) and Sentinel (compliance integrity).
Status: carried forward as canonical rule logic for restart implementation.

---

## 1. Scope

- Applies to active staff only (`staff.isActive == true`).
- A training requirement applies when:
  - `trainingType.required == true`, or
  - `staff.employmentRole` is included in `trainingType.requiredForRoles`.
- If no training requirement applies, that training type is ignored for compliance scoring.

### 1.1 Applicability Precedence

- If `trainingType.required == true`, the training is required for all active staff.
- If `trainingType.required == false`, the training is required only when `staff.employmentRole` is in `trainingType.requiredForRoles`.
- If `requiredForRoles` is empty and `required == false`, the training is optional and excluded from compliance scoring.

---

## 2. Record Status Rules

Let `now = current date`.

| Condition                           | Record Status |
| ----------------------------------- | ------------- |
| No matching required record exists  | `missing`     |
| `expiresAt < now`                   | `expired`     |
| `now <= expiresAt <= now + 60 days` | `expiring`    |
| `expiresAt > now + 60 days`         | `valid`       |

Notes:

- `missing` is a compliance state for required training evaluation.
- For non-expiring training types (`expires == false`), a present record is treated as `valid`.
- Day-boundary rule: `expiresAt` is evaluated in UTC.
- `expiresAt == now` is `expiring`, not `expired`.

### 2.1 Matching Record Selection (Deterministic)

When multiple records exist for the same `staffId + trainingTypeId`, use this order:

1. Exclude records outside org scope or with invalid required fields.
2. Prefer record with latest `expiresAt` (when training expires).
3. For non-expiring training, prefer latest `issuedAt`; if missing, latest `updatedAt`.
4. If tie remains, prefer latest `updatedAt`.

This selected record is the effective record for status evaluation.

---

## 3. Staff Compliance Rules

| Condition                                                                     | Staff Compliance |
| ----------------------------------------------------------------------------- | ---------------- |
| Any required training is `expired`                                            | `non_compliant`  |
| Any required training is `missing`                                            | `non_compliant`  |
| No required training is `expired` or `missing` and at least one is `expiring` | `expiring_soon`  |
| All required training is `valid`                                              | `compliant`      |

### 3.1 Staff Status Priority

Evaluate with strict priority:

1. `non_compliant` (if any required item is `expired` or `missing`)
2. `expiring_soon`
3. `compliant`

---

## 4. School Compliance Rules

| Condition                                                                     | School Compliance                          |
| ----------------------------------------------------------------------------- | ------------------------------------------ |
| Any active linked staff is `non_compliant`                                    | `non_compliant`                            |
| No active linked staff is `non_compliant` and at least one is `expiring_soon` | `expiring_soon`                            |
| All active linked staff are `compliant`                                       | `compliant`                                |
| No active linked staff                                                        | `no_active_staff` (neutral state, not red) |

Notes:

- Staff can belong to multiple schools (`staff.schoolIds`). A non-compliant staff member affects all linked schools.

### 4.1 School Status Priority

Evaluate with strict priority:

1. `non_compliant`
2. `expiring_soon`
3. `compliant`
4. `no_active_staff` (only when active staff count is zero)

---

## 5. Organisation Compliance Rules

| Condition                                                               | Org Compliance  |
| ----------------------------------------------------------------------- | --------------- |
| Any school is `non_compliant`                                           | `non_compliant` |
| No school is `non_compliant` and at least one school is `expiring_soon` | `expiring_soon` |
| All schools are `compliant` or `no_active_staff`                        | `compliant`     |

### 5.1 Org Status Priority

Evaluate with strict priority:

1. `non_compliant`
2. `expiring_soon`
3. `compliant`

---

## 6. UI Color Mapping

| State             | Color |
| ----------------- | ----- |
| `compliant`       | Green |
| `expiring_soon`   | Amber |
| `non_compliant`   | Red   |
| `no_active_staff` | Grey  |

---

## 7. Aggregate Update Triggers (P1)

Update impacted aggregates when any of the below changes:

- training record created, updated, or deleted
- staff `isActive` changed
- staff `schoolIds` changed
- staff `employmentRole` changed
- training type required/role mapping changed

Impacted docs:

- `orgs/{orgId}/aggregates/orgCompliance`
- `orgs/{orgId}/aggregates/school_{schoolId}` for affected schools only

---

## 8. Evaluation Flow (Implementation Contract)

1. Load active staff in scope.
2. Resolve required training set per staff via applicability rules.
3. Resolve effective record per required training.
4. Compute required training statuses (`missing|expired|expiring|valid`).
5. Compute staff state using priority rules.
6. Roll up school state from active linked staff.
7. Roll up org state from school states.
8. Persist aggregate deltas and `lastCalculatedAt`.

---

## 9. Acceptance Test Cases (Phase 0.1 Minimum)

1. Required training missing -> staff `non_compliant`.
2. Required training expired -> staff `non_compliant`.
3. Required training valid, one expiring -> staff `expiring_soon`.
4. Multi-school staff non-compliant -> all linked schools `non_compliant`.
5. Staff marked inactive -> removed from compliance scoring.
6. Non-expiring required training with record present -> `valid`.
7. School with zero active staff -> `no_active_staff`.
8. `expiresAt == now` -> status `expiring`.
9. `required == false` and role not in `requiredForRoles` -> training excluded from scoring.
10. Two records for same training -> effective record chosen by deterministic selection rules.

---

## 10. Sign-Off Checklist (Rule Contract)

- Missing required record behavior is explicit and testable.
- Inactive staff exclusion is explicit and testable.
- Multi-school propagation behavior is explicit and testable.
- Deterministic record selection is defined.
- State priority is defined for staff, school, and org.
