import { Controller, Get, Param, Query } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { ProductsService } from "./products.service";

@RequirePermissions("pos.product.read")
@Controller("products")
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  /** Used by both camera scan (decoded barcode) and HID douchette input. */
  @Get("barcode/:barcode")
  findByBarcode(@Param("barcode") barcode: string, @CurrentAuth() auth: AuthContext) {
    return this.products.findByBarcode(auth.companyId, auth.storeId, barcode);
  }

  @Get("search")
  search(@Query("q") query: string, @CurrentAuth() auth: AuthContext) {
    return this.products.search(auth.companyId, auth.storeId, query ?? "");
  }
}
