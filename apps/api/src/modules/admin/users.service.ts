import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateUserDto, AssignRoleDto } from "./dto/user.dto";

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  isActive: true,
  lastLoginAt: true,
  mfaEnabled: true,
  mfaRequired: true,
  roles: { include: { role: true, store: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException(`A user with email ${dto.email} already exists`);

    await this.assertRoleAndStoreBelongToCompany(companyId, dto.roleId, dto.storeId);

    const user = await this.prisma.user.create({
      data: {
        companyId,
        email: dto.email,
        passwordHash: bcrypt.hashSync(dto.password, 12),
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        roles: { create: [{ roleId: dto.roleId, storeId: dto.storeId }] },
      },
      select: userSelect,
    });
    return user;
  }

  list(companyId: string) {
    return this.prisma.user.findMany({ where: { companyId }, select: userSelect, orderBy: { firstName: "asc" } });
  }

  async setActive(companyId: string, id: string, isActive: boolean) {
    // updateMany's `where` enforces companyId at the query level (unlike `update`, which only
    // accepts unique fields in `where`) — a stray future call site can't silently drop the
    // tenant check the way it could if this relied solely on a preceding findOne().
    const result = await this.prisma.user.updateMany({ where: { id, companyId }, data: { isActive } });
    if (result.count === 0) throw new NotFoundException(`User ${id} not found`);
    return this.prisma.user.findUniqueOrThrow({ where: { id }, select: userSelect });
  }

  async setMfaRequired(companyId: string, id: string, mfaRequired: boolean) {
    const result = await this.prisma.user.updateMany({ where: { id, companyId }, data: { mfaRequired } });
    if (result.count === 0) throw new NotFoundException(`User ${id} not found`);
    return this.prisma.user.findUniqueOrThrow({ where: { id }, select: userSelect });
  }

  async assignRole(companyId: string, userId: string, dto: AssignRoleDto) {
    await this.findOne(companyId, userId);
    await this.assertRoleAndStoreBelongToCompany(companyId, dto.roleId, dto.storeId);
    await this.prisma.userRole.create({ data: { userId, roleId: dto.roleId, storeId: dto.storeId } });
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: userSelect });
  }

  async revokeRole(companyId: string, userId: string, userRoleId: string) {
    await this.findOne(companyId, userId);
    const assignment = await this.prisma.userRole.findFirst({ where: { id: userRoleId, userId } });
    if (!assignment) throw new NotFoundException(`Role assignment ${userRoleId} not found`);
    await this.prisma.userRole.delete({ where: { id: userRoleId } });
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: userSelect });
  }

  private async findOne(companyId: string, id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, companyId } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  private async assertRoleAndStoreBelongToCompany(companyId: string, roleId: string, storeId?: string): Promise<void> {
    const role = await this.prisma.role.findFirst({ where: { id: roleId, OR: [{ companyId }, { companyId: null }] } });
    if (!role) throw new BadRequestException(`Role ${roleId} not found`);
    if (storeId) {
      const store = await this.prisma.store.findFirst({ where: { id: storeId, companyId } });
      if (!store) throw new BadRequestException(`Store ${storeId} not found`);
    }
  }
}
