import { IsIn, IsISO8601, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

const STAGES = ["NEW", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"] as const;
export type PipelineStageValue = (typeof STAGES)[number];

export class CreateOpportunityDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsISO8601()
  expectedCloseDate?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;
}

export class UpdateOpportunityStageDto {
  @IsIn(STAGES)
  stage!: PipelineStageValue;
}
