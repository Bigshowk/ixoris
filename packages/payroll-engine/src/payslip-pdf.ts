import PDFDocument from "pdfkit";
import { PayslipResult } from "./types";

const LOGO_NAVY = "#132A46";
const LOGO_GOLD = "#C9973A";

/**
 * Draws the IXORIS monogram (same 0..140 geometry as `packages/ui/src/IxorisLogo.tsx`
 * and the thermal-ticket raster logo in `packages/escpos`) as native PDF vector paths —
 * no rasterized image asset needed, so it always renders crisp at any size.
 */
function drawIxorisMark(doc: PDFKit.PDFDocument, x: number, y: number, size: number) {
  const scale = size / 140;
  doc.save();
  doc.translate(x, y).scale(scale);
  doc.roundedRect(0, 0, 140, 140, 28).fill(LOGO_NAVY);
  doc.lineCap("round");
  doc.path("M106.25 86.9 A40 40 0 1 1 86.9 33.75").lineWidth(7).stroke(LOGO_GOLD);
  doc.path("M86.9 33.75 L96.2 13.8").lineWidth(7).stroke(LOGO_GOLD);
  doc.polygon([101.3, 2.9], [105.15, 13.58], [90.65, 6.82]).fill(LOGO_GOLD);
  doc.restore();
}

export interface PayslipPdfCompanyInfo {
  companyName: string;
  companyAddress?: string;
  taxId?: string;
}

export interface PayslipPdfEmployeeInfo {
  fullName: string;
  employeeNumber: string;
  position?: string;
}

export interface BuildPayslipPdfInput {
  company: PayslipPdfCompanyInfo;
  employee: PayslipPdfEmployeeInfo;
  period: string; // "2026-08"
  payslip: PayslipResult;
  currencySymbol?: string;
}

/** Renders a printable bulletin de paie as a PDF byte buffer. */
export function buildPayslipPdf(input: BuildPayslipPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const symbol = input.currencySymbol ?? "XOF";
    const money = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} ${symbol}`;

    const headerX = doc.x;
    const headerY = doc.y;
    const markSize = 30;
    const textX = headerX + markSize + 10;
    const textWidth = 520 - markSize - 10;
    drawIxorisMark(doc, headerX, headerY, markSize);

    doc.fontSize(16).text(input.company.companyName, textX, headerY, { width: textWidth });
    if (input.company.companyAddress) doc.fontSize(9).fillColor("#555555").text(input.company.companyAddress, textX, doc.y, { width: textWidth });
    if (input.company.taxId) doc.fontSize(9).text(`NIF: ${input.company.taxId}`, textX, doc.y, { width: textWidth });
    doc.fillColor("#000000");
    doc.x = headerX;
    doc.y = Math.max(doc.y, headerY + markSize);
    doc.moveDown();

    doc.fontSize(14).text(`Bulletin de paie — ${input.period}`, { align: "center" });
    doc.moveDown();

    doc.fontSize(10);
    doc.text(`Salarie : ${input.employee.fullName}`);
    doc.text(`Matricule : ${input.employee.employeeNumber}`);
    if (input.employee.position) doc.text(`Poste : ${input.employee.position}`);
    doc.moveDown();

    const startX = doc.x;
    const colLabel = startX;
    const colBase = 300;
    const colAmount = 420;

    const row = (label: string, base: string, amount: string, bold = false) => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica");
      const y = doc.y;
      doc.text(label, colLabel, y, { width: 250 });
      doc.text(base, colBase, y, { width: 100, align: "right" });
      doc.text(amount, colAmount, y, { width: 100, align: "right" });
      doc.moveDown(0.5);
    };

    row("Element", "Base", "Montant", true);
    doc
      .moveTo(startX, doc.y)
      .lineTo(520, doc.y)
      .stroke();
    doc.moveDown(0.3);

    for (const line of input.payslip.lines) {
      const sign = line.type === "DEDUCTION" ? "-" : "";
      row(line.label, money(line.base), `${sign}${money(line.amount)}`);
    }

    doc.moveDown(0.5);
    doc
      .moveTo(startX, doc.y)
      .lineTo(520, doc.y)
      .stroke();
    doc.moveDown(0.3);

    row("SALAIRE BRUT", "", money(input.payslip.grossSalary), true);
    row("Total retenues", "", `-${money(input.payslip.totalDeductions)}`, true);
    doc.moveDown(0.3);

    doc.fontSize(12).font("Helvetica-Bold").text(`NET A PAYER : ${money(input.payslip.netSalary)}`, colLabel, doc.y);

    doc.moveDown(2);
    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor("#777777")
      .text(`Charges patronales (non deduites du net) : ${money(input.payslip.totalEmployerContributions)}`);

    doc.end();
  });
}
