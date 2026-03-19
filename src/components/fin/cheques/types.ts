export type ChequeStatus =
  | "borrador"
  | "cotizada"
  | "aprobada"
  | "liquidada"
  | "rechazada";

export type CounterpartyType = "persona" | "empresa";

export type ChequeDraft = {
  id: string;
  banco: string;
  numero: string;
  librador: string;
  fechaPago: string;
  nominal: number;
};

export type OfferTerms = {
  tasaDescuentoMensual: number;
  gastoFijoPorCheque: number;
  gastoVariablePct: number;
};

export type OfferPreview = {
  nominalTotal: number;
  descuentoTotal: number;
  gastosTotal: number;
  netoTotal: number;
  plazoPromedioDias: number;
};

export type ChequeOperation = {
  id: string;
  numeroOperacion: string;
  cliente: string;
  cuit: string;
  tipoContraparte: CounterpartyType;
  estado: ChequeStatus;
  createdAt: string;
  acreditacionEstimada: string;
  observaciones: string;
  cheques: ChequeDraft[];
  terms: OfferTerms;
  preview: OfferPreview;
};
