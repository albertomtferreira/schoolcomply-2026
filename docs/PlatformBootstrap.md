# Platform Bootstrap Contract (v1)

Purpose: define the environment model, Firebase project separation, and reproducible local setup baseline for Phase 0.5.

Status: Phase 0.5 baseline completed.
Last updated: 2026-02-15.

Canonical companions:
- `docs/Architecture.md`
- `docs/DataContract.md`
- `docs/SecurityContract.md`
- `firebase.json`
- `.firebaserc`
- `.env.example`

---

## 1. Environment Separation

Environment model:
- `dev`: local development + Firebase emulators
- `staging`: pilot validation environment
- `prod`: production tenant data

Firebase project aliases (`.firebaserc`):
- `dev -> schoolcomply-dev`
- `staging -> schoolcomply-staging`
- `prod -> schoolcomply-prod`

Rule:
- Never share tenant data between environments.
- Rules and index changes must be validated in `dev` before promotion.

---

## 2. Environment Variable Contract

Source of truth:
- `.env.example` defines required keys.

Client keys:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_APP_ENV` (`dev|staging|prod`)

Server keys:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_USE_EMULATORS` (`true|false`)
- `FIRESTORE_EMULATOR_HOST`
- `FIREBASE_AUTH_EMULATOR_HOST`
- `FIREBASE_STORAGE_EMULATOR_HOST`

---

## 3. Local Runtime Bootstrap

Core files:
- `firebase.json`: emulator + Firestore rules/index wiring
- `firestore.rules`: baseline rules
- `firestore.indexes.json`: baseline indexes
- `src/lib/env.ts`: typed env parsing
- `src/lib/firebase/client.ts`: client SDK bootstrap + emulator connector
- `src/lib/firebase/admin.ts`: Admin SDK bootstrap

NPM scripts:
- `npm run firebase:login`
- `npm run firebase:emulators`

---

## 4. Reproducible Setup Steps

1. Install dependencies:
   - `npm install`
2. Create local env file:
   - Copy `.env.example` to `.env.local`
   - Fill Firebase web config values for `schoolcomply-dev`
   - Set `FIREBASE_USE_EMULATORS=true`
3. Login Firebase CLI:
   - `npm run firebase:login`
4. Start emulators:
   - `npm run firebase:emulators`
5. In a second terminal, run app:
   - `npm run dev`
6. Verify emulator access:
   - Emulator UI at `http://127.0.0.1:4000`

---

## 5. Promotion Controls

Before promoting config from `dev` to `staging` or `prod`:
- Rules reviewed against `docs/SecurityContract.md`
- Index changes reviewed against `docs/DataContract.md`
- Any aggregate behavior change reviewed against `docs/AggregateContract.md`
- Changelog entry added in `docs/Implementation.md`

---

## 6. Sign-Off Checklist (Phase 0.5)

- Environment separation is documented and aliased.
- Env variable contract is explicit.
- Local emulator workflow is reproducible from clean clone.
- Firebase SDK bootstrap modules exist for client and server.
- Core Firebase config files exist (`firebase.json`, `.firebaserc`).

