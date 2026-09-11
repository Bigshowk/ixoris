import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { FixedAssetsService } from "./fixed-assets.service";
import { DepreciationService } from "./depreciation.service";
import { CreateFixedAssetDto } from "./dto/create-fixed-asset.dto";
import { DisposeFixedAssetDto } from "./dto/dispose-fixed-asset.dto";

@RequirePermissions("assets.fixedasset.manage")
@Controller("fixed-assets")
export class FixedAssetsController {
  constructor(
    private readonly fixedAssets: FixedAssetsService,
    private readonly depreciation: DepreciationService,
  ) {}

  @Post()
  create(@Body() dto: CreateFixedAssetDto, @CurrentAuth() auth: AuthContext) {
    return this.fixedAssets.create(auth.companyId, dto);
  }

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    return this.fixedAssets.list(auth.companyId);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.fixedAssets.findOne(auth.companyId, id);
  }

  @Post(":id/dispose")
  dispose(@Param("id") id: string, @Body() dto: DisposeFixedAssetDto, @CurrentAuth() auth: AuthContext) {
    return this.fixedAssets.dispose(auth.companyId, id, dto.disposalAmount);
  }

  @RequirePermissions("assets.depreciation.run")
  @Post("depreciation/run")
  runDepreciation(@CurrentAuth() auth: AuthContext) {
    return this.depreciation.postDue(auth.companyId, auth.userId);
  }
}
