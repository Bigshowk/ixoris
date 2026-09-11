import { Controller, Get } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { AccountsService } from "./accounts.service";

@RequirePermissions("accounting.journal.read")
@Controller("accounting/accounts")
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    return this.accounts.list(auth.companyId);
  }
}
