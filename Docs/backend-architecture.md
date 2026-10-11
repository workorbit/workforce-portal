# Backend Architecture

## 1. Monorepo shape

`backend/` is a single **Nest CLI monorepo** (Nest's own built-in multi-app
mode — not Nx, not Lerna). This is controlled by `nest-cli.json`:

```jsonc
{
  "monorepo": true,
  "projects": {
    "auth": { "type": "application", "root": "apps/auth", ... },
    "employees": { "type": "application", "root": "apps/employees", ... },
    "timesheets": { "type": "application", "root": "apps/timesheets", ... },
    "payroll": { "type": "application", "root": "apps/payroll", ... },
    "feedback": { "type": "application", "root": "apps/feedback", ... },
    "notifications": { "type": "application", "root": "apps/notifications", ... },
    "shared": { "type": "library", "root": "libs/shared", ... }
  }
}
```

Each entry under `apps/` is a **fully independent NestJS application** —
its own `main.ts`, its own port, its own process. `npm run start:<name>`
boots exactly one of them; `npm run start:all` boots all six together
(via `concurrently`, one colored log stream per app). There is one root
`package.json`, one root `tsconfig.json`, and one root `.env` shared by all
six — but at runtime they are just six separate Node processes that happen
to live in the same repo and reuse the same `libs/shared` code by import
path (`@app/shared`, resolved via a TS path alias, not an npm package).

Every app follows the same internal shape:

```
apps/<name>/
  src/
    main.ts                    bootstraps the app, Swagger, global pipes
    <name>.module.ts           root module — Mongo connection, imports
    apis/
      health/                  GET /health liveness check (every app has one)
      <feature>/
        <feature>.schema.ts     Mongoose schema + document type
        <feature>.dto.ts        request/response DTOs (class-validator + Swagger)
        <feature>.repository.ts thin Mongoose query layer
        <feature>.service.ts    business logic
        <feature>.controller.ts routes, guards, request→service wiring
        <feature>.module.ts     wires the above together
  tsconfig.app.json
```

This `controller → service → repository → schema` layering is the same
pattern used throughout the sibling `CAMPUS_PLACEMENT_...` backend, adopted
here for consistency.

## 2. Why no API gateway and no event bus

The original PDF spec diagrams an API Gateway in front of all six services,
plus an event bus for cross-service triggers. This implementation
deliberately **does not** build either of those, in favor of the simpler
pattern already proven in the sibling project:

- **No gateway** — each frontend talks to each backend app directly, on its
  own port (`environment.ts` in each Angular app lists one base URL per
  app: `authServiceUrl`, `employeesServiceUrl`, etc.). One fewer moving
  part to run, and no gateway-level auth/proxy logic to maintain.
- **No event bus** — the handful of cross-app calls this system needs
  (see §5) are plain HTTP calls, straight from the calling app to the
  callee's port, using small typed helper functions in `libs/shared`. There
  is no message broker (Kafka/RabbitMQ/etc.) anywhere in this system.

This is a real trade-off, not a shortcut taken by accident: it means a
cross-app call fails synchronously and visibly (an HTTP error) rather than
being silently retried by a broker, and it means every app needs to know
the URL of every other app it calls (via env vars). For a system this size,
that's judged simpler than standing up and operating a broker.

## 3. Data storage

**One shared MongoDB connection** (`APP_MONGODB_URI` in `.env`) is used by
every app that needs a database. Each app only ever registers the Mongoose
schemas it owns (e.g. `timesheets` never touches the `Employee` collection
directly), so there is still logical separation between apps — it's just
not physically separate databases. The `notifications` app is the one
exception: it registers **no** Mongoose connection at all, because it's
genuinely stateless (see §4.6).

## 4. Apps, in detail

### 4.1 `auth` (port 3001)

Owns the one collection every login depends on. No other app ever reads or
writes it directly.

**Schema — `User`**

