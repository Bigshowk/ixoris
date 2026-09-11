import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { UsersService } from "./users.service";
import { CreateUserDto, AssignRoleDto } from "./dto/user.dto";

@RequirePermissions("admin.user.manage")
@Controller("admin/users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto, @CurrentAuth() auth: AuthContext) {
    return this.users.create(auth.companyId, dto);
  }

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    return this.users.list(auth.companyId);
  }

  @Post(":id/activate")
  activate(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.users.setActive(auth.companyId, id, true);
  }

  @Post(":id/deactivate")
  deactivate(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.users.setActive(auth.companyId, id, false);
  }

  @Post(":id/roles")
  assignRole(@Param("id") id: string, @Body() dto: AssignRoleDto, @CurrentAuth() auth: AuthContext) {
    return this.users.assignRole(auth.companyId, id, dto);
  }

  @Delete(":id/roles/:userRoleId")
  revokeRole(@Param("id") id: string, @Param("userRoleId") userRoleId: string, @CurrentAuth() auth: AuthContext) {
    return this.users.revokeRole(auth.companyId, id, userRoleId);
  }
}
