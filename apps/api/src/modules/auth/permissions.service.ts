import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class PermissionsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Union of permission codes granted to a user, from every Role assigned
   * either globally (`UserRole.storeId === null`, applies everywhere) or to
   * the given store specifically. This is the runtime authority behind
   * PermissionsGuard; @ixoris/rbac only supplies the seedable catalog.
   */
  async getEffectivePermissions(userId: string, storeId?: string): Promise<Set<string>> {
    const assignments = await this.prisma.userRole.findMany({
      where: {
        userId,
        OR: storeId ? [{ storeId: null }, { storeId }] : [{ storeId: null }],
      },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });

    const codes = new Set<string>();
    for (const assignment of assignments) {
      for (const rolePermission of assignment.role.permissions) {
        codes.add(rolePermission.permission.code);
      }
    }
    return codes;
  }
}
