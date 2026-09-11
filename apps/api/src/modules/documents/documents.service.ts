import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AttachDocumentDto } from "./dto/attach-document.dto";

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  attach(companyId: string, userId: string, dto: AttachDocumentDto) {
    return this.prisma.document.create({
      data: {
        companyId,
        fileName: dto.fileName,
        fileUrl: dto.fileUrl,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        attachableType: dto.attachableType,
        attachableId: dto.attachableId,
        uploadedById: userId,
      },
    });
  }

  listFor(companyId: string, attachableType: string, attachableId: string) {
    return this.prisma.document.findMany({ where: { companyId, attachableType, attachableId }, orderBy: { createdAt: "desc" } });
  }

  async remove(companyId: string, id: string): Promise<void> {
    const document = await this.prisma.document.findFirst({ where: { id, companyId } });
    if (!document) throw new NotFoundException(`Document ${id} not found`);
    await this.prisma.document.delete({ where: { id } });
  }
}
