# Frontend Architecture

## 1. Two independent apps, not one

`employer-portal/` and `employee-portal/` are two fully separate Angular
CLI applications — separate `package.json`, separate `angular.json`,
separate `node_modules`. There is no shared Angular library between them;
common patterns (dark theme tokens, the NgRx `auth` slice shape, the
`AppShell` layout component) are duplicated by hand into both, the same way
the sibling `CAMPUS_PLACEMENT_...` project's `frontend/` and
`admin-portal/` already relate to each other. This was a deliberate choice
over a shared Nx workspace — see the project's approved implementation
plan for the reasoning.

| | employer-portal | employee-portal |
|---|---|---|
| Port | 4200 | 4300 |
| Used by | `employer_admin` role | `employee` role |
| Login flow | email + password → tokens | email + password → tokens |

## 2. Tech stack

- **Angular 21**, standalone components (no `NgModule`s), signals for local
  component state (`signal()`, `computed()`), the new `@if`/`@for` control
  flow syntax.
- **NgRx** (`@ngrx/store` + `@ngrx/effects`) for all server-derived state
  (auth session, employees, timesheets). Local, ephemeral UI state (is a
  form open, which tab is active) stays as component signals — it does not
  go into the store.
- **Bootstrap 5** and **Tailwind 4** coexisting in the same app (see §3) —
  Bootstrap supplies base component styling (forms, buttons), Tailwind
  supplies utility classes, and a shared set of CSS custom properties
  (design tokens) drive both plus all hand-written component SCSS.
- Dark theme only for this project (no light-mode toggle) — a navy/teal
  palette chosen to echo the original PDF spec's own cover-page branding.

## 3. The styling system

Every component's SCSS reads from the same CSS custom properties rather
than hardcoding colors/spacing. Three files, loaded in this exact order via
`angular.json`'s `"styles"` array:

1. **`src/styles/tailwind-base.scss`** — imports Tailwind's theme +
   utilities layers, and defines the color/radius tokens inside an
   `@theme { ... }` block:

   ```scss
   --color-bg: #0a1420;        // page background
   --color-surface: #101d2c;   // cards, sidebar
   --color-surface-2: #16273a; // inputs, nested surfaces
   --color-text: #e8edf2;
   --color-text-muted: #8fa1b3;
   --color-border: #223449;
   --color-primary: #14b8a6;   // teal — buttons, links, active nav state
   --color-primary-dark: #0d9488;
   --color-secondary: #64748b;
   --color-success: #22c55e;
   --color-warning: #f59e0b;
   --color-danger: #ef4444;
   --radius-sm / --radius-md / --radius-lg
   ```

   This block **must** live in this same file as the two `@import`
   statements — Angular/PostCSS processes each `styles` array entry as its
   own pass, so an `@theme` block in a separately-`@use`'d partial never
   gets picked up by Tailwind's utility generator.

2. **`_variables.scss`** — the non-Tailwind-namespaced half of the token
   set: an 8-step spacing scale (`--space-1` … `--space-8`), typography
   scale (`--font-size-xs` … `--font-size-3xl`, weights, line-heights), and
   `--shadow-card`. Also sets `color-scheme: dark` at `:root`.

3. **`_bootstrap-overrides.scss`** — forwards Bootstrap's SCSS
   (`@forward 'bootstrap/scss/bootstrap' with (...)`) with the same colors
   baked in as literal Sass variables (`$primary: #14b8a6`, etc.).
   Bootstrap's own color functions (`darken`/`lighten`) can't operate on
   CSS custom properties, so these values are kept as plain hex, manually
   in sync with the `@theme` block above.

Component-level SCSS then only ever reads `var(--color-primary)`,
`var(--space-4)`, etc. — never a raw hex code or pixel value.

## 4. App structure (identical shape in both apps)

```
src/app/
  core/
    api/            one *-api.service.ts per backend app it talks to
    auth/           auth.guard.ts, jwt.interceptor.ts
  store/
    auth/           actions, reducer, selectors, effects
    <feature>/       same 4-file shape per feature (employees, timesheets)
  shared/
    models/          plain TS interfaces/enums mirroring backend DTOs
    components/
      app-shell/      sidebar + topbar layout, wraps every authenticated page
  features/
    auth/login/       (+ auth/forgot-password/, auth/reset-password/ in employee-portal only)
    dashboard/
    <feature>/         one folder per routed screen
  app.routes.ts
  app.config.ts
  app.ts / app.html
```

