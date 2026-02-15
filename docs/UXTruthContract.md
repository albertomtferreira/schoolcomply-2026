# UX Truth Contract (v1)

Purpose: define canonical dashboard state semantics, badges, filters, and visibility behavior for leadership-facing compliance UX.

Contract owners: Lumen (clarity) and Sentinel (compliance integrity).
Status: Phase 0.6 baseline for MVP implementation.
Last updated: 2026-02-15.

Canonical companions:
- `docs/ComplianceDecisionTable.md`
- `docs/Architecture.md`
- `docs/Guidelines.md`
- `docs/ux/Wireframes.md`

---

## 1. Canonical State Set

Locked state identifiers (must not be renamed in code or UI copy keys):
- `compliant`
- `expiring_soon`
- `non_compliant`
- `no_active_staff` (school-level neutral state only)

State source-of-truth:
- Computed using rule precedence from `docs/ComplianceDecisionTable.md`.
- UI may not override computed state.

---

## 2. Badge and Color Semantics

| State | Badge Label | Color Token | Meaning |
| --- | --- | --- | --- |
| `compliant` | Compliant | green | No required gaps or expiries in warning window |
| `expiring_soon` | Expiring Soon | amber | No failures yet, but at least one required item in warning window |
| `non_compliant` | Non-Compliant | red | At least one required item missing or expired |
| `no_active_staff` | No Active Staff | grey | School has zero active staff in scope |

Non-negotiable:
- Missing required record must render as `non_compliant` (red context).
- `no_active_staff` is neutral (grey), never red.

---

## 3. App Shell and Scope Switching Contract

Global shell requirements:
- Persistent left sidebar navigation on authenticated app pages.
- Persistent top scope bar containing:
  - organisation switcher
  - school switcher
  - optional date range and user menu controls

Scope switching behavior:
- Page data must always resolve from current `(orgId, schoolId)` scope selection.
- If user has a single org, org switcher is read-only.
- School switcher options must be constrained by selected org and user RBAC scope.
- Route changes must preserve scope selection where valid.
- If scope becomes invalid (for example role/scope change), UI must reset to nearest valid scope and notify user.

---

## 4. Modal Interaction Contract

Modal-first pattern:
- Use modals for create/edit/update flows to preserve page context.
- Use drawer/slide-over for secondary details (for example audit timeline).
- Use confirmation modal for destructive actions.

Modal behavior rules:
- Single-modal depth only (no nested modal stacks).
- Must support keyboard focus trap and `Esc` close.
- Primary action must be explicit (`Save`, `Archive`, `Confirm`).
- On success: close modal, refresh affected view section, show toast/feedback.
- On validation error: keep modal open and show field-level errors.

---

## 5. Filter Contract

Minimum filters for org and school dashboards:
- `state` (multi-select): `compliant`, `expiring_soon`, `non_compliant`, `no_active_staff` (school-level contexts only)
- `school` (org dashboard)
- `employmentRole` (school/staff contexts)
- `trainingType` (staff detail contexts)

Filter behavior:
- Filters are conjunctive (`AND`) across groups.
- Within a single filter group, values are disjunctive (`OR`).
- Default state filter at org/school dashboard load: all states included.

---

## 6. Sorting and Priority Contract

Default sort order for risk-first visibility:
1. `non_compliant`
2. `expiring_soon`
3. `compliant`
4. `no_active_staff`

Secondary sort:
- alphabetical by school name (dashboard)
- alphabetical by staff surname/full name (school view)

---

## 7. Drill-Down Contract

Required drill-down path:
1. Org dashboard row -> school dashboard
2. School dashboard row -> staff profile
3. Staff profile -> required training checklist and record evidence

Drill-down integrity:
- Parent state must be explainable by child rows.
- Every red/amber row must show explicit contributing reasons.

---

## 8. Reason Codes (User-Visible)

Allowed reason code set for status explanation:
- `missing_required_record`
- `expired_required_record`
- `expiring_soon_required_record`
- `no_active_staff`

Reason display rules:
- `non_compliant` rows must show at least one of:
  - missing required record
  - expired required record
- `expiring_soon` rows must show the nearest expiry item/date.

---

## 9. Data Freshness Contract

Freshness source:
- `lastCalculatedAt` from aggregate docs.

Display rules:
- Always display "Last updated" timestamp on org and school dashboards.
- If `lastCalculatedAt` is older than 24 hours, show stale data warning banner.
- If aggregate doc missing, show explicit "Data unavailable - retrying" state and avoid showing misleading green status.

---

## 10. Empty and Error State Contract

Minimum empty/error states:
- No schools in org -> onboarding empty state with clear action.
- No staff in school -> empty state; do not mark school red unless rules indicate non-compliance.
- No records for required training -> shown as `missing_required_record` and contributes to red status.
- Aggregate fetch error -> error panel + retry control + preserve last known timestamp if available.

---

## 11. Accessibility and Copy Contract

- Badge labels must be text-visible, not color-only.
- Red/Amber/Green states require icon + label pairing.
- Modals must be fully keyboard-accessible with visible focus states.
- Use plain language:
  - "Non-Compliant", not technical error codes
  - "Expiring Soon", not ambiguous "Warning"

---

## 12. Acceptance Criteria (Phase 1 UX Baseline)

1. All four canonical states render consistently across org, school, and staff views where applicable.
2. Missing required record always surfaces as `non_compliant`.
3. Default sorting shows red items first.
4. Filter combinations behave as defined (AND across groups, OR within group).
5. Every non-compliant row has at least one visible reason code.
6. `lastCalculatedAt` is visible on dashboards.
7. Stale-data banner appears when freshness threshold is exceeded.
8. `no_active_staff` appears as grey and is excluded from red counts.
9. Sidebar and scope bar remain persistent across page navigation.
10. Scope switching updates content to selected org/school without stale cross-scope data.
11. Create/edit flows run in modal context with required accessibility behavior.

---

## 13. Sign-Off Checklist (Phase 1 UX Baseline)

- State identifiers match `docs/ComplianceDecisionTable.md`.
- App shell, badge, filter, and sort contracts are explicit and testable.
- Reason code set is fixed and implementation-ready.
- Freshness and error behavior prevent false trust in stale data.
- Modal behavior is explicit and accessibility-compliant.

---

## 14. Wireframe References (Phase 1)

- Wireframe specification: `docs/ux/Wireframes.md`
- Wireframe image exports: `docs/ux/wireframes/`
