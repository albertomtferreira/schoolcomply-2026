# UX Truth Contract (Restart v1)

Purpose: lock the shell and navigation behavior for the rebuild.
Status: approved UX baseline for implementation.
Last updated: 2026-02-15.

Canonical companions:

- `docs/Architecture.md`
- `docs/Guidelines.md`
- `docs/ComplianceDecisionTable.md`

---

## 1. Shell Layout

- Top bar is a persistent requirement in the new app.
- Sidebar is persistent and is the main app navigation.
- Main content pane renders child route selected from sidebar.

---

## 2. Sidebar Structure

Required order:

1. User menu section
2. Role-aware management section
3. Module navigation section

### 2.1 User Menu Section

Must include:

- signed-in user identity
- profile/settings entry
- sign-out action

### 2.2 Role-Aware Management Section

Visibility depends on role:

- `platform_admin`: can manage orgs and platform-level setup
- `org_admin`: can manage org settings, schools, users, module subscriptions
- `school_admin`: can manage assigned schools and school-level staff
- `staff` and `viewer`: no admin management actions

### 2.3 Module Navigation Section

- Only show modules both subscribed by org and enabled for the member.
- Each module row is expandable/collapsible.
- Selecting a module reveals child links.

TrainingTrack required children:

- `Dashboard`
- `Training Records`
- `Staff`
- `Training Definitions`

---

## 3. Routing Contract

Route pattern:

- `/app/{moduleId}` for module default dashboard
- `/app/{moduleId}/{child}` for child pages

Examples:

- `/app/trainingTrack/dashboard`
- `/app/trainingTrack/training-records`
- `/app/trainingTrack/staff`
- `/app/trainingTrack/training-definitions`

Behavior:

- Keep selected org/school context while navigating between children.
- If user loses entitlement for current route, redirect to nearest allowed page.

---

## 4. Indicator Contract

- Module row shows health indicator from `orgs/{orgId}/moduleHealth/{moduleId}`.
- States:
  - `green`
  - `amber`
  - `red`
  - `grey`
- Indicator must include text, not color only.

---

## 5. Acceptance Criteria

1. Top bar is present on all authenticated pages.
2. Sidebar renders user menu first.
3. Sidebar management items are role-aware.
4. Sidebar modules are entitlement-aware.
5. Module submenus open/close and child routes render correctly.
6. Main content area always reflects selected sidebar child.
