import type { ApiClient } from "@/lib/api/types";
import { parseManagementDataset } from "./dashboardDataset";
import { parseManagementOverview, parseManagementTasks } from "./parser";

export const managementService = {
  overview: async (api: ApiClient, signal?: AbortSignal) => parseManagementOverview(await api.get<unknown>("management/overview", { signal })),
  tasks: async (api: ApiClient, signal?: AbortSignal) => parseManagementTasks(await api.get<unknown>("management/tasks", { signal })),
  dashboard: async (api: ApiClient, signal?: AbortSignal) => parseManagementDataset(await api.get<unknown>("management/dashboard-dataset", { signal })),
};
