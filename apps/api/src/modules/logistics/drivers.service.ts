import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class DriversService {
  constructor(private readonly prisma: PrismaService) {}

  /** Users who can be assigned as a delivery driver — anyone holding logistics.delivery.drive via a role. */
  list(companyId: string) {
    return this.prisma.user.findMany({
      where: {
        companyId,
        isActive: true,
        roles: { some: { role: { permissions: { some: { permission: { code: "logistics.delivery.drive" } } } } } },
      },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: { firstName: "asc" },
    });
  }
}
