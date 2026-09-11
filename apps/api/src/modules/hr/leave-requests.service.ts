import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateLeaveRequestDto } from "./dto/leave.dto";

const requestInclude = { employee: true, leaveType: true } as const;

@Injectable()
export class LeaveRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateLeaveRequestDto) {
    const employee = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, companyId } });
    if (!employee) throw new NotFoundException(`Employee ${dto.employeeId} not found`);
    const leaveType = await this.prisma.leaveType.findFirst({ where: { id: dto.leaveTypeId, companyId } });
    if (!leaveType) throw new NotFoundException(`Leave type ${dto.leaveTypeId} not found`);

    return this.prisma.leaveRequest.create({
      data: {
        employeeId: dto.employeeId,
        leaveTypeId: dto.leaveTypeId,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        status: "PENDING",
      },
      include: requestInclude,
    });
  }

  async approve(companyId: string, id: string, approverId: string) {
    return this.setStatus(companyId, id, "APPROVED", approverId);
  }

  async reject(companyId: string, id: string, approverId: string) {
    return this.setStatus(companyId, id, "REJECTED", approverId);
  }

  private async setStatus(companyId: string, id: string, status: "APPROVED" | "REJECTED", approverId: string) {
    const request = await this.prisma.leaveRequest.findFirst({ where: { id, employee: { companyId } } });
    if (!request) throw new NotFoundException(`Leave request ${id} not found`);
    if (request.status !== "PENDING") throw new BadRequestException(`Leave request ${id} is already ${request.status.toLowerCase()}`);

    return this.prisma.leaveRequest.update({ where: { id }, data: { status, approvedById: approverId }, include: requestInclude });
  }

  async listByEmployee(companyId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId } });
    if (!employee) throw new NotFoundException(`Employee ${employeeId} not found`);
    return this.prisma.leaveRequest.findMany({ where: { employeeId }, include: requestInclude, orderBy: { startDate: "desc" } });
  }

  listPending(companyId: string) {
    return this.prisma.leaveRequest.findMany({
      where: { status: "PENDING", employee: { companyId } },
      include: requestInclude,
      orderBy: { startDate: "asc" },
    });
  }
}
