import PDFDocument from "pdfkit";
import { PayslipResult } from "./types";

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

    doc.fontSize(16).text(input.company.companyName);
    if (input.company.companyAddress) doc.fontSize(9).fillColor("#555555").text(input.company.companyAddress);
    if (input.company.taxId) doc.fontSize(9).text(`NIF: ${input.company.taxId}`);
    doc.fillColor("#000000");
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
