# Workforce Portal

Employer + Employee portal system: NestJS/MongoDB backend (one independent
app per domain, Nest's built-in monorepo mode — no API gateway, no event
bus), and two independent Angular apps on the frontend. Mirrors the
conventions already used by the sibling `CAMPUS_PLACEMENT_...` project.

See `Employer-Employee-Portal-Documentation.pdf` for the full functional
spec this was built from.

## Layout

```
backend/              Nest CLI monorepo — apps/{auth,employees,timesheets,payroll,feedback,notifications}
employer-portal/       Angular app (port 4200) — HR/admin
employee-portal/       Angular app (port 4300) — staff
```

## Running it locally

1. **MongoDB** — either run the bundled compose file, or point
   `backend/.env`'s `APP_MONGODB_URI` at your own instance (e.g. Atlas):
   ```
   docker compose up -d mongo
   ```
2. **Backend** — install once, then boot every app together:
   ```
   cd backend
   npm install
   npm run start:all
   ```
   Or individually: `npm run start:auth`, `npm run start:employees`, etc.
   Each app's Swagger docs are at `http://localhost:<port>/docs`.
3. **Seed the first employer account** (no self-signup — doc §8):
   ```
   npm run seed:employer -- --name "Jane Doe" --email jane@company.com --password Str0ngPassword!
   ```
4. **Frontends**:
   ```
   cd employer-portal && npm install && npm start   # http://localhost:4200
   cd employee-portal && npm install && npm start    # http://localhost:4300
   ```

## What's built vs. what's next

Auth (login + OTP + JWT), Employees (directory/create/status), and
Timesheets (draft/submit/approve with a remarks history thread) are fully
wired end to end on both the backend and their frontend screens. Payroll
and Feedback have real backend schemas/endpoints but their frontend screens
are routed placeholders — next-iteration work. See the plan this was built
from for the full reasoning: ask to pick these up whenever you're ready.
