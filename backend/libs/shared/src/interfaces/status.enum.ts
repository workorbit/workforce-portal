// Shared status vocab so every app/service and both frontends agree on the
// exact string values (doc §6).

export enum TimesheetStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

// Per-day status on a timesheet entry — distinct from the timesheet-level
// TimesheetStatus (draft/pending/approved/rejected) above.
export enum TimesheetEntryStatus {
  PRESENT = 'present',
  WFH = 'wfh',
  LEAVE = 'leave',
  SICK_LEAVE = 'sick_leave',
  HOLIDAY = 'holiday',
  WEEKEND = 'weekend',
}

export enum TimesheetPeriodType {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export enum FeedbackStatus {
  OPEN = 'open',
  IN_REVIEW = 'in_review',
  RESOLVED = 'resolved',
}

export enum FeedbackCategory {
  PAYROLL = 'payroll',
  TIMESHEET = 'timesheet',
  PORTAL_BUG = 'portal_bug',
  GENERAL = 'general',
}

export enum PayrollClaimStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PAID = 'paid',
}
