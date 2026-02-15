# Firestore Security Contract (v1)

Purpose: Phase 0.3 RBAC and security-rules baseline for MVP implementation.

Status: approved draft baseline for implementation and emulator testing.
Last updated: 2026-02-15.

Canonical companions:
- `docs/Architecture.md`
- `docs/DataContract.md`
- `docs/ComplianceDecisionTable.md`
- `firestore.rules`

---

## 1. RBAC Matrix (Role-to-Action)

Scope keys:
- `org`: tenant-wide inside `organisations/{orgId}`
- `school`: only docs where school is in `user.schoolIds`
- `self`: only user-linked `staffId`

| Resource | superadmin | org_admin | school_admin | staff | viewer |
| --- | --- | --- | --- | --- | --- |
| `organisations/{orgId}` | R/W | R/W | R | R | R |
| `schools` | R/W | R/W | R (school scope) | R (school scope) | R (school scope) |
| `users` | R/W | R/W | R (school scope visibility only) | R self | R (school scope) |
| `staff` | R/W | R/W | R/W (school scope) | R self | R (school scope) |
| `trainingTypes` | R/W | R/W | R | R | R |
| `trainingRecords` | R/W | R/W | R/W (school scope) | R self, optional submit self | R (school scope) |
| `aggregates` | R/W | R | R (school scope) | R (limited) | R (school scope) |
| `auditLogs` | R/W | R, create | R, create (school scope actions) | no access | R (read-only, scoped) |

Notes:
- In MVP, writes should be centralized in server actions / Admin SDK where possible.
- Client writes may be further restricted in production even if role matrix allows them.
- Audit logs are immutable: no update/delete for any non-admin bypass path.

---

## 2. Rule Invariants

1. Auth required for all access.
2. Tenant isolation required: user must belong to `orgId` in path.
3. Role and scope both required for non-org-admin operations.
4. Staff can never mutate compliance state directly (`status`, aggregate counts).
5. Audit logs are create-only from rules perspective.
6. Derived fields are write-protected from untrusted clients.

---

## 3. Firestore Rules Coverage (Required Paths)

Rules must explicitly cover:
- `organisations/{orgId}`
- `organisations/{orgId}/schools/{schoolId}`
- `organisations/{orgId}/users/{uid}`
- `organisations/{orgId}/staff/{staffId}`
- `organisations/{orgId}/trainingTypes/{trainingTypeId}`
- `organisations/{orgId}/trainingRecords/{recordId}`
- `organisations/{orgId}/aggregates/{aggregateId}`
- `organisations/{orgId}/auditLogs/{logId}`

---

## 4. Rules Test Cases (Phase 0.3 Minimum)

Each case should be implemented in emulator tests and asserted as allow/deny.

### 4.1 Tenant Isolation

1. `org_admin` from org A reads school from org B -> deny.
2. `school_admin` from org A writes training record in org B -> deny.

### 4.2 Org Admin Access

3. `org_admin` reads/writes staff in own org -> allow.
4. `org_admin` creates training type in own org -> allow.

### 4.3 School Scope Enforcement

5. `school_admin` with `schoolIds=['s1']` reads record where `schoolId='s1'` -> allow.
6. `school_admin` with `schoolIds=['s1']` writes record where `schoolId='s2'` -> deny.
7. `viewer` with `schoolIds=['s1']` reads staff linked to `s1` -> allow.
8. `viewer` attempts any write -> deny.

### 4.4 Staff Self Access

9. Staff user reads own staff doc via `users.staffId` match -> allow.
10. Staff user reads another staff doc -> deny.
11. Staff user submits own training record with `staffId == users.staffId` and scoped school -> allow (if enabled).
12. Staff user updates another staff member record -> deny.

### 4.5 Immutable Audit Logs

13. `org_admin` creates audit log -> allow.
14. `org_admin` updates existing audit log -> deny.
15. `school_admin` deletes audit log -> deny.

### 4.6 Aggregate Protection

16. Viewer writes `aggregates/orgCompliance` -> deny.
17. School admin writes aggregate doc directly -> deny (client path).
18. Org admin reads aggregate doc in own org -> allow.

### 4.7 User Record Integrity

19. User creates/updates `users/{uid}` where `uid != request.auth.uid` without org_admin rights -> deny.
20. User tries to set `orgId` different from path org -> deny.

---

## 5. Sign-Off Checklist (Phase 0.3)

- RBAC matrix approved by Forge + Sentinel.
- Rules baseline file exists and maps to all required paths.
- Minimum test-case set is documented and executable in emulator.
- Tenant isolation and scope checks are present in all path rules.
- Audit log immutability is enforced.

