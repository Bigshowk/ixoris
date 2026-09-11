import { Controller, Get } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { DriversService } from "./drivers.service";

@RequirePermissions("logistics.delivery.manage")
@Controller("logistics/drivers")
export class DriversController {
  constructor(private readonly drivers: DriversService) {}

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    return this.drivers.list(auth.companyId);
  }
}
