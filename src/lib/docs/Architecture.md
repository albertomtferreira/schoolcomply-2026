# Compliance SaaS – Technical Architecture

> Goal: a **multi-tenant**, **role-based** system that gives **instant compliance clarity**.
> Rule: **1 expired training = non-compliant**.

---

## 1. Tech Stack (Baseline)

- **Frontend:** Next.js (App Router)
- **UI:** Tailwind + shadcn/ui
- **Language:** TypeScript
- **Validation:** Zod
- **Auth:** Firebase
- **DB:** Firestore
- **Storage:** Firebase Storage (for certificates)
- **Hosting:** Vercel

---

## 2. Tenancy Model

### Tenancy Principle

Every document that matters must be scoped by **orgId**.

### Recommended Hierarchy

- **Organisation (Org)** = Federation or single school customer
- **School** = entity inside org

### Data placement

Prefer **nested collections** under an org for clarity and security:

```
organisations/{orgId}
  schools/{schoolId}
  users/{userId}
  staff/{staffId}
  trainingTypes/{trainingTypeId}
  trainingRecords/{recordId}
  aggregates/{aggregateId}
  auditLogs/{logId}
```

auditLogs/{logId}

```

### Storage Placement (New)

Mirror the structure for security:

```

storage/{orgId}/{schoolId}/{staffId}/{file.pdf}

```

This makes it hard to accidentally query across orgs.

---

## 3. Roles + RBAC

### Roles (example)

* **superadmin**: platform owner/operator
* **org_admin**: federation-level admin
* **school_admin**: admin for a single school
* **staff**: can view own profile + submit/update (optional)
* **viewer**: read-only

### Role Assignment

* superadmin assigns org_admin
* org_admin creates schools and assigns school_admin
* school_admin manages staff/training records for their school

### Access Scope

* **org_admin**: everything within org
* **school_admin**: limited to a schoolId within org
* **staff**: limited to staffId (and optionally schoolId)

Store both role and scope claims:

```

role: 'org_admin' | 'school_admin' | 'staff' | 'viewer'
orgId: string
schoolIds?: string[]
staffId?: string

