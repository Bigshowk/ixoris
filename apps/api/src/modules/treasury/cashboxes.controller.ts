import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { CashBoxesService } from "./cashboxes.service";
import { CreateCashBoxDto, CreateCashMovementDto } from "./dto/cashbox.dto";

@RequirePermissions("treasury.cashbox.manage")
@Controller("treasury/cashboxes")
export class CashBoxesController {
  constructor(private readonly cashBoxes: CashBoxesService) {}

  @Post()
  create(@Body() dto: CreateCashBoxDto, @CurrentAuth() auth: AuthContext) {
    return this.cashBoxes.create(auth.companyId, dto);
  }

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    return this.cashBoxes.list(auth.companyId);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.cashBoxes.findOne(auth.companyId, id);
  }

  @Get(":id/movements")
  listMovements(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.cashBoxes.listMovements(auth.companyId, id);
  }

  @Post(":id/movements")
  addMovement(@Param("id") id: string, @Body() dto: CreateCashMovementDto, @CurrentAuth() auth: AuthContext) {
    return this.cashBoxes.addMovement(auth.companyId, auth.userId, id, dto);
  }

  @Post("movements/:movementId/post")
  postApprovedMovement(@Param("movementId") movementId: string, @CurrentAuth() auth: AuthContext) {
    return this.cashBoxes.postApprovedMovement(auth.companyId, auth.userId, movementId);
  }
}
