import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateVehicleDto } from "./dto/vehicle.dto";

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  create(companyId: string, dto: CreateVehicleDto) {
    return this.prisma.vehicle.create({ data: { companyId, plateNumber: dto.plateNumber, type: dto.type ?? "MOTO", capacityKg: dto.capacityKg } });
  }

  list(companyId: string) {
    return this.prisma.vehicle.findMany({ where: { companyId, isActive: true }, orderBy: { plateNumber: "asc" } });
  }

  async findOne(companyId: string, id: string) {
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id, companyId } });
    if (!vehicle) throw new NotFoundException(`Vehicle ${id} not found`);
    return vehicle;
  }
}
