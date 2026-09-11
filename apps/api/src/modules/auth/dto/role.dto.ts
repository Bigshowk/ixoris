import { ArrayMinSize, IsArray, IsString, MinLength } from "class-validator";

export class CreateRoleDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  permissionCodes!: string[];
}

export class UpdateRolePermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissionCodes!: string[];
}
