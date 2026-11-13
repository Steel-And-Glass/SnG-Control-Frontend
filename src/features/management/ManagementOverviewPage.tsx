"use client";

import { useCallback, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { useApiClient } from "@/features/auth/hooks/useApiClient";
import { useResource } from "@/lib/api/useResource";
import { ManagementAccess, ManagementError } from "./ManagementAccess";
import { ManagementDashboardView } from "./ManagementDashboardView";
import { emptyDashboardFilters, type DashboardFilters } from "./dashboardModel";
import { managementService } from "./service";

export function ManagementOverviewPage() {
  return <ManagementAccess><Dashboard /></ManagementAccess>;
}

// One request loads the dataset; every selection is applied in memory, so the page never reloads while filtering.
function Dashboard() {
  const api = useApiClient();
  const load = useCallback((signal: AbortSignal) => managementService.dashboard(api, signal), [api]);
  const { data, loading, error, refresh } = useResource(load);
  const [filters, setFilters] = useState<DashboardFilters>(emptyDashboardFilters);
  return <div className="page-stack">
    <PageHeader title="Gerencia Integral" description="Estado de proyectos, tareas y cotizaciones."
      action={<button className="button-secondary" onClick={refresh} disabled={loading}>Actualizar</button>} />
    {loading && <p role="status" className="loading-notice">Cargando resumen…</p>}
    <ManagementError error={error} retry={refresh} />
    {data && <ManagementDashboardView dataset={data} filters={filters} onChange={setFilters} />}
  </div>;
}
