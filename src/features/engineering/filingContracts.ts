import { ApiError } from "@/lib/api/apiError";
import type { Structure, Comparison, Modification, MeasurementType } from "@/features/measurements/contracts";
export const filingCategories = { Structures:"01 — Lista de Estructuras", Sections:"02 — Secciones", Plans:"03 — Planos", UnoptimizedCutList:"04 — Lista de Corte No Optimizada", Glass:"05 — Vidrios", Materials:"06 — Materiales", GlassModulation:"07 — Modulación de Vidrios", Additional:"Documentos Adicionales" } as const;
export type FilingCategory=keyof typeof filingCategories;
export type FilingOp={structureId:string;code:string;confirmed:boolean};
export type FilingDocument={documentId:string;category:FilingCategory;version:number;state:"Current"|"Replaced"|"Withdrawn";name:string;sizeBytes:number;sha256:string;uploadedAt:string;uploadedBySubject:string;contentType:string|null};
export type FilingVersion={id:string;number:number;reason:string|null;createdAt:string;createdBySubject:string;confirmedAt:string|null;confirmedBySubject:string|null;manifestSha256:string|null;members:FilingOp[];documents:FilingDocument[]};
// Historical snapshots mirror the backend DTO, including opaque modification evidence.
export type FilingSource = Omit<Structure,"comparison"|"modification"> & {
 comparison?: (Omit<Comparison,"measurementType"|"width"|"height"> & {measurementType:MeasurementType|null;width:number|null;height:number|null}) | null;
 modification?: (Modification & {evidence:string}) | null;
};
export type Filing={id:string;taskId:string|null;acceptanceId:string;openingRecordId:string;actaNumber:number;presentedDocumentId:string;signedDocumentId:string;acceptedAt:string;responsibleSubject:string;status:"Pending"|"Preparing"|"Confirmed";number:string|null;revision:number;canModify:boolean;blockedReason:"LEGACY_INCOMPLETE_EVIDENCE"|null;structures:{structureId:string;submissionId:string;evidenceVersion:number;source:FilingSource}[];versions:FilingVersion[];history:{action:string;at:string;actorSubject:string}[]};
export type Filings={projectName:string;sgCode:string|null;filings:Filing[]};
export type FilingCommand={requestKey:string;expectedRevision:number;action:"Save"|"Withdraw"|"Confirm"|"Amend";number:string|null;members:FilingOp[]|null;documentId:string|null;reason:string|null};
export type FilingUpload={requestKey:string;expectedRevision:number;category:FilingCategory;replacesDocumentId:string|null};
const fail=():never=>{throw new ApiError(502);};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const exact=(v:unknown,keys:string)=>object(v)&&Object.keys(v).length===keys.split(" ").length&&keys.split(" ").every(k=>Object.hasOwn(v,k));
const text=(v:unknown):v is string=>typeof v==="string"&&v.length>0&&v.length<=4000;
const nullable=(v:unknown)=>v===null||text(v);
const number=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0;
const date=(v:unknown)=>text(v)&&Number.isFinite(Date.parse(v));
const hash=(v:unknown)=>typeof v==="string"&&/^[A-F0-9]{64}$/.test(v);
const unique=(ids:string[])=>new Set(ids).size===ids.length;
function sourceValid(s:unknown):boolean {
 if(!object(s))return false;
 const keys="id itemId unitOrdinal unitCount itemNumber description location width height note createdAt measuredAt retiredAt actualWidth actualHeight actualSystemText imageCatalogItemId technical sketchVersionId technicalComplete measurementType actualLocation installationObservations comparison comparisonStatus comparisonCurrent widthDifferenceMm heightDifferenceMm modification modificationComplete".split(" ");
 if(Object.keys(s).some(k=>!keys.includes(k)))return false;
 for(const key of ["itemId","itemNumber","location","note","actualSystemText","imageCatalogItemId","sketchVersionId","actualLocation","installationObservations"])if(s[key]!==undefined&&s[key]!==null&&(typeof s[key]!=="string"||(s[key] as string).length>4000))return false;
 for(const key of ["width","height","actualWidth","actualHeight","widthDifferenceMm","heightDifferenceMm"])if(s[key]!==undefined&&s[key]!==null&&(typeof s[key]!=="number"||!Number.isFinite(s[key])))return false;
 if(s.technical!=null&&(!object(s.technical)||Object.keys(s.technical).some(k=>!"handleStatus handleHeightMm viewSide openingType openingDirection openingHand hasAlfajia alfajiaMeasurementMm isComplete isFullyComplete".split(" ").includes(k))||Object.values(s.technical).some(v=>v!==null&&!["string","number","boolean"].includes(typeof v))))return false;
 if(s.comparison!=null){
  const c=s.comparison;
  if(!exact(c,"resolution reason measurementType width height")||!object(c)||!["Comparable","NotComparable"].includes(c.resolution as string)||!text(c.reason)||![null,"Agreed","Production","Opening"].includes(c.measurementType as string|null)||![c.width,c.height].every(v=>v===null||(typeof v==="number"&&Number.isFinite(v))))return false;
 }
 if(s.modification!=null){
  const m=s.modification;
  if(!exact(m,"versionId type reason description sketchVersionId evidence")||!object(m)||!text(m.versionId)||!text(m.type)||![m.reason,m.description].every(v=>v===null||(typeof v==="string"&&v.length<=4000))||!nullable(m.sketchVersionId)||typeof m.evidence!=="string"||m.evidence.length>32768)return false;
 }
 return true;
}
export function parseFilings(value:unknown):Filings {
 if(!exact(value,"projectName sgCode filings"))return fail();const v=value as Filings;
 if(!text(v.projectName)||!nullable(v.sgCode)||!Array.isArray(v.filings)||!unique(v.filings.map(f=>f?.id)))return fail();
 for(const f of v.filings){
  if(!exact(f,"id taskId acceptanceId openingRecordId actaNumber presentedDocumentId signedDocumentId acceptedAt responsibleSubject status number revision canModify blockedReason structures versions history")||![f.id,f.acceptanceId,f.openingRecordId,f.presentedDocumentId,f.signedDocumentId].every(text)||!nullable(f.taskId)||!number(f.actaNumber)||f.actaNumber<1||!date(f.acceptedAt)||typeof f.responsibleSubject!=="string"||!["Pending","Preparing","Confirmed"].includes(f.status)||!nullable(f.number)||!number(f.revision)||typeof f.canModify!=="boolean"||![null,"LEGACY_INCOMPLETE_EVIDENCE"].includes(f.blockedReason)||!Array.isArray(f.structures)||!Array.isArray(f.versions)||!Array.isArray(f.history))return fail();
  if(!unique(f.structures.map(s=>s?.structureId))||!unique(f.versions.map(x=>x?.id)))return fail();
  for(const s of f.structures)if(!exact(s,"structureId submissionId evidenceVersion source")||!text(s.structureId)||!text(s.submissionId)||!number(s.evidenceVersion)||s.evidenceVersion<1||!sourceValid(s.source)||s.source.id!==s.structureId||typeof s.source.description!=="string"||!number(s.source.unitOrdinal)||!number(s.source.unitCount)||!Number.isFinite(s.source.width)||!Number.isFinite(s.source.height))return fail();
  for(const ver of f.versions){
   if(!exact(ver,"id number reason createdAt createdBySubject confirmedAt confirmedBySubject manifestSha256 members documents")||!text(ver.id)||!number(ver.number)||ver.number<1||!nullable(ver.reason)||!date(ver.createdAt)||!text(ver.createdBySubject)||!(ver.confirmedAt===null||date(ver.confirmedAt))||!nullable(ver.confirmedBySubject)||!(ver.manifestSha256===null||hash(ver.manifestSha256))||!Array.isArray(ver.members)||!Array.isArray(ver.documents)||!unique(ver.members.map(m=>m?.structureId))||!unique(ver.documents.map(d=>d?.documentId)))return fail();
   for(const m of ver.members)if(!exact(m,"structureId code confirmed")||!f.structures.some(s=>s.structureId===m.structureId)||!text(m.code)||typeof m.confirmed!=="boolean")return fail();
   for(const d of ver.documents)if(!exact(d,"documentId category version state name sizeBytes sha256 uploadedAt uploadedBySubject contentType")||!text(d.documentId)||!Object.hasOwn(filingCategories,d.category)||!number(d.version)||d.version<1||!["Current","Replaced","Withdrawn"].includes(d.state)||!text(d.name)||!number(d.sizeBytes)||d.sizeBytes<1||!hash(d.sha256)||!date(d.uploadedAt)||!text(d.uploadedBySubject)||!(d.contentType===null||(text(d.contentType)&&d.contentType.length<=255&&!/[\r\n]/.test(d.contentType))))return fail();
   if(ver.confirmedAt&&(!ver.confirmedBySubject||!ver.manifestSha256||ver.members.length!==f.structures.length||ver.members.some(m=>!m.confirmed)))return fail();
  }
  if(f.blockedReason&&f.canModify)return fail();
  for(const h of f.history)if(!exact(h,"action at actorSubject")||!["Save","Upload","Withdraw","Confirm","Amend"].includes(h.action)||!date(h.at)||!text(h.actorSubject))return fail();
 }
 return v;
}
