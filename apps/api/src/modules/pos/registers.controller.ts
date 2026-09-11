import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { RegistersService } from "./registers.service";
import { CloseCashSessionDto, OpenCashSessionDto } from "./dto/cash-session.dto";

@RequirePermissions("pos.cashsession.manage")
@Controller("pos/registers")
export class RegistersController {
  constructor(private readonly registers: RegistersService) {}

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    return this.registers.list(auth.companyId);
  }

  @Post(":id/sessions")
  openSession(@Param("id") registerId: string, @Body() dto: OpenCashSessionDto, @CurrentAuth() auth: AuthContext) {
    return this.registers.openSession(registerId, auth.userId, dto.openingBalance);
  }

  @Patch("sessions/:sessionId/close")
  closeSession(@Param("sessionId") sessionId: string, @Body() dto: CloseCashSessionDto, @CurrentAuth() auth: AuthContext) {
    return this.registers.closeSession(sessionId, auth.userId, dto.closingBalance, dto.varianceNotes);
  }
}
