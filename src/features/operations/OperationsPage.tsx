"use client";
import Link from "next/link";
import { useCallback,useState } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useApiClient } from "@/features/auth/hooks/useApiClient";
import { ErrorNotice } from "@/lib/api/ErrorNotice";
import { formatDate } from "@/lib/formatDate";
import { operationsService as service } from "./service";
import { useRead,useOperation } from "./hooks";
import { OperationFeedback,SourceIdentity,stateLabels } from "./shared";
export function OperationsPage(){const {user,activeRole,status}=useAuth();if(status!=="authenticated"||activeRole!=="OperationsHead"||!user?.roles.includes(activeRole))return <p role="alert">Esta bandeja requiere el área activa Jefe de Operaciones.</p>;return <Inbox key={`${user.subject}:${activeRole}`}/>;}
function Inbox(){
 const api=useApiClient();const [tab,setTab]=useState<"releases"|"preparations">("releases");const [skip,setSkip]=useState(0);
 const read=useCallback(async(signal:AbortSignal)=>tab==="releases"?{releases:await service.releases(api,skip,signal),preparations:null}:{releases:null,preparations:await service.preparations(api,skip,signal)},[api,tab,skip]);
 const state=useRead(read);const operation=useOperation(state.reload);const disabled=state.loading||operation.disabled;const count=state.data?.releases?.length??state.data?.preparations?.length??0;
 return <div className="page-stack"><header><h1 className="page-title">Jefe de Operaciones</h1><p>Preparación y revisión documental para Producción.</p></header>
 <p className="metadata">El servicio identifica proyecto, expediente y versión mediante sus IDs. Sus nombres y números comerciales no están disponibles en esta consulta.</p>
 <nav aria-label="Bandeja de Operaciones" className="flex gap-3"><button className="button-secondary" disabled={operation.disabled} aria-pressed={tab==="releases"} onClick={()=>{setTab("releases");setSkip(0);}}>Liberaciones disponibles</button><button className="button-secondary" disabled={operation.disabled} aria-pressed={tab==="preparations"} onClick={()=>{setTab("preparations");setSkip(0);}}>Preparaciones existentes</button></nav>
 <OperationFeedback operation={operation}/>{state.error!==undefined&&<ErrorNotice error={state.error} retry={state.retry}/ >}{state.loading&&<p role="status">Cargando bandeja…</p>}
 {!state.loading&&state.error===undefined&&state.data&&<><p>Registros {skip+1}–{skip+count}. Hasta 50 por página; no es un total global.</p>{count===0&&<p>No hay registros en esta página.</p>}
 {state.data.releases?.map(r=><article className="panel stack" key={r.versionId}><h2>Liberación confirmada · {formatDate(r.confirmedAt)}</h2><SourceIdentity projectId={r.projectId} filingId={r.filingId} releaseVersionId={r.versionId}/>{r.preparationId?<Link className="text-link" href={`/operations/preparations/${r.preparationId}`}>Abrir preparación</Link>:<button className="button-primary" disabled={disabled} onClick={()=>{if(window.confirm("¿Crear una preparación independiente desde esta liberación confirmada?"))void operation.run(async signal=>{await service.create(api,r.versionId,signal);});}}>Crear preparación</button>}</article>)}
 {state.data.preparations?.map(p=><article className="panel stack" key={p.id}><h2>Preparación · {formatDate(p.createdAt)}</h2><SourceIdentity {...p}/><p>Extracción inicial: {stateLabels[p.state]}</p><p className="metadata">La revisión y aprobación actuales se consultan en el detalle.</p><Link className="text-link" href={`/operations/preparations/${p.id}`}>Abrir preparación y revisiones</Link></article>)}</>}
 <div className="flex gap-3"><button className="button-secondary" disabled={disabled||skip===0} onClick={()=>setSkip(s=>Math.max(0,s-50))}>Anterior</button><button className="button-secondary" disabled={disabled||count<50||state.error!==undefined} onClick={()=>setSkip(s=>s+50)}>Siguiente</button><button className="button-secondary" disabled={disabled} onClick={state.retry}>Actualizar bandeja</button></div></div>;
}
