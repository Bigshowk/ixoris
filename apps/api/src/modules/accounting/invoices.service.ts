import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "crypto";
import { WELL_KNOWN_ACCOUNTS } from "@ixoris/accounting-engine";
import { PrismaService } from "../../prisma/prisma.service";
import { JournalEntriesService, AutoPostLine } from "./journal-entries.service";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { toNumber } from "../pos/pos.mappers";
import { CreditControlService } from "../credit-control/credit-control.service";

const invoiceInclude = { lines: true } as const;

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalEntries: JournalEntriesService,
    private readonly creditControl: CreditControlService,
  ) {}

  async create(companyId: string, dto: CreateInvoiceDto) {
    if (dto.type === "CUSTOMER" && !dto.customerId) {
      throw new BadRequestException("customerId is required for a CUSTOMER invoice");
    }
    if (dto.type === "SUPPLIER" && !dto.supplierId) {
      throw new BadRequestException("supplierId is required for a SUPPLIER invoice");
    }
    if (dto.type === "CUSTOMER" && dto.customerId) {
      await this.creditControl.assertNotBlocked(companyId, dto.customerId);
    }

    const computedLines = dto.lines.map((l) => {
      const ht = round2(l.quantity * l.unitPrice);
      const tva = round2(ht * (l.tvaRate / 100));
      return { ...l, ht, tva, total: round2(ht + tva) };
    });
    const totalHT = round2(computedLines.reduce((sum, l) => sum + l.ht, 0));
    const totalTVA = round2(computedLines.reduce((sum, l) => sum + l.tva, 0));
    const totalTTC = round2(totalHT + totalTVA);

    return this.prisma.invoice.create({
      data: {
        companyId,
        type: dto.type,
        customerId: dto.customerId,
        supplierId: dto.supplierId,
        number: generateInvoiceNumber(dto.type),
        dueDate: new Date(dto.dueDate),
        status: "DRAFT",
        totalHT,
        totalTVA,
        totalTTC,
        lines: {
          create: computedLines.map((l) => ({
            productId: l.productId,
            label: l.label,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            tvaRate: l.tvaRate,
            total: l.total,
          })),
        },
      },
      include: invoiceInclude,
    });
  }

  /** Validates a draft invoice and posts the corresponding journal entry — the point of no return for editing it directly. */
  async validate(companyId: string, invoiceId: string, userId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      include: { customer: true, supplier: true },
    });
    if (!invoice) throw new NotFoundException(`Invoice ${invoiceId} not found`);
    if (invoice.status !== "DRAFT") throw new BadRequestException(`Invoice ${invoice.number} is not a draft`);

    const journalCode = invoice.type === "CUSTOMER" ? "VE" : "AC";
    const journal = await this.prisma.journal.findFirst({ where: { companyId, code: journalCode } });
    if (!journal) throw new NotFoundException(`Journal ${journalCode} not found — configure the chart of accounts first`);

    const ht = toNumber(invoice.totalHT);
    const tva = toNumber(invoice.totalTVA);
    const ttc = toNumber(invoice.totalTTC);
    const label = `Facture ${invoice.number}`;

    const lines: AutoPostLine[] =
      invoice.type === "CUSTOMER"
        ? [
            { accountCode: await this.resolveAccountCode(invoice.customer?.accountId, WELL_KNOWN_ACCOUNTS.clients), debit: ttc, credit: 0, label },
            { accountCode: WELL_KNOWN_ACCOUNTS.ventesMarchandises, debit: 0, credit: ht, label },
            ...(tva > 0 ? [{ accountCode: WELL_KNOWN_ACCOUNTS.tvaCollectee, debit: 0, credit: tva, label }] : []),
          ]
        : [
            { accountCode: WELL_KNOWN_ACCOUNTS.achatsMarchandises, debit: ht, credit: 0, label },
            ...(tva > 0 ? [{ accountCode: WELL_KNOWN_ACCOUNTS.tvaRecuperable, debit: tva, credit: 0, label }] : []),
            { accountCode: await this.resolveAccountCode(invoice.supplier?.accountId, WELL_KNOWN_ACCOUNTS.fournisseurs), debit: 0, credit: ttc, label },
          ];

    const entry = await this.journalEntries.postBalancedEntry(companyId, userId, {
      journalId: journal.id,
      date: invoice.date,
      description: label,
      sourceType: "Invoice",
      sourceId: invoice.id,
      lines,
    });

    const updated = await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: "VALIDATED", journalEntryId: entry.id },
      include: invoiceInclude,
    });

    if (invoice.type === "CUSTOMER" && invoice.customerId) {
      await this.creditControl.evaluateCreditLimit(companyId, invoice.customerId);
    }

    return updated;
  }

  async list(companyId: string, type?: "CUSTOMER" | "SUPPLIER") {
    return this.prisma.invoice.findMany({ where: { companyId, type }, include: invoiceInclude, orderBy: { date: "desc" }, take: 200 });
  }

  async findOne(companyId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, companyId }, include: invoiceInclude });
    if (!invoice) throw new NotFoundException(`Invoice ${id} not found`);
    return invoice;
  }

  private async resolveAccountCode(accountId: string | null | undefined, fallback: string): Promise<string> {
    if (!accountId) return fallback;
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    return account?.code ?? fallback;
  }
}

function generateInvoiceNumber(type: "CUSTOMER" | "SUPPLIER"): string {
  const prefix = type === "CUSTOMER" ? "FC" : "FF";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix}-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
