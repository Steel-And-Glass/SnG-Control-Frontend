import type {CommercialState} from "@/features/engineering/commercialOpeningContracts";
import {engineeringId as id,engineeringDate as date,engineeringDoc as doc,engineeringState} from "./engineeringFixtures";
import {user} from "./fixtures";
export function commercialState():CommercialState {
 const structures=engineeringState.structures.map(r=>({structure:r.structure,submissionId:id,submissionNumber:1,sourceEvidenceVersion:1,evidenceVersion:1,evidenceDocumentId:doc.id,approval:"AwaitingApproval" as const,acceptanceId:null,revision:0}));
 return {projectId:id,serverNow:date,actas:[{id,number:1,engineerSubject:user.subject,confirmedAt:date,lastActivityAt:date,canReceive:false,
 rounds:[{id,number:1,status:"Presented",revision:1,taskId:id,documentId:doc.id,advisorSubject:user.subject,receivedAt:date,presentedAt:date,firstResponseAt:null,resolvedAt:null,supersededAt:null,elapsedSeconds:120,firstResponseSeconds:null,resolutionSeconds:null,canPresent:false,canRespond:true,structures}],
 reviews:[],documents:[{roundId:null,reviewId:null,kind:"ENGINEERING",version:1,sha256:"A".repeat(64),document:doc,structures:structures.map(r=>({structureId:r.structure.id,evidenceVersion:1,evidenceDocumentId:doc.id}))}],acceptances:[],history:[]}]};
}
