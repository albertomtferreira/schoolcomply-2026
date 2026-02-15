# Phase 1 UX Wireframes (P1.0)

Purpose: low-fidelity wireframes for core MVP screens, aligned to `docs/UXTruthContract.md` and `docs/ComplianceDecisionTable.md`.

Owners: Lumen + Sentinel
Status: Draft v2
Last updated: 2026-02-15

---

## 1. Global App Shell (Layout Contract)

Goal: persistent navigation, module access clarity, and explicit scope context on every screen.

Shell layout:

```txt
+--------------------------------------+-----------------------------------------------------------------------+
| Sidebar                              | Top Scope Bar                                                         |
| - Dashboard [green/amber/red/grey]   | Org Switcher | School Switcher | Module Navbar | Date Range | User Menu |
+--------------------------------------+-----------------------------------------------------------------------+
| - TrainingTrack [green/amber/red/grey] | Module Content (children rendered by active module route)          |
| - StatutoryTrack [green/amber/red/grey]|                                                                      |
| - ClubTrack [green/amber/red/grey]   |                                                                       |
| - COSHHTrack [green/amber/red/grey]  |                                                                       |
| User Menu (bottom)                   |                                                                       |
+--------------------------------------+-----------------------------------------------------------------------+
```

Rules:
- Sidebar is persistent across authenticated app pages.
- Top scope bar is persistent and controls rendered data scope.
- Top bar module navbar shows only modules available to current user.
- Sidebar module rows include a traffic-light indicator sourced from module health.
- Content area renders children based on:
  1. selected module route
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

---

## 12. Text-First Draft Wireframes (No PNG Required)

Purpose: unblock design review while visual exports are pending. These drafts are canonical until PNGs are produced.

### 12.1 Create/Edit Staff Modal

Goal: allow scoped admins to create or update staff safely.

```txt
+----------------------------------------------------------------------------------+
| Modal Header: Create Staff / Edit Staff                                          |
+----------------------------------------------------------------------------------+
| Full Name*                                                                        |
| Email                                                                             |
| Employment Role*                                                                  |
| School Assignment* (multi-select; scoped by org and user permissions)            |
| Job Title                                                                         |
| Start Date                                                                        |
| End Date                                                                          |
| Active Status (toggle)                                                            |
+----------------------------------------------------------------------------------+
| Inline Validation: required fields, invalid email, scope mismatch                 |
+----------------------------------------------------------------------------------+
| Actions: Save Staff | Cancel                                                      |
+----------------------------------------------------------------------------------+
```

Behavior:
- On create, write shared `staff/{staffId}` with scoped school IDs.
- On edit, preserve immutable IDs and write audit entry.
- If school selection includes out-of-scope IDs, block save with explicit error.

### 12.2 Create/Edit Training Type Modal

Goal: configure requirement logic that drives compliance decisions.

```txt
+----------------------------------------------------------------------------------+
| Modal Header: Create Training Type / Edit Training Type                           |
+----------------------------------------------------------------------------------+
| Name*                                                                             |
| Code                                                                              |
| Expires? (toggle)                                                                 |
| Default Validity Days (enabled only when Expires = true)                         |
| Required for all active staff? (toggle)                                           |
| Required For Roles (multi-select, enabled when Required for all = false)         |
+----------------------------------------------------------------------------------+
| Rule Preview:                                                                     |
| - Requirement applicability summary                                                |
| - Expiry behavior summary                                                         |
+----------------------------------------------------------------------------------+
| Actions: Save Type | Cancel                                                       |
+----------------------------------------------------------------------------------+
```

Behavior:
- `required=true` overrides role-based requirement mapping.
- If `expires=false`, hide/disable validity-day input.
- Save triggers aggregate recomputation event.

### 12.3 Archive/Deactivate Confirmation Modal

Goal: reduce accidental destructive actions and make impacts explicit.

