import type { ApiClient } from "@/lib/api/types";
import { parseCommercialOpening, type CommercialCommand, type CommercialUpload } from "./commercialOpeningContracts";
const root=(id:string)=>`projects/${id}/incremental-opening-records`;
export const commercialOpeningService={
 read:async(api:ApiClient,id:string,signal:AbortSignal)=>parseCommercialOpening(await api.get<unknown>(root(id),{signal}),id),
 command:(api:ApiClient,id:string,acta:string,command:CommercialCommand,signal:AbortSignal)=>api.post<unknown>(`${root(id)}/${acta}/commands`,{...command,...(command.structures?{structures:command.structures.map(s=>({...s}))}:{})},{signal}),
 upload:(api:ApiClient,id:string,acta:string,round:string,manifest:CommercialUpload,file:File,signal:AbortSignal)=>{
  const body=new FormData();body.append("manifest",new Blob([JSON.stringify(manifest)],{type:"application/json"}));body.append("file",file);
  return api.upload<unknown>(`${root(id)}/${acta}/rounds/${round}/documents`,body,{signal});
 },
 download:(api:ApiClient,id:string,acta:string,doc:string,signal:AbortSignal)=>api.downloadStream(`${root(id)}/${acta}/documents/${doc}/download`,{signal}),
};
