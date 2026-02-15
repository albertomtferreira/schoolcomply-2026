# SchoolTrack Architecture (Restart v1)

Purpose: define the restart architecture after pausing the previous implementation.
Status: approved direction for rebuild from scratch.
Last updated: 2026-02-15.

Canonical companions:

- `docs/DataContract.md`
- `docs/SecurityContract.md`
- `docs/UXTruthContract.md`
- `docs/Implementation.md`

---

## 1. Restart Decisions

1. Stop extending the previous implementation.
2. Keep learnings, but reset delivery to a simpler baseline.
3. Use top-level Firestore roots:
   - `users`
   - `orgs`
4. Build from a new, clean Next.js installation (greenfield).
5. Reuse decisions and contracts only, not legacy app code.

---

## 2. Firestore Topology

```txt
users/{uid}
orgs/{orgId}
orgs/{orgId}/members/{uid}
orgs/{orgId}/schools/{schoolId}
orgs/{orgId}/staff/{staffId}
orgs/{orgId}/modules/{moduleId}/...
orgs/{orgId}/moduleHealth/{moduleId}
orgs/{orgId}/aggregates/{aggregateId}
```

Principles:

- `users` stores identity and global user metadata.
- `orgs` owns business data and subscriptions.
- Module data is always owned by `orgs/{orgId}/modules/{moduleId}`.
- User module access is the intersection of org subscription and member grants.

---

## 3. Access Model

Access is evaluated with:

1. Authenticated user (`users/{uid}` exists and active)
2. Org membership (`orgs/{orgId}/members/{uid}` exists and active)
3. Role scope (`role`, optional `schoolIds`, optional `staffId`)
4. Module entitlement:
   - Org has module subscribed
   - Member has module enabled

---

## 4. Roles

Initial role set:

- `platform_admin`
- `org_admin`
- `school_admin`
- `staff`
- `viewer`

Notes:

- Role is evaluated in org context via `orgs/{orgId}/members/{uid}`.
- `users/{uid}` can store a convenience `defaultRole`, but org member role is authoritative.

---

## 5. Module Contract

Every module must follow:

- path: `orgs/{orgId}/modules/{moduleId}/...`
- own collections, indexes, and audit logs
- no direct mutation of shared identity collections (`users`, `schools`, `staff`) outside approved service layer

TrainingTrack module namespace:

```txt
orgs/{orgId}/modules/trainingTrack/trainingDefinitions/{definitionId}
orgs/{orgId}/modules/trainingTrack/trainingRecords/{recordId}
orgs/{orgId}/modules/trainingTrack/auditLogs/{logId}
```

---

## 6. UI Shell Contract

- Top bar is required and persistent in the new app.
- Sidebar is the primary app navigation.
- Sidebar includes:
  - user menu section
  - role-aware management sections (orgs, schools, modules, users)
  - module list with collapsible submenus

TrainingTrack menu example:

- `TrainingTrack`
- `TrainingTrack > Dashboard`
- `TrainingTrack > Training Records`
- `TrainingTrack > Staff`
- `TrainingTrack > Training Definitions`

Main workspace renders the selected sidebar child route.

---

## 7. Non-Goals For Restart

- No migration continuation from legacy paths.
- No assumption that old completion statuses are still valid.
- No new module build until shell + permissions baseline is stable.
- No direct reuse of old UI/components/services in the new app codebase.
