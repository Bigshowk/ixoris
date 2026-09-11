import { ApprovalableType } from "@ixoris/database";
import { IsEnum, IsIn, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateApprovalRuleDto {
  @IsEnum(ApprovalableType)
  appliesTo!: ApprovalableType;

  @IsNumber()
  @Min(0)
  minAmount!: number;

  @IsString()
  @MinLength(1)
  requiredRoleId!: string;
}

export class DecideApprovalRequestDto {
  @IsIn(["APPROVED", "REJECTED"])
  decision!: "APPROVED" | "REJECTED";

  @IsOptional()
  @IsString()
  comment?: string;
}
