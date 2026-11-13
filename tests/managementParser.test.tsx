import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OverviewPage from "@/app/(app)/management/page";
import TasksPage from "@/app/(app)/management/tasks/page";
import { parseManagementOverview, parseManagementTasks } from "@/features/management/parser";
import { ApiError } from "@/lib/api/apiError";
import { mockBackend, renderOperational } from "./operationalFixtures";
import { manager, managementTask, overview } from "./managementFixtures";
import { datasetFixture } from "./managementDatasetFixtures";
import type { TaskArea, TaskType } from "@/features/tasks/types";
import { managementOverviewResponse } from "./managementOverviewResponse";

// DTO-shaped synthetic coverage of every current ProjectTaskType/OperationalArea.
// Task fixtures follow the Backend DTO; overview also has an exact browser capture below.
const untracked: [TaskType, TaskArea][] = [
 ["RegisterInitialDeposit", "Accounting"], ["TakeMeasurements", "Installation"],
 ["CorrectDepositReceipts", "Commercial"], ["PrepareOpeningRecord", "Engineering"],
 ["PresentOpeningRecord", "Commercial"], ["ReviewOpeningRecord", "Engineering"],
 ["FileOpeningRecord", "Engineering"], ["EngineeringPackage", "Engineering"],
];
const quotation = ["PrepareQuotation", "ReviewQuotation", "PresentQuotationToClient"] as const;
const tasks = untracked.map(([type,area],index)=>({...managementTask,taskId:`0000000${index+1}-1111-4111-8111-111111111111`,projectName:`Proyecto anonimizado ${index+1}`,type,area,quotationRound:null,status:"Pending" as const,startedAt:null,completedAt:null,deadlineAt:null,wasOverdue:null,leadTimeStatus:"NotStarted" as const}));
const engineeringOverview = {
 ...overview,
 areas: [...overview.areas,{area:"Engineering",pending:2,inProgress:1,completed:3,overdue:0,dueToday:0,dueSoon:0}],
 attention:{total:1,items:[{...overview.attention.items[0],projectName:"Proyecto anonimizado",area:"Engineering",taskType:"PrepareOpeningRecord",taskStatus:"InProgress",startedAt:"2026-11-12T15:38:33.525747Z"}]},
};
describe("current Management DTO compatibility",()=>{
 it("accepts the exact anonymized overview HTTP 200 without ApiError 502",()=>{
  expect(parseManagementOverview(managementOverviewResponse)).toEqual(managementOverviewResponse);
 });
 it("accepts Engineering in both summaries and attention without changing counts or dates",()=>{
  expect(parseManagementOverview(engineeringOverview)).toEqual(engineeringOverview);
 });
 it.each(["Commercial","Budgets","Accounting","Installation","Engineering"])("accepts the real operational area %s",area=>{
  expect(parseManagementOverview({...engineeringOverview,areas:[{...engineeringOverview.areas[0],area}]}).areas[0].area).toBe(area);
 });
 it.each(untracked)("accepts null quotationRound for %s in %s",(type,area)=>{
  const task={...tasks[0],type,area};expect(parseManagementTasks([task])).toEqual([task]);
 });
 it.each(quotation)("retains positive rounds for %s",type=>{
  expect(parseManagementTasks([{...managementTask,type,quotationRound:2}])[0].quotationRound).toBe(2);
 });
 it.each(untracked)("rejects a fabricated round for non-quotation task %s",(type,area)=>{
  expect(()=>parseManagementTasks([{...managementTask,type,area,quotationRound:1}])).toThrow(ApiError);
 });
 it.each(quotation)("rejects missing/null/invalid rounds for quotation task %s",type=>{
  for(const quotationRound of [undefined,null,0,-1,1.5,"1",Number.MAX_SAFE_INTEGER+1])expect(()=>parseManagementTasks([{...managementTask,type,quotationRound}])).toThrow(ApiError);
 });
 it.each(["Production","OperationsHead","UnknownArea",5,null])("rejects non-contract area %s everywhere",area=>{
  expect(()=>parseManagementOverview({...engineeringOverview,areas:[{...engineeringOverview.areas[0],area}]})).toThrow(ApiError);
  expect(()=>parseManagementOverview({...engineeringOverview,attention:{total:1,items:[{...engineeringOverview.attention.items[0],area}]}})).toThrow(ApiError);
  expect(()=>parseManagementTasks([{...tasks[0],area}])).toThrow(ApiError);
 });
 it("preserves closed object validation, nonnegative integer counts, statuses and aware dates",()=>{
  expect(()=>parseManagementOverview({...engineeringOverview,unknown:true})).toThrow(ApiError);
  expect(()=>parseManagementOverview({...engineeringOverview,tasks:{pending:0,inProgress:0}})).toThrow(ApiError);
  for(const pending of [-1,0.2,"2"])expect(()=>parseManagementOverview({...engineeringOverview,tasks:{...overview.tasks,pending}})).toThrow(ApiError);
  for(const patch of [{assignedAt:null},{assignedAt:"2026-11-13T12:00:00"},{completedAt:"invalid"},{wasOverdue:"false"},{status:"Cancelled"},{leadTimeStatus:"CalculatedHere"},{unknown:true}])expect(()=>parseManagementTasks([{...tasks[0],...patch}])).toThrow(ApiError);
 });
 it("keeps the overview's actual nullable attention fields valid",()=>{
  const value={...engineeringOverview,attention:{total:1,items:[{...engineeringOverview.attention.items[0],sgCode:null,deadlineAt:null,startedAt:null}]}};
  expect(parseManagementOverview(value)).toEqual(value);
 });
 it("renders dashboard HTTP 200 containing Engineering instead of an ApiError 502",async()=>{
  const engineering={...managementTask,taskId:"engineering-task",area:"Engineering" as const,type:"EngineeringPackage",status:"InProgress" as const,leadTimeStatus:"OnTrack" as const,quotationRound:null};
  const fetch=mockBackend(path=>path==="management/dashboard-dataset"?{...datasetFixture,tasks:[...datasetFixture.tasks,engineering]}:Response.json({}));
  renderOperational(<OverviewPage/>,manager);
  expect(await screen.findByRole("heading",{name:"Seguimiento por proyecto"})).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();expect(fetch.mock.calls[0][0]).toBe("/api/backend/management/dashboard-dataset");
 });
 it("renders tasks HTTP 200 across current workflows and filters Engineering",async()=>{
  const fetch=mockBackend(()=>Response.json(tasks));renderOperational(<TasksPage/>,manager);await screen.findByRole("table");
  expect(within(screen.getByRole("table")).getAllByRole("link")).toHaveLength(8);
  await userEvent.selectOptions(screen.getByLabelText("Área"),"Engineering");
  expect(within(screen.getByRole("table")).getAllByRole("link")).toHaveLength(4);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();expect(fetch.mock.calls[0][0]).toBe("/api/backend/management/tasks");
 });
});