```

> Best practice: keep authorisation logic consistent: **role + orgId + scope**.

---

## 4. Firestore Schema (v1)

### 4.1 organisations/{orgId}

Purpose: tenant root.

**Fields**

* name
* slug
* status: active|paused
* createdAt, updatedAt

---

### 4.2 organisations/{orgId}/schools/{schoolId}

Purpose: school entities.

**Fields**

* name
* code (optional)
* address (optional)
* status: active|archived
* createdAt, updatedAt

---

### 4.3 organisations/{orgId}/users/{userId}

Purpose: app user profile + authorisation scope.

**Fields**

* authUid (if separate)
* fullName
* email
* role
* orgId
* schoolIds: string[] (for school_admin/viewer)
* staffId (if linked)
* isActive
* createdAt, updatedAt

> Decision: Keep Users and Staff separate.
> Users = Login access. Staff = Compliance entity.
> If a User is also Staff (e.g., Headteacher), link them via `users.staffId`.
> If using Clerk, store clerkUserId. If Firebase Auth, store uid.

---

### 4.4 organisations/{orgId}/staff/{staffId}

Purpose: staff members who have training requirements.

**Fields**

* fullName
* email (optional)
* schoolIds: string[] (Supports working across multiple schools in a trust)
* jobTitle (optional)
* startDate (optional)
* endDate (optional)
* isActive
* createdAt, updatedAt

---

### 4.5 organisations/{orgId}/trainingTypes/{trainingTypeId}

Purpose: definitions of training categories.

**Fields**

* name (e.g., "First Aid at Work")
* code (optional)
* expires: boolean
* defaultValidityDays (optional)
* required: boolean (global)
* requiredForRoles: string[] (optional)
* createdAt, updatedAt

---

### 4.6 organisations/{orgId}/trainingRecords/{recordId}

Purpose: evidence + expiry tracking.

**Fields**

* staffId
* schoolId (denormalised for fast queries)
* trainingTypeId
* issuedAt (optional)
* expiresAt (if expires=true)
* provider (optional)
* certificateUrl (optional)
* notes (optional)
* createdBy
* createdAt, updatedAt

**Derived fields (recommended)**

* status: valid|expiring|expired (computed on write)
* daysToExpiry (computed on write)

> Denormalise `schoolId` to avoid extra reads.

---

### 4.7 organisations/{orgId}/aggregates/* (optional but recommended)

Purpose: fast dashboards without heavy reads.

Suggested docs:

* `aggregates/orgCompliance`
* `aggregates/school_{schoolId}`

**Fields**

* compliantCount
* nonCompliantCount
* expiringSoonCount
* lastCalculatedAt

---

### 4.8 organisations/{orgId}/auditLogs/{logId} (P1)

Purpose: accountability.

**Fields**

* actorUserId
* action (create/update/delete)
* entityType (staff/trainingRecord/trainingType)
* entityId
* before (optional)
* after (optional)
* createdAt

> **Sentinel Requirement:** Audit logs must be **immutable**. No edit access for any role.

---

## 5. Compliance Logic

### Status Rules

Let `now = today`.

* **Expired**: `expiresAt < now`
* **Expiring Soon**: `now <= expiresAt <= now + 60 days` (Sentinel Requirement: Predictive warning)
* **Valid**: `expiresAt > now + 60 days`

### Staff Non-Compliance Rule

A staff member is **non-compliant** if **any required training record** is **expired**.

> **Crucial:** Only checks **Active** staff (`isActive == true`). Leavers do not count against the score.

### School Non-Compliance Rule

A school is **non-compliant** if **any ACTIVE staff member** is **non-compliant**.

> This is intentionally strict and matches the reputational-risk logic you stated.
> **Clarification:** If a staff member works across 3 schools and is non-compliant, **ALL 3 schools are non-compliant**. This is not a bug; it is an accurate reflection of risk.

---

## 6. Query Patterns (Dashboards)

### Org dashboard

* List schools with compliance state:

  * Use aggregates if available, otherwise:
  * Query `trainingRecords` filtered by `schoolId` and `status in [expired, expiring]` and aggregate.

### School dashboard

* Staff list:

  * Query `staff` where `schoolId == X`
  * Query `trainingRecords` where `schoolId == X` (or where staffIds in chunks)

### Staff profile

* Query `trainingRecords` where `staffId == X`

---

## 7. Indexes (Likely Needed)

Create composite indexes when Firestore prompts.
Common ones:

* `trainingRecords` by `schoolId + status`
* `trainingRecords` by `staffId + trainingTypeId`
* `trainingRecords` by `schoolId + expiresAt`

---

## 8. Security Rules Strategy (High Level)

### Must-haves

* All reads/writes require auth
* user must have `orgId` matching the path
* role-based write permissions

### Policy outline

* **superadmin**: may access any org (admin console only)
* **org_admin**: read/write everything inside their org
* **school_admin**: read/write only for their `schoolIds`
* **staff**: read own staff profile + own records (optional); write only their own record submissions (optional)
* **viewer**: read-only within scope

### Practical rule checks

* Validate `request.auth.uid` exists
* Validate `get(/organisations/{orgId}/users/{uid}).data.orgId == orgId`
* Validate scope for school-based docs: `resource.data.schoolId in user.schoolIds`

> Keep rules boring and predictable.

---

## 9. Server Actions / API Design

### Recommended pattern

* Use **Server Actions** for admin workflows
* Centralise writes so:

  * derived fields are calculated consistently
  * audit logs can be written
  * aggregates updated

### On-write steps for trainingRecords

1. Validate payload (Zod)
2. Compute status + daysToExpiry
3. Write record
4. Update aggregates (org + school)
5. Write audit log

> **Critical:** Steps 2-4 MUST be wrapped in a **Firestore Transaction** to ensure aggregates remain accurate under high concurrency.

---

## 10. Aggregation Strategy (When to Introduce)

### Strategy: Immediate Implementation (P1)

> **Decision:** Aggregates are Core, not Optional.

We must support instant dashboard loading. We cannot query 50+ staff records every time the dashboard loads.

### Add aggregates when:

* dashboards feel slow
* reads become expensive

Aggregate recalculation options:

* On write (preferred)
* Scheduled nightly recalculation (backup)

---

## 11. Environments & Separation

* `dev`: local + emulator
* `staging`: for external pilot
* `prod`: real customers

Use separate Firebase projects to prevent cross-contamination.

---

## 12. MVP Definition of Done (Tech)

* Tenant isolation verified
* RBAC guards in UI + rules in Firestore
* Compliance engine tested
* Org dashboard + school dashboard work end-to-end
* Seed + onboarding works for your federation
* Basic audit fields included everywhere

---

## Appendix: Suggested Document IDs

Use deterministic IDs where helpful:

* `users/{uid}`
* `aggregates/orgCompliance`

Use random IDs for:

* trainingRecords
* auditLogs
```
