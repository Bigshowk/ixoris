import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateLeaveTypeDto } from "./dto/leave.dto";

@Injectable()
export class LeaveTypesService {
  constructor(private readonly prisma: PrismaService) {}

  create(companyId: string, dto: CreateLeaveTypeDto) {
    return this.prisma.leaveType.create({ data: { companyId, name: dto.name, isPaid: dto.isPaid ?? true } });
  }

  list(companyId: string) {
    return this.prisma.leaveType.findMany({ where: { companyId }, orderBy: { name: "asc" } });
  }
}
