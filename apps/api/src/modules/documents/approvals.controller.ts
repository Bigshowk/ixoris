import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { ApprovalsService } from "./approvals.service";
import { CreateApprovalRuleDto, DecideApprovalRequestDto } from "./dto/approval.dto";

@RequirePermissions("ged.approval.manage")
@Controller("approvals")
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Post("rules")
  createRule(@Body() dto: CreateApprovalRuleDto, @CurrentAuth() auth: AuthContext) {
    return this.approvals.createRule(auth.companyId, dto);
  }

  @Get("rules")
  listRules(@CurrentAuth() auth: AuthContext) {
    return this.approvals.listRules(auth.companyId);
  }

  @Delete("rules/:id")
  deleteRule(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.approvals.deleteRule(auth.companyId, id);
  }

  @Get("requests")
  listRequests(@Query("status") status: "PENDING" | "APPROVED" | "REJECTED" | undefined, @CurrentAuth() auth: AuthContext) {
    return this.approvals.listRequests(auth.companyId, status);
  }

  @Post("requests/:id/decide")
  decide(@Param("id") id: string, @Body() dto: DecideApprovalRequestDto, @CurrentAuth() auth: AuthContext) {
    return this.approvals.decide(auth.companyId, id, auth.userId, dto);
  }
}
