import { Controller, Get } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { CrmAnalyticsService } from "./crm-analytics.service";

@RequirePermissions("crm.customer.manage")
@Controller("crm/analytics")
export class CrmAnalyticsController {
  constructor(private readonly analytics: CrmAnalyticsService) {}

  @Get()
  get(@CurrentAuth() auth: AuthContext) {
    return this.analytics.companyAnalytics(auth.companyId);
  }
}
