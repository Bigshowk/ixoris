import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateDepartmentDto } from "./dto/department.dto";

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  create(companyId: string, dto: CreateDepartmentDto) {
    return this.prisma.department.create({ data: { companyId, name: dto.name } });
  }

  list(companyId: string) {
    return this.prisma.department.findMany({ where: { companyId }, orderBy: { name: "asc" } });
  }

  async findOne(companyId: string, id: string) {
    const department = await this.prisma.department.findFirst({ where: { id, companyId } });
    if (!department) throw new NotFoundException(`Department ${id} not found`);
    return department;
  }
}
