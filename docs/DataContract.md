# Firestore Data Contract (Restart v1)

Purpose: schema contract for rebuild using top-level `users` and `orgs`.
Status: approved baseline for restart implementation.
Last updated: 2026-02-15.

Canonical companions:
- `docs/Architecture.md`
- `docs/SecurityContract.md`
- `docs/ComplianceDecisionTable.md`

---

## 1. Root Collections

Top-level roots:
- `users/{uid}`
- `orgs/{orgId}`

All tenant business data lives under `orgs/{orgId}`.

---

## 2. User Root Contract

Path: `users/{uid}`

Required fields:
- `uid: string` (doc id must match)
- `email: string`
- `fullName: string`
- `isActive: boolean`
- `defaultOrgId: string | null`
- `createdAt: Timestamp`
- `updatedAt: Timestamp`

Optional fields:
- `defaultRole: 'platform_admin' | 'org_admin' | 'school_admin' | 'staff' | 'viewer'`

Rule:
- `users` does not store org business data.

---

## 3. Org Root Contract

Path: `orgs/{orgId}`

Required fields:
- `name: string`
- `slug: string`
- `status: 'active' | 'paused'`
- `subscribedModules: string[]`
- `createdAt: Timestamp`
- `updatedAt: Timestamp`

---

## 4. Org Membership Contract

Path: `orgs/{orgId}/members/{uid}`

Required fields:
- `uid: string` (must match doc id)
- `role: 'org_admin' | 'school_admin' | 'staff' | 'viewer'`
- `isActive: boolean`
- `enabledModules: string[]`
- `createdAt: Timestamp`
- `updatedAt: Timestamp`

Optional fields:
- `schoolIds: string[]`
- `staffId: string`

Entitlement invariant:
- `enabledModules` must be a subset of `orgs/{orgId}.subscribedModules`.

---

## 5. Shared Org Collections

### 5.1 `orgs/{orgId}/schools/{schoolId}`

Required:
- `name: string`
- `status: 'active' | 'archived'`
- `createdAt: Timestamp`
- `updatedAt: Timestamp`

Optional:
- `code: string`
- `address: string`

### 5.2 `orgs/{orgId}/staff/{staffId}`

Required:
- `fullName: string`
- `schoolIds: string[]`
- `employmentRole: string`
- `isActive: boolean`
- `createdAt: Timestamp`
- `updatedAt: Timestamp`

Optional:
- `email: string`
- `jobTitle: string`
- `startDate: Timestamp`
- `endDate: Timestamp`

### 5.3 `orgs/{orgId}/moduleHealth/{moduleId}`

Required:
- `state: 'green' | 'amber' | 'red' | 'grey'`
- `openRiskCount: number`
- `lastCalculatedAt: Timestamp`

### 5.4 `orgs/{orgId}/aggregates/{aggregateId}`

Required:
- `lastCalculatedAt: Timestamp`

Module-specific aggregate fields are defined by each module contract.

---

## 6. TrainingTrack Module Contract

Paths:
- `orgs/{orgId}/modules/trainingTrack/trainingDefinitions/{definitionId}`
- `orgs/{orgId}/modules/trainingTrack/trainingRecords/{recordId}`
- `orgs/{orgId}/modules/trainingTrack/auditLogs/{logId}`

### 6.1 Training Definitions

Required:
- `name: string`
- `required: boolean`
- `expires: boolean`
- `createdAt: Timestamp`
- `updatedAt: Timestamp`

Optional:
- `defaultValidityDays: number`
- `requiredForRoles: string[]`

### 6.2 Training Records

Required:
- `staffId: string`
- `schoolId: string`
- `trainingDefinitionId: string`
- `status: 'valid' | 'expiring' | 'expired'`
- `createdBy: string`
- `createdAt: Timestamp`
- `updatedAt: Timestamp`

Optional:
- `issuedAt: Timestamp`
- `expiresAt: Timestamp`
- `provider: string`
- `certificateUrl: string`
- `notes: string`

### 6.3 Audit Logs

Required:
- `moduleId: 'trainingTrack'`
- `actorUserId: string`
- `action: 'create' | 'update' | 'delete'`
- `entityType: string`
- `entityId: string`
- `createdAt: Timestamp`

Rule:
- create-only (immutable)

---

## 7. ID Conventions

Deterministic IDs:
- `users/{uid}`
- `orgs/{orgId}/members/{uid}`
- `orgs/{orgId}/moduleHealth/{moduleId}`
- `orgs/{orgId}/aggregates/orgCompliance`

Generated IDs:
- `schools/{schoolId}`
- `staff/{staffId}`
- module entity IDs under `modules/{moduleId}`

---

## 8. Change Control

Any schema change requires:
1. Update `docs/Architecture.md`
2. Update `docs/SecurityContract.md` if authorization changes
3. Update module contract docs
4. Add note in `docs/Implementation.md`