Every routed feature is **lazy-loaded** (`loadComponent: () => import(...)`)
and every authenticated route is behind `authGuard`, which waits for the
app-boot session restore to finish before deciding — so a hard page reload
on e.g. `/timesheets` doesn't flash a redirect to `/login` while the silent
refresh-token exchange is still in flight.

## 5. NgRx pattern

Every store slice follows the same four files:

- **`*.actions.ts`** — `createActionGroup({ source: '<Feature>', events: {...} })`.
- **`*.reducer.ts`** — `createReducer` + `on(...)` handlers; state shape
  always includes at least `loading`/`saving` and `error`.
- **`*.selectors.ts`** — `createFeatureSelector` + `createSelector`.
- **`*.effects.ts`** — one `createEffect` per async action, calling the
  matching `core/api/*.service.ts`, mapping success/failure to the
  matching `*Success`/`*Failure` action. Navigation side-effects (redirect
  after login, after logout) are `{ dispatch: false }` effects that call
  `Router.navigateByUrl`.

Components inject `Store` and read state via `store.selectSignal(...)` —
never subscribing manually.

### The `auth` slice

Both apps (`AuthState`): `{ user, accessToken, loading, initialized, error }`.
`login` → `loginSuccess`/`loginFailure` directly (no OTP step in either
portal — a valid password is sufficient) → redirect to `/dashboard`.

**employee-portal** additionally carries `pendingResetEmail` and the
`changePassword`/`forgotPassword`/`resetPassword` actions. `pendingResetEmail`
and the forgot/reset actions drive the standalone password-reset flow, which
is unrelated to login and is the only place OTP still appears in this app:

```
/forgot-password: forgotPassword({email}) → forgotPasswordSuccess({email}) → redirect to /reset-password
                                                                                  │
/reset-password: resetPassword({email, otp, newPassword}) → resetPasswordSuccess → redirect to /login
```

Both apps' `restoreSession` effect calls `POST /auth/refresh` then
`GET /auth/me` on app boot, and rejects (dispatches
`restoreSessionFailure`) if the returned role doesn't match what that
portal expects — so an employee's session cookie can't silently restore
them into the employer portal or vice versa.

## 6. Employer Portal — screens & every form field

### 6.1 Login (`/login`)

| Field | Type | Validation |
|---|---|---|
| Email | text (email) | required, valid email |
| Password | text/password (toggleable) | required, min 8 chars |

Submits `AuthActions.login({ email, password })`. If the logged-in account's
role isn't `employer_admin` (i.e. someone with an Employee account tried to
log in here), the effect surfaces an error telling them to use the Employee
Portal instead.

### 6.2 Dashboard (`/dashboard`)

Read-only KPI cards, no form fields: total employees, active count,
inactive count, timesheets pending review, plus a short list of the
pending timesheets and quick-action links to Employees/Timesheets/Payroll.

### 6.3 Employees (`/employees`)

A directory table (name, email, department, joined date, active/inactive
pill, an Activate/Deactivate link) with a collapsible **create-employee
form** above it:

| Field | Type | Validation | Maps to |
|---|---|---|---|
| Full name | text | required, min 2 chars | `name` |
| Official email | text (email) | required, valid email | `email` — becomes the login ID |
| Department | text | optional | `department` |
| Designation | text | optional | `designation` |
| Joining date | date picker | required | `joiningDate` |
| Salary / rate | number | required, ≥ 0 | `salary` |
| Pay type | select: Fixed / Hourly | defaults to Fixed | `payType` |
| Initial password | text | optional, min 8 chars if filled | `initialPassword` — leave blank to auto-generate one |

Submits `EmployeesActions.createEmployee({ payload })`. The
Activate/Deactivate link dispatches `updateEmployeeStatus({ id, isActive })`
with the flipped boolean — no confirmation dialog (a straightforward
status toggle, reversible any time).

### 6.4 Timesheets (`/timesheets`)

