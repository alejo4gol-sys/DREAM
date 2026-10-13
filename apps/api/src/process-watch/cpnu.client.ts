/**
 * Cliente de la Consulta de Procesos Nacional Unificada (CPNU) de la Rama Judicial.
 * Usa la misma API JSON pública que consume el portal consultaprocesos.ramajudicial.gov.co (sin captcha ni usuario).
 * Cortesía: máximo ~12 consultas por minuto, reintentos con espera ante 429/5xx y un User-Agent identificable.
 * La API no está documentada oficialmente: si cambian los nombres de los campos se lanza un error claro
 * en vez de tratar el proceso como «sin novedades».
 */
import { config } from '../config';

export class CpnuError extends Error {
  constructor(message: string, public readonly kind: 'NETWORK' | 'SHAPE' | 'HTTP' = 'NETWORK') { super(message); }
}

export interface CpnuProcess {
  idProceso: number; llaveProceso: string; fechaProceso: string | null; fechaUltimaActuacion: string | null;
  despacho: string; departamento: string; sujetosProcesales: string; esPrivado: boolean;
}
export interface CpnuAction {
  idRegActuacion: number; consActuacion: number; fechaActuacion: string | null; actuacion: string; anotacion: string;
  fechaInicial: string | null; fechaFinal: string | null; fechaRegistro: string | null; conDocumentos: boolean;
}
export interface CpnuDetail { despacho: string; ponente: string; tipoProceso: string; claseProceso: string; subclaseProceso: string; recurso: string; ubicacion: string; contenidoRadicacion: string }

const UA = 'DREAMS-VigilanciaProcesos/1.0 (vigilancia de radicados propios de abogados; contacto: soporte@dreams.co)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const day = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const txt = (v: unknown) => (v == null ? '' : String(v).trim());

function need(obj: any, keys: string[], where: string) {
  if (!obj || typeof obj !== 'object') throw new CpnuError(`Respuesta inesperada de la Rama Judicial en ${where}.`, 'SHAPE');
  const miss = keys.filter((k) => !(k in obj));
  if (miss.length) throw new CpnuError(`La Rama Judicial cambió el formato de ${where} (faltan ${miss.join(', ')}).`, 'SHAPE');
}

let lastCall = 0;
async function get(path: string): Promise<any> {
  // Limitador simple: al menos 5 s entre consultas (≈12 por minuto) en todo el servidor.
  const wait = lastCall + 5000 - Date.now();
  if (wait > 0) await sleep(wait);
  let attempt = 0;
  for (;;) {
    lastCall = Date.now();
    let res: Response;
    try {
      res = await fetch(`${config.cpnuBaseUrl}${path}`, { headers: { Accept: 'application/json', 'User-Agent': UA }, signal: AbortSignal.timeout(25_000) });
    } catch (e) {
      if (++attempt <= 2) { await sleep(4000 * attempt); continue; }
      throw new CpnuError(`No se pudo conectar con la Rama Judicial (${(e as Error).message}).`);
    }
    if (res.status === 429 || res.status >= 500) {
      if (++attempt <= 2) { await sleep(8000 * attempt); continue; }
      throw new CpnuError(`La Rama Judicial no respondió (HTTP ${res.status}). Se reintentará más tarde.`, 'HTTP');
    }
    if (res.status === 404) return null;
    if (!res.ok) throw new CpnuError(`La Rama Judicial rechazó la consulta (HTTP ${res.status}).`, 'HTTP');
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('json')) throw new CpnuError('La Rama Judicial respondió con una página en lugar de datos. Se reintentará más tarde.', 'SHAPE');
    return res.json();
  }
}

/** Busca un radicado de 23 dígitos. Puede devolver varios procesos (instancias o conexiones distintas). */
export async function searchByRadicado(radicado: string): Promise<CpnuProcess[]> {
  const data = await get(`/Procesos/Consulta/NumeroRadicacion?numero=${radicado}&SoloActivos=false&pagina=1`);
  if (!data) return [];
  if (!Array.isArray(data.procesos)) {
    if (data?.paginacion && Number(data.paginacion.cantidadRegistros) === 0) return [];
    throw new CpnuError('La respuesta de la Rama Judicial no trae la lista de procesos.', 'SHAPE');
  }
  return data.procesos.filter((p: any) => p && typeof p === 'object').map((p: any) => {
    need(p, ['idProceso', 'llaveProceso', 'fechaUltimaActuacion', 'despacho', 'esPrivado'], 'la búsqueda por radicado');
    return {
      idProceso: Number(p.idProceso), llaveProceso: txt(p.llaveProceso), fechaProceso: day(p.fechaProceso), fechaUltimaActuacion: day(p.fechaUltimaActuacion),
      despacho: txt(p.despacho), departamento: txt(p.departamento), sujetosProcesales: txt(p.sujetosProcesales), esPrivado: !!p.esPrivado,
    };
  });
}

export async function getDetail(idProceso: number): Promise<CpnuDetail | null> {
  const d = await get(`/Proceso/Detalle/${idProceso}`);
  if (!d) return null;
  need(d, ['llaveProceso', 'despacho', 'tipoProceso', 'claseProceso'], 'el detalle del proceso');
  return {
    despacho: txt(d.despacho), ponente: txt(d.ponente), tipoProceso: txt(d.tipoProceso), claseProceso: txt(d.claseProceso),
    subclaseProceso: txt(d.subclaseProceso), recurso: txt(d.recurso), ubicacion: txt(d.ubicacion), contenidoRadicacion: txt(d.contenidoRadicacion),
  };
}

/** Actuaciones, de la más reciente a la más antigua (40 por página). */
export async function getActions(idProceso: number, page = 1): Promise<{ items: CpnuAction[]; pages: number; total: number }> {
  const d = await get(`/Proceso/Actuaciones/${idProceso}?pagina=${page}`);
  if (!d) return { items: [], pages: 0, total: 0 };
  if (!Array.isArray(d.actuaciones)) throw new CpnuError('La respuesta de la Rama Judicial no trae las actuaciones.', 'SHAPE');
  const items = d.actuaciones.map((a: any) => {
    need(a, ['idRegActuacion', 'fechaActuacion', 'actuacion', 'anotacion'], 'las actuaciones');
    const id = Number(a.idRegActuacion);
    if (!Number.isFinite(id) || id <= 0) throw new CpnuError('Una actuación llegó sin identificador.', 'SHAPE');
    return {
      idRegActuacion: id, consActuacion: Number(a.consActuacion) || 0, fechaActuacion: day(a.fechaActuacion), actuacion: txt(a.actuacion), anotacion: txt(a.anotacion),
      fechaInicial: day(a.fechaInicial), fechaFinal: day(a.fechaFinal), fechaRegistro: day(a.fechaRegistro), conDocumentos: !!a.conDocumentos,
    };
  });
  return { items, pages: Number(d?.paginacion?.cantidadPaginas) || 1, total: Number(d?.paginacion?.cantidadRegistros) || items.length };
}
