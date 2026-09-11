import { Injectable, NotFoundException } from "@nestjs/common";
import { buildSaleReceipt, PaperWidth } from "@ixoris/escpos";
import { PrismaService } from "../../prisma/prisma.service";
import { NetworkPrinterClient } from "./network-printer.client";
import { PrintTicketDto } from "./dto/print-ticket.dto";
import { toNumber } from "../pos/pos.mappers";

const DEFAULT_PORT = 9100;

@Injectable()
export class PrintService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly printer: NetworkPrinterClient,
  ) {}

  /** Builds the ESC/POS byte stream for a sale — shared by the network-print and WebUSB (raw bytes) paths. */
  async buildTicketBytes(companyId: string, saleId: string, paperWidth: PaperWidth = "80mm"): Promise<Uint8Array> {
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, companyId },
      include: {
        items: { include: { product: true } },
        payments: true,
        store: { include: { company: true } },
        customer: true,
        createdBy: true,
      },
    });
    if (!sale) throw new NotFoundException(`Sale ${saleId} not found`);

    const totalPaid = sale.payments.reduce((sum, p) => sum + toNumber(p.amount), 0);

    return buildSaleReceipt(
      {
        storeName: sale.store.name,
        storeAddress: sale.store.address ?? undefined,
        storePhone: sale.store.phone ?? undefined,
        taxId: sale.store.company.taxId ?? undefined,
        saleNumber: sale.number,
        date: sale.date,
        cashierName: `${sale.createdBy.firstName} ${sale.createdBy.lastName}`,
        customerName: sale.customer?.name,
        items: sale.items.map((item) => ({
          name: item.product.name,
          quantity: toNumber(item.quantity),
          unitPrice: toNumber(item.unitPrice),
          discount: toNumber(item.discount) || undefined,
          total: toNumber(item.total),
        })),
        subtotal: toNumber(sale.subtotal),
        discountTotal: toNumber(sale.discountTotal),
        tvaTotal: toNumber(sale.tvaTotal),
        total: toNumber(sale.total),
        currencyCode: sale.currencyCode,
        payments: sale.payments.map((p) => ({ method: p.method, amount: toNumber(p.amount) })),
        changeDue: Math.max(0, totalPaid - toNumber(sale.total)),
      },
      paperWidth,
    );
  }

  /** LAN thermal printers (port 9100) — browsers can't open raw TCP sockets, so this always goes through the backend. */
  async printSaleTicket(companyId: string, dto: PrintTicketDto): Promise<void> {
    const bytes = await this.buildTicketBytes(companyId, dto.saleId, dto.paperWidth ?? "80mm");
    await this.printer.send(dto.host, dto.port ?? DEFAULT_PORT, bytes);
  }
}
