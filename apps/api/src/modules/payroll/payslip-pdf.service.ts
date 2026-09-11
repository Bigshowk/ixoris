import { Injectable, NotFoundException } from "@nestjs/common";
import { buildPayslipPdf, PayslipResult } from "@ixoris/payroll-engine";
import { PrismaService } from "../../prisma/prisma.service";
import { toNumber } from "../pos/pos.mappers";

@Injectable()
export class PayslipPdfService {
  constructor(private readonly prisma: PrismaService) {}

  async buildPdf(companyId: string, payslipId: string): Promise<Buffer> {
    const payslip = await this.prisma.payslip.findFirst({
      where: { id: payslipId, payrollRun: { companyId } },
      include: {
        employee: { include: { position: true } },
        payrollRun: true,
        lines: { include: { component: true } },
      },
    });
    if (!payslip) throw new NotFoundException(`Payslip ${payslipId} not found`);

    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });

    const payslipResult: PayslipResult = {
      employeeId: payslip.employeeId,
      grossSalary: toNumber(payslip.grossSalary),
      totalDeductions: toNumber(payslip.totalDeductions),
      totalEmployerContributions: toNumber(payslip.totalEmployerContributions),
      netSalary: toNumber(payslip.netSalary),
      lines: payslip.lines.map((line) => ({
        componentCode: line.component.code,
        label: line.label,
        type: line.component.type,
        base: toNumber(line.base),
        amount: toNumber(line.amount),
      })),
    };

    return buildPayslipPdf({
      company: {
        companyName: company.name,
        companyAddress: company.address ?? undefined,
        taxId: company.taxId ?? undefined,
      },
      employee: {
        fullName: `${payslip.employee.firstName} ${payslip.employee.lastName}`,
        employeeNumber: payslip.employee.employeeNumber,
        position: payslip.employee.position?.title,
      },
      period: payslip.payrollRun.period,
      payslip: payslipResult,
      currencySymbol: company.baseCurrencyCode,
    });
  }
}
