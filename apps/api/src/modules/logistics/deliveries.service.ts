import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { DeliveryStatus } from "@ixoris/database";
import { PrismaService } from "../../prisma/prisma.service";
import { toNumber } from "../pos/pos.mappers";
import { computeDeliveryFee } from "./delivery-fee.util";
import { CreateDeliveryDto } from "./dto/create-delivery.dto";
import { UpdateDeliveryStatusDto, AssignDriverDto } from "./dto/update-delivery-status.dto";
import { ProofOfDeliveryDto } from "./dto/proof-of-delivery.dto";
import { DeliveryPostingService } from "./delivery-posting.service";
import { PermissionsService } from "../auth/permissions.service";

const deliveryInclude = {
  deliveryZone: true,
  vehicle: true,
  driver: true,
  customer: true,
  statusHistory: { orderBy: { changedAt: "asc" as const } },
};

/** The Prisma relation is `deliveryZone` (matching the FK column); every consumer (this API's DTO shape, the delivery driver app) expects the shorter `zone`. */
function mapDelivery<T extends { deliveryZone: unknown }>(delivery: T): Omit<T, "deliveryZone"> & { zone: T["deliveryZone"] } {
  const { deliveryZone, ...rest } = delivery;
  return { ...rest, zone: deliveryZone };
}

/** From-state -> allowed to-states. DELIVERED is only reachable via submitProofOfDelivery, never a direct status update. */
const ALLOWED_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  PENDING: ["LOADED", "CANCELLED"],
  LOADED: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["DELIVERED", "FAILED", "CANCELLED"],
  DELIVERED: [],
  FAILED: [],
  CANCELLED: [],
};

