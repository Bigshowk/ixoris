import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { PositionsService } from "./positions.service";
import { CreatePositionDto } from "./dto/position.dto";

@RequirePermissions("hr.employee.manage")
@Controller("hr/positions")
export class PositionsController {
  constructor(private readonly positions: PositionsService) {}

  @Post()
  create(@Body() dto: CreatePositionDto, @CurrentAuth() auth: AuthContext) {
    return this.positions.create(auth.companyId, dto);
  }

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    return this.positions.list(auth.companyId);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.positions.findOne(auth.companyId, id);
  }
}
