import type { ApiClient } from "@/lib/api/types";
import {parseFilings,type FilingCommand,type FilingUpload} from "./filingContracts";
const root=(id:string)=>`projects/${id}/opening-filings`;
export const filingService={
 read:async(api:ApiClient,id:string,signal:AbortSignal)=>parseFilings(await api.get<unknown>(root(id),{signal})),
 command:(api:ApiClient,id:string,filing:string,c:FilingCommand,signal:AbortSignal)=>api.post<unknown>(`${root(id)}/${filing}/commands`,{...c,members:c.members?.map(m=>({...m}))??null},{signal}),
 upload:(api:ApiClient,id:string,filing:string,manifest:FilingUpload,file:File,signal:AbortSignal)=>{const body=new FormData();body.append("manifest",new Blob([JSON.stringify(manifest)],{type:"application/json"}));body.append("file",file);return api.upload<unknown>(`${root(id)}/${filing}/documents`,body,{signal});},
 download:(api:ApiClient,id:string,filing:string,version:string,doc:string,signal:AbortSignal)=>api.downloadStream(`${root(id)}/${filing}/versions/${version}/documents/${doc}/download`,{signal}),
};
