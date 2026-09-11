import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreatePositionDto } from "./dto/position.dto";

@Injectable()
export class PositionsService {
  constructor(private readonly prisma: PrismaService) {}

  create(companyId: string, dto: CreatePositionDto) {
    return this.prisma.position.create({ data: { companyId, title: dto.title, departmentId: dto.departmentId } });
  }

  list(companyId: string) {
    return this.prisma.position.findMany({ where: { companyId }, include: { department: true }, orderBy: { title: "asc" } });
  }

  async findOne(companyId: string, id: string) {
    const position = await this.prisma.position.findFirst({ where: { id, companyId }, include: { department: true } });
    if (!position) throw new NotFoundException(`Position ${id} not found`);
    return position;
  }
}
