import {beforeEach,expect,it,vi} from "vitest";
import {screen,waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {OpeningFilingsPage} from "@/features/engineering/OpeningFilingsPage";
import {parseFilings,type Filings,type FilingCommand} from "@/features/engineering/filingContracts";
import {openingFilingMethod,isBackendPath} from "@/lib/api/backendPath";
import {mockBackend,renderOperational,deferred} from "./operationalFixtures";
import {user} from "./fixtures";
import {engineeringState,engineeringId as id,engineeringDate as date} from "./engineeringFixtures";
const engineer={...user,roles:["Engineering" as const]};
const task="44444444-4444-4444-8444-444444444444";
function state():Filings{return {projectName:"Synthetic project",sgCode:"SG120",filings:[{id,taskId:task,acceptanceId:id,openingRecordId:id,actaNumber:1,presentedDocumentId:id,signedDocumentId:id,acceptedAt:date,responsibleSubject:user.subject,status:"Pending",number:null,revision:0,canModify:true,blockedReason:null,structures:engineeringState.structures.map(r=>({structureId:r.structure.id,submissionId:id,evidenceVersion:1,source:r.structure})),versions:[],history:[]}]};}
beforeEach(()=>vi.spyOn(window,"confirm").mockReturnValue(true));
it("opens the assigned task with eight multi-file categories and saves exact OP identities",async()=>{
 const data=state();const gate=deferred<Response>();const fetch=mockBackend((_,init)=>init.method==="POST"?gate.promise:data);
 renderOperational(<OpeningFilingsPage projectId={id} taskId={task}/>,engineer);
 await userEvent.type(await screen.findByLabelText(/N.mero de radicado/),"1162001");
 const ops=screen.getAllByLabelText(/C.digo OP/);await userEvent.type(ops[0],"OP1");await userEvent.click(screen.getAllByRole("checkbox")[0]);
 expect(screen.getAllByLabelText(/A.adir PDF/)).toHaveLength(7);for(const input of screen.getAllByLabelText(/A.adir PDF/)){expect(input).toHaveAttribute("multiple");expect(input).toHaveAttribute("accept",".pdf,application/pdf");}
 const additional=screen.getByLabelText(/A.adir archivos/);expect(additional).toHaveAttribute("multiple");expect(additional).not.toHaveAttribute("accept");
 await userEvent.click(screen.getByRole("button",{name:"Guardar borrador"}));expect(screen.getByRole("button",{name:"Guardar borrador"})).toBeDisabled();
 const write=fetch.mock.calls.find(c=>c[1].method==="POST")!;const body=JSON.parse(write[1].body as string) as FilingCommand;
 expect(body).toMatchObject({action:"Save",number:"1162001",members:[{structureId:data.filings[0].structures[0].structureId,code:"OP1",confirmed:true}]});
 gate.resolve(new Response(null,{status:204}));await waitFor(()=>expect(screen.getByRole("button",{name:"Guardar borrador"})).toBeEnabled());
});
it.each(["Management","CommercialAdvisor"] as const)("keeps %s read only despite server capability",async role=>{
 mockBackend(()=>state());renderOperational(<OpeningFilingsPage projectId={id} taskId={task}/>,{...user,roles:[role],isManagement:role==="Management"});
 await screen.findByRole("button",{name:"Descargar PDF firmado"});expect(screen.queryByRole("button",{name:"Guardar borrador"})).not.toBeInTheDocument();expect(screen.queryByLabelText(/C.digo OP/)).not.toBeInTheDocument();
});
it("checks subject independently of email and blocks other engineers",async()=>{
 mockBackend(()=>state());renderOperational(<OpeningFilingsPage projectId={id} taskId={task}/>,{...engineer,subject:"other-synthetic-engineer"});
 await screen.findByRole("button",{name:"Descargar PDF firmado"});expect(screen.queryByRole("button",{name:"Guardar borrador"})).not.toBeInTheDocument();
});
it("keeps the same request key after an uncertain HTTP response",async()=>{
 const data=state();const commands:FilingCommand[]=[];mockBackend((_,init)=>{if(init.method==="POST"){commands.push(JSON.parse(init.body as string));return commands.length===1?Response.json({}, {status:503}):new Response(null,{status:204});}return data;});
 renderOperational(<OpeningFilingsPage projectId={id} taskId={task}/>,engineer);await userEvent.type(await screen.findByLabelText(/N.mero de radicado/),"1162001");await userEvent.click(screen.getByRole("button",{name:"Guardar borrador"}));await userEvent.click(await screen.findByRole("button",{name:/Reintentar la misma/}));await waitFor(()=>expect(commands).toHaveLength(2));expect(commands[0]).toEqual(commands[1]);
});
it("uploads several PDFs progressively without inventing a new filing",async()=>{
 const data=state();const uploads:FormData[]=[];const revisions:number[]=[];mockBackend(async(_,init)=>{if(init.body instanceof FormData){uploads.push(init.body);const text=await (init.body.get("manifest") as Blob).text();revisions.push(JSON.parse(text).expectedRevision);data.filings[0].revision++;return new Response(null,{status:204});}return data;});
 renderOperational(<OpeningFilingsPage projectId={id} taskId={task}/>,engineer);const inputs=await screen.findAllByLabelText(/A.adir PDF/);await userEvent.upload(inputs[1],[new File(["pdf1"],"one.pdf",{type:"application/pdf"}),new File(["pdf2"],"two.pdf",{type:"application/pdf"})]);await waitFor(()=>expect(uploads).toHaveLength(2));expect(revisions).toEqual([0,1]);expect((uploads[0].get("file") as File).name).toBe("one.pdf");expect((uploads[1].get("file") as File).name).toBe("two.pdf");
});
it("lists independent filings and links to each task",async()=>{
 const data=state();data.filings.push({...structuredClone(data.filings[0]),id:task,taskId:id});mockBackend(()=>data);renderOperational(<OpeningFilingsPage projectId={id}/>,engineer);
 const links=await screen.findAllByRole("link",{name:/Abrir radicaci/});expect(links).toHaveLength(2);expect(links[0]).toHaveAttribute("href",`/projects/${id}/opening-filings?task=${task}`);expect(links[1]).toHaveAttribute("href",`/projects/${id}/opening-filings?task=${id}`);
});
it("rejects open contracts, foreign structures and duplicate filing identities",()=>{
 expect(parseFilings(state()).filings).toHaveLength(1);expect(()=>parseFilings({...state(),secret:"unknown"})).toThrow();const duplicate=state();duplicate.filings.push(duplicate.filings[0]);expect(()=>parseFilings(duplicate)).toThrow();const foreign=state();foreign.filings[0].structures[0].structureId="foreign";expect(()=>parseFilings(foreign)).toThrow();
});
it("closes methods and routes for filing operations",()=>{
 const root=["projects",id,"opening-filings"];expect(openingFilingMethod(root)).toBe("GET");expect(openingFilingMethod([...root,id,"commands"])).toBe("POST");expect(openingFilingMethod([...root,id,"versions",id,"documents",id,"download"])).toBe("GET");for(const path of [[...root,"admin"],[...root,id,"delete"],[...root,id,"versions",id,"commands"]])expect(isBackendPath(path)).toBe(false);
});

it("uploads mixed additional formats progressively without filtering or interpreting bytes",async()=>{
 const data=state();const forms:FormData[]=[];mockBackend((_,init)=>{if(init.body instanceof FormData){forms.push(init.body);data.filings[0].revision++;return new Response(null,{status:204});}return data;});
 renderOperational(<OpeningFilingsPage projectId={id} taskId={task}/>,engineer);
 const files=[new File(["<script>throw 1</script>"],"source.html",{type:"text/html"}),new File([new Uint8Array([0,255,7])],"drawing.dwg",{type:"application/x-custom"}),new File(["opaque"],"no-extension")];
 await userEvent.upload(await screen.findByLabelText(/A.adir archivos/),files);await waitFor(()=>expect(forms).toHaveLength(3));
 for(let i=0;i<files.length;i++){const sent=forms[i].get("file") as File;expect(sent.name).toBe(files[i].name);expect(sent.type).toBe(files[i].type);expect(await sent.arrayBuffer()).toEqual(await files[i].arrayBuffer());expect(JSON.parse(await (forms[i].get("manifest") as Blob).text())).toMatchObject({category:"Additional",expectedRevision:i});}
});
it("keeps arbitrary-format replacements only on the additional card and renders declared MIME as metadata",async()=>{
 const data=state();data.filings[0].status="Preparing";data.filings[0].versions=[{id,number:1,reason:null,createdAt:date,createdBySubject:user.subject,confirmedAt:null,confirmedBySubject:null,manifestSha256:null,members:[],documents:[{documentId:id,category:"Additional",version:1,state:"Current",name:"original.html",sizeBytes:3,sha256:"A".repeat(64),uploadedAt:date,uploadedBySubject:user.subject,contentType:"text/html"}]}];
 const forms:FormData[]=[];mockBackend((_,init)=>{if(init.body instanceof FormData){forms.push(init.body);return new Response(null,{status:204});}return data;});renderOperational(<OpeningFilingsPage projectId={id} taskId={task}/>,engineer);
 const replace=await screen.findByLabelText("Sustituir original.html");expect(replace).not.toHaveAttribute("accept");expect(screen.getByText(/text\/html/)).toBeInTheDocument();
 await userEvent.upload(replace,new File(["new"],"replacement.exe",{type:"application/x-msdownload"}));await waitFor(()=>expect(forms).toHaveLength(1));expect(JSON.parse(await (forms[0].get("manifest") as Blob).text())).toMatchObject({category:"Additional",replacesDocumentId:id});
});
