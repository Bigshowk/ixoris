import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { DepreciationService } from "./depreciation.service";
import { CreateFixedAssetDto } from "./dto/create-fixed-asset.dto";

const assetInclude = {
  assetAccount: true,
  depreciationAccount: true,
  depreciationEntries: { orderBy: { sequenceNumber: "asc" as const } },
} as const;

@Injectable()
export class FixedAssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly depreciation: DepreciationService,
  ) {}

  async create(companyId: string, dto: CreateFixedAssetDto) {
    const assetAccount = await this.resolveAccount(companyId, dto.assetAccountCode);
    const depreciationAccount = await this.resolveAccount(companyId, dto.depreciationAccountCode);

    const asset = await this.prisma.fixedAsset.create({
      data: {
        companyId,
        code: dto.code,
        name: dto.name,
        assetAccountId: assetAccount.id,
        depreciationAccountId: depreciationAccount.id,
        acquisitionDate: new Date(dto.acquisitionDate),
        acquisitionCost: dto.acquisitionCost,
        residualValue: dto.residualValue ?? 0,
        usefulLifeYears: dto.usefulLifeYears,
        depreciationMethod: dto.depreciationMethod,
        decliningBalanceRate: dto.decliningBalanceRate,
        warehouseId: dto.warehouseId,
        notes: dto.notes,
      },
    });

    await this.depreciation.generateSchedule(companyId, asset.id);
    return this.findOne(companyId, asset.id);
  }

  list(companyId: string) {
    return this.prisma.fixedAsset.findMany({ where: { companyId }, include: assetInclude, orderBy: { acquisitionDate: "desc" } });
  }

  async findOne(companyId: string, id: string) {
    const asset = await this.prisma.fixedAsset.findFirst({ where: { id, companyId }, include: assetInclude });
    if (!asset) throw new NotFoundException(`Fixed asset ${id} not found`);
    return asset;
  }

  async dispose(companyId: string, id: string, disposalAmount: number) {
    const asset = await this.findOne(companyId, id);
    if (asset.status === "DISPOSED") throw new BadRequestException(`Fixed asset ${asset.code} is already disposed`);

    return this.prisma.fixedAsset.update({
      where: { id },
      data: { status: "DISPOSED", disposalDate: new Date(), disposalAmount },
      include: assetInclude,
    });
  }

  private async resolveAccount(companyId: string, code: string) {
    const account = await this.prisma.account.findFirst({ where: { companyId, code } });
    if (!account) throw new NotFoundException(`Account ${code} not found`);
    return account;
  }
}
