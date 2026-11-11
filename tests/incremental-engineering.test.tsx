import {beforeEach,expect,it,vi} from "vitest";
import {screen,within,waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {EngineeringPanel} from "@/features/engineering/EngineeringPanel";
import {parseEngineering} from "@/features/engineering/contracts";
import type {EngineeringActa} from "@/features/engineering/workspaceContracts";
import {incrementalEngineering,engineeringId as id,engineeringDate as date,engineeringDoc} from "./engineeringFixtures";
import {mockBackend,renderOperational,deferred} from "./operationalFixtures";
import {user} from "./fixtures";
const engineer={...user,roles:["Engineering" as const]};
beforeEach(()=>{Object.defineProperty(HTMLDialogElement.prototype,"showModal",{configurable:true,value(){this.setAttribute("open","");}});Object.defineProperty(HTMLDialogElement.prototype,"close",{configurable:true,value(){this.removeAttribute("open");}});});
function actaState(){const s=incrementalEngineering();const a:EngineeringActa={id:"44444444-4444-4444-8444-444444444444",number:1,status:"Ready",responsibleSubject:user.subject,createdBySubject:user.subject,createdAt:date,revision:2,canModify:true,structures:s.workspace!.packages[0].structures,scopeHash:"A".repeat(64),currentDocumentId:engineeringDoc.id,documents:[{file:{document:engineeringDoc,version:1,sha256:"B".repeat(64)},structures:s.workspace!.packages[0].structures,matchesManifest:true}],confirmedAt:null,confirmedBySubject:null};s.workspace!.actas=[a];s.structures=s.structures.map(r=>({...r,completed:true,changedAt:date,work:{...r.work!,openingRecordId:a.id}}));s.completed=2;s.pending=0;s.progress=100;return s;}
it("creates a package only after confirmation and sends exact evidence and configured subject",async()=>{
 const state=incrementalEngineering();const gate=deferred<Response>();const fetch=mockBackend((_p,init)=>init.method==="POST"?gate.promise:state);
 renderOperational(<EngineeringPanel projectId={id} onRefresh={vi.fn()}/>,engineer);
 const selection=await screen.findAllByRole("checkbox",{name:/Seleccionar V1/});await userEvent.click(selection[0]);await userEvent.selectOptions(screen.getByRole("combobox",{name:"Responsable de paquete o Acta"}),"synthetic-engineer-two");
 await userEvent.click(screen.getByRole("button",{name:"Crear paquete de trabajo"}));expect(fetch.mock.calls.filter(c=>c[1].method==="POST")).toHaveLength(0);
 await userEvent.click(within(screen.getByRole("dialog")).getByRole("button",{name:/Confirmar operaci/}));
 const post=fetch.mock.calls.find(c=>c[1].method==="POST")!;expect(JSON.parse(post[1].body as string)).toMatchObject({action:"CreatePackage",subject:"synthetic-engineer-two",expectedRevision:0,structures:[{structureId:state.structures[0].structure.id,submissionId:id,evidenceVersion:1}]});
 expect(screen.getByRole("button",{name:"Crear paquete de trabajo"})).toBeDisabled();gate.resolve(new Response(null,{status:204}));await waitFor(()=>expect(screen.getByRole("button",{name:"Crear paquete de trabajo"})).toBeDisabled());
});
it("assigned worker checks its own structures even when global coordinator differs",async()=>{
 const state=incrementalEngineering();state.responsibleSubject="synthetic-coordinator";state.workspace!.canManagePackages=false;state.workspace!.assignableSubjects=[];state.structures[1].work!.canModify=false;
 const fetch=mockBackend((_p,init)=>{if(init.method==="PUT"){state.structures[0].completed=true;state.completed=1;state.pending=1;state.progress=50;return new Response(null,{status:204});}return state;});
 renderOperational(<EngineeringPanel projectId={id} onRefresh={vi.fn()}/>,engineer);
 const checks=await screen.findAllByRole("checkbox",{name:/Estructura revisada/});expect(checks[0]).toBeEnabled();expect(checks[1]).toBeDisabled();await userEvent.click(checks[0]);await waitFor(()=>expect(fetch.mock.calls.some(c=>c[1].method==="PUT")).toBe(true));expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
});
it("read-only roles see confirmed documents without mutation controls",async()=>{
 const state=actaState();state.canModify=false;state.workspace!.canManagePackages=false;state.workspace!.assignableSubjects=[];state.workspace!.actas[0]={...state.workspace!.actas[0],status:"Confirmed",canModify:false,confirmedAt:date,confirmedBySubject:user.subject};state.structures.forEach(r=>{r.work!.canModify=false;});
 mockBackend(()=>state);renderOperational(<EngineeringPanel projectId={id} onRefresh={vi.fn()}/>,{...user,roles:["Management"]});
 expect(await screen.findByText(/Confirmada por Ingenier/)).toBeInTheDocument();expect(screen.getByRole("button",{name:/Descargar Acta 1/})).toBeInTheDocument();expect(screen.queryByRole("button",{name:"Confirmar Acta 1"})).not.toBeInTheDocument();expect(screen.queryByLabelText("PDF para Acta 1")).not.toBeInTheDocument();
});
it("freezes confirmation on retry after uncertain HTTP result and rereads official state",async()=>{
 const state=actaState();const bodies:string[]=[];mockBackend((_p,init)=>{if(init.method==="POST"){bodies.push(init.body as string);if(bodies.length===1)throw new TypeError("network");state.structures.forEach(r=>{r.work!.canModify=false;});state.workspace!.actas[0]={...state.workspace!.actas[0],status:"Confirmed",canModify:false,confirmedAt:date,confirmedBySubject:user.subject};return new Response(null,{status:204});}return state;});
 renderOperational(<EngineeringPanel projectId={id} onRefresh={vi.fn()}/>,engineer);await userEvent.click(await screen.findByRole("button",{name:"Confirmar Acta 1"}));await userEvent.click(within(screen.getByRole("dialog")).getByRole("button",{name:/Confirmar operaci/}));await userEvent.click(await screen.findByRole("button",{name:/Reintentar operaci/}));await screen.findByText(/Confirmada por Ingenier/);expect(bodies).toHaveLength(2);expect(bodies[1]).toBe(bodies[0]);
});
it("uploads an Acta-specific PDF with frozen declared scope and preserved bytes",async()=>{
 const state=actaState();const fetch=mockBackend(()=>state);renderOperational(<EngineeringPanel projectId={id} onRefresh={vi.fn()}/>,engineer);
 const file=new File(["%PDF-synthetic"],"version.pdf",{type:"application/pdf"});await userEvent.upload(await screen.findByLabelText("PDF para Acta 1"),file);await userEvent.click(screen.getByRole("button",{name:"Declarar alcance y cargar PDF de Acta 1"}));await userEvent.click(within(screen.getByRole("dialog")).getByRole("button",{name:/Confirmar operaci/}));
 await waitFor(()=>expect(fetch.mock.calls.some(c=>c[1].method==="POST")).toBe(true));const [path,init]=fetch.mock.calls.find(c=>c[1].method==="POST")!;expect(path).toContain(`/engineering/opening-records/${state.workspace!.actas[0].id}/documents?`);expect(path).toContain(`scopeHash=${"A".repeat(64)}`);expect(init.body).toBeInstanceOf(FormData);expect(Array.from((init.body as FormData).values()).some(v=>v instanceof File&&v.name==="version.pdf"&&v.size===file.size)).toBe(true);
});
it("rejects unknown workspace fields, foreign evidence, duplicate membership and confirmed writable states",()=>{
 const state=actaState();expect(parseEngineering(state,id)).toEqual(state);
 for(const mutate of [(s:typeof state)=>Object.assign(s.workspace!,{extra:{secret:"x"}}),(s:typeof state)=>{s.workspace!.actas[0].structures=[{structureId:"foreign",submissionId:id,evidenceVersion:1}];},(s:typeof state)=>{s.workspace!.actas.push({...s.workspace!.actas[0],id:"another"});},(s:typeof state)=>{s.workspace!.actas[0].status="Confirmed";}]){const copy=structuredClone(state);mutate(copy);expect(()=>parseEngineering(copy,id)).toThrow();}
});
it("409 refreshes state and requires a new deliberate operation without automatic write retry",async()=>{
 const state=actaState();let writes=0;mockBackend((_p,init)=>{if(init.method==="POST"){writes++;return Response.json({code:"EngineeringRevisionConflict"},{status:409});}return state;});renderOperational(<EngineeringPanel projectId={id} onRefresh={vi.fn()}/>,engineer);
 await userEvent.click(await screen.findByRole("button",{name:"Confirmar Acta 1"}));await userEvent.click(within(screen.getByRole("dialog")).getByRole("button",{name:/Confirmar operaci/}));await screen.findByRole("alert");expect(writes).toBe(1);expect(screen.queryByRole("button",{name:/Reintentar operaci/})).not.toBeInTheDocument();
});

it("renders Acta responsibility without granting ownership of the rest of its package",async()=>{
 const s=actaState();const a=s.workspace!.actas[0];a.structures=a.structures.slice(0,1);a.documents[0].structures=a.structures;
 s.workspace!.packages[0].responsibleSubject="another-synthetic-engineer";s.workspace!.canManagePackages=false;s.workspace!.assignableSubjects=[];
 s.structures[1].work={...s.structures[1].work!,responsibleSubject:"another-synthetic-engineer",openingRecordId:null,canModify:false};
 expect(parseEngineering(s,id).workspace!.actas[0].responsibleSubject).toBe(user.subject);mockBackend(()=>s);renderOperational(<EngineeringPanel projectId={id} onRefresh={vi.fn()}/>,engineer);
 const checks=await screen.findAllByRole("checkbox",{name:/Estructura revisada/});expect(checks[0]).toBeEnabled();expect(checks[1]).toBeDisabled();expect(screen.queryByRole("button",{name:"Crear Acta de Vanos"})).not.toBeInTheDocument();
});
it("head explicitly selects and confirms an Acta reassignment",async()=>{
 const s=actaState();const fetch=mockBackend((_,init)=>init.method==="POST"?new Response(null,{status:204}):s);renderOperational(<EngineeringPanel projectId={id} onRefresh={vi.fn()}/>,engineer);
 await userEvent.selectOptions(await screen.findByRole("combobox",{name:"Responsable de paquete o Acta"}),"synthetic-engineer-two");await userEvent.click(screen.getByRole("button",{name:/Reasignar Acta 1/}));expect(fetch.mock.calls.filter(c=>c[1].method==="POST")).toHaveLength(0);
 await userEvent.click(within(screen.getByRole("dialog")).getByRole("button",{name:/Confirmar operaci/}));await waitFor(()=>expect(fetch.mock.calls.some(c=>c[1].method==="POST")).toBe(true));
 expect(JSON.parse(fetch.mock.calls.find(c=>c[1].method==="POST")![1].body as string)).toMatchObject({action:"AssignActa",subject:"synthetic-engineer-two",targetId:s.workspace!.actas[0].id,expectedRevision:2,structures:null});
});
