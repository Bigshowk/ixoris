import { IsIn, IsISO8601, IsOptional, IsString, MinLength } from "class-validator";

const INTERACTION_TYPES = ["CALL", "EMAIL", "MEETING", "WHATSAPP", "SMS", "NOTE"] as const;

export class CreateInteractionDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  opportunityId?: string;

  @IsIn(INTERACTION_TYPES)
  type!: (typeof INTERACTION_TYPES)[number];

  @IsString()
  @MinLength(1)
  notes!: string;

  @IsOptional()
  @IsISO8601()
  date?: string;
}
