# Compliance Decision Table

Purpose: single source of truth for compliance outcomes used by product, engineering, and QA.

---

## 1. Scope

- Applies to active staff only (`staff.isActive == true`).
- A training requirement applies when:
  - `trainingType.required == true`, or
  - `staff.employmentRole` is included in `trainingType.requiredForRoles`.
- If no training requirement applies, that training type is ignored for compliance scoring.

---

## 2. Record Status Rules

Let `now = current date`.

| Condition | Record Status |
| --- | --- |
| No matching required record exists | `missing` |
| `expiresAt < now` | `expired` |
| `now <= expiresAt <= now + 60 days` | `expiring` |
| `expiresAt > now + 60 days` | `valid` |

Notes:
- `missing` is a compliance state for required training evaluation.
- For non-expiring training types (`expires == false`), a present record is treated as `valid`.

---

## 3. Staff Compliance Rules

| Condition | Staff Compliance |
| --- | --- |
| Any required training is `expired` | `non_compliant` |
| Any required training is `missing` | `non_compliant` |
| No required training is `expired` or `missing` and at least one is `expiring` | `expiring_soon` |
| All required training is `valid` | `compliant` |

---

## 4. School Compliance Rules

| Condition | School Compliance |
| --- | --- |
| Any active linked staff is `non_compliant` | `non_compliant` |
| No active linked staff is `non_compliant` and at least one is `expiring_soon` | `expiring_soon` |
| All active linked staff are `compliant` | `compliant` |
| No active linked staff | `no_active_staff` (neutral state, not red) |

Notes:
- Staff can belong to multiple schools (`staff.schoolIds`). A non-compliant staff member affects all linked schools.

---

## 5. Organisation Compliance Rules

| Condition | Org Compliance |
| --- | --- |
| Any school is `non_compliant` | `non_compliant` |
| No school is `non_compliant` and at least one school is `expiring_soon` | `expiring_soon` |
| All schools are `compliant` or `no_active_staff` | `compliant` |

---

## 6. UI Color Mapping

| State | Color |
| --- | --- |
| `compliant` | Green |
| `expiring_soon` | Amber |
| `non_compliant` | Red |
| `no_active_staff` | Grey |

---

## 7. Aggregate Update Triggers (P1)

Update impacted aggregates when any of the below changes:

- training record created, updated, or deleted
- staff `isActive` changed
- staff `schoolIds` changed
- staff `employmentRole` changed
- training type required/role mapping changed

Impacted docs:

- `organisations/{orgId}/aggregates/orgCompliance`
- `organisations/{orgId}/aggregates/school_{schoolId}` for affected schools only

---

## 8. Test Cases (Minimum)

1. Required training missing -> staff `non_compliant`.
2. Required training expired -> staff `non_compliant`.
3. Required training valid, one expiring -> staff `expiring_soon`.
4. Multi-school staff non-compliant -> all linked schools `non_compliant`.
5. Staff marked inactive -> removed from compliance scoring.
6. Non-expiring required training with record present -> `valid`.
7. School with zero active staff -> `no_active_staff`.

