# Compliance SaaS - Technical Architecture

> Goal: a **multi-tenant**, **role-based** system that gives **instant compliance clarity**.
> Rule: **1 expired training = non-compliant**.
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
- **Storage:** Firebase Storage (for certificates)
- **Hosting:** Vercel

---

## 2. Tenancy Model

### Tenancy Principle

Every document that matters must be scoped by **orgId**.

### Recommended Hierarchy

- **Organisation (Org)** = federation or single school customer
- **School** = entity inside org

### Data Placement

Prefer **nested collections** under an org for clarity and security:

```txt
organisations/{orgId}
  schools/{schoolId}
  users/{userId}
  staff/{staffId}
  trainingTypes/{trainingTypeId}
  trainingRecords/{recordId}
  aggregates/{aggregateId}
  auditLogs/{logId}
```

### Storage Placement

Mirror the structure for security:

```txt
storage/{orgId}/{schoolId}/{staffId}/{file.pdf}
```

This makes accidental cross-org access significantly harder.

---

## 3. Roles + RBAC

### Roles

- **superadmin**: platform owner/operator
- **org_admin**: federation-level admin
- **school_admin**: admin for one or more schools
- **staff**: can view own profile + optionally submit own evidence
- **viewer**: read-only

### Role Assignment

- superadmin assigns org_admin
- org_admin creates schools and assigns school_admin
- school_admin manages staff and training records for their scoped schools

### Access Scope Claims

Store both role and scope claims:

```ts
role: 'org_admin' | 'school_admin' | 'staff' | 'viewer'
orgId: string
schoolIds?: string[]
staffId?: string
```

> Best practice: keep authorization logic consistent as **role + orgId + scope**.

---

## 4. Firestore Schema (v1)

### 4.1 organisations/{orgId}

Purpose: tenant root.

**Fields**

- name
- slug
- status: active|paused
- createdAt, updatedAt

---

### 4.2 organisations/{orgId}/schools/{schoolId}

Purpose: school entities.

**Fields**

- name
- code (optional)
- address (optional)
- status: active|archived
- createdAt, updatedAt

---

### 4.3 organisations/{orgId}/users/{userId}

Purpose: app user profile + authorization scope.

**Fields**

- uid (Firebase Auth UID)
- fullName
- email
- role
- orgId
- schoolIds: string[] (for school_admin/viewer)
- staffId (if linked)
- isActive
- createdAt, updatedAt

> Decision: keep Users and Staff separate.
> Users = login access. Staff = compliance entity.
> If a user is also staff (for example a Headteacher), link via `users.staffId`.
> Auth provider is Firebase only. `users/{userId}` should use Firebase UID as document ID.

---

### 4.4 organisations/{orgId}/staff/{staffId}

Purpose: staff members who have training requirements.

**Fields**

- fullName
- email (optional)
- schoolIds: string[] (staff can be linked to multiple schools)
- employmentRole (for requirement mapping)
- jobTitle (optional)
- startDate (optional)
- endDate (optional)
- isActive
- createdAt, updatedAt

---

### 4.5 organisations/{orgId}/trainingTypes/{trainingTypeId}

Purpose: definitions of training categories.

**Fields**

- name (for example "First Aid at Work")
- code (optional)
- expires: boolean
- defaultValidityDays (optional)
- required: boolean (global)
- requiredForRoles: string[] (optional, maps to `staff.employmentRole`)
- createdAt, updatedAt

---

### 4.6 organisations/{orgId}/trainingRecords/{recordId}

Purpose: evidence + expiry tracking.

**Fields**

- staffId
- schoolId (denormalized for fast school dashboards)
- trainingTypeId
- issuedAt (optional)
- expiresAt (if expires=true)
- provider (optional)
- certificateUrl (optional)
- notes (optional)
- createdBy
- createdAt, updatedAt

**Derived fields (recommended)**

- status: valid|expiring|expired (computed on write)
- daysToExpiry (computed on write)

> Denormalize `schoolId` in records to avoid extra reads on school-level pages.

---

### 4.7 organisations/{orgId}/aggregates/* (required)

Purpose: fast dashboards without heavy reads.

Suggested docs:

- `aggregates/orgCompliance`
- `aggregates/school_{schoolId}`

**Fields**

- compliantCount
- nonCompliantCount
- expiringSoonCount
- lastCalculatedAt

---

### 4.8 organisations/{orgId}/auditLogs/{logId} (P1)

Purpose: accountability.

**Fields**

- actorUserId
- action (create/update/delete)
- entityType (staff/trainingRecord/trainingType)
- entityId
- before (optional)
- after (optional)
- createdAt

> **Sentinel Requirement:** audit logs are immutable. No update/delete access for any role.

