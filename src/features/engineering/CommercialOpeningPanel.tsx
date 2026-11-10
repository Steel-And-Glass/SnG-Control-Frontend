"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {useAuth} from "@/features/auth/hooks/useAuth";
import {useApiClient} from "@/features/auth/hooks/useApiClient";
import {useResource} from "@/lib/api/useResource";
import {ApiError} from "@/lib/api/apiError";
import {ErrorNotice} from "@/lib/api/ErrorNotice";
import {saveDownload} from "@/lib/api/saveDownload";
import {formatDate} from "@/lib/formatDate";
import {useMeasurementImages} from "@/features/measurements/StructureCard";
import {EngineeringStructureDetails} from "./EngineeringPanel";
import {commercialOpeningService as service} from "./commercialOpeningService";
import type {CommercialCommand,CommercialUpload,CommercialRow} from "./commercialOpeningContracts";
import styles from "./EngineeringPanel.module.css";
type Operation={acta:string;command:CommercialCommand}|{acta:string;round:string;manifest:CommercialUpload;file:File};
const status={Ready:"Pendiente de presentación",Presented:"Esperando respuestas",Resolved:"Resuelta",Superseded:"Sustituida por nueva ronda"};
const approval={AwaitingApproval:"Pendiente de respuesta",Confirmed:"Confirmada",UnderEngineeringReview:"En revisión de Ingeniería"};
const reference=(r:CommercialRow)=>({structureId:r.structure.id,expectedRevision:r.revision,evidenceVersion:r.evidenceVersion});
const duration=(s:number|null)=>s===null?"Aún no registrado":`${Math.floor(s/86400)} d ${Math.floor(s%86400/3600)} h ${Math.floor(s%3600/60)} min ${Math.floor(s%60)} s`;
export function CommercialOpeningPanel({projectId,onRefresh}:{projectId:string;onRefresh:(signal:AbortSignal)=>Promise<void>}){
 const api=useApiClient();const {user,activeRole}=useAuth();
 const load=useCallback((signal:AbortSignal)=>service.read(api,projectId,signal),[api,projectId]);const resource=useResource(load);
 const [actaId,setActaId]=useState<string>();const [roundId,setRoundId]=useState<string>();
 const acta=resource.data?.actas.find(a=>a.id===actaId)??resource.data?.actas[0];const round=acta?.rounds.find(r=>r.id===roundId)??acta?.rounds.at(-1);
 const review=acta?.reviews.find(v=>v.roundId===round?.id);
 const images=useMeasurementImages(projectId,round?.structures.map(r=>r.structure)??[]);
 const [selected,setSelected]=useState<string[]>([]);const [reasons,setReasons]=useState<Record<string,string>>({});const [observations,setObservations]=useState("");
 const [changed,setChanged]=useState<string[]>();const [file,setFile]=useState<File>();const [signedId,setSignedId]=useState("");const [attest,setAttest]=useState(false);
 const [pending,setPending]=useState<Operation>();const [confirmation,setConfirmation]=useState<{operation:Operation;text:string}>();const [busy,setBusy]=useState(false);const [error,setError]=useState<unknown>();const [notice,setNotice]=useState("");
 const running=useRef<AbortController|null>(null);const fileInput=useRef<HTMLInputElement|null>(null);
 useEffect(()=>()=>running.current?.abort(),[projectId,activeRole,user?.subject]);
 const reset=()=>{setSelected([]);setReasons({});setChanged(undefined);setObservations("");setFile(undefined);setSignedId("");setAttest(false);setConfirmation(undefined);if(fileInput.current)fileInput.current.value="";};
 async function run(op:Operation){
  if(running.current)return;const c=new AbortController();running.current=c;setBusy(true);setPending(op);setError(undefined);setNotice("");
  try{
   if("command" in op)await service.command(api,projectId,op.acta,op.command,c.signal);else await service.upload(api,projectId,op.acta,op.round,op.manifest,op.file,c.signal);
   if(c.signal.aborted)return;resource.update(await load(c.signal));if(c.signal.aborted)return;
   setPending(undefined);reset();setNotice("Guardado confirmado por el servidor.");if("command" in op&&op.command.action==="CloseReview")setRoundId(undefined);await onRefresh(c.signal);
  }catch(e){if(c.signal.aborted)return;setError(e);try{const current=await load(c.signal);if(!c.signal.aborted)resource.update(current);}catch{/* Keep original operation for an uncertain result. */}
   if(!c.signal.aborted&&e instanceof ApiError&&[400,403,404,409,413].includes(e.status)){setPending(undefined);reset();}
  }finally{if(!c.signal.aborted){running.current=null;setBusy(false);}}
 }
 async function download(docId:string,name:string){if(!acta||running.current)return;const c=new AbortController();running.current=c;setBusy(true);try{await saveDownload(()=>service.download(api,projectId,acta.id,docId,c.signal),name,c.signal,{serverFilename:true});}catch(e){if(!c.signal.aborted)setError(e);}finally{if(!c.signal.aborted){running.current=null;setBusy(false);}}}
 if(resource.loading)return <p role="status">Consultando Actas comerciales…</p>;
 if(resource.error)return <ErrorNotice error={resource.error} retry={resource.refresh}/>;
 if(!acta)return <section className="panel"><h2>Actas comerciales</h2><p>Ingeniería aún no ha confirmado Actas de este proyecto.</p></section>;
 const disabled=busy||!!pending;const advisor=activeRole==="CommercialAdvisor"&&user?.subject===round?.advisorSubject;const reviewer=!!review&&activeRole==="Engineering"&&user?.subject===review?.subject&&review.canReview;
 const chosen=round?.structures.filter(r=>selected.includes(r.structure.id))??[];
 const declared=changed??review?.structures.filter(r=>r.changed).map(r=>r.structureId)??[];
 const signed=acta.documents.filter(d=>d.kind==="SIGNED"&&d.roundId===round?.id);const signedDoc=signed.find(d=>d.document.id===signedId);
 const covered=chosen.length>0&&chosen.every(r=>r.approval==="AwaitingApproval"&&signedDoc?.structures.some(m=>m.structureId===r.structure.id&&m.evidenceVersion===r.evidenceVersion&&m.evidenceDocumentId===r.evidenceDocumentId));
 const command=(action:CommercialCommand["action"],extra:Partial<CommercialCommand>={}):Operation=>({acta:acta.id,command:{requestKey:crypto.randomUUID(),action,expectedRevision:round?.revision??0,...(round?{roundId:round.id}:{}),...extra}});
 const ask=(operation:Operation,text:string)=>setConfirmation({operation,text});
 const label=(r:CommercialRow)=>`Ítem ${r.structure.itemNumber??"Agregada"} · Unidad ${r.structure.unitOrdinal}`;
 const errors:Record<string,string>={OpeningRevisionConflict:"El expediente cambió. Revisa el estado recuperado y selecciona nuevamente.",OpeningEvidenceConflict:"La selección no corresponde a evidencia vigente y pendiente.",OpeningSignedActaRequired:"Selecciona un PDF firmado de esta Acta y ronda con el alcance exacto.",OpeningReviewIncomplete:"Completa los checks, declara lo realmente cambiado y carga la nueva versión.",OpeningReleasedEvidenceLocked:"Esta estructura ya fue liberada mediante una aceptación; su evidencia permanece protegida.",OpeningAffectedDeclarationChanged:"La declaración cambió. Carga un PDF asociado a la declaración vigente.",OpeningRoundStateConflict:"La ronda cambió o ya no permite esta operación.",OpeningRequestConflict:"El reintento no coincide con la operación original.",InvalidEngineeringPdf:"Selecciona un PDF válido de hasta 25 MiB."};
 return <section className="panel stack" aria-label="Comercial incremental de Actas">
 <h2>Actas de Vanos · Presentación comercial</h2>
 <ul>{resource.data?.actas.map(a=>{const r=a.rounds.at(-1);return <li key={a.id}>Acta {String(a.number).padStart(2,"0")} · {r?status[r.status]:"Pendiente de recepción"} · {r?.structures.length??0} estructuras · {r?.structures.filter(x=>x.approval==="Confirmed").length??0} confirmadas · {r?.structures.filter(x=>x.approval==="AwaitingApproval").length??0} pendientes · {r?.structures.filter(x=>x.approval==="UnderEngineeringReview").length??0} con cambios · PDF v{a.documents.find(d=>d.document.id===r?.documentId)?.version??"—"} · Recepción: {formatDate(r?.receivedAt??null)} · Última actividad: {formatDate(a.lastActivityAt)}</li>;})}</ul>
 <label>Acta<select className="form-control" value={acta.id} disabled={disabled} onChange={e=>{setActaId(e.target.value);setRoundId(undefined);reset();setError(undefined);}}>{resource.data?.actas.map(a=><option key={a.id} value={a.id}>Acta {String(a.number).padStart(2,"0")}</option>)}</select></label>
 <p>Acta {acta.number} · {acta.id} · Responsable de Ingeniería: {acta.engineerSubject}</p>
 <button className="button-secondary" disabled={disabled} onClick={()=>{reset();resource.refresh();}}>Actualizar estado y tiempos</button>
 {notice&&<p role="status">{notice}</p>}{error instanceof ApiError&&error.code&&errors[error.code]?<p role="alert">{errors[error.code]}</p>:<ErrorNotice error={error}/>}
 {pending&&!busy&&<button className="button-secondary" onClick={()=>void run(pending)}>Reintentar operación original</button>}
 {acta.canReceive&&activeRole==="CommercialAdvisor"&&<button className="button-primary" disabled={disabled} onClick={()=>ask(command("Receive"),"Recibir esta Acta confirmada y crear su tarea comercial independiente.")}>Recibir Acta confirmada</button>}
 {round&&<>
 <label>Ronda de esta Acta<select className="form-control" value={round.id} disabled={disabled} onChange={e=>{setRoundId(e.target.value);reset();setError(undefined);}}>{acta.rounds.map(r=><option key={r.id} value={r.id}>Ronda {r.number} · {status[r.status]}</option>)}</select></label>
 <h3>Ronda {round.number} · {status[round.status]}</h3><p>Tarea comercial: {round.taskId} · Asesor: {round.advisorSubject}</p>
 <p>Presentación: {formatDate(round.presentedAt)} · Recepción: {formatDate(round.receivedAt)}</p>
 <p>Tiempo desde presentación: {duration(round.elapsedSeconds)} · Primera respuesta: {duration(round.firstResponseSeconds)} · Resolución completa: {duration(round.resolutionSeconds)}</p>
 <p>Sin SLA. Tiempos oficiales consultados: {formatDate(resource.data?.serverNow??null)}. Mientras haya pendientes, continúa el seguimiento de esta ronda.</p>
 {advisor&&round.canPresent&&<button className="button-primary" disabled={disabled} onClick={()=>ask(command("Present"),"Confirmo que presenté al cliente exactamente el PDF de esta ronda. El servidor iniciará el tiempo de respuesta.")}>Confirmar presentación al cliente</button>}
 <p>Los datos técnicos radicados de Instalación se conservan como origen. La evidencia técnica de cada versión del Acta está en su PDF.</p>
 <div className={styles.cards}>{round.structures.map(r=>{const s=r.structure;const member=review?.structures.find(m=>m.structureId===s.id);return <article className={`stack ${styles.card}`} key={s.id} aria-label={label(r)}>
 <h4>{label(r)}</h4><p>{s.actualLocation??s.location??"Sin ubicación"}</p><p>{approval[r.approval]} · Evidencia de Acta v{r.evidenceVersion} · PDF {r.evidenceDocumentId}</p><p>Radicación {r.submissionNumber} · {r.submissionId} · Evidencia original v{r.sourceEvidenceVersion}</p>
 <EngineeringStructureDetails structure={s} projectId={projectId} image={s.imageCatalogItemId?images.images[s.imageCatalogItemId]:undefined} retryImage={images.retry}/>
 {acta.history.filter(h=>h.roundId===round.id).flatMap((h,n)=>h.changes.filter(c=>c.structureId===s.id).map((c,i)=><p key={`${n}:${i}`}><strong>Cambio solicitado:</strong> {c.description} · {formatDate(h.at)}</p>))}
 {advisor&&round.canRespond&&r.approval!=="Confirmed"&&<><label className={styles.check}><input type="checkbox" checked={selected.includes(s.id)} disabled={disabled} onChange={e=>{setSelected(e.target.checked?[...selected,s.id]:selected.filter(id=>id!==s.id));setAttest(false);}}/>Seleccionar {label(r)}</label>{selected.includes(s.id)&&<label>Descripción de cambio · {label(r)}<textarea className="form-control" disabled={disabled} maxLength={4000} value={reasons[s.id]??""} onChange={e=>setReasons({...reasons,[s.id]:e.target.value})}/></label>}</>}
 {reviewer&&member&&<label className={styles.check}><input type="checkbox" disabled={disabled} checked={member.completed} onChange={e=>void run(command("ReviewCheck",{reviewId:review.id,structures:[{structureId:s.id,expectedRevision:member.revision,evidenceVersion:member.evidenceVersion}],completed:e.target.checked}))}/>Trabajo de revisión realizado · {label(r)}</label>}
 </article>;})}</div>
 {advisor&&round.canRespond&&<>
 <p>Solo se modifican las estructuras seleccionadas. Las omitidas conservan su estado.</p>
 <label>Observaciones generales (opcional)<textarea className="form-control" maxLength={4000} disabled={disabled} value={observations} onChange={e=>setObservations(e.target.value)}/></label>
 <button className="button-secondary" disabled={disabled||!chosen.length||chosen.some(r=>!reasons[r.structure.id]?.trim())} onClick={()=>ask(command("RequestChanges",{structures:chosen.map(r=>({...reference(r),description:reasons[r.structure.id].trim()})),observations}),"Enviar únicamente los cambios seleccionados a Ingeniería. Las estructuras omitidas conservan su estado y pueden recibir otras respuestas.")}>Solicitar cambios seleccionados</button>
 <button className="button-secondary" disabled>Detener proyecto</button>
 </>}
 {reviewer&&<section className="stack"><h3>Revisión de Ingeniería</h3><p>Una revisión abierta agrupa los motivos sucesivos de esta Acta. Un nuevo pedido invalida la declaración y el PDF anterior; solo reinicia el check de la estructura nuevamente observada.</p>
 {round.structures.map(r=><label key={r.structure.id} className={styles.check}><input type="checkbox" checked={declared.includes(r.structure.id)} disabled={disabled||r.acceptanceId!==null} onChange={e=>setChanged(e.target.checked?[...declared,r.structure.id]:declared.filter(id=>id!==r.structure.id))}/>Cambió realmente · {label(r)}</label>)}
 <button className="button-secondary" disabled={disabled} onClick={()=>ask(command("DeclareChanged",{reviewId:review.id,expectedRevision:review.revision,structures:round.structures.filter(r=>declared.includes(r.structure.id)).map(reference)}),"Confirmo la lista exacta de estructuras realmente modificadas, que puede ser vacía. El nuevo PDF deberá corresponder a esta declaración.")}>Guardar declaración de cambios reales</button>
 </section>}
 {(reviewer||advisor&&round.canRespond)&&<section className="stack"><h3>{reviewer?"PDF revisado del Acta completa":"Aceptación parcial documentada"}</h3>
 <p>{reviewer?"Declara los cambios reales antes de cargar la nueva versión completa.":"Selecciona las estructuras cubiertas por el PDF firmado. La carga sola no confirma ni libera estructuras."}</p>
 <label>{reviewer?"Seleccionar PDF revisado":"Seleccionar PDF firmado"}<input ref={fileInput} type="file" accept=".pdf,application/pdf" disabled={disabled} onChange={e=>setFile(e.target.files?.[0])}/></label>
 <button className="button-primary" disabled={disabled||!file||!file.name.toLowerCase().endsWith(".pdf")||!file.size||file.size>25*1024*1024||(reviewer?!review.declared:!chosen.length||chosen.some(r=>r.approval!=="AwaitingApproval"))} onClick={()=>file&&ask({acta:acta.id,round:round.id,file,manifest:{requestKey:crypto.randomUUID(),kind:reviewer?"REVISED":"SIGNED",expectedRevision:reviewer?review.revision:round.revision,reviewId:reviewer?review.id:null,structures:(reviewer?round.structures:chosen).map(reference)}},reviewer?"Guardar una versión nueva del Acta completa con la declaración vigente.":`Guardar el PDF firmado con alcance explícito: ${chosen.map(label).join(", ")}. No se verificará automáticamente la firma.`)}>Cargar PDF con alcance declarado</button>
 {reviewer?<button className="button-primary" disabled={disabled||!review.declared||!review.documentId||review.structures.some(m=>!m.completed)} onClick={()=>ask(command("CloseReview",{reviewId:review.id,expectedRevision:review.revision,documentId:review.documentId!}),"Confirmar la revisión y crear la siguiente ronda de esta Acta. Las aprobaciones no afectadas se conservan; las estructuras revisadas vuelven a esperar respuesta.")}>Finalizar revisión y crear siguiente ronda</button>:<>
 <label>PDF firmado de esta ronda<select className="form-control" value={signedId} disabled={disabled} onChange={e=>{setSignedId(e.target.value);setAttest(false);}}><option value="">Seleccionar documento</option>{signed.map(d=><option key={d.document.id} value={d.document.id}>Versión {d.version} · {d.document.originalFileName} · {d.structures.length} estructuras</option>)}</select></label>
 <label className={styles.check}><input type="checkbox" checked={attest} disabled={disabled||!covered} onChange={e=>setAttest(e.target.checked)}/>Declaro que este PDF corresponde al Acta y ronda seleccionadas, incluye las estructuras seleccionadas y documenta su aceptación firmada por el cliente</label>
 <button className="button-primary" disabled={disabled||!attest||!covered} onClick={()=>ask(command("Accept",{structures:chosen.map(reference),documentId:signedId,attest:true}),`Confirmar y liberar únicamente: ${chosen.map(label).join(", ")}. Se creará una tarea independiente de Radicación de Vanos, sin ejecutar esa etapa.`)}>Confirmar aceptación parcial</button>
 </>}
 </section>}
 </>}
 {confirmation&&<div role="dialog" aria-label="Confirmar operación comercial"><p>{confirmation.text}</p><button className="button-primary" disabled={disabled} onClick={()=>void run(confirmation.operation)}>Confirmar operación</button><button className="button-secondary" disabled={busy} onClick={()=>setConfirmation(undefined)}>Cancelar</button></div>}
 <details><summary>Documentos y alcance de esta Acta</summary>{acta.documents.map(d=><div className="stack" key={d.document.id}><p>{d.kind==="SIGNED"?"Acta firmada":d.kind==="REVISED"?"Revisión de Acta":"Acta de Ingeniería"} · Versión {d.version} · {d.document.originalFileName} · {formatDate(d.document.uploadedAt)} · {d.document.uploadedBy.name??"Actor registrado"}</p><p>SHA-256: {d.sha256} · Ronda: {acta.rounds.find(r=>r.id===d.roundId)?.number??"Origen de Ingeniería"}</p><ul>{d.structures.map(m=><li key={m.structureId}>{m.structureId} · Evidencia v{m.evidenceVersion} · {m.evidenceDocumentId}</li>)}</ul><button className="button-secondary" disabled={busy} onClick={()=>void download(d.document.id,d.document.originalFileName)}>Descargar {d.document.originalFileName}</button></div>)}</details>
 <details><summary>Aceptaciones y Radicaciones de Vanos pendientes</summary>{acta.acceptances.map(a=><article key={a.id}><h4>Aceptación {a.id}</h4><p>Ronda {acta.rounds.find(r=>r.id===a.roundId)?.number} · {formatDate(a.at)} · Asesor {a.actorSubject} · Atestación registrada</p><p>PDF firmado: {a.signedDocumentId} · Tarea de Radicación de Vanos: {a.taskId} · Ejecución aún no habilitada</p><ul>{a.structures.map(m=><li key={m.structureId}>{m.structureId} · Evidencia v{m.evidenceVersion} · {m.evidenceDocumentId}</li>)}</ul></article>)}</details>
 <details><summary>Historial de respuestas y revisiones</summary>{acta.history.map((h,i)=><article key={i}><p>{h.action} · Ronda {acta.rounds.find(r=>r.id===h.roundId)?.number} · {formatDate(h.at)} · {h.actorSubject}</p>{h.observations&&<p>{h.observations}</p>}<ul>{h.changes.map(c=><li key={c.structureId}>{c.structureId}: {c.description}</li>)}</ul></article>)}</details>
 </section>;
}
