import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { RecordAttendanceDto } from "./dto/attendance.dto";

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Manual/admin entry — also how an ABSENT day gets recorded for payroll proration. */
  async record(companyId: string, dto: RecordAttendanceDto) {
    const employee = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, companyId } });
    if (!employee) throw new NotFoundException(`Employee ${dto.employeeId} not found`);

    const date = startOfDay(new Date(dto.date));
    return this.prisma.attendance.upsert({
      where: { employeeId_date: { employeeId: dto.employeeId, date } },
      update: { status: dto.status, checkIn: dto.checkIn ? new Date(dto.checkIn) : undefined, checkOut: dto.checkOut ? new Date(dto.checkOut) : undefined },
      create: {
        employeeId: dto.employeeId,
        date,
        status: dto.status,
        checkIn: dto.checkIn ? new Date(dto.checkIn) : undefined,
        checkOut: dto.checkOut ? new Date(dto.checkOut) : undefined,
      },
    });
  }

  async checkIn(companyId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId } });
    if (!employee) throw new NotFoundException(`Employee ${employeeId} not found`);

    const date = startOfDay(new Date());
    return this.prisma.attendance.upsert({
      where: { employeeId_date: { employeeId, date } },
      update: { checkIn: new Date(), status: "PRESENT" },
      create: { employeeId, date, checkIn: new Date(), status: "PRESENT" },
    });
  }

  async checkOut(companyId: string, employeeId: string) {
    const date = startOfDay(new Date());
    const existing = await this.prisma.attendance.findFirst({ where: { employeeId, date, employee: { companyId } } });
    if (!existing) throw new BadRequestException(`No check-in recorded for today — check in first`);

    return this.prisma.attendance.update({ where: { id: existing.id }, data: { checkOut: new Date() } });
  }

  async listByEmployee(companyId: string, employeeId: string, from?: Date, to?: Date) {
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId } });
    if (!employee) throw new NotFoundException(`Employee ${employeeId} not found`);

    return this.prisma.attendance.findMany({
      where: { employeeId, date: { gte: from, lte: to } },
      orderBy: { date: "desc" },
    });
  }
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
