import { ErrorNotice } from "@/lib/api/ErrorNotice";
import { ApiError } from "@/lib/api/apiError";
import type { useOperation } from "./hooks";
export const reviewStates = {1:"Borrador",2:"Aprobada",3:"Sustituida por reextracción"};
export const stateLabels: Record<string,string> = {PendingExtraction:"Extracción pendiente",Extracted:"Extraída",Blocked:"Bloqueada",ReadyForReview:"Lista para revisión",Queued:"En cola",Running:"Procesando",Completed:"Extracción finalizada",Failed:"Extracción fallida"};
export const materialLabels = {Glass:"Vidrio",AluminumProfile:"Perfil de aluminio",MicroperforatedSheet:"Lámina microperforada"};
export function OperationFeedback({operation:o}:{operation:ReturnType<typeof useOperation>}) {return <>{o.error!==undefined&&<ErrorNotice error={o.error}/ >}{o.error instanceof ApiError&&o.error.code&&<p role="status">Código: {o.error.code}. {o.error.status===409?"Se consultó el estado actual; revisa los cambios antes de enviar otra operación.":""}</p>}{o.notice&&<p role="status">{o.notice}</p>}{o.busy&&<p role="status">Procesando solicitud…</p>}{o.pending&&!o.busy&&<button className="button-secondary" onClick={o.retry}>Reintentar la misma operación</button>}</>;}
// Internal identifiers are not shown; the origin is described in words.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function SourceIdentity(_props:{projectId?:string;filingId?:string;releaseVersionId?:string}) {return <p className="metadata">Origen: Radicación de Vanos confirmada y versión documental liberada.</p>;}
export function EvidenceText({text,label="Detalle documental"}:{text:string;label?:string}) {return <details><summary>{label}</summary><pre className="whitespace-pre-wrap break-words text-xs max-h-80 overflow-auto">{text}</pre></details>;}
