# SchoolTrack Product Guidelines (Restart v1)

Purpose: keep brand and product decisions coherent during rebuild.
Status: active guidance.
Last updated: 2026-02-15.

Canonical companions:

- `docs/Architecture.md`
- `docs/UXTruthContract.md`
- `docs/Implementation.md`

---

## 1. Product Direction

- Build a dependable operations and compliance platform for schools.
- Start with one strong module (`TrainingTrack`) on a strong platform shell.
- Favor clarity and reliability over speed and surface area.

---

## 2. Data and Access Principles

1. Firestore roots are `users` and `orgs`.
2. Org business data lives only under `orgs/{orgId}`.
3. Role and scope are evaluated in org membership context.
4. Module access requires:
   - org subscription
   - member enablement

---

## 3. UX Principles

1. Keep top bar persistent.
2. Use sidebar as primary navigation surface.
3. Sidebar starts with user menu, then management, then modules.
4. Module rows are expandable and own their child navigation.
5. Main pane always reflects selected sidebar child route.

---

## 4. TrainingTrack Information Architecture

Required submenu:

- `Dashboard`
- `Training Records`
- `Staff`
- `Training Definitions`

No additional items without explicit contract update.

---

## 5. Delivery Discipline

1. No feature work outside restart contracts.
2. No "done" claims without passing rule and route acceptance gates.
3. Document changes first, then implement.
