import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateRoleDto, UpdateRolePermissionsDto } from "./dto/role.dto";

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Company-specific roles plus the global system roles (companyId null) shared by every company. */
  list(companyId: string) {
    return this.prisma.role.findMany({
      where: { OR: [{ companyId }, { companyId: null }] },
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: "asc" },
    });
  }

  /** The full permission catalog (seeded from @ixoris/rbac), grouped by module for a role-editor UI. */
  listPermissions() {
    return this.prisma.permission.findMany({ orderBy: [{ module: "asc" }, { code: "asc" }] });
  }

  async createRole(companyId: string, dto: CreateRoleDto) {
    const permissions = await this.prisma.permission.findMany({ where: { code: { in: dto.permissionCodes } } });
    if (permissions.length !== dto.permissionCodes.length) {
      throw new BadRequestException("One or more permission codes are invalid");
    }

    return this.prisma.role.create({
      data: {
        companyId,
        name: dto.name,
        isSystem: false,
        permissions: { create: permissions.map((p) => ({ permissionId: p.id })) },
      },
      include: { permissions: { include: { permission: true } } },
    });
  }

  async updateRolePermissions(companyId: string, roleId: string, dto: UpdateRolePermissionsDto) {
    const role = await this.findEditableRole(companyId, roleId);

    const permissions = await this.prisma.permission.findMany({ where: { code: { in: dto.permissionCodes } } });
    if (permissions.length !== dto.permissionCodes.length) {
      throw new BadRequestException("One or more permission codes are invalid");
    }

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      this.prisma.rolePermission.createMany({ data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })) }),
    ]);

    return this.prisma.role.findUniqueOrThrow({ where: { id: role.id }, include: { permissions: { include: { permission: true } } } });
  }

  async deleteRole(companyId: string, roleId: string): Promise<void> {
    await this.findEditableRole(companyId, roleId);
    await this.prisma.role.delete({ where: { id: roleId } });
  }

  private async findEditableRole(companyId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({ where: { id: roleId } });
    if (!role) throw new NotFoundException(`Role ${roleId} not found`);
    if (role.isSystem || role.companyId !== companyId) throw new ForbiddenException("System roles cannot be modified");
    return role;
  }
}