| Field | Type | Notes |
|---|---|---|
| `name` | `string` | required, trimmed |
| `email` | `string` | required, unique, lowercased — this is the login ID |
| `passwordHash` | `string` | required, `select: false` (bcrypt hash only — plaintext is never stored) |
| `role` | `'employer_admin' \| 'employee'` | required |
| `companyId` | `string` | required. For an `employer_admin` this is their **own** user id (set at creation). Every other app scopes its queries by this value. |
| `employeeId` | `string \| null` | only set for `employee` accounts — the `employees` app's `Employee._id` |
| `mustChangePassword` | `boolean` | default `false`. Set `true` when `employees` provisions a new account, so the employee is nudged to change their temporary password on first login |
| `otpHash` | `string \| null` | `select: false`. Hashed 6-digit password-reset code |
| `otpExpiresAt` | `Date \| null` | `select: false`. ~10 minute TTL from issue time |
| `currentHashedRefreshToken` | `string \| null` | `select: false`. Hashed refresh token; nulled out on logout |
| `createdAt` | `Date` | from `{ timestamps: true }` |

**Endpoints**

| Method & path | Guard | Body | Returns |
|---|---|---|---|
| `POST /auth/login` | — | `{ email, password }` | `{ accessToken, user }` + sets `refresh_token` httpOnly cookie, for either role |
| `POST /auth/refresh` | refresh cookie | — | `{ accessToken }` |
| `POST /auth/logout` | JWT | — | `{ message }`, clears the refresh cookie |
| `GET /auth/me` | JWT | — | the raw JWT payload (`sub`, `email`, `role`, `companyId`, `employeeId?`) |
| `POST /auth/password` | JWT | `{ newPassword }` | `{ message }` — also clears `mustChangePassword` |
| `POST /auth/password/forgot` | — | `{ email }` | `{ message }` (always the same response, whether or not the email exists) |
| `POST /auth/password/reset` | — | `{ email, otp, newPassword }` | `{ message }` |
| `POST /auth/internal/provision` | — (internal only) | `{ employeeId, companyId, email, name, initialPassword?, mustChangePassword? }` | `{ temporaryPassword }` |

**Login flow**

1. `POST /auth/login` verifies the password and issues tokens immediately —
   both `employee` and `employer_admin` accounts get an access token
   (~15 min, `JWT_ACCESS_EXPIRY`) and a refresh token (~7 day,
   `JWT_REFRESH_EXPIRY`) straight away, no second step. The refresh token is
   stored as a bcrypt hash against the user and set as an httpOnly
   `refresh_token` cookie. Each frontend rejects the login client-side if
   the returned `user.role` doesn't match what that portal expects (see
   `frontend-architecture.md` §5).
2. Every subsequent request sends the access token as a Bearer header;
   `POST /auth/refresh` (reading the httpOnly cookie) exchanges it for a
   new access token once it expires.

The 6-digit OTP mechanism (`otpHash`/`otpExpiresAt` on `User`, emailed via
`notifications`) is not part of login — it's only used by the
`password/forgot` + `password/reset` pair, below.

**Account provisioning** — `POST /auth/internal/provision` is called only
by the `employees` app, never by a frontend. It creates the `User` record
with an auto-generated random password (`crypto.randomBytes`) unless the
employer typed one explicitly on the create-employee form, then emails the
login + temporary password via `notifications`.

### 4.2 `employees` (port 3002)

**Schema — `Employee`**

| Field | Type | Notes |
|---|---|---|
| `companyId` | `string` | required — the owning employer's user id |
| `name` | `string` | required, trimmed |
| `email` | `string` | required, unique, lowercased |
| `department` | `string?` | optional |
| `designation` | `string?` | optional |
| `joiningDate` | `Date` | required |
| `salary` | `number` | required, min `0` — an hourly rate or a fixed salary, depending on `payType` |
| `payType` | `'hourly' \| 'fixed'` | default `'fixed'` |
| `reportingManagerId` | `string \| null` | optional — another employee's id, for manager-routed approval (not currently used for routing; timesheets always route to any employer/admin in the company) |
| `isActive` | `boolean` | default `true` — the single switch that gates login (soft-delete, never hard-deleted) |
| `createdAt` | `Date` | from `{ timestamps: true }` |

**Endpoints**

