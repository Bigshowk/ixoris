import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  roleId!: string;

  @IsOptional()
  @IsString()
  storeId?: string;
}

export class AssignRoleDto {
  @IsString()
  roleId!: string;

  @IsOptional()
  @IsString()
  storeId?: string;
}
