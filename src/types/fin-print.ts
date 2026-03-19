export type FinPrintDocumentType = "credito" | "cobro" | "cheque";

export interface FinPrintMeta {
  document_type: FinPrintDocumentType;
  document_id: string;
  organization_id: string;
  generated_at: string;
  generated_by: string;
}
