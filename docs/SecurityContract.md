# Firestore Security Contract (v2)

Purpose: RBAC, module entitlement, and rules baseline for SchoolTrack core + modules.

Status: approved baseline for implementation and emulator testing.
Last updated: 2026-02-15.

Canonical companions:
- `docs/Architecture.md`
- `docs/DataContract.md`
- `docs/ComplianceDecisionTable.md`
- `firestore.rules`

---

## 1. RBAC + Module Entitlement Matrix

Scope keys:
- `org`: tenant-wide inside `organisations/{orgId}`
- `school`: only docs where school is in `user.schoolIds`
- `self`: only user-linked `staffId`
- `module`: only docs where `moduleId in user.enabledModules`

| Resource | superadmin | org_admin | school_admin | staff | viewer |
| --- | --- | --- | --- | --- | --- |
| `organisations/{orgId}` | R/W | R/W | R | R | R |
| `schools` | R/W | R/W | R (school scope) | R (school scope) | R (school scope) |
| `users` | R/W | R/W | R (school scope visibility only) | R self | R (school scope) |
| `staff` | R/W | R/W | R/W (school scope) | R self | R (school scope) |
| `moduleHealth` | R/W | R/W | R (school scope) | R (limited) | R (school scope) |
| `modules/{moduleId}/*` | R/W | R/W (entitled module) | R/W (school scope + entitled module) | R self / optional submit (entitled module) | R (school scope + entitled module) |
| `aggregates` | R/W | R | R (school scope) | R (limited) | R (school scope) |
| `auditLogs` (module-owned) | R/W | R, create | R, create (school scope actions) | no access | R (read-only, scoped) |

Notes:
- Module access is denied when `moduleId` is not enabled for user/org.
- In MVP, writes should still be centralized in trusted server actions/Admin SDK.
- Audit logs remain immutable (create-only).

---

## 2. Rule Invariants

1. Auth required for all access.
2. Tenant isolation required: user must belong to `orgId` in path.
3. Role + scope + module entitlement are all required for module operations.
4. Staff can never mutate compliance or aggregate state directly.
5. Audit logs are create-only.
6. Derived fields are write-protected from untrusted clients.
7. Module rules must not permit mutation of core identity documents (`users`, `schools`, `staff`) outside role scope.

---

## 3. Rules Coverage (Required Paths)

Rules must explicitly cover:
- `organisations/{orgId}`
- `organisations/{orgId}/schools/{schoolId}`
- `organisations/{orgId}/users/{uid}`
- `organisations/{orgId}/staff/{staffId}`
- `organisations/{orgId}/moduleHealth/{moduleId}`
- `organisations/{orgId}/aggregates/{aggregateId}`
- `organisations/{orgId}/modules/{moduleId}/{document=**}`

TrainingTrack required subpaths:
- `organisations/{orgId}/modules/trainingTrack/trainingTypes/{trainingTypeId}`
- `organisations/{orgId}/modules/trainingTrack/trainingRecords/{recordId}`
- `organisations/{orgId}/modules/trainingTrack/auditLogs/{logId}`

---

## 4. Rules Test Cases (Minimum)

### 4.1 Tenant Isolation

1. `org_admin` from org A reads school from org B -> deny.
2. `school_admin` from org A writes module record in org B -> deny.

### 4.2 Module Entitlement

3. User without `trainingTrack` in `enabledModules` reads training record -> deny.
4. User with `trainingTrack` entitlement reads scoped training record -> allow.

### 4.3 School Scope Enforcement

5. `school_admin` scoped to `s1` writes training record for `s1` -> allow.
6. `school_admin` scoped to `s1` writes training record for `s2` -> deny.
7. `viewer` reads scoped module records -> allow.
8. `viewer` writes any module doc -> deny.

### 4.4 Staff Self Access

9. Staff reads own shared staff doc -> allow.
10. Staff reads another staff doc -> deny.
11. Staff submits own training record where enabled and scoped -> allow (if enabled).
12. Staff updates another staff member record -> deny.

### 4.5 Immutable Audit Logs

13. `org_admin` creates module audit log -> allow.
14. `org_admin` updates existing module audit log -> deny.
15. `school_admin` deletes module audit log -> deny.

### 4.6 Aggregate and Health Protection

16. Viewer writes `aggregates/orgCompliance` -> deny.
17. School admin writes `moduleHealth/trainingTrack` directly -> deny (client path).
18. Org admin reads aggregate and moduleHealth docs in own org -> allow.

### 4.7 User Record Integrity

19. User updates `users/{uid}` where `uid != request.auth.uid` without org_admin rights -> deny.
20. User sets `orgId` different from path org -> deny.

---

## 5. Sign-Off Checklist

- RBAC + module entitlement matrix approved by Forge + Sentinel.
- Rules baseline covers core and module namespace paths.
- Minimum emulator suite includes module entitlement assertions.
- Tenant isolation and scope checks are present in all relevant rules.
- Audit log immutability is enforced.
