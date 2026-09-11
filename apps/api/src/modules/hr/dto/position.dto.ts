import { IsOptional, IsString, MinLength } from "class-validator";

export class CreatePositionDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  departmentId?: string;
}
