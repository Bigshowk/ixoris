import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { SupplierQuotesService } from "./supplier-quotes.service";
import { CreateSupplierQuoteDto } from "./dto/create-supplier-quote.dto";

@RequirePermissions("supplychain.quote.manage")
@Controller("supply-chain/quotes")
export class SupplierQuotesController {
  constructor(private readonly quotes: SupplierQuotesService) {}

  @Post()
  create(@Body() dto: CreateSupplierQuoteDto, @CurrentAuth() auth: AuthContext) {
    return this.quotes.create(auth.companyId, dto);
  }

  @Get()
  list(
    @Query("productId") productId: string | undefined,
    @Query("supplierId") supplierId: string | undefined,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.quotes.list(auth.companyId, productId, supplierId);
  }
}
