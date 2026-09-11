import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateBrandDto, CreateCategoryDto, CreateProductDto, UpdateProductDto } from "./dto/product.dto";

const productInclude = { category: true, brand: true, unit: true, stocks: true, barcodes: true } as const;

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async createProduct(companyId: string, dto: CreateProductDto) {
    const product = await this.prisma.product.create({
      data: {
        companyId,
        sku: dto.sku,
        name: dto.name,
        description: dto.description,
        categoryId: dto.categoryId,
        brandId: dto.brandId,
        unitId: dto.unitId,
        purchasePrice: dto.purchasePrice,
        sellingPrice: dto.sellingPrice,
        tvaRate: dto.tvaRate ?? 18,
        minStockAlert: dto.minStockAlert ?? 0,
      },
    });

    if (dto.barcode) {
      await this.prisma.productBarcode.create({ data: { productId: product.id, barcode: dto.barcode, type: "EAN13" } });
    }

    return this.findOne(companyId, product.id);
  }

  list(companyId: string) {
    return this.prisma.product.findMany({ where: { companyId }, include: productInclude, orderBy: { name: "asc" } });
  }

  async findOne(companyId: string, id: string) {
    const product = await this.prisma.product.findFirst({ where: { id, companyId }, include: productInclude });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  async updateProduct(companyId: string, id: string, dto: UpdateProductDto) {
    await this.findOne(companyId, id);
    return this.prisma.product.update({ where: { id }, data: dto, include: productInclude });
  }

  createCategory(companyId: string, dto: CreateCategoryDto) {
    return this.prisma.category.create({ data: { companyId, name: dto.name } });
  }

  listCategories(companyId: string) {
    return this.prisma.category.findMany({ where: { companyId }, orderBy: { name: "asc" } });
  }

  createBrand(companyId: string, dto: CreateBrandDto) {
    return this.prisma.brand.create({ data: { companyId, name: dto.name } });
  }

  listBrands(companyId: string) {
    return this.prisma.brand.findMany({ where: { companyId }, orderBy: { name: "asc" } });
  }

  listUnits() {
    return this.prisma.unit.findMany({ orderBy: { code: "asc" } });
  }
}
