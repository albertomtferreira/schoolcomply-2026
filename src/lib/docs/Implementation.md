# Compliance SaaS – Implementation Plan

## Phase 0 – Strategic Foundation (Weeks 1–2)

### Objectives

- Define core scope (Training Compliance only)
- Lock role architecture (RBAC)
- Define database schema (Organisations → Schools → Staff → Trainings)
- Define compliance logic (1 expired = non-compliant)

### Deliverables

- Data model v1 locked
- Role definitions confirmed
- Compliance calculation rules documented
- MVP feature list frozen

---

## Phase 1 – Internal Pilot (Weeks 3–8)

### Scope

Training compliance tracking only.

### Features

- Staff profiles
- Training types
- Expiry dates
- Compliance dashboard
- School status indicator
- Federation overview

### UX Requirements

- Green = Fully compliant
- Amber = Expiring soon
- Red = Non-compliant
- Clear drill-down capability

### Success Criteria

- All federation schools onboarded
- Data accuracy validated
- No manual spreadsheets required

---

## Phase 2 – Stabilisation & Optimisation (Weeks 9–12)

### Objectives

- Improve dashboard clarity
- Reduce friction in data entry
- Implement alerts system
- Generate exportable compliance reports

### Additions

- Email reminders (2 months before expiry)
- School-level compliance reports (PDF export)
- Role-based views (Exec vs School Admin)

---

## Phase 3 – External Pilot (Month 4–6)

### Strategy

- Approach 3 local schools
- Offer pilot access (**Mercury Strategy:** "Founding Member" status)
- Collect structured feedback

### Requirements

- Multi-tenant isolation
- Onboarding workflow
- School creation flow
- Subscription logic groundwork

---

## Phase 4 – Monetisation Launch

### Pricing Model (Draft)

- Per school subscription
- Federation bundle option
- Tiered feature access (Lite / Standard / Multi-Org)

### Go-To-Market

- Word of mouth
- Direct outreach
- Local authority networking

---

## Technical Stack (Confirmed)

- Next.js (App Router)
- Firebase (Auth)
- Firebase (Firestore)
- TypeScript
- Zod validation
- shadcn/ui
- Tailwind CSS
- RBAC multi-tenant architecture

---

## Risk Management

| Risk            | Mitigation                      |
| --------------- | ------------------------------- |
| Scope creep     | Lock MVP to training only       |
| Overengineering | Build only what pilot needs     |
| Data complexity | Standardise training types      |
| Slow adoption   | Make dashboard visually obvious |

---

## Strategic Reminder

Do not build everything at once.

Compliance first.
Clarity second.
Expansion third.
