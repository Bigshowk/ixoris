import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { BankAccountsService } from "./bank-accounts.service";
import { CreateBankAccountDto } from "./dto/create-bank-account.dto";

@RequirePermissions("accounting.bank.reconcile")
@Controller("accounting/bank-accounts")
export class BankAccountsController {
  constructor(private readonly bankAccounts: BankAccountsService) {}

  @Post()
  create(@Body() dto: CreateBankAccountDto, @CurrentAuth() auth: AuthContext) {
    return this.bankAccounts.create(auth.companyId, dto);
  }

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    return this.bankAccounts.list(auth.companyId);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.bankAccounts.findOne(auth.companyId, id);
  }
}
