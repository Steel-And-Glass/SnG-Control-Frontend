import type { LeadTimeStatus, TaskArea } from "@/features/tasks/types";
import type { DatasetProject, ManagementDataset } from "./dashboardDataset";
import { sumDecimals } from "./dashboardMath";
import type { ManagementTask } from "./types";

export interface DashboardFilters {
  clientId: string; projectId: string; city: string; productLine: string; area: string; status: string;
}

export const emptyDashboardFilters: DashboardFilters = { clientId: "", projectId: "", city: "", productLine: "", area: "", status: "" };
export const dashboardAreas: readonly TaskArea[] = ["Commercial", "Budgets", "Accounting", "Installation", "Engineering"];

const attentionOrder: Partial<Record<LeadTimeStatus, number>> = { Overdue: 0, DueToday: 1, DueSoon: 2 };

// Project-level filters apply to projects and tasks alike.
function inProject(item: { clientId: string; projectId: string; city: string; productLine: string }, f: DashboardFilters) {
  return (!f.clientId || item.clientId === f.clientId) && (!f.projectId || item.projectId === f.projectId)
    && (!f.city || item.city === f.city) && (!f.productLine || item.productLine === f.productLine);
}

export function activeFilterCount(f: DashboardFilters): number {
  return Object.values(f).filter(Boolean).length;
}

export function filterOptions(dataset: ManagementDataset, clientId: string) {
  const clients = new Map<string, string>();
  for (const p of dataset.projects) clients.set(p.clientId, p.clientName);
  const projects = dataset.projects.filter((p) => !clientId || p.clientId === clientId);
  const sorted = (values: Iterable<string>) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es"));
  return {
    clients: [...clients.entries()].sort((a, b) => a[1].localeCompare(b[1], "es")),
    projects: projects.map((p) => [p.projectId, `${p.sgCode ? `${p.sgCode} · ` : ""}${p.projectName}`] as const),
    cities: sorted(dataset.projects.map((p) => p.city)),
    productLines: sorted(dataset.projects.map((p) => p.productLine)),
  };
}

export function buildDashboard(dataset: ManagementDataset, f: DashboardFilters) {
  const tasks = dataset.tasks.filter((t) => inProject(t, f) && (!f.area || t.area === f.area) && (!f.status || t.status === f.status));
  const taskProjects = new Set(tasks.map((t) => t.projectId));
  const hasTaskFilter = Boolean(f.area || f.status);
  // With an area or status selected, only projects that have matching work are shown.
  const projects = dataset.projects.filter((p) => inProject(p, f) && (!hasTaskFilter || taskProjects.has(p.projectId)));

  const count = (test: (t: ManagementTask) => boolean) => tasks.filter(test).length;
  const open = (t: ManagementTask) => t.status !== "Completed";
  const onTime = count((t) => t.leadTimeStatus === "CompletedOnTime");
  const late = count((t) => t.leadTimeStatus === "CompletedLate");

  const quoted = projects.filter((p) => p.quotedValue !== null);
  const values = projects.flatMap((p) => (p.quotedValue === null ? [] : [p.quotedValue]));
  const squares = projects.flatMap((p) => (p.quotedSquareMeters === null ? [] : [p.quotedSquareMeters]));

  const projectRows = projects.map((project) => {
    const mine = tasks.filter((t) => t.projectId === project.projectId);
    return {
      project,
      active: mine.filter(open).length,
      overdue: mine.filter((t) => open(t) && t.leadTimeStatus === "Overdue").length,
      dueToday: mine.filter((t) => open(t) && t.leadTimeStatus === "DueToday").length,
    };
  }).sort((a, b) => b.overdue - a.overdue || b.active - a.active || a.project.projectName.localeCompare(b.project.projectName, "es"));

  const squareRanking = projects
    .filter((p): p is DatasetProject & { quotedSquareMeters: string } => p.quotedSquareMeters !== null)
    .sort((a, b) => Number(b.quotedSquareMeters) - Number(a.quotedSquareMeters) || a.projectName.localeCompare(b.projectName, "es"))
    .slice(0, 8);

  // Missing deadlines sort last within the same urgency.
  const due = (t: ManagementTask) => { const v = Date.parse(t.deadlineAt ?? ""); return Number.isFinite(v) ? v : Number.MAX_SAFE_INTEGER; };
  const attention = tasks
    .filter((t) => open(t) && attentionOrder[t.leadTimeStatus] !== undefined)
    .sort((a, b) => (attentionOrder[a.leadTimeStatus] ?? 9) - (attentionOrder[b.leadTimeStatus] ?? 9) || due(a) - due(b));

  return {
    tasks, projects, projectRows, squareRanking, attention,
    kpis: {
      inProgress: count((t) => t.status === "InProgress"),
      active: count(open),
      overdue: count((t) => open(t) && t.leadTimeStatus === "Overdue"),
      dueToday: count((t) => open(t) && t.leadTimeStatus === "DueToday"),
      onTime, late,
      onTimeRate: onTime + late === 0 ? null : Math.round((onTime / (onTime + late)) * 100),
    },
    quoted: {
      projects: quoted.length,
      items: projects.reduce((total, p) => total + p.quotedItems, 0),
      value: sumDecimals(values),
      squareMeters: sumDecimals(squares),
    },
    areas: dashboardAreas.map((area) => {
      const mine = tasks.filter((t) => t.area === area);
      return {
        area,
        pending: mine.filter((t) => t.status === "Pending").length,
        inProgress: mine.filter((t) => t.status === "InProgress").length,
        completed: mine.filter((t) => t.status === "Completed").length,
      };
    }),
  };
}
