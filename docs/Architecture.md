# SchoolTrack - Technical Architecture

> Goal: a **multi-tenant**, **role-based** platform that gives **instant operational and compliance clarity**.
> Core model: **SchoolTrack shell + module workspaces**.
> Rule baseline (TrainingTrack): **1 expired required training = non-compliant**.
> Canonical rules reference: `docs/ComplianceDecisionTable.md`.
> Canonical data contract reference: `docs/DataContract.md`.
> Canonical security contract reference: `docs/SecurityContract.md`.
> Canonical aggregate contract reference: `docs/AggregateContract.md`.
> Canonical platform bootstrap reference: `docs/PlatformBootstrap.md`.
> Canonical UX truth reference: `docs/UXTruthContract.md`.

---

## 1. Tech Stack (Baseline)

- **Frontend:** Next.js (App Router)
- **UI:** Tailwind + shadcn/ui
- **Language:** TypeScript
- **Validation:** Zod
- **Auth:** Firebase Auth
- **DB:** Firestore
- **Storage:** Firebase Storage
- **Hosting:** Vercel

---

## 2. Platform Composition (Core + Modules)

SchoolTrack architecture is split into:

- **Core shell**
  - persistent sidebar
  - persistent top bar
  - scope controls (org + school)
  - module discovery and module switching
- **Module workspace**
  - children rendered into the core shell content area
  - domain-specific entities and workflows

Module IDs (initial):

- `trainingTrack`
- `statutoryTrack`
- `clubTrack`
- `coshhTrack`

Navigation contract:

- Top navbar shows only modules user is entitled to access.
- Sidebar can show all entitled modules plus module health indicators.
- Module routing mount pattern: `/app/{moduleId}/...`.

---

## 3. Tenancy Model

### Tenancy Principle

Every document must be scoped by **orgId** path.

### Recommended Hierarchy

- **Organisation (Org)** = federation or single school customer
- **School** = entity inside org

### Data Placement

Shared platform entities live at org root; module entities live under module namespace.

```txt
organisations/{orgId}
  schools/{schoolId}
  users/{userId}
  staff/{staffId}
  aggregates/{aggregateId}
  moduleHealth/{moduleId}
  modules/{moduleId}/...
```

### Storage Placement

Mirror module-aware structure for security and lifecycle management:

```txt
storage/{orgId}/{moduleId}/{schoolId}/{entityId}/{file}
```

---

## 4. Roles + RBAC

### Roles

- **superadmin**: platform owner/operator
- **org_admin**: federation-level admin
- **school_admin**: admin for one or more schools
- **staff**: can view own profile + optionally submit own evidence
- **viewer**: read-only

### Access Scope Claims

Store role, scope, and module entitlements:

```ts
role: 'org_admin' | 'school_admin' | 'staff' | 'viewer'
orgId: string
schoolIds?: string[]
staffId?: string
enabledModules: string[]
```

Authorization logic is always **role + orgId + scope + module entitlement**.

---

## 5. Shared Core Schema (v1)

### 5.1 organisations/{orgId}

Purpose: tenant root.

Fields:
- `name`
- `slug`
- `status: active|paused`
- `createdAt, updatedAt`

### 5.2 organisations/{orgId}/schools/{schoolId}

Purpose: school entities.

Fields:
- `name`
- `code` (optional)
- `address` (optional)
- `status: active|archived`
- `createdAt, updatedAt`

### 5.3 organisations/{orgId}/users/{uid}

Purpose: app user profile + authorization scope + module access.

Fields:
- `uid`
- `fullName`
- `email`
- `role`
- `orgId`
- `schoolIds: string[]` (optional)
- `staffId` (optional)
- `enabledModules: string[]`
- `isActive`
- `createdAt, updatedAt`

### 5.4 organisations/{orgId}/staff/{staffId}

Purpose: shared person entity used across modules.

Fields:
- `fullName`
- `email` (optional)
- `schoolIds: string[]`
- `employmentRole`
- `jobTitle` (optional)
- `startDate` (optional)
- `endDate` (optional)
- `isActive`
- `createdAt, updatedAt`

### 5.5 organisations/{orgId}/moduleHealth/{moduleId}

Purpose: lightweight status summary for sidebar module indicators.

Fields:
- `state: 'green' | 'amber' | 'red' | 'grey'`
- `openRiskCount: number`
- `lastCalculatedAt`
- `summary` (optional)

### 5.6 organisations/{orgId}/aggregates/*

Purpose: fast shared dashboards.

Suggested docs:
- `aggregates/orgCompliance`
- `aggregates/school_{schoolId}`

---

## 6. TrainingTrack Module Schema (v1)

Training entities are owned by `trainingTrack`.

```txt
organisations/{orgId}/modules/trainingTrack/trainingTypes/{trainingTypeId}
organisations/{orgId}/modules/trainingTrack/trainingRecords/{recordId}
organisations/{orgId}/modules/trainingTrack/auditLogs/{logId}
```

### trainingTypes fields
- `name`
- `code` (optional)
- `expires: boolean`
- `defaultValidityDays` (optional)
- `required: boolean`
- `requiredForRoles: string[]` (optional)
- `createdAt, updatedAt`

### trainingRecords fields
- `staffId`
- `schoolId`
- `trainingTypeId`
- `issuedAt` (optional)
- `expiresAt` (if expires=true)
- `provider` (optional)
- `certificateUrl` (optional)
- `notes` (optional)
- `createdBy`
- `createdAt, updatedAt`
- `status: valid|expiring|expired` (derived)
- `daysToExpiry` (derived)

### auditLogs fields
- `actorUserId`
- `action`
- `entityType`
- `entityId`
- `before` (optional)
- `after` (optional)
- `moduleId: 'trainingTrack'`
- `createdAt`

---

## 7. Query Patterns

### Core shell
- Load user profile and `enabledModules`.
- Load `moduleHealth/*` for entitled modules to render sidebar indicators.

### TrainingTrack
- Staff list: query shared `staff` where `schoolIds array-contains {schoolId}`.
- Training records: query `modules/trainingTrack/trainingRecords` where `schoolId == {schoolId}`.
- Staff profile module view: query training records where `staffId == {staffId}`.

---

## 8. Security Rules Strategy (High Level)

Detailed RBAC matrix and rule invariants are defined in `docs/SecurityContract.md`.

Must-haves:
- All reads/writes require auth.
- Path org must equal user org.
- Module path access requires module entitlement.
- Module writes cannot mutate core identity entities.

---

## 9. Aggregation Strategy

- Keep shared org/school aggregates for global views.
- Keep module-specific health summaries in `moduleHealth/{moduleId}` for sidebar indicators.
- Update only impacted org/school/module aggregates using delta logic.
- Run periodic reconciliation for drift correction.

---

## 10. MVP Definition of Done (Tech)

- Tenant isolation verified.
- RBAC + module entitlement enforcement in rules and server actions.
- Core shell persists across module navigation.
- Top navbar lists only entitled modules.
- Sidebar renders module health indicator (traffic-light state).
- TrainingTrack works end-to-end as first module.
- Immutable module audit logs enforced.

---

## Appendix: ID Conventions

Deterministic IDs:
- `users/{uid}`
- `aggregates/orgCompliance`
- `moduleHealth/{moduleId}`

Generated IDs:
- `schools/{schoolId}`
- `staff/{staffId}`
- `modules/{moduleId}/trainingTypes/{trainingTypeId}`
- `modules/{moduleId}/trainingRecords/{recordId}`
- `modules/{moduleId}/auditLogs/{logId}`
