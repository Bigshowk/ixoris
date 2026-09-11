import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { CatalogService } from "./catalog.service";
import { CreateBrandDto, CreateCategoryDto, CreateProductDto, UpdateProductDto } from "./dto/product.dto";

@RequirePermissions("stock.product.manage")
@Controller("stock")
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Post("products")
  createProduct(@Body() dto: CreateProductDto, @CurrentAuth() auth: AuthContext) {
    return this.catalog.createProduct(auth.companyId, dto);
  }

  @Get("products")
  listProducts(@CurrentAuth() auth: AuthContext) {
    return this.catalog.list(auth.companyId);
  }

  @Get("products/:id")
  findProduct(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.catalog.findOne(auth.companyId, id);
  }

  @Patch("products/:id")
  updateProduct(@Param("id") id: string, @Body() dto: UpdateProductDto, @CurrentAuth() auth: AuthContext) {
    return this.catalog.updateProduct(auth.companyId, id, dto);
  }

  @Post("categories")
  createCategory(@Body() dto: CreateCategoryDto, @CurrentAuth() auth: AuthContext) {
    return this.catalog.createCategory(auth.companyId, dto);
  }

  @Get("categories")
  listCategories(@CurrentAuth() auth: AuthContext) {
    return this.catalog.listCategories(auth.companyId);
  }

  @Post("brands")
  createBrand(@Body() dto: CreateBrandDto, @CurrentAuth() auth: AuthContext) {
    return this.catalog.createBrand(auth.companyId, dto);
  }

  @Get("brands")
  listBrands(@CurrentAuth() auth: AuthContext) {
    return this.catalog.listBrands(auth.companyId);
  }

  @Get("units")
  listUnits() {
    return this.catalog.listUnits();
  }
}
