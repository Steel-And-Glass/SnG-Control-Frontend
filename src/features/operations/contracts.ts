import { ApiError } from "@/lib/api/apiError";

// Project only the P2.1/P2.3 DTOs. Review state is numeric inside Backend JsonElement.
export const materials = ["Glass", "AluminumProfile", "MicroperforatedSheet"] as const;
export type Material = typeof materials[number];
export type Route = "GLASS" | "ALUMINUM";
export interface Values {
  material: Material | null; route: Route | null; reference: string | null; description: string | null;
  measure: number | null; cutDimension: number | null; width: number | null; height: number | null;
  unit: string | null; leftAngle: number | null; rightAngle: number | null; quantity: number | null;
}
export interface Preparation { id: string; projectId: string; filingId: string; releaseVersionId: string; manifestSha256: string; createdAt: string; state: string; revision: number; extractorVersion: string | null }
export interface Release { versionId: string; projectId: string; filingId: string; confirmedAt: string; manifestSha256: string; preparationId: string | null }
export interface Member { structureId: string; op: string }
export interface SourceDocument { documentId: string; sha256: string; category: string }
export interface PreparationDetail { preparation: Preparation; members: Member[]; documents: SourceDocument[] }
export interface Review { id: string; preparationId: string; extractionJobId: string; sourceRevisionId: string; number: number; revision: number; dataRevision: number; state: 1 | 2 | 3; createdAt: string; createdBySubject: string }
export interface Original extends Values { page: number | null; sourceRow: string | null; sheet: string | null; originalPieceId: string | null; originalDimensions: string | null; declaredMaterial: string | null; coordinates: string | null; specifications: string | null; manual: boolean }
export interface Row { id: string; candidateId: string | null; structureId: string; op: string; documentId: string; documentSha256: string; original: Original; values: Values; reviewed: boolean; excluded: boolean }
export interface Issue { id: string; code: string; category: "HumanReview" | "FormalDocumentResolution" | "IntegrityOrScope"; evidence: string; resolved: boolean }
export interface Attachment { id: string; name: string; contentType: string | null; sizeBytes: number; sha256: string; at: string; actor: string }
export interface Approval { id: string; revision: number; sha256: string; actor: string; at: string }
export interface ReviewView { review: Review; rows: Row[]; issues: Issue[]; approval: Approval | null; origin: { projectId: string; filingId: string; releaseVersionId: string; manifestSha256: string; extractorVersion: string }; attachments: Attachment[] }
export interface Job { id: string; state: string; revision: number; generation: number; extractorVersion: string; errorCode: string | null; report: string }
export interface History { id: string; reviewId: string; action: string; reason: string; at: string; actor: string; detail: string }
export interface Evidence { documentId: string | null; attachmentId: string | null; locator: string; observation: string }
export type Action = "Start" | "Edit" | "Add" | "Exclude" | "Restore" | "Resolve" | "Note" | "RecordConflict" | "Approve" | "Reextract";
export interface Command { requestKey: string; expectedRevision: number; action: Action; reason: string; reviewId?: string; extractionJobId?: string; rowId?: string; values?: Values; structureId?: string; op?: string; sourceDocumentId?: string; issueId?: string; conflictCode?: string; evidence?: Evidence }
export interface CommandResult { reviewId: string; revision: number; approvalId: string | null; extractionJobId: string | null }
const fail = (): never => { throw new ApiError(502); };
const obj = (v: unknown): Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : fail();
const str = (v: unknown): string => typeof v === "string" && v.length <= 4_000_000 ? v : fail();
const id = (v: unknown): string => typeof v === "string" && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v) ? v : fail();
const num = (v: unknown): number => typeof v === "number" && Number.isFinite(v) ? v : fail();
const integer = (v: unknown): number => Number.isSafeInteger(v) && num(v) >= 0 ? num(v) : fail();
const bool = (v: unknown): boolean => typeof v === "boolean" ? v : fail();
const nullable = <T>(v: unknown, parse: (v: unknown) => T): T | null => v === null ? null : parse(v);
const enumeration = <T extends string | number>(v: unknown, values: readonly T[]): T => values.includes(v as T) ? v as T : fail();
const date = (v: unknown) => Number.isFinite(Date.parse(str(v))) ? str(v) : fail();
const hash = (v: unknown) => /^[a-f0-9]{64}$/i.test(str(v)) ? str(v) : fail();
export function array<T>(v: unknown, parse: (v: unknown) => T, max = 10000): T[] { return Array.isArray(v) && v.length <= max ? v.map(parse) : fail(); }
// Evidence/snapshots are inert text, never HTML, URLs, script or commands.
const textJson = (v: unknown) => JSON.stringify(v, null, 2) ?? "";
export function parseValues(v: unknown): Values {
  const o = obj(v);
  return { material: nullable(o.material, x => enumeration(x, materials)), route: nullable(o.route, x => enumeration(x, ["GLASS", "ALUMINUM"] as const)),
    reference: nullable(o.reference, str), description: nullable(o.description, str), unit: nullable(o.unit, str),
    measure: nullable(o.measure, num), cutDimension: nullable(o.cutDimension, num), width: nullable(o.width, num), height: nullable(o.height, num),
    leftAngle: nullable(o.leftAngle, num), rightAngle: nullable(o.rightAngle, num), quantity: nullable(o.quantity, integer) };
}
export const emptyValues: Values = { material: null, route: null, reference: null, description: null, unit: null, measure: null, cutDimension: null, width: null, height: null, leftAngle: null, rightAngle: null, quantity: null };
export function parsePreparation(v: unknown): Preparation { const o=obj(v); return { id:id(o.id),projectId:id(o.projectId),filingId:id(o.filingId),releaseVersionId:id(o.releaseVersionId),manifestSha256:hash(o.manifestSha256),createdAt:date(o.createdAt),state:enumeration(o.state,["PendingExtraction","Extracted","Blocked","ReadyForReview"]),revision:integer(o.revision),extractorVersion:nullable(o.extractorVersion,str) }; }
export function parseRelease(v: unknown): Release { const o=obj(v); return { versionId:id(o.versionId),projectId:id(o.projectId),filingId:id(o.filingId),confirmedAt:date(o.confirmedAt),manifestSha256:hash(o.manifestSha256),preparationId:nullable(o.preparationId,id) }; }
export function parseDetail(v: unknown): PreparationDetail { const o=obj(v); return {preparation:parsePreparation(o.preparation),members:array(o.members,v=>{const m=obj(v);return {structureId:id(m.structureId),op:str(m.op)};}),documents:array(o.documents,v=>{const d=obj(v);return {documentId:id(d.documentId),sha256:hash(d.sha256),category:str(d.category)};})}; }
export function parseReview(v: unknown): Review { const o=obj(v); return {id:id(o.id),preparationId:id(o.preparationId),extractionJobId:id(o.extractionJobId),sourceRevisionId:id(o.sourceRevisionId),number:integer(o.number),revision:integer(o.revision),dataRevision:integer(o.dataRevision),state:enumeration(o.state,[1,2,3] as const),createdAt:date(o.createdAt),createdBySubject:str(o.createdBySubject)}; }
export function parseAttachment(v: unknown): Attachment {const o=obj(v);return {id:id(o.id),name:str(o.name),contentType:nullable(o.contentType,str),sizeBytes:integer(o.sizeBytes),sha256:hash(o.sha256),at:date(o.at),actor:str(o.actor)};}
function parseOriginal(v: unknown): Original {
  const o=obj(v);
  if(o.manual===true) return {...emptyValues,manual:true,page:null,sourceRow:null,sheet:null,originalPieceId:null,originalDimensions:null,declaredMaterial:null,coordinates:null,specifications:null};
  return {...parseValues({...o,route:o.proposedRoute}),manual:false,page:nullable(o.page,integer),sourceRow:str(o.sourceRow),sheet:nullable(o.sheet,str),originalPieceId:nullable(o.originalPieceId,str),originalDimensions:nullable(o.originalDimensions,str),declaredMaterial:nullable(o.declaredMaterial,str),coordinates:str(o.coordinatesJson),specifications:str(o.specificationsJson)};
}
export function parseView(v: unknown): ReviewView {
 const o=obj(v),origin=obj(o.origin);
 const result: ReviewView={review:parseReview(o.review),rows:array(o.rows,v=>{const r=obj(v);return {id:id(r.id),candidateId:nullable(r.candidateId,id),structureId:id(r.structureId),op:str(r.op),documentId:id(r.documentId),documentSha256:hash(r.documentSha256),original:parseOriginal(r.original),values:parseValues(r.values),reviewed:bool(r.reviewed),excluded:bool(r.excluded)};}),issues:array(o.issues,v=>{const i=obj(v);return {id:id(i.id),code:str(i.code),category:enumeration(i.category,["HumanReview","FormalDocumentResolution","IntegrityOrScope"] as const),evidence:textJson(i.evidence),resolved:bool(i.resolved)};}),approval:nullable(o.approval,v=>{const a=obj(v);return {id:id(a.id),revision:integer(a.revision),sha256:hash(a.sha256),actor:str(a.actor),at:date(a.at)};}),origin:{projectId:id(origin.projectId),filingId:id(origin.filingId),releaseVersionId:id(origin.releaseVersionId),manifestSha256:hash(origin.manifestSha256),extractorVersion:str(origin.extractorVersion)},attachments:array(o.attachments,parseAttachment,50)};
 if ((result.review.state===2)!==(result.approval!==null) || new Set(result.rows.map(r=>r.id)).size!==result.rows.length) fail();
 return result;
}
export function parseJob(v: unknown): Job {const o=obj(v);return {id:id(o.id),state:enumeration(o.state,["Queued","Running","Completed","Blocked","Failed"]),revision:integer(o.revision),generation:integer(o.generation),extractorVersion:str(o.extractorVersion),errorCode:nullable(o.errorCode,str),report:textJson(o.report)};}
export function parseHistory(v: unknown): History { const o=obj(v);return {id:id(o.id),reviewId:id(o.reviewId),action:str(o.action),reason:str(o.reason),at:date(o.at),actor:str(o.actor),detail:str(o.detailJson)}; }
export function parseResult(v: unknown): CommandResult {const o=obj(v);return {reviewId:id(o.reviewId),revision:integer(o.revision),approvalId:nullable(o.approvalId,id),extractionJobId:nullable(o.extractionJobId,id)};}
