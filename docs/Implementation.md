# SchoolTrack Implementation Plan (Restart v1)

Purpose: execute a clean rebuild after the reset decision.
Status: active plan.
Last updated: 2026-02-15.

Canonical references:

- `docs/Architecture.md`
- `docs/DataContract.md`
- `docs/SecurityContract.md`
- `docs/UXTruthContract.md`

---

## 1. Reset Outcome

- Previous implementation is treated as learning material, not delivery baseline.
- New build starts from the restart contracts listed above.
- Any prior "completed" status is non-authoritative.
- Delivery starts from a clean Next.js installation.
- Existing app code is not copied into the new codebase.

---

## 2. Phase Plan

### Phase 0 - Greenfield Bootstrap (Current)

Objective:

- Stand up a clean, production-ready foundation from zero.

Engineering tasks:

- [x] initialize a new Next.js project (`create-next-app`) for SchoolTrack
- [x] define base folder layout (`src/app`, `src/components`, `src/lib`, `src/modules`, `src/types`)
- [x] configure TypeScript strict mode and shared path aliases
- [x] configure ESLint and Prettier with project scripts
- [x] add baseline UI stack dependencies (Tailwind, component primitives)
- [x] add Firebase client and admin SDK dependencies
- [x] add env parsing/validation layer for server and client vars

Firebase and runtime tasks:

- [ ] configure `.firebaserc` aliases (`dev`, `staging`, `prod`)
- [ ] configure `firebase.json` emulator mappings
- [ ] wire local emulator startup scripts
- [ ] create baseline `firestore.rules` and `firestore.indexes.json` placeholders
- [ ] implement minimal auth + Firestore bootstrap modules in `src/lib/firebase/*`

Quality and ops tasks:

- [ ] create CI scripts for lint, typecheck, test placeholders
- [ ] add pre-commit or local quality command (single command for lint + typecheck)
- [ ] verify clean install from empty cache and fresh clone
- [ ] document bootstrap in `docs/PlatformBootstrap.md`

Exit gate:

- project boots locally with `npm run dev`
- emulators start and are reachable
- lint and typecheck pass on clean clone
- env validation fails fast when required keys are missing

### Phase 1 - Re-baseline Contracts

Objective:

- Convert architecture contracts into enforceable schema and access control.

Data contract tasks:

- [ ] define concrete TypeScript models for `users`, `orgs`, `members`, `schools`, `staff`
- [ ] define runtime validators for write payloads
- [ ] freeze deterministic ID rules (`users/{uid}`, `members/{uid}`, `moduleHealth/{moduleId}`)
- [ ] define module namespace conventions under `orgs/{orgId}/modules/{moduleId}`

Security contract tasks:

- [ ] implement Firestore rules for all required root and org paths
- [ ] implement role + scope + entitlement checks using membership docs
- [ ] enforce module access intersection rule (`orgs.subscribedModules` + `members.enabledModules`)
- [ ] enforce create-only rule for module audit logs
- [ ] enforce no client writes to aggregate-derived docs unless explicitly allowed

Test harness tasks:

- [ ] rebuild `firestore.rules` tests for new path topology
- [ ] add positive tests for each role in own org/scope
- [ ] add deny tests for cross-org reads/writes
- [ ] add deny tests for module entitlement mismatch
- [ ] add deny tests for out-of-scope school access

Routing scaffolding tasks:

- [ ] scaffold public routes for marketing and auth (`/`, `/sign-in`, `/sign-up`)
- [ ] scaffold app shell route groups for `/app/*`
- [ ] scaffold module-aware route pattern `/app/{moduleId}/{child}`
- [ ] define auth redirect behavior between public routes and authenticated `/app/*` routes
- [ ] scaffold not-authorized and not-found states

Documentation tasks:

- [ ] confirm `docs/Architecture.md`, `docs/DataContract.md`, `docs/SecurityContract.md` match implementation choices
- [ ] add decisions log in this file for any contract clarifications

Exit gate:

- rules test suite green in emulator
- core shell route tree compiles and renders
- schema, rules, and route conventions are consistent with restart docs

### Phase 2 - Platform Shell

Objective:

- Deliver the complete role-aware shell and navigation framework.

Top bar tasks:

- [ ] implement top bar layout component for authenticated app routes
- [ ] add org selector behavior (single-org read-only, multi-org selectable)
- [ ] add school selector constrained by membership scope
- [ ] add global user quick actions entry point

Sidebar tasks:

- [ ] implement sidebar layout and section ordering (user menu, role-aware management, modules)
- [ ] implement user menu (identity, profile/settings, sign out)
- [ ] implement management links by role (`platform_admin`, `org_admin`, `school_admin`, `staff/viewer`)
- [ ] implement expandable module rows and active/expanded state management
- [ ] implement TrainingTrack children (`Dashboard`, `Training Records`, `Staff`, `Training Definitions`)

