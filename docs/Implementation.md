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
