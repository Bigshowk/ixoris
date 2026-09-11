import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { toNumber } from "../pos/pos.mappers";
import { GenerateInstallmentsDto } from "./dto/installment.dto";

@Injectable()
export class InstallmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(companyId: string, invoiceId: string, dto: GenerateInstallmentsDto) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id: invoiceId, companyId } });
    if (!invoice) throw new NotFoundException(`Invoice ${invoiceId} not found`);

    const existing = await this.prisma.paymentInstallment.count({ where: { invoiceId } });
    if (existing > 0) throw new BadRequestException(`Invoice ${invoice.number} already has a payment schedule`);

    const total = toNumber(invoice.totalTTC);
    const sum = round2(dto.installments.reduce((s, l) => s + l.amount, 0));
    if (Math.abs(sum - total) > 0.5) {
      throw new BadRequestException(`Installments (${sum}) must sum to the invoice total (${total})`);
    }

    return this.prisma.$transaction(
      dto.installments.map((line, index) =>
        this.prisma.paymentInstallment.create({
          data: { invoiceId, installmentNumber: index + 1, dueDate: new Date(line.dueDate), amount: line.amount },
        }),
      ),
    );
  }

  list(companyId: string, invoiceId: string) {
    return this.prisma.paymentInstallment.findMany({ where: { invoiceId, invoice: { companyId } }, orderBy: { installmentNumber: "asc" } });
  }

  async markPaid(companyId: string, installmentId: string, paymentId?: string) {
    const installment = await this.prisma.paymentInstallment.findFirst({ where: { id: installmentId, invoice: { companyId } } });
    if (!installment) throw new NotFoundException(`Installment ${installmentId} not found`);
    if (installment.status === "PAID") throw new BadRequestException(`Installment ${installmentId} is already paid`);

    return this.prisma.paymentInstallment.update({ where: { id: installmentId }, data: { status: "PAID", paidAt: new Date(), paymentId } });
  }

  /** Flags installments past their due date as OVERDUE — called alongside CreditControlService.runOverdueCheck. */
  async markOverdue(companyId: string) {
    const result = await this.prisma.paymentInstallment.updateMany({
      where: { status: "PENDING", dueDate: { lt: new Date() }, invoice: { companyId } },
      data: { status: "OVERDUE" },
    });
    return { updated: result.count };
  }
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
