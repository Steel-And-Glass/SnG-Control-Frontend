"use client";
import Link from "next/link";
import {useCallback,useState} from "react";
import {useAuth} from "@/features/auth/hooks/useAuth";
import {useApiClient} from "@/features/auth/hooks/useApiClient";
import {ErrorNotice} from "@/lib/api/ErrorNotice";
import {operationsService as service} from "./service";
import {useRead,useOperation} from "./hooks";
import {OperationFeedback,SourceIdentity,stateLabels,reviewStates,EvidenceText} from "./shared";
import {ReviewPanel} from "./ReviewPanel";
export function PreparationPage({id}:{id:string}){
 const {user,activeRole,status}=useAuth();if(status!=="authenticated"||!activeRole||!user?.roles.includes(activeRole)||!["OperationsHead","Management"].includes(activeRole))return <p role="alert">No tienes acceso a la revisión de Operaciones con el área actual.</p>;
 return <PreparationContent key={`${id}:${user.subject}:${activeRole}`} id={id} writable={activeRole==="OperationsHead"}/>;
}
function PreparationContent({id,writable}:{id:string;writable:boolean}){
 const api=useApiClient();const [selected,setSelected]=useState<string>();const [reason,setReason]=useState("");
 const read=useCallback(async(signal:AbortSignal)=>{const [detail,job,reviews]=await Promise.all([writable?service.detail(api,id,signal):null,writable?service.job(api,id,signal):null,service.reviews(api,id,signal)]);return {detail,job,reviews};},[api,id,writable]);
 const state=useRead(read);const operation=useOperation(state.reload);const data=state.data;const chosen=data?.reviews.find(r=>r.id===selected)??data?.reviews.at(-1);const disabled=state.loading||operation.disabled||state.error!==undefined;
 return <div className="page-stack">{writable&&<Link className="text-link" href="/operations">Volver a preparaciones</Link>}<h1 className="page-title">Revisión de preparación</h1>{!writable&&<p>Gerencia · Solo lectura</p>}
 <OperationFeedback operation={operation}/>{state.error!==undefined&&<ErrorNotice error={state.error} retry={state.retry}/ >}{state.loading&&<p role="status">Consultando preparación…</p>}
 {data&&<>{data.detail&&<section className="panel stack"><SourceIdentity {...data.detail.preparation}/><p>Estado de extracción inicial: {stateLabels[data.detail.preparation.state]}</p><details><summary>Alcance confirmado de OP</summary>{data.detail.members.map(m=><p key={m.structureId}>OP {m.op}</p>)}</details></section>}
 {writable&&<section className="panel stack"><h2>Extracción documental</h2>{data.job?<><p>{stateLabels[data.job.state]} · Generación {data.job.generation} · Parser {data.job.extractorVersion}</p>{data.job.errorCode&&<p role="alert">{data.job.errorCode}</p>}<EvidenceText text={data.job.report} label="Reporte original de extracción y diagnósticos"/></>:<p>Sin extracción registrada.</p>}
 {(!data.job||data.job.state==="Failed")&&<button className="button-primary" disabled={disabled} onClick={()=>{if(window.confirm("¿Solicitar extracción documental? No se crearán tareas ni checklists."))void operation.run(s=>service.extract(api,id,s));}}>Solicitar extracción</button>}
 {data.job&&["Completed","Blocked"].includes(data.job.state)&&!data.reviews.some(r=>r.extractionJobId===data.job!.id)&&!data.reviews.some(r=>r.state===2)&&<form className="stack" onSubmit={e=>{e.preventDefault();const job=data.job!;const requestKey=crypto.randomUUID();void operation.run(async signal=>{const result=await service.command(api,id,{requestKey,expectedRevision:0,action:"Start",reason,extractionJobId:job.id},signal);signal.throwIfAborted();setSelected(result.reviewId);});}}><label>Motivo de inicio de revisión<input className="form-control" required maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)} disabled={disabled}/></label><button className="button-primary" disabled={disabled||!reason.trim()}>Iniciar revisión documental</button></form>}
 <button className="button-secondary" disabled={disabled} onClick={state.retry}>Consultar estado de extracción</button></section>}
 <section className="stack"><h2>Revisiones y aprobaciones</h2><p className="metadata">Primeras 100 revisiones, ordenadas por número. La extracción no constituye aprobación.</p>{data.reviews.length===0?<p>No se ha iniciado una revisión.</p>:<><label>Revisión<select className="form-control" value={chosen?.id} disabled={operation.disabled||state.loading} onChange={e=>setSelected(e.target.value)}>{data.reviews.map(r=><option key={r.id} value={r.id}>Revisión {r.number} · {reviewStates[r.state]}</option>)}</select></label>{chosen&&<ReviewPanel key={`${chosen.id}:${writable}`} preparationId={id} reviewId={chosen.id} detail={data.detail} writable={writable} parentDisabled={disabled} refreshParent={state.reload}/>}</>}</section></>}
 </div>;
}
