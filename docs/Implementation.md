# Compliance SaaS - Implementation Plan

Canonical compliance logic reference: `docs/ComplianceDecisionTable.md`.

## Phase 0 - Strategic Foundation (Weeks 1-2)

### Objectives

- Define core scope (training compliance only)
- Lock role architecture (RBAC)
- Lock database schema (Organisations -> Schools -> Staff -> Training Types -> Training Records)
- Lock compliance logic:
  - 1 expired required training = non-compliant
  - missing required training record = non-compliant
- Confirm Firebase-only auth model

### Deliverables

- Data model v1 locked
- Role definitions confirmed
- Staff schema confirmed (including multi-school links via `schoolIds` and `employmentRole`)
- Compliance decision rules documented and linked to `docs/ComplianceDecisionTable.md`
- MVP feature list frozen

### Phase 0 Work Breakdown (Execution)

1. Rule Contract (Sentinel + Forge)
- Finalize the decision table as canonical.
- Confirm edge cases: missing required records, inactive staff, multi-school staff impact.
- Artifact: signed rule set in `docs/ComplianceDecisionTable.md`.
- Status: baseline completed (Rule Contract v1), ready for implementation and test harness.

2. Data Contract (Forge)
- Freeze Firestore collection and field schema from `docs/Architecture.md`.
- Confirm required indexes and deterministic ID conventions.
- Artifact: schema + index checklist approved in architecture docs.
- Artifact location: `docs/DataContract.md` and `firestore.indexes.json`.
- Status: baseline completed (Data Contract v1), ready for schema/rules implementation.

3. Security Contract (Forge + Sentinel)
- Define role-to-action matrix (superadmin, org_admin, school_admin, staff, viewer).
- Draft Firestore rules for org, school, staff, training, and audit scopes.
- Artifact: RBAC matrix + rules test cases.
- Artifact location: `docs/SecurityContract.md` and `firestore.rules`.
- Status: baseline completed (Security Contract v1), ready for emulator test implementation.

4. Aggregate Contract (Forge)
- Define delta update logic for `orgCompliance` and `school_{schoolId}`.
- Define nightly reconciliation logic and drift correction behavior.
- Artifact: aggregate update and reconciliation spec.
- Artifact location: `docs/AggregateContract.md`.
- Status: baseline completed (Aggregate Contract v1), ready for implementation and load testing.

5. Platform Bootstrap (Forge)
- Validate Firebase environment separation (`dev`, `staging`, `prod`).
- Define environment variable contract and local emulator setup.
- Artifact: reproducible local setup baseline.
- Artifact location: `docs/PlatformBootstrap.md`, `firebase.json`, `.firebaserc`, `.env.example`.
- Status: baseline completed (Platform Bootstrap v1), ready for team onboarding.

6. UX Truth Contract (Lumen + Sentinel)
- Lock state semantics for dashboard badges and filters:
  - `compliant`
  - `expiring_soon`
  - `non_compliant`
  - `no_active_staff`
- Artifact: state mapping aligned with decision table and architecture.
- Artifact location: `docs/UXTruthContract.md`.
- Status: baseline completed (UX Truth Contract v1), ready for UI implementation and QA checks.

### Phase 0 Exit Gate (Go/No-Go to Phase 1)

All conditions must pass before starting Phase 1:

- Compliance decision table approved and unchanged by unresolved comments.
- Schema and index plan approved and frozen.
- RBAC matrix approved and mapped to rule tests.
- Aggregate strategy approved (delta updates + nightly reconciliation).
- Firebase environment model validated for `dev/staging/prod`.
- Local setup reproducible by a second person without undocumented steps.

### Phase 0 Exit Gate Evidence (Current)

| Gate Item | Status | Evidence | Owner | Date |
| --- | --- | --- | --- | --- |
| Compliance decision table approved and unchanged by unresolved comments | PASS | `docs/ComplianceDecisionTable.md` (Rule Contract v1), `docs/UXTruthContract.md` state alignment | Sentinel | 2026-02-15 |
| Schema and index plan approved and frozen | PASS | `docs/DataContract.md`, `firestore.indexes.json` | Forge | 2026-02-15 |
| RBAC matrix approved and mapped to rule tests | PASS | `docs/SecurityContract.md`, `firestore.rules`, `firestore.rules.test.ts`, command: `npm run firebase:rules:test` (20/20 passed) | Forge + Sentinel | 2026-02-15 |
| Aggregate strategy approved (delta updates + nightly reconciliation) | PASS | `docs/AggregateContract.md` | Forge | 2026-02-15 |
| Firebase environment model validated for `dev/staging/prod` | PASS | `docs/PlatformBootstrap.md`, `.firebaserc`, `firebase.json`, emulator UI confirmed | Forge | 2026-02-15 |
| Local setup reproducible by a second person without undocumented steps | PASS | Independent validation recorded: Windows 11 Home, Node v22.16.0, npm v10.9.2, run window 2026-02-15 04:00-04:30, result PASS; blocker resolved by installing Java for emulator runtime | Alberto | 2026-02-15 |

