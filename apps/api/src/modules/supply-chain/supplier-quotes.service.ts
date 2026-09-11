import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateSupplierQuoteDto } from "./dto/create-supplier-quote.dto";

@Injectable()
export class SupplierQuotesService {
  constructor(private readonly prisma: PrismaService) {}

  create(companyId: string, dto: CreateSupplierQuoteDto) {
    return this.prisma.supplierQuote.create({
      data: {
        companyId,
        supplierId: dto.supplierId,
        productId: dto.productId,
        unitPrice: dto.unitPrice,
        currencyCode: dto.currencyCode ?? "XOF",
        leadTimeDays: dto.leadTimeDays ?? 0,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        notes: dto.notes,
      },
    });
  }

  list(companyId: string, productId?: string, supplierId?: string) {
    return this.prisma.supplierQuote.findMany({
      where: { companyId, productId, supplierId },
      include: { supplier: true, product: true },
      orderBy: { unitPrice: "asc" },
    });
  }

  /** The comparatif prix fournisseurs, boiled down to "who's cheapest right now" for a product. */
  async cheapestForProduct(companyId: string, productId: string) {
    const now = new Date();
    return this.prisma.supplierQuote.findFirst({
      where: {
        companyId,
        productId,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gte: now } }],
      },
      orderBy: { unitPrice: "asc" },
    });
  }
}