| Method & path | Guard | Body / Query | Returns |
|---|---|---|---|
| `GET /employees/me` | JWT, role `employee` | — | the logged-in employee's own record |
| `GET /employees` | JWT, role `employer_admin` | `?department=&isActive=` | the company's employee directory, filterable |
| `POST /employees` | JWT, role `employer_admin` | see §5 form fields below | the created employee — also provisions their login via `auth` |
| `PUT /employees/:id` | JWT, role `employer_admin` | partial employee fields | the updated employee |
| `PATCH /employees/:id/status` | JWT, role `employer_admin` | `{ isActive }` | the updated employee |
| `GET /employees/internal/:id` | — (internal only) | — | `{ id, name, email, companyId, salary, payType }` — used by `timesheets`/`payroll`/`feedback` to resolve an employee's contact/pay details |

**Create-employee request body** (`CreateEmployeeRequestDto`):

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string, min 2 chars | ✅ | |
| `email` | valid email | ✅ | becomes the login ID |
| `department` | string | – | |
| `designation` | string | – | |
| `joiningDate` | date string | ✅ | |
| `salary` | number ≥ 0 | ✅ | |
| `payType` | `'hourly' \| 'fixed'` | – | defaults to `'fixed'` |
| `reportingManagerId` | string | – | |
| `initialPassword` | string, min 8 chars | – | if omitted, `auth` auto-generates a random temporary password instead |

On create, `employees` calls `auth`'s `POST /auth/internal/provision`
(fire-and-forget, logged on failure rather than failing the whole request)
so the employee record and its login are both created from one form
submission.

### 4.3 `timesheets` (port 3003)

**Schema — `Timesheet`**

| Field | Type | Notes |
|---|---|---|
| `employeeId` | `string` | required |
| `companyId` | `string` | required |
| `period` | `string` | e.g. `"2026-07-14"` for a week-start, or `"2026-07"` for a month — a company-level cycle setting, not per-employee |
| `entries` | `TimesheetEntry[]` | see below |
| `status` | `'draft' \| 'pending' \| 'approved' \| 'rejected'` | default `'draft'` |
| `statusHistory` | `TimesheetStatusEvent[]` | append-only log — see below |
| `isWithdrawn` | `boolean` | default `false` — soft-delete flag |
| `createdAt` | `Date` | from `{ timestamps: true }` |

`TimesheetEntry` (one row per logged day):

| Field | Type | Notes |
|---|---|---|
| `date` | `string` | e.g. `"2026-07-14"` |
| `hours` | `number` | ≥ 0 |
| `task` | `string?` | optional free-text description |

`TimesheetStatusEvent` (one entry per decision — **appended**, never
overwritten, so the full approve/reject/resubmit thread is preserved):

| Field | Type | Notes |
|---|---|---|
| `status` | `'draft' \| 'pending' \| 'approved' \| 'rejected'` | |
| `remarks` | `string?` | required by the API when rejecting, optional otherwise |
| `changedBy` | `string` | the acting user's id (employee on submit, employer on decision) |
| `changedAt` | `Date` | defaults to now |

**Endpoints**

| Method & path | Guard | Body / Query | Returns |
|---|---|---|---|
| `POST /timesheets` | JWT, role `employee` | `{ period, entries[] }` | new timesheet, status `draft` |
| `PUT /timesheets/:id` | JWT, role `employee` | `{ period, entries[] }` | updated — only while `draft` or `rejected` |
| `POST /timesheets/:id/submit` | JWT, role `employee` | — | status → `pending`, appends a `statusHistory` event |
| `GET /timesheets` | JWT | `?status=` | own timesheets if `employee`; the whole company's if `employer_admin` (approval queue) |
| `GET /timesheets/:id` | JWT | — | full detail including the whole `statusHistory` thread |
| `PATCH /timesheets/:id/status` | JWT, role `employer_admin` | `{ status, remarks? }` | approve / reject (remarks required) / keep-pending — appends to `statusHistory`, emails the employee via `notifications` |
| `GET /timesheets/internal/approved-hours` | — (internal only) | `?companyId=&period=` | `[{ employeeId, period, totalHours }]` — pulled by `payroll` when a pay run is triggered |

### 4.4 `payroll` (port 3004)