The approval queue — one card per timesheet, each showing the period,
total hours, current status pill, and (if there's history) the full
remarks thread. For any timesheet still `pending`, a decision panel is
shown:

| Field | Type | Validation |
|---|---|---|
| Remarks | textarea | required only when rejecting; optional for approve/keep-pending |

Three buttons — **Approve**, **Reject**, **Keep Pending** — each dispatch
`TimesheetsActions.updateTimesheetStatus({ id, payload: { status, remarks } })`
with the corresponding status.

### 6.5 Payroll (`/payroll`) & Feedback Inbox (`/feedback-inbox`)

Both are placeholder panels explaining that the backend is fully wired
(payroll runs / feedback replies both work end-to-end via Swagger or a
future UI pass) but the screen itself hasn't been built yet.

## 7. Employee Portal — screens & every form field

### 7.1 Login (`/login`)

Same two fields as the employer portal's login (email, password), and the
same direct-to-tokens behavior — no OTP step. If the logged-in account's
role isn't `employee`, the effect surfaces an error telling them to use the
Employer Portal instead. A **Forgot password?** link goes to
`/forgot-password`.

### 7.2 Forgot / reset password (`/forgot-password`, `/reset-password`)

| Screen | Field(s) | Validation |
|---|---|---|
| Forgot password | Email | required, valid email |
| Reset password | Verification code (6-digit), New password, Confirm new password | code required exactly 6 chars; passwords required, min 8 chars, must match |

`/forgot-password` submits `AuthActions.forgotPassword({ email })`, which
always shows the same generic confirmation (the backend never reveals
whether the email exists) and redirects to `/reset-password`. That screen
submits `AuthActions.resetPassword({ email, otp, newPassword })` (the
`email` comes from the store's `pendingResetEmail`, not a hidden form
field) and has its own **Resend code** control. If opened directly with no
`pendingResetEmail` in the store, it redirects back to `/forgot-password`.
Profile's "Change password" link (§7.5) also points here — there's no
separate authenticated change-password screen.

### 7.3 Dashboard (`/dashboard`)

Read-only: pending/approved/rejected timesheet counts, quick-action links.
If the logged-in user's `mustChangePassword` is still `true` (a fresh
account that hasn't changed its temporary password yet), a dismissible-by-
navigation banner appears linking to `/profile`.

### 7.4 Timesheets (`/timesheets`)

A collapsible **log-hours form**, plus a history list below it:

| Field | Type | Validation |
|---|---|---|
| Period | text | required, e.g. `2026-07-14` |
| Entries (repeatable row) | date + number + text | at least one row |
| — Date | date picker | per-row |
| — Hours | number | per-row |
| — Task | text | optional, per-row |

Rows can be added (**+ Add day**) or removed (✕ per row). **Save as draft**
dispatches `TimesheetsActions.saveDraft({ period, entries })`. Any
timesheet still in `draft` or `rejected` status shows a **Submit for
review** button, dispatching `submitTimesheet({ id })`. Each card also
shows the full status/remarks history thread, same as the employer side.

### 7.5 Profile (`/profile`)

Two panels:

- **Contact info** (read-only) — name, email, department, designation,
  fetched once via `EmployeesApiService.getMyProfile()` (a plain HTTP call,
  not routed through NgRx, since it's a single read with no further
  interaction).
- **Change password** — a link to `/forgot-password` (§7.2), not an inline
  form; changing your password always goes through the emailed
  verification code, the same as recovering a forgotten one.

### 7.6 Payroll (`/payroll`), Feedback (`/feedback`), My Insights (`/analytics`)

All three are placeholder panels for the same reason as the employer
portal's Payroll/Feedback Inbox — backend ready, screen not yet built.

## 8. `environment.ts` (both apps, identical)

```ts
export const environment = {
  production: false,
  authServiceUrl: 'http://localhost:3001',
  employeesServiceUrl: 'http://localhost:3002',
  timesheetsServiceUrl: 'http://localhost:3003',
  payrollServiceUrl: 'http://localhost:3004',
  feedbackServiceUrl: 'http://localhost:3005',
};
```

No `notificationsServiceUrl` — the frontend never calls that app directly,
only other backend apps do.
