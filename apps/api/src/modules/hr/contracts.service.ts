import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateContractDto, EndContractDto } from "./dto/contract.dto";

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateContractDto) {
    const employee = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, companyId } });
    if (!employee) throw new NotFoundException(`Employee ${dto.employeeId} not found`);

    return this.prisma.contract.create({
      data: {
        employeeId: dto.employeeId,
        type: dto.type,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        grossSalary: dto.grossSalary,
        documentUrl: dto.documentUrl,
      },
    });
  }

  async listByEmployee(companyId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId } });
    if (!employee) throw new NotFoundException(`Employee ${employeeId} not found`);
    return this.prisma.contract.findMany({ where: { employeeId }, orderBy: { startDate: "desc" } });
  }

  async end(companyId: string, contractId: string, dto: EndContractDto) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, employee: { companyId } },
    });
    if (!contract) throw new NotFoundException(`Contract ${contractId} not found`);
    if (contract.endDate) throw new BadRequestException(`Contract ${contractId} already has an end date`);

    return this.prisma.contract.update({
      where: { id: contractId },
      data: { endDate: dto.endDate ? new Date(dto.endDate) : new Date() },
    });
  }
}