**Schema — `PayrollRun`**

| Field | Type | Notes |
|---|---|---|
| `companyId` | `string` | required |
| `period` | `string` | matches the timesheet cycle, e.g. `"2026-07"` |
| `lineItems` | `PayrollLineItem[]` | one per employee paid in this run |
| `status` | `'pending' \| 'processed' \| 'paid'` | default `'pending'` |
| `isVoid` | `boolean` | default `false` — corrections create a **new** run and void the old one rather than editing it in place |
| `createdAt` | `Date` | from `{ timestamps: true }` |

`PayrollLineItem`:

| Field | Type | Notes |
|---|---|---|
| `employeeId` | `string` | |
| `hoursApproved` | `number` | pulled from `timesheets`' approved-hours endpoint |
| `grossPay` | `number` | `hours × rate` for hourly employees; the full `salary` for fixed employees (no leave/partial-period pro-rating yet — flagged as future work) |
| `deductions` | `number` | currently always `0` — no deduction rules implemented yet |
| `netPay` | `number` | `grossPay − deductions` |

**Endpoints**

| Method & path | Guard | Body / Query | Returns |
|---|---|---|---|
| `POST /payroll/run` | JWT, role `employer_admin` | `{ period }` | a new `PayrollRun` — pulls approved hours from `timesheets`, rates from `employees`, computes pay per employee |
| `GET /payroll/:employeeId` | JWT | — | payroll runs containing that employee (an `employee` caller is always forced to their own id, regardless of the URL param) |
| `PATCH /payroll/:runId/process` | JWT, role `employer_admin` | — | marks the run `processed`, emails each employee their payslip summary via `notifications` |

### 4.5 `feedback` (port 3005)

**Schema — `Feedback`**

| Field | Type | Notes |
|---|---|---|
| `employeeId` | `string` | required |
| `companyId` | `string` | required |
| `category` | `'payroll' \| 'timesheet' \| 'portal_bug' \| 'general'` | required |
| `description` | `string` | required |
| `status` | `'open' \| 'in_review' \| 'resolved'` | default `'open'` |
| `replies` | `FeedbackReply[]` | append-only thread |
| `isArchived` | `boolean` | default `false` — resolved/old items move to an archived view rather than being removed |
| `createdAt` | `Date` | from `{ timestamps: true }` |

`FeedbackReply`: `{ message: string, byUserId: string, at: Date }`.

**Endpoints**

| Method & path | Guard | Body | Returns |
|---|---|---|---|
| `POST /feedback` | JWT, role `employee` | `{ category, description }` | new feedback item, status `open` |
| `GET /feedback` | JWT | — | own submissions if `employee`; the whole inbox if `employer_admin` |
| `GET /feedback/:id` | JWT | — | detail including the reply thread |
| `PATCH /feedback/:id/status` | JWT, role `employer_admin` | `{ status, message }` | appends a reply, updates status, emails the employee via `notifications` |

### 4.6 `notifications` (port 3006)

The only app with **no Mongoose connection at all** — it is genuinely
stateless, matching the original spec's "Stateless — uses Email Provider"
description. It exists purely to send email, called synchronously (HTTP)
by whichever app triggers a notification. Every endpoint is unauthenticated
and excluded from its own Swagger doc, since no browser ever calls it
directly — only the other backend apps do.

| Method & path | Body |
|---|---|
| `POST /notifications/otp` | `{ to, name, otp }` |
| `POST /notifications/account-created` | `{ to, name, temporaryPassword, loginUrl }` |
| `POST /notifications/password-changed` | `{ to, name }` |
| `POST /notifications/timesheet-status` | `{ to, name, status, period, remarks? }` |
| `POST /notifications/feedback-reply` | `{ to, name, status, reply }` |
| `POST /notifications/payroll-processed` | `{ to, name, period, netPay }` |

If `MAIL_HOST` is unset in `.env`, every email is logged to the console
instead of actually sent — so the whole system is runnable end-to-end
without real SMTP configured.

## 5. Cross-service calls

All defined as small typed functions in `libs/shared/src/utils/http-client.util.ts`,
each reading its target's base URL from an env var:

| Caller → Callee | Function | Purpose |
|---|---|---|
| `employees` → `auth` | `provisionEmployeeAccount` | create the login credential when an employee is created |
| `auth`/`employees`/`timesheets`/`payroll`/`feedback` → `notifications` | `sendOtpEmail`, `sendAccountCreatedEmail`, `sendPasswordChangedEmail`, `sendTimesheetStatusEmail`, `sendFeedbackReplyEmail`, `sendPayrollProcessedEmail` | trigger the relevant email |
| `timesheets`/`payroll`/`feedback` → `employees` | `findEmployeeById` | resolve an employee's name/email/pay details for emails and payroll math |
| `payroll` → `timesheets` | `fetchApprovedTimesheetHours` | pull approved hours for a period when a pay run is triggered |

## 6. Soft-delete / status flags

Nothing is ever hard-deleted. Every entity that can be "removed" instead
carries a flag that read queries filter by:

| Entity | Flag(s) | Effect when flipped |
|---|---|---|
| `Employee` | `isActive` | Login blocked (checked by `auth` — see note below), hidden from active-only directory views; payroll/timesheet history stays intact |
| `Timesheet` | `status`, `isWithdrawn` | Withdrawn/superseded entries drop out of the active list but stay queryable for audit |
| `Feedback` | `status`, `isArchived` | Resolved/old items move to an archived view instead of disappearing |
| `PayrollRun` | `isVoid` | Corrections create a new run and void the old one |

> Note: `isActive` currently lives only on the `employees` app's record.
> `auth`'s login check does not yet cross-reference it before issuing
> tokens — wiring that check (or denormalizing an `isActive` flag onto the
> `User` record, updated whenever `employees` flips it) is flagged as
> follow-up work, since it's a real gap between the documented behavior
> ("Inactive: Login blocked") and the current implementation.

## 7. Auth & scoping

- **JWT payload**: `{ sub, email, role, companyId, employeeId? }` — verified
  by every app that needs it via a shared Passport `JwtStrategy` (in
  `libs/shared`, registered per-app since each app is its own process/DI
  container).
- **`@CurrentUser()`** — a param decorator that reads the verified payload
  off the request.
- **`@Roles(...)` + `RolesGuard`** — route-level role gating; throws
  `ForbiddenException` if the caller's role isn't in the allowed list.
- **Scoping** — every controller reads `companyId`/`employeeId` from
  `@CurrentUser()` and passes it into the service/repository as a query
  filter. An `employee` calling e.g. `GET /payroll/:employeeId` with
  someone else's id is silently redirected to their own id server-side,
  rather than trusting the URL param.

## 8. Environment variables (`backend/.env`)

| Variable | Used by | Purpose |
|---|---|---|
| `NODE_ENV` | all | `development` / `production` |
| `APP_MONGODB_URI` | all except `notifications` | the one shared Mongo connection string |
| `JWT_SECRET` / `JWT_ACCESS_EXPIRY` | all (verify), `auth` (issue) | access token signing |
| `JWT_REFRESH_SECRET` / `JWT_REFRESH_EXPIRY` | `auth` | refresh token signing |
| `<APP>_PORT` (e.g. `AUTH_PORT`) | each app | which port it listens on |
| `<APP>_DOMAIN_URL` (e.g. `AUTH_DOMAIN_URL`) | `auth` | cookie domain for the refresh cookie |
| `MAIL_HOST` / `MAIL_PORT` / `MAIL_SECURE` / `MAIL_USER` / `MAIL_PASS` / `MAIL_FROM` | `notifications` | SMTP config — left blank, emails log to console instead |
| `EMPLOYER_PORTAL_URL` / `EMPLOYEE_PORTAL_URL` | `auth` | link targets used inside emails |
| `AUTH_SERVICE_URL`, `EMPLOYEES_SERVICE_URL`, `TIMESHEETS_SERVICE_URL`, `PAYROLL_SERVICE_URL`, `FEEDBACK_SERVICE_URL`, `NOTIFICATIONS_SERVICE_URL` | whichever app calls that service | base URLs for the cross-service HTTP calls in §5 |