```txt
+----------------------------------------------------------------------------------+
| Modal Header: Confirm Archive / Deactivate                                        |
+----------------------------------------------------------------------------------+
| Warning Text: This action may affect compliance status and visibility.            |
| Entity: <staff/training type/school>                                              |
| Impact Preview:                                                                   |
| - Linked schools affected                                                         |
| - Potential state changes (if known)                                              |
| Confirmation Input (optional): type entity name to continue                       |
+----------------------------------------------------------------------------------+
| Actions: Confirm Archive | Cancel                                                 |
+----------------------------------------------------------------------------------+
```

Behavior:
- Primary action is destructive-styled and requires explicit confirmation.
- On success, show toast + refresh impacted dashboard sections.

### 12.4 Audit Timeline Drawer

Goal: provide traceable history for compliance-affecting changes.

```txt
+----------------------------------------------------------------------------------+
| Drawer Header: Audit Timeline                                                     |
+----------------------------------------------------------------------------------+
| Filters: Date Range | Actor | Action Type                                         |
+----------------------------------------------------------------------------------+
| Timeline List                                                                      |
| [timestamp] [actor] Created training record                                       |
| - Entity: trainingRecords/{recordId}                                              |
| - Change Summary: expiresAt null -> 2026-07-01                                    |
|------------------------------------------------------------------------------------|
| [timestamp] [actor] Updated training record                                       |
| - Diff: provider "NGA" -> "NGA UK"                                                |
| ...                                                                                |
+----------------------------------------------------------------------------------+
| Actions: Close                                                                     |
+----------------------------------------------------------------------------------+
```

Behavior:
- Read-only view; no inline edit capability.
- Diffs should prefer concise before/after display for key fields.

### 12.5 Unauthorized / No Module Access Screen

Goal: explain access denial without leaving ambiguity.

```txt
+----------------------------------------------------------------------------------+
| Title: Access Restricted                                                          |
| Message: You do not have permission to view this module.                          |
| Details: Required entitlement missing in enabled modules.                         |
| Actions: Go to Dashboard | Contact Org Admin                                      |
+----------------------------------------------------------------------------------+
```

Behavior:
- Returned for unentitled module routes.
- Must not leak module data shape in error payload.

### 12.6 Scope Invalid Reset Banner Pattern

Goal: notify user when current scope is auto-corrected to a valid scope.

```txt
+----------------------------------------------------------------------------------+
| Warning Banner: Selected school is no longer in your access scope.               |
| Scope reset to: <nearest valid school>.                                           |
| Action: Review Scope                                                              |
+----------------------------------------------------------------------------------+
```

Behavior:
- Trigger after role/scope changes or stale deep links.
- Preserve route when possible; otherwise redirect to module root with banner.

### 12.7 Loading, Error, and Empty-State Patterns

Goal: standardize data lifecycle rendering across dashboards and lists.

Loading:
```txt
[KPI Skeleton Blocks]
[Filter Skeleton Row]
[Table Skeleton Rows x N]
```

Error:
```txt
Data unavailable.
Last known update: <timestamp or unknown>
[Retry]
```

Empty Filter Result:
```txt
No results match current filters.
[Clear Filters]
```

Behavior:
- Retain active filters and scope on retry.
- Preserve last known timestamp where available.

### 12.8 Training Record Upload States

Goal: make upload behavior explicit before hi-fi design.

```txt
Certificate Upload
- Idle: [Choose File]
- Uploading: [Progress Bar 0-100%]
- Success: [File Name] [Replace] [Remove]
- Error: Upload failed. [Retry]
```

Behavior:
- Validate type and size before upload begins.
- Save disabled while upload is in progress.

---

## 13. Wireframe Backlog for PNG Export

When visual exports begin, produce PNGs for:
1. Org Dashboard
2. School Dashboard
3. Staff Profile
4. Training Record Form
5. Create/Edit Staff Modal
6. Create/Edit Training Type Modal
7. Archive/Deactivate Confirmation Modal
8. Audit Timeline Drawer
9. Unauthorized/No Access Screen
10. Scope Reset Banner State
11. Loading/Error/Empty states (dashboard variants)
12. Upload state variants