Current Phase 0 exit gate result: **FULLY PASSED**.

---

## Phase 1 - Internal Pilot (Weeks 3-8)

### Scope

Training compliance tracking only.

### Features

- Staff profiles
- Training types
- Training records with expiry
- Compliance dashboard
- School status indicator
- Federation overview
- Immutable audit logs (create-only)
- Aggregates in P1:
  - `aggregates/orgCompliance`
  - `aggregates/school_{schoolId}`

### UX Requirements

- Green = fully compliant
- Amber = expiring soon
- Red = non-compliant
- Missing required record is clearly shown as non-compliant
- Clear drill-down capability

### Success Criteria

- All federation schools onboarded
- Data accuracy validated
- No manual spreadsheets required for compliance reporting
- Dashboard loads from aggregate docs (no heavy full recount on normal reads)

### Phase 1 Work Breakdown (Execution)

P1.0 UX Wireframes (Lumen + Sentinel) - First Task
- Create low-fidelity wireframes before implementation for:
  - Org dashboard
  - School dashboard
  - Staff profile
  - Training record form and drill-down
- Ensure states and reason codes align with `docs/UXTruthContract.md` and `docs/ComplianceDecisionTable.md`.
- Artifact location:
  - `docs/ux/Wireframes.md`
  - `docs/ux/wireframes/`
- Status: draft baseline created, ready for visual export/review.

P1.1 Foundation Wiring (Forge)
- Wire Firebase auth/session flow in app.
- Implement repository/server-action pattern with Zod validation.
- Enforce org and role scoping in server paths.

P1.2 Core Entity Flows (Forge + Sentinel)
- Implement CRUD for staff, training types, and training records.
- Validate writes against data/security contracts.

P1.3 Compliance Engine Integration (Sentinel + Forge)
- Integrate status computation from canonical rule contract.
- Ensure missing required records and expiry states are reflected in UI and aggregates.

P1.4 Aggregate Pipeline Integration (Forge)
- Run aggregate delta updates on relevant writes.
- Use aggregate docs as primary dashboard read path.

P1.5 Dashboard and Drill-Down UI (Lumen)
- Build org and school dashboards with risk-priority sorting.
- Build staff-level drill-down with reason codes and freshness indicators.

P1.6 Audit and Reliability (Sentinel + Forge)
- Ensure immutable audit log writes from trusted server paths.
- Add operational logging for aggregate and compliance update failures.

P1.7 QA and Pilot Readiness (All)
- Run security rules suite and core UI/flow checks.
- Validate seeded onboarding flow for pilot schools.

---

## Phase 2 - Stabilisation and Optimisation (Weeks 9-12)

### Objectives

- Improve dashboard clarity
- Reduce friction in data entry
- Implement alerts system
- Generate exportable compliance reports
- Optimize read/write efficiency for aggregate updates

### Additions

- Email reminders (2 months before expiry)
- School-level compliance reports (PDF export)
- Role-based views (Exec vs School Admin)
- Nightly aggregate reconciliation job

---

## Phase 3 - External Pilot (Month 4-6)

### Strategy

- Approach 3 local schools
- Offer pilot access
- Collect structured feedback

### Requirements

- Multi-tenant isolation proven
- Onboarding workflow
- School creation flow
- Operational support process

---

## Phase 4 - Monetisation (Deferred)

Monetisation decisions are intentionally deferred until pilot evidence is strong.

### Entry Conditions

- Stable external pilot usage
- Strong retention and workflow adoption
- Clear value proof from compliance clarity and time savings

### Initial Options (Draft)

- Per school subscription
- Federation bundle option
- Tiered feature access (Lite / Standard / Multi-Org)

---

## Technical Stack (Confirmed)

- Next.js (App Router)
- Firebase Auth
- Firestore
- Firebase Storage
- TypeScript
- Zod validation
- shadcn/ui
- Tailwind CSS
- RBAC multi-tenant architecture

---

## Risk Management

| Risk | Mitigation |
| --- | --- |
| Scope creep | Lock MVP to training compliance only |
| Overengineering | Build only what pilot needs |
| Data complexity | Standardize training types and role mapping |
| Read/write costs | Use aggregate deltas + nightly reconciliation |
| Slow adoption | Make dashboard visually obvious and trustworthy |

---

## Strategic Reminder

Do not build everything at once.

Compliance first.
Clarity second.
Expansion third.
Revenue after validation.
