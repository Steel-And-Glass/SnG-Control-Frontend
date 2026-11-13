import type { ManagementDataset } from "@/features/management/dashboardDataset";
import type { ManagementTask } from "@/features/management/types";
import { managementTask } from "./managementFixtures";

// Wire-shaped dataset: exact decimals as strings, synthetic names only.
const task = (patch: Partial<ManagementTask>): ManagementTask => ({ ...managementTask, ...patch });

export const datasetTasks: ManagementTask[] = [
  task({ taskId: "task-overdue", area: "Budgets", status: "InProgress", leadTimeStatus: "Overdue", deadlineAt: "2026-11-10T22:00:00Z" }),
  task({ taskId: "task-today", projectId: "project-2", projectName: "Proyecto Sur", clientId: "client-2", clientName: "Cliente Sur",
    city: "Cali", sgCode: null, area: "Commercial", type: "ReviewQuotation", status: "Pending", startedAt: null,
    leadTimeStatus: "DueToday", deadlineAt: "2026-11-13T22:00:00Z" }),
  task({ taskId: "task-done-ontime", area: "Budgets", status: "Completed", leadTimeStatus: "CompletedOnTime", completedAt: "2026-11-05T15:00:00Z" }),
  task({ taskId: "task-done-late", projectId: "project-4", projectName: "Proyecto Terminado", clientId: "client-2", clientName: "Cliente Sur",
    city: "Cali", sgCode: "SG004", area: "Accounting", status: "Completed", leadTimeStatus: "CompletedLate", completedAt: "2026-11-06T15:00:00Z" }),
  task({ taskId: "task-engineering", area: "Engineering", status: "InProgress", leadTimeStatus: "OnTrack", deadlineAt: "2026-11-30T22:00:00Z" }),
];

export const datasetFixture: ManagementDataset = {
  generatedAt: "2026-11-13T15:00:00Z",
  currencyCode: "COP",
  totals: { projectCount: 3, quotationCount: 2, quotedItems: 4, quotedSquareMeters: "12.8456789",
    quotedValue: "1750000.50", completedOnTime: 1, completedLate: 1 },
  projects: [
    { projectId: "project-1", clientId: "client-1", projectName: "Proyecto Norte", clientName: "Cliente Norte", sgCode: "SG001",
      city: "Bogotá", productLine: "Classic", quotedSquareMeters: "12.3456789", quotedItems: 3, quotedValue: "1500000.00",
      referenceSquareMeters: "2.511", measuredStructures: 1, pendingStructures: 2 },
    { projectId: "project-2", clientId: "client-2", projectName: "Proyecto Sur", clientName: "Cliente Sur", sgCode: null,
      city: "Cali", productLine: "Classic", quotedSquareMeters: null, quotedItems: 0, quotedValue: null,
      referenceSquareMeters: null, measuredStructures: 0, pendingStructures: 0 },
    { projectId: "project-4", clientId: "client-2", projectName: "Proyecto Terminado", clientName: "Cliente Sur", sgCode: "SG004",
      city: "Cali", productLine: "Classic", quotedSquareMeters: "0.5", quotedItems: 1, quotedValue: "250000.50",
      referenceSquareMeters: null, measuredStructures: 0, pendingStructures: 0 },
  ],
  tasks: datasetTasks,
};
