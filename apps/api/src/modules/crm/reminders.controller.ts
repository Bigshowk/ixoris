import { Controller, Get, Post } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { RemindersService } from "./reminders.service";

@RequirePermissions("crm.reminder.manage")
@Controller("crm/reminders")
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  @Post("generate-overdue")
  generateOverdue(@CurrentAuth() auth: AuthContext) {
    return this.reminders.generateOverdueReminders(auth.companyId);
  }

  @Post("dispatch")
  dispatch(@CurrentAuth() auth: AuthContext) {
    return this.reminders.dispatchPending(auth.companyId);
  }

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    return this.reminders.list(auth.companyId);
  }
}
