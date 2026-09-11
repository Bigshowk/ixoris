import { IsString, MinLength } from "class-validator";

export class ManualMatchDto {
  @IsString()
  @MinLength(1)
  journalLineId!: string;
}
