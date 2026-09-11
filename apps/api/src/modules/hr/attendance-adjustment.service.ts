import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface AttendanceAdjustment {
  workingDays: number;
  unpaidDays: number;
  /** Fraction of the base salary actually earned this period (1 = full pay, 0 = fully unpaid). */
  ratio: number;
}

/**
 * Bridges Attendance/LeaveRequest into payroll: an employee absent without
 * an approved *paid* leave loses pay for those weekdays. Working days = all
 * Mon-Fri in the calendar month (no public-holiday calendar yet — a known
 * simplification, see README).
 */
@Injectable()
export class AttendanceAdjustmentService {
  constructor(private readonly prisma: PrismaService) {}

  async computeForPeriod(employeeId: string, period: string): Promise<AttendanceAdjustment> {
    const [year, month] = period.split("-").map(Number);
    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd = new Date(Date.UTC(year, month, 0));

    const workingDays = countWeekdays(periodStart, periodEnd);

    const leaveRequests = await this.prisma.leaveRequest.findMany({
      where: { employeeId, status: "APPROVED", startDate: { lte: periodEnd }, endDate: { gte: periodStart } },
      include: { leaveType: true },
    });

    const anyApprovedLeaveDates = new Set<string>();
    const unpaidLeaveDates = new Set<string>();
    for (const request of leaveRequests) {
      const from = maxDate(request.startDate, periodStart);
      const to = minDate(request.endDate, periodEnd);
      for (const day of eachDay(from, to)) {
        if (!isWeekday(day)) continue;
        const key = dayKey(day);
        anyApprovedLeaveDates.add(key);
        if (!request.leaveType.isPaid) unpaidLeaveDates.add(key);
      }
    }

    const absences = await this.prisma.attendance.findMany({
      where: { employeeId, status: "ABSENT", date: { gte: periodStart, lte: periodEnd } },
    });
    const unauthorizedAbsenceDates = new Set<string>();
    for (const absence of absences) {
      const key = dayKey(absence.date);
      if (!anyApprovedLeaveDates.has(key)) unauthorizedAbsenceDates.add(key);
    }

    const unpaidDays = unpaidLeaveDates.size + unauthorizedAbsenceDates.size;
    const ratio = workingDays > 0 ? Math.max(0, (workingDays - unpaidDays) / workingDays) : 1;

    return { workingDays, unpaidDays, ratio };
  }
}

function countWeekdays(start: Date, end: Date): number {
  let count = 0;
  for (const day of eachDay(start, end)) if (isWeekday(day)) count++;
  return count;
}

function* eachDay(start: Date, end: Date): Generator<Date> {
  const cursor = new Date(start);
  while (cursor <= end) {
    yield new Date(cursor);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
}

function isWeekday(date: Date): boolean {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function maxDate(a: Date, b: Date): Date {
  return a > b ? a : b;
}

function minDate(a: Date, b: Date): Date {
  return a < b ? a : b;
}
