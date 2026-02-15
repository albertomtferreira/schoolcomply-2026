# Phase 1 UX Wireframes (P1.0)

Purpose: low-fidelity wireframes for core MVP screens, aligned to `docs/UXTruthContract.md` and `docs/ComplianceDecisionTable.md`.

Owners: Lumen + Sentinel
Status: Draft v2
Last updated: 2026-02-15

---

## 1. Global App Shell (Layout Contract)

Goal: persistent navigation and explicit scope context on every screen.

Shell layout:

```txt
+----------------------+-----------------------------------------------------------+
| Sidebar              | Top Scope Bar                                            |
| - Dashboard          | Org Switcher | School Switcher | Date Range | User Menu |
| - Staff              +-----------------------------------------------------------+
| - Training           | Page Content (changes by sidebar route + selected scope) |
| - Reports            |                                                           |
| - Settings           |                                                           |
|                      |                                                           |
| User Menu (bottom)   |                                                           |
+----------------------+-----------------------------------------------------------+
```

Rules:
- Sidebar is persistent across authenticated app pages.
- Top scope bar is persistent and controls rendered data scope.
- Content area renders children based on:
  1. selected sidebar route
  2. selected organisation
  3. selected school (when applicable)
- If user has one organisation, org selector is locked/read-only.
- School selector options must always be constrained by current org and user scope.

---

## 2. Screen Map (Inside App Shell)

1. Org Dashboard
2. School Dashboard
3. Staff Profile
4. Training Record Form and Drill-Down

Navigation flow:

`Org Dashboard -> School Dashboard -> Staff Profile -> Record Form`

---

## 3. Org Dashboard (Wireframe Spec)

Goal: federation-level risk visibility and fast drill-down.

Layout:

```txt
+----------------------------------------------------------------------------------+
| (App Shell Top Scope Bar is persistent)                                          |
+----------------------------------------------------------------------------------+
| KPI Cards: [Compliant] [Expiring Soon] [Non-Compliant] [No Active Staff]        |
| Last updated: <lastCalculatedAt>                                                 |
+----------------------------------------------------------------------------------+
| Filters: State (multi) | School Group | Employment Role | Search                |
+----------------------------------------------------------------------------------+
| Table: Schools                                                                   |
| Name | State Badge | Compliant | Expiring | Non-Compliant | Last Updated | >    |
| ...                                                                             |
+----------------------------------------------------------------------------------+
```

Behavior:
- Default sort: `non_compliant` -> `expiring_soon` -> `compliant` -> `no_active_staff`.
- Row click opens School Dashboard.
- If `lastCalculatedAt` > 24h old, show stale-data banner.

---

## 4. School Dashboard (Wireframe Spec)

Goal: identify which staff are causing school-level status.

Layout:

```txt
+----------------------------------------------------------------------------------+
| (App Shell Top Scope Bar is persistent)                                          |
| Breadcrumb (Org > School) | Last updated: <lastCalculatedAt>                     |
-----------------------------------------------------------------------------------+
| KPI Cards: [Compliant Staff] [Expiring Soon] [Non-Compliant]                    |
+----------------------------------------------------------------------------------+
| Filters: State (multi) | Employment Role | Training Type | Search               |
+----------------------------------------------------------------------------------+
| Table: Staff                                                                     |
| Name | Role | State Badge | Primary Reason | Next Expiry | >                     |
| ...                                                                             |
+----------------------------------------------------------------------------------+
```

Behavior:
- Primary reason must show one of:
  - `missing_required_record`
  - `expired_required_record`
  - `expiring_soon_required_record`
- Row click opens Staff Profile.

---

## 5. Staff Profile (Wireframe Spec)

Goal: full compliance explanation per staff member.

Layout:

```txt
+----------------------------------------------------------------------------------+
| Header: Staff Name | School tags | Employment Role | State Badge                |
+----------------------------------------------------------------------------------+
| Summary: required count | valid | expiring | missing | expired                   |
+----------------------------------------------------------------------------------+
| Required Training Checklist                                                      |
| Training Type | Requirement Status | Evidence Status | Expiry Date | Reason      |
| ...                                                                             |
+----------------------------------------------------------------------------------+
| Evidence Panel (selected training)                                               |
| Provider | IssuedAt | ExpiresAt | Certificate Link | Notes                       |
+----------------------------------------------------------------------------------+
| Actions: Add Record (modal) | Replace Record (modal) | View Audit (drawer/modal) |
+----------------------------------------------------------------------------------+
```

Behavior:
- Checklist rows show deterministic status from rule contract.
- Missing required training is visibly red and blocks compliance.

---

## 6. Training Record Form and Drill-Down (Wireframe Spec)

Goal: create/update evidence with clear validation and scope.

Layout:

```txt
+----------------------------------------------------------------------------------+
| Modal Header: Add/Update Training Record                                         |
+----------------------------------------------------------------------------------+
| Staff (readonly or selected)                                                     |
| School (scoped list)                                                             |
| Training Type                                                                    |
| IssuedAt | ExpiresAt | Provider                                                  |
| Certificate Upload                                                               |
| Notes                                                                            |
+----------------------------------------------------------------------------------+
| Live Validation:                                                                 |
| - required fields                                                                |
| - scope constraints                                                              |
| - expiry preview (valid/expiring/expired)                                        |
+----------------------------------------------------------------------------------+
| Actions: Save | Cancel                                                           |
+----------------------------------------------------------------------------------+
```

Behavior:
- No direct editing of derived fields (`status`, `daysToExpiry`).
- Save path writes audit log and triggers aggregate update pipeline.

---

## 7. Modal Interaction Pattern (Preferred)

Modal-first UX guidance:
- Use modals for create/edit/update flows to preserve page context.
- Use slide-over/drawer for secondary detail (for example: audit timeline).
- Keep destructive actions in confirmation modals.

Modal rules:
- Must trap focus and support `Esc` to close.
- Must not hide critical compliance alerts behind nested modals.
- Do not stack more than one modal level.
- On successful save, close modal and refresh affected section with success feedback.

Primary modal candidates:
- Add Training Record
- Edit/Replace Record
- Create Staff
- Create Training Type
- Confirm archive/deactivate actions

---

## 8. Canonical State and Badge Contract

Use only:
- `compliant` -> green
- `expiring_soon` -> amber
- `non_compliant` -> red
- `no_active_staff` -> grey (school-level neutral)

Reason codes (user visible):
- `missing_required_record`
- `expired_required_record`
- `expiring_soon_required_record`
- `no_active_staff`

---

## 9. Empty/Error States

- No schools: onboarding empty state with create/import action.
- No staff: neutral empty state, not red by default.
- Aggregate missing: "Data unavailable - retrying".
- Stale aggregate (`lastCalculatedAt` > 24h): warning banner.

---

## 10. Accessibility Notes

- Badge must include text label, not color only.
- Include icon + text for risk states.
- Ensure keyboard navigation for table rows and filters.
- All modals must be keyboard-navigable with clear focus states.

---

## 11. Deliverables for P1.0 Completion

1. This spec reviewed by Lumen + Sentinel.
2. Low-fidelity image exports stored in `docs/ux/wireframes/`.
3. Any deltas reflected in `docs/UXTruthContract.md`.
