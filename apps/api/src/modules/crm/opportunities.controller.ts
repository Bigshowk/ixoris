import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { OpportunitiesService } from "./opportunities.service";
import { CreateOpportunityDto, UpdateOpportunityStageDto } from "./dto/opportunity.dto";

@RequirePermissions("crm.opportunity.manage")
@Controller("crm/opportunities")
export class OpportunitiesController {
  constructor(private readonly opportunities: OpportunitiesService) {}

  @Post()
  create(@Body() dto: CreateOpportunityDto, @CurrentAuth() auth: AuthContext) {
    return this.opportunities.create(auth.companyId, dto);
  }

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    return this.opportunities.list(auth.companyId);
  }

  @Get("kanban")
  kanban(@CurrentAuth() auth: AuthContext) {
    return this.opportunities.kanban(auth.companyId);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.opportunities.findOne(auth.companyId, id);
  }

  @Patch(":id/stage")
  updateStage(@Param("id") id: string, @Body() dto: UpdateOpportunityStageDto, @CurrentAuth() auth: AuthContext) {
    return this.opportunities.updateStage(auth.companyId, id, dto);
  }
}
