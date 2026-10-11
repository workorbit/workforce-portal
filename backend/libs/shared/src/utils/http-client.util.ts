import axios from 'axios';
import { INTERNAL_API_KEY_HEADER } from '../guards/internal-api.guard';

// Every call below crosses an app boundary into a route protected by
// InternalApiGuard, so each one has to carry the shared key. Read per call
// rather than cached at import time — the app's ConfigModule populates
// process.env during bootstrap, which can happen after this module loads.
function internalRequestConfig() {
  return {
    headers: { [INTERNAL_API_KEY_HEADER]: process.env.INTERNAL_API_KEY ?? '' },
  };
}

// No API gateway and no event bus in this system (matches the
// CAMPUS_PLACEMENT backend's convention) — the handful of cross-app calls
// this system needs are plain HTTP, straight from caller to callee's own
// port. Callers should catch/log rather than let a hiccup in a downstream
// app fail their own request, except where the call is load-bearing
// (provisioning an account cannot silently fail).

// ---------- employees -> auth ----------

export interface ProvisionAccountPayload {
  employeeId: string;
  companyId: string;
  email: string;
  name: string;
  // Only set when the employer typed a password manually on the create-
  // employee form; otherwise auth generates and emails a random one.
  initialPassword?: string;
}

export interface ProvisionAccountResult {
  temporaryPassword: string;
}

// `auth` owns the User/credentials collection exclusively — no other app
// writes to it directly (doc §7.1: "the employer is the source of truth",
// but auth is the source of truth for the login record itself).
export async function provisionEmployeeAccount(
  payload: ProvisionAccountPayload,
): Promise<ProvisionAccountResult> {
  const url = `${process.env.AUTH_SERVICE_URL}/auth/internal/provision`;
  const response = await axios.post<ProvisionAccountResult>(url, payload, internalRequestConfig());
  return response.data;
}

// ---------- {auth,employees,timesheets,payroll,feedback} -> notifications ----------

export interface SendOtpEmailPayload {
  to: string;
  name: string;
  otp: string;
}

export async function sendOtpEmail(payload: SendOtpEmailPayload): Promise<void> {
  const url = `${process.env.NOTIFICATIONS_SERVICE_URL}/notifications/otp`;
  await axios.post(url, payload, internalRequestConfig());
}

export interface SendAccountCreatedEmailPayload {
  to: string;
  name: string;
  temporaryPassword: string;
  loginUrl: string;
}

export async function sendAccountCreatedEmail(
  payload: SendAccountCreatedEmailPayload,
): Promise<void> {
  const url = `${process.env.NOTIFICATIONS_SERVICE_URL}/notifications/account-created`;
  await axios.post(url, payload, internalRequestConfig());
}

export interface SendPasswordChangedEmailPayload {
  to: string;
  name: string;
}

export async function sendPasswordChangedEmail(
  payload: SendPasswordChangedEmailPayload,
): Promise<void> {
  const url = `${process.env.NOTIFICATIONS_SERVICE_URL}/notifications/password-changed`;
  await axios.post(url, payload, internalRequestConfig());
}

export interface SendTimesheetStatusEmailPayload {
  to: string;
  name: string;
  status: 'approved' | 'rejected' | 'pending';
  period: string;
  remarks?: string;
}

export async function sendTimesheetStatusEmail(
  payload: SendTimesheetStatusEmailPayload,
): Promise<void> {
  const url = `${process.env.NOTIFICATIONS_SERVICE_URL}/notifications/timesheet-status`;
  await axios.post(url, payload, internalRequestConfig());
}

export interface SendFeedbackReplyEmailPayload {
  to: string;
  name: string;
  status: string;
  reply: string;
}

export async function sendFeedbackReplyEmail(
  payload: SendFeedbackReplyEmailPayload,
): Promise<void> {
  const url = `${process.env.NOTIFICATIONS_SERVICE_URL}/notifications/feedback-reply`;
  await axios.post(url, payload, internalRequestConfig());
}

export interface SendPayrollStatusEmailPayload {
  to: string;
  name: string;
  status: 'approved' | 'rejected' | 'pending';
  period: string;
  remarks?: string;
}

export async function sendPayrollStatusEmail(
  payload: SendPayrollStatusEmailPayload,
): Promise<void> {
  const url = `${process.env.NOTIFICATIONS_SERVICE_URL}/notifications/payroll-status`;
  await axios.post(url, payload, internalRequestConfig());
}

export interface SendPayrollPaidEmailPayload {
  to: string;
  name: string;
  period: string;
  netPay: number;
}

export async function sendPayrollPaidEmail(
  payload: SendPayrollPaidEmailPayload,
): Promise<void> {
  const url = `${process.env.NOTIFICATIONS_SERVICE_URL}/notifications/payroll-paid`;
  await axios.post(url, payload, internalRequestConfig());
}

// ---------- {timesheets,payroll,feedback} -> employees ----------

export interface InternalEmployee {
  id: string;
  name: string;
  email: string;
  companyId: string;
  salary: number;
  payType: 'hourly' | 'fixed';
}

// `employees` owns the Employee collection exclusively. Other apps only need
// the employee's name/email/pay details to render notifications and payroll
// — never the full record — so this is a narrow, key-authenticated
// service-to-service lookup rather than exposing the whole directory.
export async function findEmployeeById(employeeId: string): Promise<InternalEmployee | null> {
  const url = `${process.env.EMPLOYEES_SERVICE_URL}/employees/internal/${employeeId}`;
  const response = await axios.get<InternalEmployee | null>(url, internalRequestConfig());
  return response.data;
}

// ---------- {timesheets} -> auth ----------

export interface InternalUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

// `auth` owns the User collection exclusively. Timesheets needs this to
// resolve a display name for an employer_admin (both the "Bill To" company
// name and the "Approved By" name on a status event) since neither of those
// is an employee record.
export async function findUserById(userId: string): Promise<InternalUser | null> {
  const url = `${process.env.AUTH_SERVICE_URL}/auth/internal/users/${userId}`;
  const response = await axios.get<InternalUser | null>(url, internalRequestConfig());
  return response.data;
}
