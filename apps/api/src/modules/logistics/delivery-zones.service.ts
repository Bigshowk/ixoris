import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateDeliveryZoneDto } from "./dto/delivery-zone.dto";

@Injectable()
export class DeliveryZonesService {
  constructor(private readonly prisma: PrismaService) {}

  create(companyId: string, dto: CreateDeliveryZoneDto) {
    return this.prisma.deliveryZone.create({ data: { companyId, ...dto } });
  }

  list(companyId: string) {
    return this.prisma.deliveryZone.findMany({ where: { companyId }, orderBy: { name: "asc" } });
  }

  async findOne(companyId: string, id: string) {
    const zone = await this.prisma.deliveryZone.findFirst({ where: { id, companyId } });
    if (!zone) throw new NotFoundException(`Delivery zone ${id} not found`);
    return zone;
  }
}
