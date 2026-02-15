# UX Truth Contract (v2)

Purpose: define canonical shell behavior, module navigation, state semantics, and visibility rules for SchoolTrack.

Contract owners: Lumen (clarity) and Sentinel (integrity).
Status: baseline for SchoolTrack shell + TrainingTrack module.
Last updated: 2026-02-15.

Canonical companions:
- `docs/ComplianceDecisionTable.md`
- `docs/Architecture.md`
- `docs/Guidelines.md`
- `docs/ux/Wireframes.md`

---

## 1. Canonical State Set

Locked state identifiers:
- `compliant`
- `expiring_soon`
- `non_compliant`
- `no_active_staff`

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

---

## 3. App Shell Contract (Core)

Global shell requirements:
- Persistent left sidebar on authenticated pages.
- Persistent top bar with:
  - organisation switcher
  - school switcher
  - module navbar (entitled modules only)
  - optional date range and user menu controls
- Module children render in central workspace area under the shell.

Scope switching behavior:
- Data always resolves from current `(orgId, schoolId)`.
- If user has a single org, org switcher is read-only.
- School switcher options are constrained by selected org and role scope.
- Route changes preserve scope where valid.
- If scope becomes invalid, reset to nearest valid scope and notify user.

---

## 4. Module Navigation + Sidebar Indicator Contract

Module navbar rules:
- Show only modules available in `users.enabledModules`.
- Active module is visually explicit.
- Disabled/unentitled modules are not displayed.

Sidebar indicator rules (Lumen note):
- Each visible module row includes a compact traffic-light indicator:
  - green: no active issues in module
  - amber: upcoming or warning-level issues
  - red: active failures/issues requiring action
  - grey: no data/unavailable
- Indicator source is `moduleHealth/{moduleId}`.
- Indicator must be visible at a glance without opening the module.
- Indicator must include accessible text label, not color-only.

---

## 5. Modal Interaction Contract

Modal-first pattern:
- Use modals for create/edit/update flows.
- Use drawer/slide-over for secondary details.
- Use confirmation modal for destructive actions.

Modal rules:
- Single-modal depth only.
- Keyboard focus trap + `Esc` close.
- Explicit primary action labels.
- On success: close modal, refresh affected section, show feedback.
- On validation error: keep open, show field-level errors.

---

## 6. Filter Contract (TrainingTrack baseline)

Minimum filters:
- `state` (multi-select): `compliant`, `expiring_soon`, `non_compliant`, `no_active_staff`
- `school` (org dashboard)
- `employmentRole` (school/staff contexts)
- `trainingType` (staff detail)

Filter behavior:
- `AND` across groups.
- `OR` within a group.
- Default includes all states.

---

## 7. Sorting and Priority Contract

Default sort order:
1. `non_compliant`
2. `expiring_soon`
3. `compliant`
4. `no_active_staff`

Secondary sort:
- school name alphabetical
- staff name alphabetical

---

## 8. Drill-Down Contract

Required path:
1. Org dashboard row -> school dashboard
2. School dashboard row -> staff profile
3. Staff profile -> required training checklist + evidence

Integrity rule:
- Parent state must be explainable by child rows.

---

## 9. Reason Codes

Allowed reason codes:
- `missing_required_record`
- `expired_required_record`
- `expiring_soon_required_record`
- `no_active_staff`

Reason display rules:
- `non_compliant` rows must show missing/expired reason.
- `expiring_soon` rows must show nearest expiry item/date.

---

## 10. Data Freshness Contract

Freshness sources:
- dashboard state: aggregate docs
- module indicator state: `moduleHealth/{moduleId}.lastCalculatedAt`

Display rules:
- Always show "Last updated" on dashboards.
- Show stale banner when freshness exceeds 24h.
- If health doc missing, show grey indicator and "Data unavailable".

---

## 11. Empty and Error States

Minimum states:
- No schools -> onboarding empty state.
- No staff in school -> neutral empty state.
- No records for required training -> `missing_required_record` (red impact).
- Aggregate/module health fetch error -> error panel + retry + preserve known timestamp if available.

---

## 12. Accessibility and Copy

- State and module indicators must be text-visible, not color-only.
- Traffic-light indicators require icon + label pairing.
- Modals must be keyboard-accessible with visible focus.
- Plain language labels only.

---

## 13. Acceptance Criteria

1. Core shell persists across module navigation.
2. Top navbar shows only entitled modules.
3. Sidebar shows per-module traffic-light indicator from `moduleHealth`.
4. Missing required record surfaces as `non_compliant`.
5. Default sorting shows red first.
6. Filter logic follows AND/OR contract.
7. Every non-compliant row has visible reason code.
8. `lastCalculatedAt` is visible and stale banner works.
9. `no_active_staff` remains neutral grey.
10. Scope switching never leaks cross-scope data.

---

## 14. Sign-Off Checklist

- State identifiers match `docs/ComplianceDecisionTable.md`.
- Shell, module navbar, and sidebar indicator contracts are explicit and testable.
- Reason code set is fixed and implementation-ready.
- Freshness/error behavior prevents false trust.
- Modal behavior is accessibility-compliant.
