import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateWarehouseDto } from "./dto/warehouse.dto";

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  create(companyId: string, dto: CreateWarehouseDto) {
    return this.prisma.warehouse.create({ data: { companyId, name: dto.name, storeId: dto.storeId, address: dto.address } });
  }

  list(companyId: string) {
    return this.prisma.warehouse.findMany({ where: { companyId }, include: { store: true }, orderBy: { name: "asc" } });
  }
}