@Injectable()
export class DeliveriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posting: DeliveryPostingService,
    private readonly permissions: PermissionsService,
  ) {}

  /**
   * A "logistics.delivery.drive" account (Livreur) may only touch a delivery it is
   * assigned to; a dispatcher/admin ("logistics.delivery.manage") can access any
   * delivery in the company. Without this, any driver could guess another
   * delivery's id and read its customer details or forge its status/GPS/proof of
   * delivery — the companyId-only scoping on findOne() is not enough on its own.
   */
  private async assertCanAccessDelivery(storeId: string, userId: string, delivery: { driverId: string | null }) {
    if (delivery.driverId === userId) return;
    const granted = await this.permissions.getEffectivePermissions(userId, storeId);
    if (granted.has("logistics.delivery.manage")) return;
    throw new ForbiddenException("You can only access your own assigned deliveries");
  }

  async create(companyId: string, dto: CreateDeliveryDto) {
    const zone = dto.deliveryZoneId
      ? await this.prisma.deliveryZone.findFirst({ where: { id: dto.deliveryZoneId, companyId } })
      : null;
    if (dto.deliveryZoneId && !zone) throw new NotFoundException(`Delivery zone ${dto.deliveryZoneId} not found`);

    const feeAmount = dto.feeAmount ?? computeDeliveryFee({ zone, weightKg: dto.weightKg, distanceKm: dto.distanceKm });

    const delivery = await this.prisma.delivery.create({
      data: {
        companyId,
        saleId: dto.saleId,
        invoiceId: dto.invoiceId,
        customerId: dto.customerId,
        address: dto.address,
        deliveryZoneId: dto.deliveryZoneId,
        vehicleId: dto.vehicleId,
        driverId: dto.driverId,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        weightKg: dto.weightKg,
        volumeM3: dto.volumeM3,
        feeAmount,
        number: generateDeliveryNumber(),
        status: "PENDING",
        statusHistory: { create: [{ status: "PENDING" }] },
      },
      include: deliveryInclude,
    });

    return mapDelivery(delivery);
  }

  async list(companyId: string, status?: DeliveryStatus) {
    const deliveries = await this.prisma.delivery.findMany({ where: { companyId, status }, include: deliveryInclude, orderBy: { createdAt: "desc" }, take: 200 });
    return deliveries.map(mapDelivery);
  }

  /** "Mes livraisons" — the driver's own scoped view. */
  async listForDriver(companyId: string, driverId: string) {
    const deliveries = await this.prisma.delivery.findMany({
      where: { companyId, driverId, status: { notIn: ["DELIVERED", "FAILED", "CANCELLED"] } },
      include: deliveryInclude,
      orderBy: { scheduledAt: "asc" },
    });
    return deliveries.map(mapDelivery);
  }

  async findOne(companyId: string, id: string) {
    const delivery = await this.prisma.delivery.findFirst({ where: { id, companyId }, include: deliveryInclude });
    if (!delivery) throw new NotFoundException(`Delivery ${id} not found`);
    return mapDelivery(delivery);
  }

  /** Driver-facing fetch (GET /logistics/deliveries/:id) — enforces the ownership check above. */
  async findOneForDriver(companyId: string, storeId: string, userId: string, id: string) {
    const delivery = await this.findOne(companyId, id);
    await this.assertCanAccessDelivery(storeId, userId, delivery);
    return delivery;
  }

  async assignDriver(companyId: string, id: string, dto: AssignDriverDto) {
    const delivery = await this.findOne(companyId, id);
    if (delivery.status !== "PENDING") throw new BadRequestException(`Delivery ${delivery.number} is no longer pending dispatch`);
    const updated = await this.prisma.delivery.update({ where: { id }, data: { driverId: dto.driverId, vehicleId: dto.vehicleId }, include: deliveryInclude });
    return mapDelivery(updated);
  }

  async updateStatus(companyId: string, storeId: string, userId: string, id: string, dto: UpdateDeliveryStatusDto) {
    const delivery = await this.findOne(companyId, id);
    await this.assertCanAccessDelivery(storeId, userId, delivery);
    if (!ALLOWED_TRANSITIONS[delivery.status].includes(dto.status)) {
      throw new BadRequestException(`Cannot move delivery ${delivery.number} from ${delivery.status} to ${dto.status}`);
    }

    await this.prisma.delivery.update({
      where: { id },
      data: {
        status: dto.status,
        failureReason: dto.status === "FAILED" ? dto.notes : undefined,
      },
    });
    await this.prisma.deliveryStatusHistory.create({
      data: { deliveryId: id, status: dto.status, changedById: userId, notes: dto.notes, latitude: dto.latitude, longitude: dto.longitude },
    });

    if (dto.status === "FAILED" && dto.lostValue && dto.lostValue > 0) {
      await this.posting.postTransitLoss(companyId, userId, await this.findOne(companyId, id), dto.lostValue);
    }

    return this.findOne(companyId, id);
  }

  /** Captures signature/QR proof and marks the delivery DELIVERED in one step — the only path to that status. */
  async submitProofOfDelivery(companyId: string, storeId: string, userId: string, id: string, dto: ProofOfDeliveryDto) {
    const delivery = await this.findOne(companyId, id);
    await this.assertCanAccessDelivery(storeId, userId, delivery);
    if (delivery.status !== "IN_TRANSIT") {
      throw new BadRequestException(`Delivery ${delivery.number} must be in transit before proof of delivery can be captured`);
    }

    const now = new Date();
    await this.prisma.delivery.update({
      where: { id },
      data: { status: "DELIVERED", deliveredAt: now, podMethod: dto.method, podSignatureUrl: dto.reference, podScannedAt: now },
    });
    await this.prisma.deliveryStatusHistory.create({
      data: { deliveryId: id, status: "DELIVERED", changedById: userId, notes: dto.notes, latitude: dto.latitude, longitude: dto.longitude },
    });

    const updated = await this.findOne(companyId, id);
    if (toNumber(updated.feeAmount) > 0) {
      await this.posting.postDeliveryFee(companyId, userId, updated);
    }

    return this.findOne(companyId, id);
  }
}

function generateDeliveryNumber(): string {
  return `DEL-${Date.now().toString(36).toUpperCase()}`;
}
