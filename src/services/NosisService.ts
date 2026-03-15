import { FIN_COLLECTIONS } from '@/firebase/collections';
import { getAdminFirestore } from '@/lib/firebase/admin';

const CONSULTAS_SUBCOLLECTION = 'fin_consultas_nosis';
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_API_URL = 'https://api.nosis.com/v1/consultas';

function normalizeDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function isSandboxEnabled(): boolean {
  return process.env.NOSIS_SANDBOX === 'true';
}

function extractNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function extractNestedNumber(
  source: Record<string, unknown>,
  paths: string[][]
): number | null {
  for (const path of paths) {
    let current: unknown = source;
    for (const segment of path) {
      if (
        !current ||
        typeof current !== 'object' ||
        !(segment in (current as Record<string, unknown>))
      ) {
        current = undefined;
        break;
      }
      current = (current as Record<string, unknown>)[segment];
    }

    const value = extractNumber(current);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

export interface NosisConsultaResult {
  score: number | null;
  situacion_bcra: number | null;
  cheques_rechazados: number;
  juicios_activos: number;
  raw_response?: unknown;
  error?: string;
}

export class NosisService {
  static async consultar(
    cuit: string,
    apiKey: string
  ): Promise<NosisConsultaResult> {
    const cuitNormalizado = normalizeDigits(cuit);

    if (!cuitNormalizado) {
      throw new Error('El CUIT es requerido para consultar Nosis');
    }

    if (isSandboxEnabled()) {
      return {
        score: 745,
        situacion_bcra: 1,
        cheques_rechazados: 0,
        juicios_activos: 0,
        raw_response: {
          sandbox: true,
          cuit: cuitNormalizado,
        },
      };
    }

    if (!apiKey.trim()) {
      throw new Error('NOSIS_API_KEY es requerido');
    }

    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(process.env.NOSIS_API_URL || DEFAULT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          documento: cuitNormalizado,
          tipoDocumento: cuitNormalizado.length === 11 ? 'CUIT' : 'CUIL',
          informe: 'COMPLETO',
        }),
        signal: controller.signal,
      });

      const rawResponse = await response.json().catch(async () => {
        const text = await response.text();
        return { raw: text };
      });

      if (!response.ok) {
        return {
          score: null,
          situacion_bcra: null,
          cheques_rechazados: 0,
          juicios_activos: 0,
          raw_response: rawResponse,
          error: `Nosis API error: ${response.status}`,
        };
      }

      const payload =
        rawResponse && typeof rawResponse === 'object'
          ? (rawResponse as Record<string, unknown>)
          : {};

      return {
        score: extractNestedNumber(payload, [['score'], ['nosis', 'score']]),
        situacion_bcra: extractNestedNumber(payload, [
          ['bcra', 'situacion'],
          ['situacion_bcra'],
          ['situacionBcra'],
        ]),
        cheques_rechazados:
          extractNestedNumber(payload, [
            ['cheques', 'rechazados'],
            ['cheques_rechazados'],
            ['chequesRechazados'],
          ]) ?? 0,
        juicios_activos:
          extractNestedNumber(payload, [
            ['juicios', 'activos'],
            ['juicios_activos'],
            ['juiciosActivos'],
          ]) ?? 0,
        raw_response: {
          ...payload,
          tiempoRespuestaMs: Date.now() - startedAt,
        },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido consultando Nosis';

      return {
        score: null,
        situacion_bcra: null,
        cheques_rechazados: 0,
        juicios_activos: 0,
        error: message,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  static async logConsulta(
    orgId: string,
    clienteId: string,
    cuit: string,
    resultado: NosisConsultaResult,
    usuarioId: string,
    usuarioNombre: string
  ): Promise<void> {
    const db = getAdminFirestore();
    const now = new Date().toISOString();
    const rawResponse =
      resultado.raw_response &&
      typeof resultado.raw_response === 'object' &&
      'tiempoRespuestaMs' in (resultado.raw_response as Record<string, unknown>)
        ? (resultado.raw_response as Record<string, unknown>)
        : null;
    const tiempoRespuestaMs = rawResponse
      ? extractNumber(rawResponse.tiempoRespuestaMs) ?? 0
      : 0;

    await db
      .doc(FIN_COLLECTIONS.cliente(orgId, clienteId))
      .collection(CONSULTAS_SUBCOLLECTION)
      .add({
        cuit: normalizeDigits(cuit),
        fechaConsulta: now,
        tipoConsulta: 'completo',
        scoreObtenido: resultado.score,
        situacionBcra: resultado.situacion_bcra,
        chequesRechazados: resultado.cheques_rechazados,
        juiciosActivos: resultado.juicios_activos,
        estado: resultado.error ? 'error' : 'exitoso',
        tiempoRespuestaMs,
        solicitadoPor: {
          userId: usuarioId,
          nombre: usuarioNombre,
        },
        errorMensaje: resultado.error,
        responseRecibido: resultado.raw_response,
        createdAt: now,
      });
  }
}
