import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "./decorators/require-permissions.decorator";
import { RolesService } from "./roles.service";
import { CreateRoleDto, UpdateRolePermissionsDto } from "./dto/role.dto";

@RequirePermissions("admin.role.manage")
@Controller("auth/roles")
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    return this.roles.list(auth.companyId);
  }

  @Get("permissions")
  listPermissions() {
    return this.roles.listPermissions();
  }

  @Post()
  create(@Body() dto: CreateRoleDto, @CurrentAuth() auth: AuthContext) {
    return this.roles.createRole(auth.companyId, dto);
  }

  @Patch(":id/permissions")
  updatePermissions(@Param("id") id: string, @Body() dto: UpdateRolePermissionsDto, @CurrentAuth() auth: AuthContext) {
    return this.roles.updateRolePermissions(auth.companyId, id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.roles.deleteRole(auth.companyId, id);
  }
}
