# Firestore Data Contract (v2)

Purpose: frozen schema and index contract for SchoolTrack core + module architecture.

Status: approved baseline for SchoolTrack shell and TrainingTrack module.
Last updated: 2026-02-15.

Canonical companions:

- `docs/Architecture.md`
- `docs/ComplianceDecisionTable.md`
- `firestore.indexes.json`

---

## 1. Namespace Contract

All documents are tenant-scoped under: `organisations/{orgId}/...`.

Data ownership split:

- **Core shared entities:** org, school, user, staff, shared aggregates, module health.
- **Module-owned entities:** all domain objects inside `modules/{moduleId}/...`.

Module IDs:

- `trainingTrack`
- `statutoryTrack`
- `clubTrack`
- `coshhTrack`

---

## 2. Shared Core Collections

### 2.1 organisations/{orgId}

Required fields:

- `name: string`
- `slug: string`
- `status: 'active' | 'paused'`
- `createdAt: Timestamp`
- `updatedAt: Timestamp`

### 2.2 organisations/{orgId}/schools/{schoolId}

Required fields:

- `name: string`
- `status: 'active' | 'archived'`
- `createdAt: Timestamp`
- `updatedAt: Timestamp`

Optional fields:

- `code: string`
- `address: string`

### 2.3 organisations/{orgId}/users/{uid}

Required fields:

- `uid: string` (must equal Firebase Auth UID and doc ID)
- `fullName: string`
- `email: string`
- `role:'superadmin' | 'org_admin' | 'school_admin' | 'staff' | 'viewer'`
- `orgId: string`
- `enabledModules: string[]`
- `isActive: boolean`
- `createdAt: Timestamp`
- `updatedAt: Timestamp`

Optional fields:

- `schoolIds: string[]`
- `staffId: string`

### 2.4 organisations/{orgId}/staff/{staffId}

Required fields:

- `fullName: string`
- `schoolIds: string[]`
- `employmentRole: string`
- `isActive: boolean`
- `createdAt: Timestamp`
- `updatedAt: Timestamp`

Optional fields:

- `email: string`
- `jobTitle: string`
- `startDate: Timestamp`
- `endDate: Timestamp`

### 2.5 organisations/{orgId}/aggregates/orgCompliance

Required fields:

- `compliantCount: number`
- `nonCompliantCount: number`
- `expiringSoonCount: number`
- `lastCalculatedAt: Timestamp`

### 2.6 organisations/{orgId}/aggregates/school\_{schoolId}

Required fields:

- `compliantCount: number`
- `nonCompliantCount: number`
- `expiringSoonCount: number`
- `lastCalculatedAt: Timestamp`

### 2.7 organisations/{orgId}/moduleHealth/{moduleId}

Required fields:

- `state: 'green' | 'amber' | 'red' | 'grey'`
- `openRiskCount: number`
- `lastCalculatedAt: Timestamp`

Optional fields:

- `summary: string`

---

## 3. Module Collections (TrainingTrack v1)

### 3.1 organisations/{orgId}/modules/trainingTrack/trainingTypes/{trainingTypeId}

Required fields:

- `name: string`
- `expires: boolean`
- `required: boolean`
- `createdAt: Timestamp`
- `updatedAt: Timestamp`

Optional fields:

- `code: string`
- `defaultValidityDays: number`
- `requiredForRoles: string[]`

### 3.2 organisations/{orgId}/modules/trainingTrack/trainingRecords/{recordId}

Required fields:

- `staffId: string`
- `schoolId: string`
- `trainingTypeId: string`
- `createdBy: string`
- `createdAt: Timestamp`
- `updatedAt: Timestamp`
- `status: 'valid' | 'expiring' | 'expired'`

Optional fields:

- `issuedAt: Timestamp`
- `expiresAt: Timestamp`
- `provider: string`
- `certificateUrl: string`
- `notes: string`
- `daysToExpiry: number`

### 3.3 organisations/{orgId}/modules/trainingTrack/auditLogs/{logId}

Required fields:

- `actorUserId: string`
- `action: 'create' | 'update' | 'delete'`
- `entityType: 'staff' | 'trainingRecord' | 'trainingType'`
- `entityId: string`
- `moduleId: 'trainingTrack'`
- `createdAt: Timestamp`

Optional fields:

- `before: map`
- `after: map`

Rule contract:

- Immutable: create-only, no update/delete.

---

## 4. Deterministic ID Conventions

Use deterministic IDs where contractually required:

- `users/{uid}`
- `aggregates/orgCompliance`
- `aggregates/school_{schoolId}`
- `moduleHealth/{moduleId}`

Use generated IDs:

- `schools/{schoolId}`
- `staff/{staffId}`
- `modules/trainingTrack/trainingTypes/{trainingTypeId}`
- `modules/trainingTrack/trainingRecords/{recordId}`
- `modules/trainingTrack/auditLogs/{logId}`

---

## 5. Index Plan (TrainingTrack Baseline)

Composite indexes (defined in `firestore.indexes.json`):

1. `modules/trainingTrack/trainingRecords`: `schoolId ASC, status ASC`
2. `modules/trainingTrack/trainingRecords`: `staffId ASC, trainingTypeId ASC`
3. `modules/trainingTrack/trainingRecords`: `schoolId ASC, expiresAt ASC`
4. `modules/trainingTrack/trainingRecords`: `staffId ASC, trainingTypeId ASC, expiresAt DESC`

Single-field reliance:

- `staff.schoolIds` supports `array-contains` query.

---

## 6. Validation Rules (Data Integrity)

- `orgId` in user scope must match path `orgId`.
- `users.uid` must equal document ID.
- `users.orgId` must equal path `orgId`.
- Access to `modules/{moduleId}` requires `moduleId in users.enabledModules`.
- Module collections may not mutate shared core entities.
- `trainingRecords.schoolId` must reference a school in same tenant.
- `trainingRecords.staffId` must reference staff in same tenant.
- `trainingRecords.trainingTypeId` must reference a module training type in same tenant.
- `status` and `daysToExpiry` are derived on write and never trusted from client input.

---

## 7. Change Control

Any schema change requires:

1. Update to `docs/Architecture.md`
2. Update to `docs/SecurityContract.md` (if auth/scope impacted)
3. Update to `docs/ComplianceDecisionTable.md` (if logic impacted)
4. Update to `firestore.indexes.json` (if query impacted)
5. Migration note in `docs/Implementation.md`

This file is the v2 freeze point for SchoolTrack core + TrainingTrack module implementation.
