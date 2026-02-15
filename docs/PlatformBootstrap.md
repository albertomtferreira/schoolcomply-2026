# Platform Bootstrap Contract (Restart v1)

Purpose: define clean local and environment bootstrap for the rebuild.
Status: active baseline for restart.
Last updated: 2026-02-15.

Canonical companions:
- `docs/Architecture.md`
- `docs/SecurityContract.md`
- `.env.example`
- `firebase.json`
- `.firebaserc`

---

## 1. Environment Model

- `dev`: local + emulator-first
- `staging`: integration and pilot validation
- `prod`: production

Aliases remain:
- `dev -> schooltrack-dev`
- `staging -> schooltrack-staging`
- `prod -> schooltrack-prod`

---

## 2. Bootstrap Rules

1. Start from a clean Next.js installation; do not reuse previous app code.
2. All implementation work begins in `dev` with emulators.
3. No schema/rules promotion without passing emulator tests.
4. `staging` and `prod` are not used to validate unfinished contracts.

---

## 3. Greenfield Project Setup

1. create project:
   - `npx create-next-app@latest schooltrack --typescript --eslint --app --src-dir --import-alias "@/*"`
2. install Firebase dependencies in the new project.
3. add baseline config files (`firebase.json`, `.firebaserc`, `.env.example`).
4. copy `.env.example` to `.env.local`.
5. configure `schooltrack-dev` values and emulator flags.
6. run `npm run firebase:emulators`.
7. run `npm run dev`.

---

## 4. Baseline Verification

Minimum checks:
- app boots locally
- auth flow works against emulator
- Firestore read/write paths match restart contract:
  - `users/{uid}`
  - `orgs/{orgId}/...`

---

## 5. Promotion Controls

Before `dev -> staging`:
- `docs/DataContract.md` and `docs/SecurityContract.md` unchanged or intentionally versioned
- rules tests pass
- implementation note updated in `docs/Implementation.md`
