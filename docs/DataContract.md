# Firestore Data Contract (v1)

Purpose: frozen schema and index contract for Phase 0.2 implementation.

Status: approved baseline for MVP (Phase 1 build input).
Last updated: 2026-02-15.

Canonical companions:
- `docs/Architecture.md`
- `docs/ComplianceDecisionTable.md`
- `firestore.indexes.json`

---

## 1. Collection Contract

All documents are scoped by tenant path: `organisations/{orgId}/...`.

### 1.1 organisations/{orgId}

Required fields:
- `name: string`
- `slug: string`
- `status: 'active' | 'paused'`
- `createdAt: Timestamp`
- `updatedAt: Timestamp`

### 1.2 organisations/{orgId}/schools/{schoolId}

Required fields:
- `name: string`
- `status: 'active' | 'archived'`
- `createdAt: Timestamp`
- `updatedAt: Timestamp`

Optional fields:
- `code: string`
- `address: string`

### 1.3 organisations/{orgId}/users/{uid}

Required fields:
- `uid: string` (must equal Firebase Auth UID and doc ID)
- `fullName: string`
- `email: string`
- `role: 'org_admin' | 'school_admin' | 'staff' | 'viewer'`
- `orgId: string`
- `isActive: boolean`
- `createdAt: Timestamp`
- `updatedAt: Timestamp`

Optional fields:
- `schoolIds: string[]`
- `staffId: string`

### 1.4 organisations/{orgId}/staff/{staffId}

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

### 1.5 organisations/{orgId}/trainingTypes/{trainingTypeId}

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

### 1.6 organisations/{orgId}/trainingRecords/{recordId}

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
- `expiresAt: Timestamp` (required if matching training type is expiring)
- `provider: string`
- `certificateUrl: string`
- `notes: string`
- `daysToExpiry: number`

### 1.7 organisations/{orgId}/aggregates/orgCompliance

Required fields:
- `compliantCount: number`
- `nonCompliantCount: number`
- `expiringSoonCount: number`
- `lastCalculatedAt: Timestamp`

### 1.8 organisations/{orgId}/aggregates/school_{schoolId}

Required fields:
- `compliantCount: number`
- `nonCompliantCount: number`
- `expiringSoonCount: number`
- `lastCalculatedAt: Timestamp`

### 1.9 organisations/{orgId}/auditLogs/{logId}

Required fields:
- `actorUserId: string`
- `action: 'create' | 'update' | 'delete'`
- `entityType: 'staff' | 'trainingRecord' | 'trainingType'`
- `entityId: string`
- `createdAt: Timestamp`

Optional fields:
- `before: map`
- `after: map`

Rule contract:
- Immutable: create-only, no update/delete.

---

## 2. Deterministic ID Conventions

Use deterministic IDs where contractually required:
- `users/{uid}`
- `aggregates/orgCompliance`
- `aggregates/school_{schoolId}`

Use generated IDs:
- `schools/{schoolId}` (generated or slug-based, but immutable after create)
- `staff/{staffId}`
- `trainingTypes/{trainingTypeId}`
- `trainingRecords/{recordId}`
- `auditLogs/{logId}`

---

## 3. Index Plan (Frozen for Phase 1)

Composite indexes (defined in `firestore.indexes.json`):

1. `trainingRecords`: `schoolId ASC, status ASC`
2. `trainingRecords`: `staffId ASC, trainingTypeId ASC`
3. `trainingRecords`: `schoolId ASC, expiresAt ASC`
4. `trainingRecords`: `staffId ASC, trainingTypeId ASC, expiresAt DESC`

Single-field reliance:
- `staff.schoolIds` supports `array-contains` query for school dashboard staff list.

Index checklist:
- Index file created: yes
- Indexed fields mapped to architecture query patterns: yes
- Additional indexes only on confirmed query errors from Firestore console: yes

---

## 4. Validation Rules (Data Integrity)

- `orgId` in auth/user scope must match path `orgId`.
- `users.uid` must equal document ID.
- `users.orgId` must equal path `orgId`.
- `trainingRecords.schoolId` must exist in tenant schools.
- `trainingRecords.staffId` must reference staff in same tenant.
- `trainingRecords.trainingTypeId` must reference type in same tenant.
- `status` and `daysToExpiry` are derived on write and never trusted from client input.
- All timestamps are server-generated where possible.

---

## 5. Change Control

- Any schema change requires:
  1. Update to `docs/Architecture.md`
  2. Update to `docs/ComplianceDecisionTable.md` (if logic impacted)
  3. Update to `firestore.indexes.json` (if query impacted)
  4. Migration note in implementation plan

This file is the Phase 0.2 freeze point for MVP implementation.

