import { BadRequestException, Body, Controller, Get, Post, Query } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { InteractionsService } from "./interactions.service";
import { CreateInteractionDto } from "./dto/create-interaction.dto";

@RequirePermissions("crm.customer.manage")
@Controller("crm/interactions")
export class InteractionsController {
  constructor(private readonly interactions: InteractionsService) {}

  @Post()
  create(@Body() dto: CreateInteractionDto, @CurrentAuth() auth: AuthContext) {
    return this.interactions.create(auth.companyId, auth.userId, dto);
  }

  @Get()
  list(
    @Query("customerId") customerId: string | undefined,
    @Query("opportunityId") opportunityId: string | undefined,
    @CurrentAuth() auth: AuthContext,
  ) {
    if (customerId) return this.interactions.listByCustomer(auth.companyId, customerId);
    if (opportunityId) return this.interactions.listByOpportunity(auth.companyId, opportunityId);
    throw new BadRequestException("customerId or opportunityId query parameter is required");
  }
}
