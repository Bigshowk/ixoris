import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Notifications visible to a user: company-wide broadcasts (userId null) plus anything addressed to them specifically. */
  list(companyId: string, userId: string, unreadOnly: boolean) {
    return this.prisma.notification.findMany({
      where: {
        companyId,
        OR: [{ userId: null }, { userId }],
        isRead: unreadOnly ? false : undefined,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  countUnread(companyId: string, userId: string) {
    return this.prisma.notification.count({
      where: { companyId, OR: [{ userId: null }, { userId }], isRead: false },
    });
  }

  async markRead(companyId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({ where: { id, companyId } });
    if (!notification) throw new NotFoundException(`Notification ${id} not found`);
    return this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }

  async markAllRead(companyId: string, userId: string): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { companyId, OR: [{ userId: null }, { userId }], isRead: false },
      data: { isRead: true },
    });
    return { updated: result.count };
  }
}
