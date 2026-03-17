import { getAdminFirestore } from '@/firebase/admin';
import { FIN_COLLECTIONS } from '@/firebase/collections';
import type { FinLedgerEntry, LedgerEntryType } from '@/types/fin-ledger';

function nowIso(): string {
  return new Date().toISOString();
}

async function getUltimoSaldo(
  orgId: string,
  clienteId: string
): Promise<number> {
  const db = getAdminFirestore();
  const snap = await db
    .collection(FIN_COLLECTIONS.ledgerEntries(orgId))
    .where('cliente_id', '==', clienteId)
    .orderBy('created_at', 'desc')
    .limit(1)
    .get();

  if (snap.empty) {
    return 0;
  }

  const data = snap.docs[0].data() as Partial<FinLedgerEntry>;
  return typeof data.saldo_acumulado === 'number' ? data.saldo_acumulado : 0;
}

async function insertarEntrada(
  orgId: string,
  entry: Omit<FinLedgerEntry, 'id'>
): Promise<string> {
  const db = getAdminFirestore();
  const ref = db.collection(FIN_COLLECTIONS.ledgerEntries(orgId)).doc();
  const fullEntry: FinLedgerEntry = { id: ref.id, ...entry };
  await ref.set(fullEntry);
  return ref.id;
}

export class LedgerService {
  static async registrarCobro(
    orgId: string,
    clienteId: string,
    cobro: {
      id: string;
      monto_total: number;
      credito_id: string;
      numero_cuota?: number;
    },
    descripcion: string
  ): Promise<string> {
    const saldoAnterior = await getUltimoSaldo(orgId, clienteId);
    const saldoAcumulado = saldoAnterior + cobro.monto_total;
    const now = nowIso();

    return insertarEntrada(orgId, {
      organizacion_id: orgId,
      cliente_id: clienteId,
      fecha: now.slice(0, 10),
      tipo: 'cobro_cuota' as LedgerEntryType,
      descripcion,
      credito_id: cobro.credito_id,
      cobro_id: cobro.id,
      cuota_numero: cobro.numero_cuota,
      debe: cobro.monto_total,
      haber: 0,
      saldo_acumulado: saldoAcumulado,
      created_at: now,
    });
  }

  static async registrarOtorgamiento(
    orgId: string,
    clienteId: string,
    creditoId: string,
    capital: number
  ): Promise<string> {
    const saldoAnterior = await getUltimoSaldo(orgId, clienteId);
    const saldoAcumulado = saldoAnterior - capital;
    const now = nowIso();

    return insertarEntrada(orgId, {
      organizacion_id: orgId,
      cliente_id: clienteId,
      fecha: now.slice(0, 10),
      tipo: 'otorgamiento' as LedgerEntryType,
      descripcion: `Otorgamiento de crédito ${creditoId}`,
      credito_id: creditoId,
      debe: 0,
      haber: capital,
      saldo_acumulado: saldoAcumulado,
      created_at: now,
    });
  }

  static async getMovimientos(
    orgId: string,
    clienteId: string,
    limit = 50
  ): Promise<FinLedgerEntry[]> {
    const db = getAdminFirestore();
    const snap = await db
      .collection(FIN_COLLECTIONS.ledgerEntries(orgId))
      .where('cliente_id', '==', clienteId)
      .orderBy('fecha', 'desc')
      .limit(limit)
      .get();

    return snap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<FinLedgerEntry, 'id'>),
    }));
  }

  static async getSaldo(orgId: string, clienteId: string): Promise<number> {
    return getUltimoSaldo(orgId, clienteId);
  }
}
