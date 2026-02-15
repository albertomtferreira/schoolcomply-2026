# Firestore Security Contract (Restart v1)

Purpose: RBAC and module entitlement rules for the restart architecture.
Status: approved for rules implementation.
Last updated: 2026-02-15.

Canonical companions:
- `docs/Architecture.md`
- `docs/DataContract.md`
- `firestore.rules`

---

## 1. Authorization Inputs

Every request must satisfy all checks:
1. `request.auth != null`
2. `users/{uid}` exists and `isActive == true`
3. target org exists and is active
4. membership exists at `orgs/{orgId}/members/{uid}` and `isActive == true`
5. role, school scope, and module entitlement checks pass

---

## 2. Entitlement Rule

Module access is allowed only when both are true:
1. `moduleId in orgs/{orgId}.subscribedModules`
2. `moduleId in orgs/{orgId}/members/{uid}.enabledModules`

If either condition fails: deny.

---

## 3. Role Matrix

| Resource | platform_admin | org_admin | school_admin | staff | viewer |
| --- | --- | --- | --- | --- | --- |
| `users/{uid}` self | R/W | R/W self | R/W self | R/W self | R/W self |
| `users/*` any | R/W | no | no | no | no |
| `orgs/{orgId}` | R/W | R/W | R | R | R |
| `orgs/{orgId}/members/*` | R/W | R/W | R (scoped) | R self | R (scoped) |
| `orgs/{orgId}/schools/*` | R/W | R/W | R/W (scoped) | R (scoped) | R (scoped) |
| `orgs/{orgId}/staff/*` | R/W | R/W | R/W (scoped) | R self | R (scoped) |
| `orgs/{orgId}/moduleHealth/*` | R/W | R | R (scoped) | R (limited) | R (scoped) |
| `orgs/{orgId}/aggregates/*` | R/W | R | R (scoped) | R (limited) | R (scoped) |
| `orgs/{orgId}/modules/{moduleId}/*` | R/W | R/W (entitled) | R/W (scoped + entitled) | R self-context (entitled) | R (scoped + entitled) |

Notes:
- `platform_admin` is for platform operations, not normal school usage.
- `school_admin`, `staff`, and `viewer` must be constrained by allowed `schoolIds`.

---

## 4. Hard Invariants

1. Cross-org access is always denied.
2. Client writes to derived aggregate fields are denied.
3. Client writes to `moduleHealth` are denied.
4. Module audit logs are create-only.
5. Users cannot grant themselves roles or module entitlements.
6. Membership `enabledModules` cannot contain modules not subscribed by the org.

---

## 5. Required Rule Paths

Rules must explicitly cover:
- `users/{uid}`
- `orgs/{orgId}`
- `orgs/{orgId}/members/{uid}`
- `orgs/{orgId}/schools/{schoolId}`
- `orgs/{orgId}/staff/{staffId}`
- `orgs/{orgId}/moduleHealth/{moduleId}`
- `orgs/{orgId}/aggregates/{aggregateId}`
- `orgs/{orgId}/modules/{moduleId}/{document=**}`

TrainingTrack minimum:
- `orgs/{orgId}/modules/trainingTrack/trainingDefinitions/{definitionId}`
- `orgs/{orgId}/modules/trainingTrack/trainingRecords/{recordId}`
- `orgs/{orgId}/modules/trainingTrack/auditLogs/{logId}`

---

## 6. Minimum Emulator Test Set

1. User without membership reads org data -> deny.
2. Member with no module grant reads module doc -> deny.
3. Member with module grant but org not subscribed -> deny.
4. Entitled org_admin reads/writes module doc -> allow.
5. school_admin writes outside scoped school -> deny.
6. staff reads own staff doc -> allow.
7. staff reads different staff doc -> deny.
8. viewer writes module doc -> deny.
9. audit log create by entitled admin -> allow.
10. audit log update/delete by any client role -> deny.
