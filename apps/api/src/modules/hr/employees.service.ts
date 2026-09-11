import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateEmployeeDto, UpdateEmployeeDto } from "./dto/employee.dto";

const employeeInclude = { department: true, position: true, contracts: { orderBy: { startDate: "desc" as const } } };

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  create(companyId: string, dto: CreateEmployeeDto) {
    return this.prisma.employee.create({
      data: {
        companyId,
        employeeNumber: dto.employeeNumber,
        firstName: dto.firstName,
        lastName: dto.lastName,
        hireDate: new Date(dto.hireDate),
        baseSalary: dto.baseSalary,
        departmentId: dto.departmentId,
        positionId: dto.positionId,
        nationalId: dto.nationalId,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        bankIban: dto.bankIban,
        userId: dto.userId,
      },
    });
  }

  list(companyId: string, status?: "ACTIVE" | "ON_LEAVE" | "TERMINATED") {
    return this.prisma.employee.findMany({ where: { companyId, status }, include: employeeInclude, orderBy: { employeeNumber: "asc" } });
  }

  async findOne(companyId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({ where: { id, companyId }, include: employeeInclude });
    if (!employee) throw new NotFoundException(`Employee ${id} not found`);
    return employee;
  }

  async update(companyId: string, id: string, dto: UpdateEmployeeDto) {
    await this.findOne(companyId, id);
    return this.prisma.employee.update({ where: { id }, data: dto });
  }

  /** Ends employment: marks the employee TERMINATED and closes their current (open-ended) contract. */
  async terminate(companyId: string, id: string, terminationDate?: string) {
    await this.findOne(companyId, id);
    const endDate = terminationDate ? new Date(terminationDate) : new Date();

    await this.prisma.contract.updateMany({
      where: { employeeId: id, endDate: null },
      data: { endDate },
    });

    return this.prisma.employee.update({ where: { id }, data: { status: "TERMINATED" } });
  }
}
