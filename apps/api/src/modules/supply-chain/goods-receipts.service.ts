import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { WELL_KNOWN_ACCOUNTS } from "@ixoris/accounting-engine";
import { PrismaService } from "../../prisma/prisma.service";
import { toNumber } from "../pos/pos.mappers";
import { CreateGoodsReceiptDto } from "./dto/create-goods-receipt.dto";
import { JournalEntriesService, AutoPostLine } from "../accounting/journal-entries.service";

const grnInclude = { lines: { include: { product: true, purchaseOrderLine: true } }, purchaseOrder: { include: { supplier: true } } };
const generateNumber = () => `GRN-${Date.now().toString(36).toUpperCase()}`;

@Injectable()
export class GoodsReceiptsService {
  private readonly logger = new Logger(GoodsReceiptsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly journalEntries: JournalEntriesService,
  ) {}

  async create(companyId: string, receivedById: string, dto: CreateGoodsReceiptDto) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id: dto.purchaseOrderId, companyId },
      include: { lines: true },
    });
    if (!po) throw new NotFoundException(`Purchase order ${dto.purchaseOrderId} not found`);
    if (po.status === "RECEIVED" || po.status === "CANCELLED") {
      throw new BadRequestException(`Purchase order ${po.number} can no longer receive goods`);
    }

    const poLineById = new Map(po.lines.map((l) => [l.id, l]));
    const lines = dto.lines.map((l) => {
      const poLine = poLineById.get(l.purchaseOrderLineId);
      if (!poLine) throw new BadRequestException(`Purchase order line ${l.purchaseOrderLineId} not found on this order`);
      const remainingExpected = toNumber(poLine.quantityOrdered) - toNumber(poLine.quantityReceived);
      const damaged = l.quantityDamaged ?? 0;
      const missing = Math.max(0, round2(remainingExpected - l.quantityReceived - damaged));
      return {
        purchaseOrderLineId: l.purchaseOrderLineId,
        productId: poLine.productId,
        quantityExpected: remainingExpected,
        quantityReceived: l.quantityReceived,
        quantityDamaged: damaged,
        quantityMissing: missing,
        lotNumber: l.lotNumber,
        expiryDate: l.expiryDate ? new Date(l.expiryDate) : undefined,
        unitCost: toNumber(poLine.unitPrice),
      };
    });

    return this.prisma.goodsReceipt.create({
      data: {
        companyId,
        purchaseOrderId: po.id,
        warehouseId: po.warehouseId,
        number: generateNumber(),
        receivedById,
        lines: { create: lines },
      },
      include: grnInclude,
    });
  }

  async findOne(companyId: string, id: string) {
    const grn = await this.prisma.goodsReceipt.findFirst({ where: { id, companyId }, include: grnInclude });
    if (!grn) throw new NotFoundException(`Goods receipt ${id} not found`);
    return grn;
  }

  list(companyId: string) {
    return this.prisma.goodsReceipt.findMany({ where: { companyId }, include: grnInclude, orderBy: { receivedDate: "desc" }, take: 200 });
  }

  /**
   * Updates Stock/StockLot, logs a PURCHASE_IN StockMovement per line (good
   * units only — damaged goods are booked as a loss, not sellable
   * inventory), advances the PO's received quantities/status, and posts the
   * Fournisseur/Achats journal entry (best-effort, like the other auto-posting
   * services — a misconfigured chart of accounts must not block a receipt).
   */
  async validate(companyId: string, userId: string, id: string) {
    const grn = await this.findOne(companyId, id);
    if (grn.status !== "DRAFT") throw new BadRequestException(`Goods receipt ${grn.number} is already validated`);

    await this.prisma.$transaction(async (tx) => {
      for (const line of grn.lines) {
        if (toNumber(line.quantityReceived) > 0) {
          await tx.stock.upsert({
            where: { productId_warehouseId: { productId: line.productId, warehouseId: grn.warehouseId } },
            update: { quantity: { increment: line.quantityReceived } },
            create: { productId: line.productId, warehouseId: grn.warehouseId, quantity: line.quantityReceived },
          });

          let lotId: string | undefined;
          if (line.product.trackLots) {
            const lot = await tx.stockLot.create({
              data: {
                productId: line.productId,
                warehouseId: grn.warehouseId,
                lotNumber: line.lotNumber || grn.number,
                quantity: line.quantityReceived,
                unitCost: line.unitCost,
                expiryDate: line.expiryDate,
              },
            });
            lotId = lot.id;
          }

          await tx.stockMovement.create({
            data: {
              companyId,
              productId: line.productId,
              warehouseId: grn.warehouseId,
              lotId,
              type: "PURCHASE_IN",
              quantity: line.quantityReceived,
              unitCost: line.unitCost,
              reference: grn.number,
              sourceType: "GoodsReceipt",
              sourceId: grn.id,
              createdById: userId,
            },
          });
        }

        await tx.purchaseOrderLine.update({
          where: { id: line.purchaseOrderLineId },
          data: { quantityReceived: { increment: line.quantityReceived } },
        });
      }

      const updatedLines = await tx.purchaseOrderLine.findMany({ where: { purchaseOrderId: grn.purchaseOrder.id } });
      const fullyReceived = updatedLines.every((l) => toNumber(l.quantityReceived) >= toNumber(l.quantityOrdered));
      const anyReceived = updatedLines.some((l) => toNumber(l.quantityReceived) > 0);
      await tx.purchaseOrder.update({
        where: { id: grn.purchaseOrder.id },
        data: { status: fullyReceived ? "RECEIVED" : anyReceived ? "PARTIALLY_RECEIVED" : grn.purchaseOrder.status },
      });

      await tx.goodsReceipt.update({ where: { id: grn.id }, data: { status: "VALIDATED" } });
    });

    await this.postAccountingEntry(companyId, userId, grn);

    return this.findOne(companyId, id);
  }

  private async postAccountingEntry(companyId: string, userId: string, grn: Awaited<ReturnType<typeof this.findOne>>) {
    try {
      const journal = await this.prisma.journal.findFirst({ where: { companyId, code: "AC" } });
      if (!journal) {
        this.logger.warn(`No 'AC' journal configured for company ${companyId} — receipt ${grn.number} not posted`);
        return;
      }

      let achatsHT = 0;
      let pertesHT = 0;
      let tva = 0;
      for (const line of grn.lines) {
        const goodHT = round2(toNumber(line.quantityReceived) * toNumber(line.unitCost));
        const damagedHT = round2(toNumber(line.quantityDamaged) * toNumber(line.unitCost));
        const lineTvaRate = toNumber(line.purchaseOrderLine.tvaRate);
        achatsHT += goodHT;
        pertesHT += damagedHT;
        tva += round2((goodHT + damagedHT) * (lineTvaRate / 100));
      }
      achatsHT = round2(achatsHT);
      pertesHT = round2(pertesHT);
      tva = round2(tva);
      const owedHT = round2(achatsHT + pertesHT);
      const owedTTC = round2(owedHT + tva);
      if (owedTTC <= 0) return;

      const supplierAccountId = grn.purchaseOrder.supplier.accountId;
      const supplierAccountCode = supplierAccountId
        ? (await this.prisma.account.findUnique({ where: { id: supplierAccountId } }))?.code
        : undefined;

      const label = `Réception ${grn.number} — ${grn.purchaseOrder.number}`;
      const lines: AutoPostLine[] = [
        ...(achatsHT > 0 ? [{ accountCode: WELL_KNOWN_ACCOUNTS.achatsMarchandises, debit: achatsHT, credit: 0, label }] : []),
        ...(pertesHT > 0 ? [{ accountCode: WELL_KNOWN_ACCOUNTS.autresCharges, debit: pertesHT, credit: 0, label: `${label} (marchandises endommagées)` }] : []),
        ...(tva > 0 ? [{ accountCode: WELL_KNOWN_ACCOUNTS.tvaRecuperable, debit: tva, credit: 0, label }] : []),
        { accountCode: supplierAccountCode ?? WELL_KNOWN_ACCOUNTS.fournisseurs, debit: 0, credit: owedTTC, label },
      ];

      const entry = await this.journalEntries.postBalancedEntry(companyId, userId, {
        journalId: journal.id,
        date: grn.receivedDate,
        description: label,
        sourceType: "GoodsReceipt",
        sourceId: grn.id,
        lines,
      });

      await this.prisma.goodsReceipt.update({ where: { id: grn.id }, data: { journalEntryId: entry.id } });
    } catch (err) {
      this.logger.warn(`Failed to auto-post goods receipt ${grn.number}: ${err instanceof Error ? err.message : err}`);
    }
  }
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
