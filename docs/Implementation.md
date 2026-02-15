# SchoolTrack - Implementation Plan

Canonical compliance logic reference: `docs/ComplianceDecisionTable.md`.
Canonical migration runbook reference: `docs/MigrationExecutionChecklist.md`.

## Phase 0 - Strategic Foundation (Completed)

Status:
- Core contracts established.
- SchoolTrack brand and UK-first strategy aligned.

---

## Phase 1 - Platform Shell + TrainingTrack (Current Build Phase)

### Scope

Deliver SchoolTrack core shell and TrainingTrack as the first production module.

### Core Platform Deliverables

- Persistent shell (sidebar + top bar)
- Org and school scope controls
- Module navbar driven by user entitlements
- Module route mount (`/app/{moduleId}`)
- Shared entities (organisation, school, user, staff)
- Module health summaries (`moduleHealth/{moduleId}`)

### TrainingTrack Deliverables

- Training types
- Training records with expiry logic
- Training compliance dashboards
- Immutable module audit logs
- Aggregate updates and freshness surfacing

### UX Deliverables

- Sidebar module indicators using traffic-light states (green/amber/red/grey)
- Risk-priority ordering
- Drill-down and reason codes

### Success Criteria

- Core shell remains stable while module content changes.
- User sees only entitled modules in navbar.
- Module indicator gives at-a-glance status per module.
- TrainingTrack rules and dashboards work end-to-end.

### Phase 1 Execution Backlog

Tracking legend:
- `[x]` Completed
- `[ ]` Not started

Progress snapshot (as of 2026-02-15):
- Total stories: `24`
- Completed: `24`
- In progress: `0`
- Remaining: `0`

#### Epic P - Public Entry and Authentication

- [x] `US-001`: Public landing page at `/` with platform value proposition and CTAs
- [x] `US-002`: Sign-in page at `/sign-in` backed by Firebase Auth email/password
- [x] `US-003`: Sign-up page at `/sign-up` backed by Firebase Auth account creation
- [x] `US-004`: Protected route gate for `/app/*` with unauthenticated redirect
- [x] `US-005`: Post-auth redirect flow with `next` param support
- [x] `US-006`: Auth loading/error UX states for sign-in and sign-up

#### Epic A - Platform Shell Foundation

- [x] `US-101`: Persistent shell layout (sidebar + top bar) across `/app/*`
- [x] `US-102`: Org/school scope controls and scoped query context switching
- [x] `US-103`: Entitlement-driven module navbar from `users.enabledModules`
- [x] `US-104`: Module route mounting standard at `/app/{moduleId}`
- [x] `US-105`: Shared entities baseline (organisation, school, user, staff)
- [x] `US-106`: Module health summary contract at `moduleHealth/{moduleId}`

#### Epic B - TrainingTrack Domain

- [x] `US-201`: Training types management (create/edit/deactivate)
- [x] `US-202`: Training records + expiry/compliance logic implementation
- [x] `US-203`: Training compliance dashboard (org/school summaries + filters)
- [x] `US-204`: Immutable TrainingTrack audit log events
- [x] `US-205`: Aggregate refresh + freshness timestamp surfacing

#### Epic C - UX Indicators and Explainability

- [x] `US-301`: Sidebar traffic-light indicators (green/amber/red/grey)
- [x] `US-302`: Risk-priority ordering (red > amber > green > grey)
- [x] `US-303`: Drill-down views with reason codes per non-green state

#### Epic D - Security and Quality Gates

- [x] `US-401`: Enforce module entitlement in rules and UI routing paths
- [x] `US-402`: Scope isolation tests (org/school boundary leakage prevention)
- [x] `US-403`: Seeded module health state verification for indicators
- [x] `US-404`: Compliance explanation traceability to rule outputs

### Suggested Sprint Sequence (Phase 1)

1. Sprint 1: `US-001`, `US-002`, `US-003`, `US-004`, `US-005`, `US-006`
2. Sprint 2: `US-101`, `US-104`, `US-105`, `US-102`
3. Sprint 3: `US-103`, `US-106`, `US-401`, `US-402`
4. Sprint 4: `US-201`, `US-202`, `US-204`
5. Sprint 5: `US-203`, `US-205`, `US-301`, `US-302`, `US-303`, `US-403`, `US-404`, full regression and pilot readiness

### Definition of Done (Phase 1)

- All Phase 1 success criteria above are met.
- Security rules tests pass (`npm run firebase:rules:test`).
- Scope switching does not leak cross-org/school data.
- Non-entitled module access is denied in UI and rules.
- Module indicator states are correct for seeded data.
- Compliance explanations remain traceable end-to-end.

---

## Phase 2 - Additional Modules (Planned)

Candidate modules:
- `statutoryTrack`
- `clubTrack`
- `coshhTrack`

Entry requirement per module:
- module data contract defined under `modules/{moduleId}`
- module RBAC/entitlement rules tested
- module health summary integrated into sidebar indicators

---

## Phase 3 - Stabilisation and Scale

Objectives:
- optimize query/index efficiency per module
- improve operational alerts and exports
- harden reconciliation and observability

---

## Delivery Sequencing (Execution Order)

1. **Forge + Lumen:** implement core shell + module routing framework.
2. **Forge + Sentinel:** enforce module entitlement and security path boundaries.
3. **Sentinel + Forge:** complete TrainingTrack domain implementation.
4. **Lumen:** finalize module indicator UI and accessibility states.
5. **All:** regression + rules tests + pilot readiness checks.

---

## Test and Quality Gates

Required gates before each release increment:

- Security rules tests pass (`npm run firebase:rules:test`)
- Scope switching does not leak cross-org/school data
- Non-entitled module access is denied in UI and rules
- Module health indicator state is correct for seeded test data
- Compliance result explanations remain traceable

---

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Module sprawl too early | Keep production scope to core + TrainingTrack first |
| Entitlement drift between UI and rules | Source module access from `users.enabledModules` and test both paths |
| Cross-module coupling | Enforce `modules/{moduleId}` ownership boundary |
| Confusing status signals | Use fixed traffic-light semantics and explicit labels |

---

## Strategic Reminder

Build one strong platform shell.
Ship one excellent first module.
Scale modules only through the same contract.