Entitlement and guard tasks:

- [ ] load membership and org subscription at shell level
- [ ] filter visible modules by intersection entitlement
- [ ] block direct URL navigation to unauthorized module/child routes
- [ ] redirect unauthorized routes to nearest allowed destination

State and UX tasks:

- [ ] persist open sidebar groups and last selected child route (session/local)
- [ ] render loading/skeleton states for shell data
- [ ] render empty states when no modules are available
- [ ] ensure keyboard navigation and accessible labels for menu and submenu controls

Testing tasks:

- [ ] add component/integration tests for role-based menu visibility
- [ ] add tests for module entitlement filtering and route guards
- [ ] add tests for module submenu expansion and child route rendering
- [ ] run manual UX checklist from `docs/UXTruthContract.md`

Exit gate:

- role and entitlement visibility verified for all roles
- navigation contract from `docs/UXTruthContract.md` passes QA checklist
- unauthorized direct routes are blocked and redirected correctly

### Phase 3 - TrainingTrack Rebuild

Objective:

- Implement TrainingTrack end-to-end on the new data and security contracts.

Domain model tasks:

- [ ] define TrainingTrack types and validators (`trainingDefinitions`, `trainingRecords`, `auditLogs`)
- [ ] map status derivation rules to `docs/ComplianceDecisionTable.md`
- [ ] define query contracts and indexes for school/staff dashboards

Feature tasks:

- [ ] build Training Definitions CRUD (create, edit, activate/deactivate)
- [ ] build Training Records CRUD with expiry logic
- [ ] build Staff module view with assigned requirements and status summary
- [ ] build TrainingTrack Dashboard with compliance buckets and filters
- [ ] build immutable module audit log creation on all write actions

Computation tasks:

- [ ] implement status calculation (`valid`, `expiring`, `expired`) on trusted write path
- [ ] implement required training applicability by role
- [ ] implement missing-required detection for compliance rollups
- [ ] implement `moduleHealth/trainingTrack` updater contract

Security and data integrity tasks:

- [ ] enforce module path ownership in code and rules
- [ ] validate foreign keys (`staffId`, `schoolId`, `trainingDefinitionId`) within org scope
- [ ] ensure client cannot write derived compliance fields directly

Testing tasks:

- [ ] add unit tests for status and compliance decision logic
- [ ] add integration tests for Training Definitions and Records flows
- [ ] add rules tests for TrainingTrack path authorization
- [ ] add regression tests for audit log immutability
- [ ] add seeded-data test cases for dashboard filters and counts

Exit gate:

- end-to-end flow works under new schema and rules
- compliance outputs match `docs/ComplianceDecisionTable.md` for seeded scenarios
- TrainingTrack navigation and pages align with `docs/UXTruthContract.md`

### Phase 4 - Stabilize

Objective:

- Hardening, observability, and pilot readiness.

Quality hardening tasks:

- [ ] finalize regression suite across auth, shell, and TrainingTrack
- [ ] raise minimum coverage targets for critical modules
- [ ] add failure-mode tests (missing data, stale aggregates, permission failures)

Aggregate and health tasks:

- [ ] verify aggregate update behavior under normal write flows
- [ ] verify module health transitions (`green`, `amber`, `red`, `grey`)
- [ ] verify timestamps/freshness display and stale-state behavior
- [ ] add reconciliation routine spec and backlog item if not implemented in phase

Performance and reliability tasks:

- [ ] verify query/index performance on seeded medium dataset
- [ ] remove duplicate or unbounded queries
- [ ] add structured logging for auth, entitlement, and write failures
- [ ] define basic error budget and alert thresholds for pilot period

Operational readiness tasks:

- [ ] build seed scripts for demo and QA orgs
- [ ] define release checklist (`dev -> staging -> prod`)
- [ ] document rollback playbook for schema/rules/deploy issues
- [ ] prepare pilot runbook and support triage flow
- [ ] finalize open risks and deferred backlog list

Exit gate:

- no critical or high-severity defects open
- pilot checklist approved
- release and rollback runbooks are available and reviewed

---

## 3. Work Rules During Restart

1. No new module beyond TrainingTrack until Phase 3 exit gate passes.
2. Security rules and UI entitlement must ship together.
3. Every feature must reference restart contracts, not legacy docs.
4. If a behavior is needed, reimplement it in the greenfield app rather than reusing old code.
5. Keep a clean file structure: route/layout files compose feature components rather than containing large UI blocks.
6. Prefer standalone and reusable components for UI primitives and shell features (for example, `Sidebar` implemented in `src/components` and consumed by layout).
