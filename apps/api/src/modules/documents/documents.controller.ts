import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { DocumentsService } from "./documents.service";
import { AttachDocumentDto } from "./dto/attach-document.dto";

@RequirePermissions("ged.document.manage")
@Controller("documents")
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post()
  attach(@Body() dto: AttachDocumentDto, @CurrentAuth() auth: AuthContext) {
    return this.documents.attach(auth.companyId, auth.userId, dto);
  }

  @Get()
  listFor(@Query("attachableType") attachableType: string, @Query("attachableId") attachableId: string, @CurrentAuth() auth: AuthContext) {
    return this.documents.listFor(auth.companyId, attachableType, attachableId);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.documents.remove(auth.companyId, id);
  }
}
