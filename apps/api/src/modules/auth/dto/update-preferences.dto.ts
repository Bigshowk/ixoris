import { IsIn, IsOptional } from "class-validator";

export class UpdatePreferencesDto {
  @IsOptional()
  @IsIn(["fr", "en"])
  locale?: string;

  @IsOptional()
  @IsIn(["light", "dark", "system"])
  themePreference?: string;
}
