import { IsString, MinLength } from "class-validator";

export class EnableMfaDto {
  @IsString()
  @MinLength(6)
  code!: string;
}

export class DisableMfaDto {
  @IsString()
  @MinLength(1)
  password!: string;

  @IsString()
  @MinLength(6)
  code!: string;
}

export class VerifyMfaDto {
  @IsString()
  @MinLength(1)
  mfaToken!: string;

  @IsString()
  @MinLength(6)
  code!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @IsString()
  @MinLength(6)
  newPassword!: string;
}
