import { Controller, Post } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { ReorderCheckService } from "./reorder-check.service";

@RequirePermissions("supplychain.purchaseorder.manage")
@Controller("supply-chain/reorder-check")
export class ReorderCheckController {
  constructor(private readonly reorderCheck: ReorderCheckService) {}

  /** Manual trigger for now — wire to a scheduler (@nestjs/schedule) to run this automatically. */
  @Post("run")
  run(@CurrentAuth() auth: AuthContext) {
    return this.reorderCheck.run(auth.companyId);
  }
}
