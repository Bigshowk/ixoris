export interface BankTransferLineInput {
  employeeName: string;
  iban: string;
  amount: number;
  reference?: string;
}

/**
 * Generic CSV bulk-transfer file. SEPA XML (pain.001) is Eurozone-specific
 * and doesn't apply to XOF-zone banking — most local banks in the OHADA zone
 * accept a plain CSV/Excel import for salary batches instead. Column
 * order/headers here are a reasonable default; adjust to match your bank's
 * exact import template before relying on it.
 */
export function buildBankTransferCsv(lines: BankTransferLineInput[]): string {
  const header = "Nom du beneficiaire;IBAN/Numero de compte;Montant;Reference";
  const rows = lines.map((l) =>
    [escapeCsv(l.employeeName), escapeCsv(l.iban), l.amount.toFixed(2), escapeCsv(l.reference ?? "")].join(";"),
  );
  return [header, ...rows].join("\r\n");
}

function escapeCsv(value: string): string {
  return /[;"\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
