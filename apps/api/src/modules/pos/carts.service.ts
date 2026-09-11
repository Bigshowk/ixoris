import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AddCartItemInput, CartDTO, CreateCartInput, UpdateCartItemInput } from "@ixoris/types";
import { mapCart } from "./pos.mappers";
import { PosGateway } from "../realtime/pos.gateway";

const cartInclude = { items: { include: { product: true } } } as const;

@Injectable()
export class CartsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: PosGateway,
  ) {}

  async create(companyId: string, createdById: string, input: CreateCartInput): Promise<CartDTO> {
    const cart = await this.prisma.cart.create({
      data: {
        companyId,
        storeId: input.storeId,
        customerId: input.customerId,
        deviceId: input.deviceId,
        createdById,
      },
      include: cartInclude,
    });
    return mapCart(cart);
  }

  async findOne(companyId: string, cartId: string): Promise<CartDTO> {
    const cart = await this.prisma.cart.findFirst({ where: { id: cartId, companyId }, include: cartInclude });
    if (!cart) throw new NotFoundException(`Cart ${cartId} not found`);
    return mapCart(cart);
  }

  async listActive(companyId: string, storeId: string): Promise<CartDTO[]> {
    const carts = await this.prisma.cart.findMany({
      where: { companyId, storeId, status: "ACTIVE" },
      include: cartInclude,
      orderBy: { updatedAt: "desc" },
    });
    return carts.map(mapCart);
  }

  async addItem(companyId: string, cartId: string, input: AddCartItemInput): Promise<CartDTO> {
    const cart = await this.requireActiveCart(companyId, cartId);
    const product = await this.prisma.product.findFirst({ where: { id: input.productId, companyId } });
    if (!product || !product.isActive) throw new NotFoundException(`Product ${input.productId} not found`);

    const existing = cart.items.find((i) => i.productId === input.productId);
    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: { increment: input.quantity }, discount: input.discount },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId,
          productId: input.productId,
          quantity: input.quantity,
          unitPrice: input.unitPriceOverride ?? product.sellingPrice,
          discount: input.discount,
        },
      });
    }

    return this.touchAndBroadcast(companyId, cartId);
  }

  async updateItem(companyId: string, cartId: string, itemId: string, input: UpdateCartItemInput): Promise<CartDTO> {
    await this.requireActiveCart(companyId, cartId);
    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: input.quantity, discount: input.discount },
    });
    return this.touchAndBroadcast(companyId, cartId);
  }

  async removeItem(companyId: string, cartId: string, itemId: string): Promise<CartDTO> {
    await this.requireActiveCart(companyId, cartId);
    await this.prisma.cartItem.delete({ where: { id: itemId } });
    return this.touchAndBroadcast(companyId, cartId);
  }

  private async requireActiveCart(companyId: string, cartId: string) {
    const cart = await this.prisma.cart.findFirst({ where: { id: cartId, companyId }, include: cartInclude });
    if (!cart) throw new NotFoundException(`Cart ${cartId} not found`);
    if (cart.status !== "ACTIVE") throw new BadRequestException(`Cart ${cartId} is no longer active`);
    return cart;
  }

  private async touchAndBroadcast(companyId: string, cartId: string): Promise<CartDTO> {
    await this.prisma.cart.update({ where: { id: cartId }, data: { updatedAt: new Date() } });
    const dto = await this.findOne(companyId, cartId);
    this.gateway.emitCartUpdated(dto);
    return dto;
  }
}
