import { Controller, Param, Post } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { LettrageService } from "./lettrage.service";

@RequirePermissions("accounting.bank.reconcile")
@Controller("accounting/lettrage")
export class LettrageController {
  constructor(private readonly lettrage: LettrageService) {}

  @Post(":accountCode/auto")
  autoMatch(@Param("accountCode") accountCode: string, @CurrentAuth() auth: AuthContext) {
    return this.lettrage.autoMatch(auth.companyId, accountCode);
  }
}
