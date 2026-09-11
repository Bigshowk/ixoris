import { Matches } from "class-validator";

export class CreatePayrollRunDto {
  /** "YYYY-MM" */
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: "period must be in YYYY-MM format" })
  period!: string;
}
