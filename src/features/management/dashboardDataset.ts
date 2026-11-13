import { ApiError } from "@/lib/api/apiError";
import { parseManagementTasks } from "./parser";
import type { ManagementTask } from "./types";

export interface DatasetProject {
  projectId: string; clientId: string; projectName: string; clientName: string; sgCode: string | null;
  city: string; productLine: string;
  quotedSquareMeters: string | null; quotedItems: number; quotedValue: string | null;
  referenceSquareMeters: string | null; measuredStructures: number; pendingStructures: number;
}

export interface DatasetTotals {
  projectCount: number; quotationCount: number; quotedItems: number;
  quotedSquareMeters: string | null; quotedValue: string;
  completedOnTime: number; completedLate: number;
}

export interface ManagementDataset {
  generatedAt: string; currencyCode: string; totals: DatasetTotals;
  projects: DatasetProject[]; tasks: ManagementTask[];
}

function invalid(): never { throw new ApiError(502); }
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const result = value as Record<string, unknown>;
  if (Object.keys(result).length !== keys.length || keys.some((key) => !Object.hasOwn(result, key))) return invalid();
  return result;
}
function text(value: unknown): string { return typeof value === "string" ? value : invalid(); }
function count(value: unknown): number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : invalid(); }
function nullable<T>(value: unknown, parse: (value: unknown) => T): T | null { return value === null ? null : parse(value); }
function list<T>(value: unknown, parse: (value: unknown) => T): T[] { return Array.isArray(value) ? value.map(parse) : invalid(); }
// Exact decimal strings only: no exponents, signs, or JavaScript numbers for m² and COP.
function decimal(value: unknown): string {
  const result = text(value);
  return /^(0|[1-9]\d*)(\.\d+)?$/.test(result) && result.length <= 60 ? result : invalid();
}
function money(value: unknown): string {
  const result = text(value);
  return /^(0|[1-9]\d*)\.\d{2}$/.test(result) && result.length <= 60 ? result : invalid();
}
function date(value: unknown): string {
  const result = text(value);
  return /^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(result) && Number.isFinite(Date.parse(result)) ? result : invalid();
}

const projectKeys = ["projectId", "clientId", "projectName", "clientName", "sgCode", "city", "productLine",
  "quotedSquareMeters", "quotedItems", "quotedValue", "referenceSquareMeters", "measuredStructures", "pendingStructures"] as const;
const totalKeys = ["projectCount", "quotationCount", "quotedItems", "quotedSquareMeters", "quotedValue", "completedOnTime", "completedLate"] as const;

function project(value: unknown): DatasetProject {
  const v = record(value, projectKeys);
  return {
    projectId: text(v.projectId), clientId: text(v.clientId), projectName: text(v.projectName), clientName: text(v.clientName),
    sgCode: nullable(v.sgCode, text), city: text(v.city), productLine: text(v.productLine),
    quotedSquareMeters: nullable(v.quotedSquareMeters, decimal), quotedItems: count(v.quotedItems),
    quotedValue: nullable(v.quotedValue, money), referenceSquareMeters: nullable(v.referenceSquareMeters, decimal),
    measuredStructures: count(v.measuredStructures), pendingStructures: count(v.pendingStructures),
  };
}

// Parses the full closed contract once. Filtering later uses only validated data.
export function parseManagementDataset(value: unknown): ManagementDataset {
  const v = record(value, ["generatedAt", "currencyCode", "totals", "projects", "tasks"]);
  const totals = record(v.totals, totalKeys);
  const projects = list(v.projects, project);
  if (text(v.currencyCode) !== "COP") invalid();
  if (projects.length !== count(totals.projectCount)) invalid();
  return {
    generatedAt: date(v.generatedAt), currencyCode: "COP",
    totals: {
      projectCount: count(totals.projectCount), quotationCount: count(totals.quotationCount), quotedItems: count(totals.quotedItems),
      quotedSquareMeters: nullable(totals.quotedSquareMeters, decimal), quotedValue: money(totals.quotedValue),
      completedOnTime: count(totals.completedOnTime), completedLate: count(totals.completedLate),
    },
    projects,
    tasks: parseManagementTasks(v.tasks),
  };
}
