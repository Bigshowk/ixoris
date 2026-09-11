import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { JournalEntriesService } from "./journal-entries.service";
import { CreateJournalEntryDto } from "./dto/create-journal-entry.dto";

@Controller("accounting/journal-entries")
export class JournalEntriesController {
  constructor(private readonly journalEntries: JournalEntriesService) {}

  @Post()
  @RequirePermissions("accounting.journal.write")
  create(@Body() dto: CreateJournalEntryDto, @CurrentAuth() auth: AuthContext) {
    return this.journalEntries.create(auth.companyId, auth.userId, dto);
  }

  @Get()
  @RequirePermissions("accounting.journal.read")
  list(@Query("journalCode") journalCode: string | undefined, @Query("periodId") periodId: string | undefined, @CurrentAuth() auth: AuthContext) {
    return this.journalEntries.list(auth.companyId, journalCode, periodId);
  }

  @Get(":id")
  @RequirePermissions("accounting.journal.read")
  findOne(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.journalEntries.findOne(auth.companyId, id);
  }
}