---

## 5. Compliance Logic

For complete and authoritative decision rules, use `docs/ComplianceDecisionTable.md`.

### Status Rules

Let `now = today`.

- **Expired**: `expiresAt < now`
- **Expiring Soon**: `now <= expiresAt <= now + 60 days`
- **Valid**: `expiresAt > now + 60 days`

### Missing Required Record Rule

If a required training type applies to a staff member and no valid matching record exists, that requirement is **missing** and counts as **non-compliant**.

### Staff Non-Compliance Rule

A staff member is **non-compliant** if any required training is:

- expired, or
- missing

> Only active staff (`isActive == true`) are included. Leavers do not count against the score.

### School Non-Compliance Rule

A school is **non-compliant** if any active staff member linked to that school is non-compliant.

> If a staff member works across 3 schools and is non-compliant, all 3 schools are non-compliant.

---

## 6. Query Patterns (Dashboards)

Dashboard state semantics, badge behavior, and filter/sort contracts are defined in `docs/UXTruthContract.md`.

### Org Dashboard

- List schools with compliance state:
  - Read `aggregates/school_{schoolId}` where available.
  - Fallback only for diagnostics/rebuild jobs.

### School Dashboard

- Staff list:
  - Query `staff` where `schoolIds array-contains {schoolId}`
- Training records:
  - Query `trainingRecords` where `schoolId == {schoolId}`

### Staff Profile

- Query `trainingRecords` where `staffId == {staffId}`

---

## 7. Indexes (Likely Needed)

Create composite indexes when Firestore prompts. Common ones:

- `trainingRecords` by `schoolId + status`
- `trainingRecords` by `staffId + trainingTypeId`
- `trainingRecords` by `schoolId + expiresAt`
- `staff` by `schoolIds` (array-contains)

Frozen index baseline is defined in `firestore.indexes.json`.

---

## 8. Security Rules Strategy (High Level)

Detailed RBAC matrix, rule invariants, and rules test cases are defined in `docs/SecurityContract.md`.
Baseline Firestore rules file: `firestore.rules`.

### Must-Haves

- All reads/writes require auth
- User org must match path org
- Role-based write permissions

### Policy Outline

- **superadmin**: may access any org (admin console only)
- **org_admin**: read/write everything inside their org
- **school_admin**: read/write only for their `schoolIds`
- **staff**: read own staff profile + own records (optional); write own submissions (optional)
- **viewer**: read-only within scope

### Practical Rule Checks

- Validate `request.auth.uid` exists
- Validate `get(/organisations/{orgId}/users/{uid}).data.orgId == orgId`
- Validate scope for school docs: `resource.data.schoolId in user.schoolIds`
- Validate scope for staff docs: at least one `resource.data.schoolIds` entry exists in `user.schoolIds`

> Keep rules predictable.

---

## 9. Server Actions / API Design

### Recommended Pattern

- Use server actions for admin workflows
- Centralize writes so:
  - derived fields are calculated consistently
  - audit logs are written
  - aggregates are updated

### On-Write Steps for trainingRecords

1. Validate payload (Zod)
2. Compute status + daysToExpiry
3. Write record
4. Update impacted aggregates (org + affected schools only)
5. Write audit log

> Steps 2-4 should run in a Firestore transaction.

---

## 10. Aggregation Strategy (P1)

Detailed delta logic, event handling, reconciliation, and idempotency rules are defined in `docs/AggregateContract.md`.

### Decision

Aggregates are core in MVP.

### Read/Write Minimization Rules

- Keep only two aggregate levels in MVP:
  - `aggregates/orgCompliance`
  - `aggregates/school_{schoolId}`
- Apply delta updates (increment/decrement) instead of full recounts.
- Recompute only impacted schools from `staff.schoolIds` plus org summary.
- Run a nightly reconciliation job to correct drift and reduce risk from missed updates.

---

## 11. Environments & Separation

Detailed environment contracts, aliases, and local setup workflow are defined in `docs/PlatformBootstrap.md`.

- `dev`: local + emulator
- `staging`: external pilot
- `prod`: real customers

Use separate Firebase projects for strict separation.

---

## 12. MVP Definition of Done (Tech)

- Tenant isolation verified
- RBAC guards in UI + rules in Firestore
- Compliance engine includes missing-required-record detection
- Org dashboard + school dashboard work end-to-end
- Seed + onboarding works for your federation
- Immutable audit logs enforced by rules

---

## Appendix: Suggested Document IDs

Use deterministic IDs where helpful:

- `users/{uid}`
- `aggregates/orgCompliance`

Use random IDs for:

- `trainingRecords`
- `auditLogs`
