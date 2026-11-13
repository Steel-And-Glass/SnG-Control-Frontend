"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useApiClient } from "@/features/auth/hooks/useApiClient";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { usePersonLabel } from "@/features/auth/hooks/usePersonLabel";
import { documentBatch } from "@/features/documents/service";
import { ApiError } from "@/lib/api/apiError";
import { ErrorNotice } from "@/lib/api/ErrorNotice";
import { saveDownload } from "@/lib/api/saveDownload";
import { formatDate } from "@/lib/formatDate";
import type { EngineeringState } from "./contracts";
import type { EngineeringCommand } from "./workspaceContracts";
type Operation={kind:"command";command:EngineeringCommand}|{kind:"upload";actaId:string;requestKey:string;expectedRevision:number;scopeHash:string;file:File};
export function EngineeringWorkspace({state,refresh,blocked,onBusy}:{state:EngineeringState;refresh:(signal:AbortSignal)=>Promise<void>;blocked:boolean;onBusy:(busy:boolean)=>void}) {const who=usePersonLabel();
 const api=useApiClient();const {activeRole,user}=useAuth();const w=state.workspace!;const path=`projects/${state.projectId}/engineering`;
 const [selected,setSelected]=useState<string[]>([]);const [subject,setSubject]=useState("");const [files,setFiles]=useState<Record<string,File|undefined>>({});
 const [pending,setPending]=useState<Operation>();const [confirmation,setConfirmation]=useState<Operation>();const [busy,setBusy]=useState(false);const [error,setError]=useState<unknown>();const [notice,setNotice]=useState("");
 const operation=useRef<AbortController|null>(null);
 useEffect(()=>()=>{operation.current?.abort();},[state.projectId,activeRole,user?.subject]);
 const engineering=activeRole==="Engineering";const disabled=blocked||busy||!!pending;
 const candidates=state.structures.filter(r=>r.work?.openingRecordId===null&&(w.canManagePackages||r.work?.canModify));
 const refs=state.structures.filter(r=>selected.includes(r.structure.id)).map(r=>({structureId:r.structure.id,submissionId:r.origin!.submissionId,evidenceVersion:r.origin!.evidenceVersion}));
 const label=(id:string)=>{const s=state.structures.find(r=>r.structure.id===id)!.structure;return `${s.itemNumber??"Agregada en obra"} · Unidad ${s.unitOrdinal}/${s.unitCount} · ${s.actualLocation??s.location??"Sin ubicación"}`;};
 const command=(action:EngineeringCommand["action"],expectedRevision:number,targetId:string|null=null,documentId:string|null=null):Operation=>({kind:"command",command:{requestKey:crypto.randomUUID(),expectedRevision,action,targetId,documentId,subject:["CreatePackage","ReassignPackage","CreateActa","AssignActa"].includes(action)?subject:null,structures:["CreatePackage","CreateActa","AddStructures"].includes(action)?refs:null}});
 async function run(op:Operation) {
  if(operation.current||blocked||!engineering)return;
  const controller=new AbortController();operation.current=controller;setBusy(true);onBusy(true);setPending(op);setConfirmation(undefined);setError(undefined);setNotice("");
  try {
   if(op.kind==="command")await api.post(`${path}/workspace/commands`,op.command,{signal:controller.signal});
   else await api.upload(`${path}/opening-records/${op.actaId}/documents`,documentBatch([{file:op.file,replacesDocumentId:null}]),{signal:controller.signal,query:new URLSearchParams({requestKey:op.requestKey,expectedRevision:String(op.expectedRevision),scopeHash:op.scopeHash})});
   if(controller.signal.aborted)return;
   await refresh(controller.signal);if(controller.signal.aborted)return;
   setPending(undefined);setSelected([]);setFiles({});setNotice("Operación confirmada por el servidor.");
  }catch(e){if(controller.signal.aborted)return;setError(e);try{await refresh(controller.signal);}catch{/* Preserve exact operation for uncertain response. */}if(e instanceof ApiError&&[400,403,404,409,413].includes(e.status))setPending(undefined);}
  finally{if(!controller.signal.aborted){operation.current=null;setBusy(false);onBusy(false);}}
 }
 async function download(actaId:string,docId:string,name:string){
  if(operation.current||blocked)return;const c=new AbortController();operation.current=c;setBusy(true);onBusy(true);setError(undefined);
  try{await saveDownload(()=>api.downloadStream(`${path}/opening-records/${actaId}/documents/${docId}/download`,{signal:c.signal}),name,c.signal,{serverFilename:true});}catch(e){if(!c.signal.aborted)setError(e);}finally{if(!c.signal.aborted){operation.current=null;setBusy(false);onBusy(false);}}
 }
 return <section className="stack" aria-label="Paquetes y Actas incrementales"><h3>Paquetes y Actas de Vanos</h3>
 <p>{w.projectName} · {w.sgCode??"Sin SG"}</p><p>El espacio permanece abierto para nuevos tramos. Cada Acta se confirma por separado.</p>
 <p>{w.actas.length} Actas · {w.actas.filter(a=>a.status==="Confirmed").length} confirmadas · {state.structures.filter(r=>r.work?.openingRecordId).length} estructuras asignadas a Actas</p>
 {error instanceof ApiError&&error.status===409?<p role="alert">El expediente cambió o la operación no cumple sus requisitos. Revisa el estado actualizado y vuelve a seleccionar.</p>:<ErrorNotice error={error}/>}
 {notice&&<p role="status">{notice}</p>}{busy&&<p role="status">Guardando operación de Ingenieríaâ€¦</p>}{pending&&!busy&&<button className="button-secondary" disabled={blocked} onClick={()=>void run(pending)}>Reintentar operación con la misma clave</button>}
 {engineering&&w.canManagePackages&&<label>Responsable de paquete o Acta<select disabled={disabled} className="form-control" value={subject} onChange={e=>setSubject(e.target.value)}><option value="">Seleccionar identidad configurada</option>{w.assignableSubjects.map((s,i)=><option key={s} value={s}>{s===user?.subject?`${user.name??"Yo"} (tú)`:`Ingeniero ${i+1}`}</option>)}</select></label>}
 {engineering&&candidates.length>0&&<fieldset disabled={disabled}><legend>Estructuras para paquete o Acta</legend>
 {candidates.map(r=><label className="stack" key={r.structure.id}><span><input type="checkbox" checked={selected.includes(r.structure.id)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,r.structure.id]:ids.filter(i=>i!==r.structure.id))}/> Seleccionar {label(r.structure.id)}</span><small>Tramo {r.origin!.number}{who("Responsable",r.work!.responsibleSubject)}</small></label>)}
 {w.canManagePackages&&<><button className="button-secondary" disabled={!refs.length||!subject||refs.some(r=>!w.packages.find(p=>p.id===state.structures.find(s=>s.structure.id===r.structureId)?.work?.packageId)?.isIntake)} onClick={()=>setConfirmation(command("CreatePackage",w.revision))}>Crear paquete de trabajo</button></>}
 {w.canManagePackages&&<button className="button-primary" disabled={!refs.length||!subject} onClick={()=>setConfirmation(command("CreateActa",w.revision))}>Crear Acta de Vanos</button>}
 </fieldset>}
 <details><summary>Paquetes y asignaciones</summary>{w.packages.map(p=><article className="stack" key={p.id}><h4>{p.isIntake?"Recepción de tramo":"Paquete de trabajo"}</h4><p>{p.status==="Open"?"Abierto":p.status==="Completed"?"Completado":"Transferido"}{who("Responsable",p.responsibleSubject)} · {p.structures.length} estructuras</p><p>Creado: {formatDate(p.createdAt)} · Asignado: {formatDate(p.assignedAt)}{p.completedAt&&` · Finalizado: ${formatDate(p.completedAt)}`}</p><ul>{p.structures.map(r=><li key={r.structureId}>{label(r.structureId)}</li>)}</ul>
 {engineering&&w.canManagePackages&&!p.isIntake&&p.status==="Open"&&<button className="button-secondary" disabled={disabled||!subject||p.structures.some(r=>state.structures.find(s=>s.structure.id===r.structureId)?.work?.openingRecordId)} onClick={()=>setConfirmation(command("ReassignPackage",p.revision,p.id))}>Reasignar paquete al responsable seleccionado</button>}
 <details><summary>Historial de asignaciones</summary>{p.history.map(h=><p key={h.id}>{h.subject} · {formatDate(h.assignedAt)}{h.endedAt&&` hasta ${formatDate(h.endedAt)}`} · {h.structures.length} estructuras originalmente asignadas</p>)}</details></article>)}</details>
 {w.actas.map(a=><article className="panel stack" key={a.id} aria-label={`Acta ${a.number}`}><h4>Acta de Vanos {a.number}</h4><p>{{Draft:"En preparación",InProgress:"Estructuras en trabajo",Ready:"Lista para confirmar",Confirmed:"Confirmada por Ingeniería"}[a.status]}</p><p>Creada: {formatDate(a.createdAt)}{who("Responsable",a.responsibleSubject)}{who("Creada por",a.createdBySubject)}</p><ul>{a.structures.map(r=><li key={r.structureId}>{label(r.structureId)} · {state.structures.find(s=>s.structure.id===r.structureId)?.completed?"Trabajada":"Pendiente"}</li>)}</ul>
 {engineering&&w.canManagePackages&&a.status!=="Confirmed"&&<button className="button-secondary" disabled={disabled||!subject||subject===a.responsibleSubject} onClick={()=>setConfirmation(command("AssignActa",a.revision,a.id))}>Reasignar Acta {a.number} al responsable seleccionado</button>}
 {engineering&&a.canModify&&<><button className="button-secondary" disabled={disabled||!refs.length||refs.some(r=>!state.structures.find(s=>s.structure.id===r.structureId)?.work?.canModify)} onClick={()=>setConfirmation(command("AddStructures",a.revision,a.id))}>Agregar selección al manifiesto del Acta {a.number}</button>
 <label>PDF para Acta {a.number}<input className="form-control" type="file" accept=".pdf,application/pdf" disabled={disabled} onChange={e=>setFiles(f=>({...f,[a.id]:e.target.files?.[0]}))}/></label>
 <p>Declara que el PDF respalda exactamente las estructuras listadas en esta Acta. Si incluye otras, agrégalas al manifiesto antes de cargarlo. El sistema no verifica semánticamente su contenido.</p>
 <button className="button-secondary" disabled={disabled||!files[a.id]||!files[a.id]!.name.toLowerCase().endsWith(".pdf")||files[a.id]!.size===0||files[a.id]!.size>25*1024*1024} onClick={()=>setConfirmation({kind:"upload",actaId:a.id,requestKey:crypto.randomUUID(),expectedRevision:a.revision,scopeHash:a.scopeHash,file:files[a.id]!})}>Declarar alcance y cargar PDF de Acta {a.number}</button></>}
 {!a.documents.length&&<p>Sin PDF cargado.</p>}{a.documents.map(d=><div className="stack" key={d.file.document.id}><strong>Versión {d.file.version} · {d.file.document.id===a.currentDocumentId?"Vigente":"Histórica"} · {d.file.document.originalFileName}</strong><p>{formatDate(d.file.document.uploadedAt)} · {d.file.document.uploadedBy.name??d.file.document.uploadedBy.email??"Responsable registrado"} · {d.file.document.sizeBytes} bytes · {d.matchesManifest?"Alcance coincidente":"Alcance anterior: actualizar PDF"}</p><details><summary>Alcance declarado e integridad</summary><ul>{d.structures.map(r=><li key={r.structureId}>{label(r.structureId)}</li>)}</ul><code>{d.file.sha256}</code></details><button className="button-secondary" disabled={busy||blocked} onClick={()=>void download(a.id,d.file.document.id,d.file.document.originalFileName)}>Descargar Acta {a.number}, versión {d.file.version}</button>{engineering&&a.canModify&&d.matchesManifest&&d.file.document.id!==a.currentDocumentId&&<button className="button-secondary" disabled={disabled} onClick={()=>setConfirmation(command("SelectDocument",a.revision,a.id,d.file.document.id))}>Usar versión {d.file.version} en Acta {a.number}</button>}</div>)}
 {engineering&&a.canModify&&<button className="button-primary" disabled={disabled||a.status!=="Ready"} onClick={()=>setConfirmation(command("ConfirmActa",a.revision,a.id))}>Confirmar Acta {a.number}</button>}{a.confirmedAt&&<p>Confirmada: {formatDate(a.confirmedAt)}{who("Por",a.confirmedBySubject)}</p>}
 </article>)}
 {confirmation&&<OperationConfirmation busy={disabled} onCancel={()=>setConfirmation(undefined)}><p>{confirmation.kind==="upload"?`Cargar ${confirmation.file.name} con el alcance declarado del Acta.`:confirmation.command.action==="ConfirmActa"?"Se congelarán el manifiesto, los checks y el PDF vigente de esta Acta. Las otras Actas y el espacio del proyecto seguirán disponibles.":"Confirma la operación con las estructuras y el responsable seleccionados."}</p>{confirmation.kind==="command"&&confirmation.command.structures&&<ul>{confirmation.command.structures.map(r=><li key={r.structureId}>{label(r.structureId)}</li>)}</ul>}{confirmation.kind==="command"&&confirmation.command.subject&&<p>Responsable: {confirmation.command.subject}</p>}<button className="button-primary" disabled={disabled} onClick={()=>void run(confirmation)}>Confirmar operación</button><button className="button-secondary" disabled={busy} onClick={()=>setConfirmation(undefined)}>Cancelar</button></OperationConfirmation>}
 <details><summary>Auditoría de paquetes y Actas</summary>{w.history.map((h,i)=><p key={i}>{h.action} · {formatDate(h.at)}{who("Por",h.actorSubject)} · Revisión {h.revision}</p>)}</details>
 </section>;
}

function OperationConfirmation({children,busy,onCancel}:{children:ReactNode;busy:boolean;onCancel:()=>void}) {
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current!;const previous=document.activeElement;dialog.showModal();dialog.querySelector<HTMLButtonElement>("button:last-child")?.focus();return()=>{dialog.close();if(previous instanceof HTMLElement&&previous.isConnected)previous.focus();};},[]);
 return <dialog ref={ref} aria-label="Confirmar operación de Ingeniería" onCancel={e=>{e.preventDefault();if(!busy)onCancel();}}>{children}</dialog>;
}
