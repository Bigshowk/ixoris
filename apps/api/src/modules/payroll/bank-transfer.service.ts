import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { buildBankTransferCsv } from "@ixoris/payroll-engine";
import { PrismaService } from "../../prisma/prisma.service";
import { toNumber } from "../pos/pos.mappers";

const batchInclude = { lines: { include: { employee: true } } } as const;

@Injectable()
export class BankTransferService {
  constructor(private readonly prisma: PrismaService) {}

  async generateForRun(companyId: string, runId: string, bankAccountId?: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, companyId },
      include: { payslips: { include: { employee: true } } },
    });
    if (!run) throw new NotFoundException(`Payroll run ${runId} not found`);
    if (run.status === "DRAFT") throw new BadRequestException("Validate the payroll run before generating transfers");

    const bankAccount = bankAccountId
      ? await this.prisma.bankAccount.findFirst({ where: { id: bankAccountId, companyId } })
      : await this.prisma.bankAccount.findFirst({ where: { companyId } });
    if (!bankAccount) throw new NotFoundException("No bank account configured for this company");

    const eligible = run.payslips.filter((p) => p.employee.bankIban);
    if (eligible.length === 0) {
      throw new BadRequestException("No employee with a bank IBAN on file for this payroll run");
    }

    return this.prisma.bankTransferBatch.create({
      data: {
        companyId,
        payrollRunId: run.id,
        bankAccountId: bankAccount.id,
        status: "GENERATED",
        lines: {
          create: eligible.map((p) => ({
            employeeId: p.employeeId,
            iban: p.employee.bankIban!,
            amount: p.netSalary,
            reference: `Salaire ${run.period}`,
          })),
        },
      },
      include: batchInclude,
    });
  }

  async findOne(companyId: string, id: string) {
    const batch = await this.prisma.bankTransferBatch.findFirst({ where: { id, companyId }, include: batchInclude });
    if (!batch) throw new NotFoundException(`Bank transfer batch ${id} not found`);
    return batch;
  }

  async toCsv(companyId: string, id: string): Promise<string> {
    const batch = await this.findOne(companyId, id);
    return buildBankTransferCsv(
      batch.lines.map((line) => ({
        employeeName: `${line.employee.firstName} ${line.employee.lastName}`,
        iban: line.iban,
        amount: toNumber(line.amount),
        reference: line.reference ?? undefined,
      })),
    );
  }
}
