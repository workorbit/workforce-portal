# Complete Project Overview

## Project Title

**Workforce Portal** — Employer & Employee Portal

## Description

Workforce Portal is a two-sided web system for managing a company's employee
lifecycle, timesheets, payroll and employee feedback. It is made of three
code bases that work together:

| Project | Type | Audience | Local port |
|---|---|---|---|
| `backend` | NestJS monorepo (6 independent apps) + shared library | Serves both portals | 3001–3006 |
| `employer-portal` | Angular web app | HR / admins | 4200 |
| `employee-portal` | Angular web app | Staff / employees | 4300 |

## About

### Purpose
Employers manage their workforce in one place, and employees get a
self-service portal for their day-to-day work records. The employer portal is
used to create employee accounts, review and approve timesheets, run payroll
and handle employee feedback. The employee portal is used to log in, submit
timesheets, view payroll and payslips, raise feedback and manage their profile.

### Core principles
1. **The employer is the source of truth.** Employees never self-register. An
   employer creates the employee record and the system provisions the login.
2. **Role-based access.** Two roles exist: `employer_admin` and `employee`.
3. **Soft deletes only.** Records are never hard-deleted; they carry a status
   or visibility flag instead.
4. **Everything is scoped to the logged-in user.** Company and employee IDs
   are taken from the verified JWT, never from the request body.

### Backend (`backend/`)
A Nest CLI monorepo with one independent app per domain. There is no API
gateway and no event bus: the frontends call each app directly, and the few
cross-app calls (for example `employees` asking `auth` to create a login) are
plain HTTP calls protected by an internal API guard.

| App | Port | Responsibility |
|---|---|---|
| `auth` | 3001 | Login, JWT issue/refresh, forgot/reset password (email code), internal user provisioning |
| `employees` | 3002 | Employee directory, create/edit, active/inactive status |
| `timesheets` | 3003 | Draft, submit, approve/reject with a remarks history |
| `payroll` | 3004 | Pay runs, payroll records, status changes, mark-as-paid |
| `feedback` | 3005 | Raise feedback, replies, status |
| `notifications` | 3006 | Email delivery (mailer service) and notifications |

`libs/shared` holds cross-cutting code: JWT strategy and guards, role and
current-user decorators, the internal API guard, CORS and HTTP-client utilities,
and shared enums/interfaces. Each app exposes a `/health` endpoint and Swagger
docs at `/docs`. `scripts/seed-employer.ts` creates the first employer account.

### Frontends (`employer-portal/`, `employee-portal/`)
Two separate Angular apps with the same architecture: feature folders
(`features/`), a `core/` layer (API and auth), reusable `shared/` components
(app shell, icons, toast tray) and an NgRx store split per feature.

- **Employer portal:** login, dashboard, employees (list and detail),
  timesheets, payroll, feedback inbox, company settings.
- **Employee portal:** login, forgot/reset password, dashboard, timesheets,
  payroll, feedback, profile, reports.

### Local infrastructure
`docker-compose.yml` runs MongoDB 7 locally. Alternatively, point the backend
at any MongoDB instance (such as Atlas) through its `.env` file.

### Status note
Older docs in this folder (`project-overview.md`, root `README.md`) describe
the payroll, feedback and analytics screens as placeholders. The current
frontend code contains implemented payroll, feedback, reports and dashboard
features in both portals, so those older notes are out of date. Treat the
code as the source of truth.

## Tech Stack

### Backend
| Area | Technology |
|---|---|
| Framework | NestJS 11 (monorepo mode) on Node.js |
| Language | TypeScript 5.7 |
| Database | MongoDB 7 with Mongoose 9 (`@nestjs/mongoose`) |
| Authentication | JWT (`@nestjs/jwt`), Passport + `passport-jwt`, `bcryptjs` password hashing, `cookie-parser` |
| Validation | `class-validator`, `class-transformer` |
| API docs | Swagger (`@nestjs/swagger`) |
| Security | `@nestjs/throttler` rate limiting, CORS, role guards |
| Email | Nodemailer |
| HTTP between apps | Axios |
| Config | `@nestjs/config` / dotenv |
| Testing | Jest 30, ts-jest, Supertest |
| Tooling | ESLint 9, Prettier, ts-node, concurrently |

### Frontend (both portals)
| Area | Technology |
|---|---|
| Framework | Angular 21 |
| Language | TypeScript 5.9 |
| State management | NgRx Store + Effects 21 |
| Reactive programming | RxJS 7.8 |
| Forms and routing | `@angular/forms`, `@angular/router` |
| Styling | SCSS with shared design-token variables (dark theme), PostCSS + Autoprefixer |
| Testing | Vitest 4 with jsdom |
| Tooling | Angular CLI / `@angular/build`, Prettier, npm 10 |

### DevOps / Tooling
Docker Compose (MongoDB), Git/GitHub (`workorbit` organization), npm.

## Running locally

```bash
docker compose up -d mongo
cd backend && npm install && npm run start:all
cd backend && npm run seed:employer -- --name "Jane Doe" --email jane@company.com --password <password>
cd employer-portal && npm install && npm start    # http://localhost:4200
cd employee-portal && npm install && npm start    # http://localhost:4300
```

## Related docs
- `backend-architecture.md` — backend apps, schemas, endpoints, service calls.
- `frontend-architecture.md` — Angular structure, NgRx pattern, forms.
- `project-overview.md` — original overview (some status notes are outdated).
