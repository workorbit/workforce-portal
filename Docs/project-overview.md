# Project Overview

## What this is

Workforce Portal is a two-sided system for running a company's employee
lifecycle, timesheets, and payroll:

- **Employer Portal** — used by HR/admins to create and manage employee
  accounts, review and approve timesheets, run payroll, and (once built)
  respond to employee feedback.
- **Employee Portal** — used by staff to log in, verify their identity,
  submit timesheets, and (once built) view payslips and raise concerns.

It was built from `Employer-Employee-Portal-Documentation.pdf` (the original
functional spec — see that file for the full narrative walkthrough of every
screen). This set of docs explains how the spec was actually implemented:
architecture, schemas, endpoints, and every form field.

## Core principles

1. **The employer is the source of truth for every employee account.**
   Employees never self-register. An employer creates the employee record,
   the system provisions login credentials automatically, and the employee
   activates their own access from there.
2. **Login is a single step for both roles.** Password verification alone
   issues tokens immediately, for both Employee and Employer/Admin accounts
   — there is no OTP step at login. The 6-digit email code exists only for
   the forgot/reset-password flow, gating "prove you own this inbox"
   before a password can be changed without the old one.
3. **Nothing is ever hard-deleted.** Employees, timesheets, feedback items,
   and payroll runs all carry a status/visibility flag instead
   (`isActive`, `isWithdrawn`, `isArchived`, `isVoid`). "Delete" in the UI is
   always really a status change — see `backend-architecture.md` §6.
4. **Every query is scoped to the logged-in user.** `companyId` and
   `employeeId` are read from the verified JWT, never trusted from a
   request body, and applied as a filter on every query. See
   `backend-architecture.md` §7.

## User roles

| Role | Can do |
|---|---|
| `employer_admin` | Create/edit employees, set active/inactive, approve/reject/pending timesheets with remarks, run payroll, view company-wide data |
| `employee` | Submit timesheets, view own payroll (once built), raise feedback (once built), change own password |

## Repository layout

```
workforce-portal/
  backend/               Nest CLI monorepo — see backend-architecture.md
    apps/
      auth/               port 3001
      employees/          port 3002
      timesheets/         port 3003
      payroll/            port 3004
      feedback/           port 3005
      notifications/      port 3006
    libs/shared/          cross-cutting Nest code (guards, JWT, enums)
    scripts/seed-employer.ts
  employer-portal/        Angular app, port 4200 — see frontend-architecture.md
  employee-portal/        Angular app, port 4300 — see frontend-architecture.md
  docs/                   you are here
  docker-compose.yml      local MongoDB for dev
  README.md               quick-start run instructions
```

There is **no API gateway and no event bus**. Both frontends call each
backend app directly on its own port, and the few cross-app calls the
backend itself needs (e.g. `employees` provisioning a login via `auth`) are
plain HTTP calls between the apps. This mirrors the sibling
`CAMPUS_PLACEMENT_...` project's backend conventions rather than the more
"idealized" gateway/event-bus diagram in the original PDF spec — chosen
deliberately for consistency with a working, familiar pattern. Full
reasoning is in `backend-architecture.md` §2.

## What's fully built vs. what's next

| Area | Backend | Frontend |
|---|---|---|
| Auth (login, OTP, JWT, password reset) | ✅ Full | ✅ Full |
| Employees (directory, create, status) | ✅ Full | ✅ Full (employer side) |
| Timesheets (draft, submit, approve, remarks thread) | ✅ Full | ✅ Full (both sides) |
| Payroll (pay runs, processing, payslip history) | ✅ Full | 🚧 Placeholder screen |
| Feedback (raise, reply, status) | ✅ Full | 🚧 Placeholder screen |
| Analytics ("My Insights") | — | 🚧 Placeholder screen |

The payroll and feedback backend APIs are real and ready to build against —
only their frontend screens are still routed-but-not-built. This was a
scope decision made explicitly (see the approved implementation plan) to
keep the foundation (auth, employees, timesheets) solid rather than
spreading thin effort across every module at once.

## Running it locally

See the root `README.md` for the full step-by-step. Short version:

```
docker compose up -d mongo
cd backend && npm install && npm run start:all
cd backend && npm run seed:employer -- --name "Jane Doe" --email jane@company.com --password Str0ngPassword!
cd employer-portal && npm install && npm start   # http://localhost:4200
cd employee-portal && npm install && npm start   # http://localhost:4300
```

## Further reading

- **`backend-architecture.md`** — every Nest app's responsibility, its full
  Mongoose schema (every field explained), its endpoints, and how services
  talk to each other.
- **`frontend-architecture.md`** — both Angular apps' structure, the NgRx
  store pattern, the dark-theme/Bootstrap+Tailwind design system, and every
  form field on every screen (including the timesheet entry form and the
  create-employee form).
