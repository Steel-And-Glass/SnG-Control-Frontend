import { ApiError } from "@/lib/api/apiError";
import type { EngineeringRow, EngineeringState } from "./contracts";
export type EngineeringReference = { structureId: string; submissionId: string; evidenceVersion: number };
export interface EngineeringWork { packageId:string; responsibleSubject:string; canModify:boolean; changedBySubject:string|null; openingRecordId:string|null }
export interface EngineeringPackage { id:string; isIntake:boolean; status:"Open"|"Transferred"|"Completed"; revision:number; responsibleSubject:string; createdAt:string; assignedAt:string; completedAt:string|null; structures:EngineeringReference[]; history:{id:string;subject:string;assignedAt:string;endedAt:string|null;structures:EngineeringReference[]}[] }
export interface EngineeringActa { id:string;number:number;status:"Draft"|"InProgress"|"Ready"|"Confirmed";responsibleSubject:string;createdBySubject:string;createdAt:string;revision:number;canModify:boolean;structures:EngineeringReference[];scopeHash:string;currentDocumentId:string|null;documents:{file:EngineeringState["documents"][number];structures:EngineeringReference[];matchesManifest:boolean}[];confirmedAt:string|null;confirmedBySubject:string|null }
export interface EngineeringWorkspace { projectName:string;sgCode:string|null;revision:number;canManagePackages:boolean;assignableSubjects:string[];packages:EngineeringPackage[];actas:EngineeringActa[];history:{action:string;targetId:string;revision:number;at:string;actorSubject:string}[] }
export type EngineeringCommand = { requestKey:string;expectedRevision:number;action:"CreatePackage"|"ReassignPackage"|"AssignActa"|"CreateActa"|"AddStructures"|"SelectDocument"|"ConfirmActa";targetId:string|null;subject:string|null;structures:EngineeringReference[]|null;documentId:string|null };
const fail=():never=>{throw new ApiError(502);};
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const exact=(v:unknown,keys:string):boolean=>obj(v)&&Object.keys(v).length===keys.split(" ").length&&keys.split(" ").every(k=>Object.hasOwn(v,k));
const text=(v:unknown):v is string=>typeof v==="string"&&v.length>0&&v.length<=500;
const nullable=(v:unknown)=>v===null||text(v);
const num=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0;
const date=(v:unknown)=>text(v)&&Number.isFinite(Date.parse(v));
const hash=(v:unknown)=>typeof v==="string"&&/^[A-F0-9]{64}$/.test(v);
function references(v:unknown,rows:EngineeringRow[]):v is EngineeringReference[] {
 return Array.isArray(v)&&v.length<=rows.length&&new Set(v.map(r=>r?.structureId)).size===v.length&&v.every(r=>exact(r,"structureId submissionId evidenceVersion")&&rows.some(x=>x.structure.id===r.structureId&&x.origin?.submissionId===r.submissionId&&x.origin?.evidenceVersion===r.evidenceVersion));
}
export function parseWorkspace(value:unknown,rows:EngineeringRow[]):EngineeringWorkspace {
 if(!exact(value,"projectName sgCode revision canManagePackages assignableSubjects packages actas history"))return fail();
 const w=value as EngineeringWorkspace;
 if(!text(w.projectName)||!nullable(w.sgCode)||!num(w.revision)||typeof w.canManagePackages!=="boolean"||!Array.isArray(w.assignableSubjects)||w.assignableSubjects.length>101||!w.assignableSubjects.every(text)||!Array.isArray(w.packages)||!Array.isArray(w.actas)||!Array.isArray(w.history))return fail();
 for(const p of w.packages) {
  if(!exact(p,"id isIntake status revision responsibleSubject createdAt assignedAt completedAt structures history")||!text(p.id)||typeof p.isIntake!=="boolean"||!["Open","Transferred","Completed"].includes(p.status)||!num(p.revision)||!text(p.responsibleSubject)||!date(p.createdAt)||!date(p.assignedAt)||!(p.completedAt===null||date(p.completedAt))||!references(p.structures,rows)||!Array.isArray(p.history))return fail();
  for(const h of p.history)if(!exact(h,"id subject assignedAt endedAt structures")||!text(h.id)||!text(h.subject)||!date(h.assignedAt)||!(h.endedAt===null||date(h.endedAt))||!references(h.structures,rows))return fail();
 }
 const reserved=new Set<string>();
 for(const a of w.actas){
  if(!exact(a,"id number status responsibleSubject createdBySubject createdAt revision canModify structures scopeHash currentDocumentId documents confirmedAt confirmedBySubject")||!text(a.id)||!num(a.number)||a.number<1||!["Draft","InProgress","Ready","Confirmed"].includes(a.status)||!text(a.responsibleSubject)||!text(a.createdBySubject)||!date(a.createdAt)||!num(a.revision)||typeof a.canModify!=="boolean"||!references(a.structures,rows)||!a.structures.length||!hash(a.scopeHash)||!nullable(a.currentDocumentId)||!Array.isArray(a.documents)||!(a.confirmedAt===null||date(a.confirmedAt))||!nullable(a.confirmedBySubject))return fail();
  for(const r of a.structures){if(reserved.has(r.structureId))return fail();reserved.add(r.structureId);}
  for(const d of a.documents)if(!exact(d,"file structures matchesManifest")||!exact(d.file,"document version sha256")||!obj(d.file.document)||!text(d.file.document.id)||!text(d.file.document.originalFileName)||!date(d.file.document.uploadedAt)||!obj(d.file.document.uploadedBy)||!num(d.file.document.sizeBytes)||!num(d.file.version)||d.file.version<1||!hash(d.file.sha256)||!references(d.structures,rows)||typeof d.matchesManifest!=="boolean")return fail();
  if(a.currentDocumentId!==null&&!a.documents.some(d=>d.file.document.id===a.currentDocumentId))return fail();
  if(a.status==="Confirmed"&&(a.canModify||!a.confirmedAt||!a.confirmedBySubject||!a.documents.some(d=>d.file.document.id===a.currentDocumentId&&d.matchesManifest)))return fail();
 }
 if(new Set(w.packages.map(p=>p.id)).size!==w.packages.length||new Set(w.actas.map(a=>a.id)).size!==w.actas.length)return fail();
 for(const r of rows){const x=r.work;if(!exact(x,"packageId responsibleSubject canModify changedBySubject openingRecordId")||!x||!text(x.packageId)||!text(x.responsibleSubject)||typeof x.canModify!=="boolean"||!nullable(x.changedBySubject)||!nullable(x.openingRecordId))return fail();const packages=w.packages.filter(p=>p.structures.some(m=>m.structureId===r.structure.id));if(packages.length!==1||packages[0].id!==x.packageId)return fail();const acta=w.actas.find(a=>a.structures.some(m=>m.structureId===r.structure.id));if((acta?.responsibleSubject??packages[0].responsibleSubject)!==x.responsibleSubject||(acta?.id??null)!==x.openingRecordId||(x.canModify&&((!acta&&packages[0].status!=="Open")||acta?.status==="Confirmed")))return fail();}
 for(const h of w.history)if(!exact(h,"action targetId revision at actorSubject")||!["CreatePackage","ReassignPackage","AssignActa","CreateActa","AddStructures","SelectDocument","ConfirmActa","UploadOpening"].includes(h.action)||!text(h.targetId)||!num(h.revision)||!date(h.at)||!text(h.actorSubject))return fail();
 return w;
}
