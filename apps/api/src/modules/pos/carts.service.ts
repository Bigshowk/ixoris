import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AddCartItemInput, CartDTO, CreateCartInput, UpdateCartItemInput } from "@ixoris/types";
import { mapCart, toNumber } from "./pos.mappers";
import { PosGateway } from "../realtime/pos.gateway";
import { PermissionsService } from "../auth/permissions.service";

const cartInclude = { items: { include: { product: true } } } as const;

@Injectable()
export class CartsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: PosGateway,
    private readonly permissions: PermissionsService,
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

  async addItem(
    companyId: string,
    storeId: string,
    userId: string,
    cartId: string,
    input: AddCartItemInput,
  ): Promise<CartDTO> {
    const cart = await this.requireActiveCart(companyId, cartId);
    const product = await this.prisma.product.findFirst({ where: { id: input.productId, companyId } });
    if (!product || !product.isActive) throw new NotFoundException(`Product ${input.productId} not found`);

    if (input.unitPriceOverride !== undefined) {
      await this.assertCanOverridePrice(storeId, userId);
    }
    const unitPrice = input.unitPriceOverride ?? toNumber(product.sellingPrice);
    const existing = cart.items.find((i) => i.productId === input.productId);
    const quantity = existing ? toNumber(existing.quantity) + input.quantity : input.quantity;
    this.assertDiscountWithinLineTotal(unitPrice, quantity, input.discount);

    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: { increment: input.quantity }, discount: input.discount },
      });
    } else {
      await this.prisma.cartItem.create({
        data: { cartId, productId: input.productId, quantity: input.quantity, unitPrice, discount: input.discount },
      });
    }

    return this.touchAndBroadcast(companyId, cartId);
  }

  async updateItem(
    companyId: string,
    cartId: string,
    itemId: string,
    input: UpdateCartItemInput,
  ): Promise<CartDTO> {
    const cart = await this.requireActiveCart(companyId, cartId);
    const item = cart.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException(`Item ${itemId} not found in cart ${cartId}`);

    const quantity = input.quantity ?? toNumber(item.quantity);
    const discount = input.discount ?? toNumber(item.discount);
    this.assertDiscountWithinLineTotal(toNumber(item.unitPrice), quantity, discount);

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: input.quantity, discount: input.discount },
    });
    return this.touchAndBroadcast(companyId, cartId);
  }

  async removeItem(companyId: string, cartId: string, itemId: string): Promise<CartDTO> {
    const cart = await this.requireActiveCart(companyId, cartId);
    if (!cart.items.some((i) => i.id === itemId)) throw new NotFoundException(`Item ${itemId} not found in cart ${cartId}`);
    await this.prisma.cartItem.delete({ where: { id: itemId } });
    return this.touchAndBroadcast(companyId, cartId);
  }

  /** A discount can never exceed the line's own value — otherwise a line (or the whole sale) could be driven to zero or negative. */
  private assertDiscountWithinLineTotal(unitPrice: number, quantity: number, discount: number) {
    const lineTotal = unitPrice * quantity;
    if (discount > lineTotal) {
      throw new BadRequestException(`Discount (${discount}) cannot exceed the line total (${lineTotal})`);
    }
  }

  private async assertCanOverridePrice(storeId: string, userId: string) {
    const granted = await this.permissions.getEffectivePermissions(userId, storeId);
    if (!granted.has("pos.price.override")) {
      throw new ForbiddenException("Missing permission(s): pos.price.override");
    }
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
