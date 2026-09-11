import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { computePayslip } from "@ixoris/payroll-engine";
import { PrismaService } from "../../prisma/prisma.service";
import { mapSalaryComponent } from "./payroll.mappers";
import { toNumber } from "../pos/pos.mappers";
import { PayrollPostingService } from "./payroll-posting.service";
import { AttendanceAdjustmentService } from "../hr/attendance-adjustment.service";

const runInclude = {
  payslips: {
    include: { employee: true, lines: { include: { component: true } } },
  },
} as const;

@Injectable()
export class PayrollRunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posting: PayrollPostingService,
    private readonly attendanceAdjustment: AttendanceAdjustmentService,
  ) {}

  async createRun(companyId: string, period: string) {
    const existing = await this.prisma.payrollRun.findUnique({ where: { companyId_period: { companyId, period } } });
    if (existing) throw new BadRequestException(`A payroll run for ${period} already exists`);

    const [employees, components] = await Promise.all([
      this.prisma.employee.findMany({ where: { companyId, status: "ACTIVE" } }),
      this.prisma.salaryComponent.findMany({ where: { companyId } }),
    ]);
    if (employees.length === 0) throw new BadRequestException("No active employees to run payroll for");

    const componentByCode = new Map(components.map((c) => [c.code, c]));
    const baseComponent = componentByCode.get("BASE");
    if (!baseComponent) {
      throw new BadRequestException("Salary component 'BASE' is not configured — seed the chart of salary components first");
    }
    const extraComponents = components.filter((c) => c.code !== "BASE").map(mapSalaryComponent);

    const run = await this.prisma.payrollRun.create({ data: { companyId, period, status: "DRAFT" } });

    for (const employee of employees) {
      const adjustment = await this.attendanceAdjustment.computeForPeriod(employee.id, period);
      const proratedBaseSalary = round2(toNumber(employee.baseSalary) * adjustment.ratio);

      const result = computePayslip({
        employeeId: employee.id,
        baseSalary: proratedBaseSalary,
        components: extraComponents,
      });

      await this.prisma.payslip.create({
        data: {
          payrollRunId: run.id,
          employeeId: employee.id,
          grossSalary: result.grossSalary,
          totalDeductions: result.totalDeductions,
          totalEmployerContributions: result.totalEmployerContributions,
          netSalary: result.netSalary,
          lines: {
            create: result.lines.map((line) => {
              const component = line.componentCode === "BASE" ? baseComponent : componentByCode.get(line.componentCode);
              if (!component) throw new BadRequestException(`Unknown salary component "${line.componentCode}"`);
              return { componentId: component.id, label: line.label, base: line.base, amount: line.amount };
            }),
          },
        },
      });
    }

    return this.findOne(companyId, run.id);
  }

  /** Locks the run and posts a consolidated journal entry (journal PA) covering every payslip. */
  async validate(companyId: string, runId: string, userId: string) {
    const run = await this.prisma.payrollRun.findFirst({ where: { id: runId, companyId }, include: runInclude });
    if (!run) throw new NotFoundException(`Payroll run ${runId} not found`);
    if (run.status !== "DRAFT") throw new BadRequestException(`Payroll run ${run.period} is not a draft`);

    await this.posting.postRun(companyId, userId, run);

    return this.prisma.payrollRun.update({ where: { id: run.id }, data: { status: "VALIDATED" }, include: runInclude });
  }

  async list(companyId: string) {
    return this.prisma.payrollRun.findMany({ where: { companyId }, include: runInclude, orderBy: { period: "desc" } });
  }

  async findOne(companyId: string, id: string) {
    const run = await this.prisma.payrollRun.findFirst({ where: { id, companyId }, include: runInclude });
    if (!run) throw new NotFoundException(`Payroll run ${id} not found`);
    return run;
  }
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
