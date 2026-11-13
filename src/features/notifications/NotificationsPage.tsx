"use client";

import { useCallback, useState } from "react";
import { useApiClient } from "@/features/auth/hooks/useApiClient";
import { ErrorNotice } from "@/lib/api/ErrorNotice";
import { useResource } from "@/lib/api/useResource";
import { notificationsService } from "./service";
import { NotificationList } from "./NotificationList";
import styles from "./NotificationList.module.css";
import type { NotificationState } from "./types";
import { PageHeader } from "@/components/ui/PageHeader";

export function NotificationsPage() {
  const api = useApiClient();
  const load = useCallback((signal: AbortSignal) => notificationsService.list(api, signal), [api]);
  const { data, loading, error, refresh } = useResource(load);
  const [filter, setFilter] = useState<"all" | NotificationState>("all");
  const shown = data && (filter === "all" ? data : data.filter(n => n.state === filter));
  const filters = [["all", "Todas"], ["Active", "Activas"], ["Informational", "Informativas"], ["Resolved", "Resueltas"]] as const;
  return <div className="page-stack">
    <PageHeader title="Notificaciones" description="Notificaciones personales e historial de alertas. Fechas y horas de Colombia (America/Bogota)." />
    {loading && <p role="status">Cargando notificaciones…</p>}
    <ErrorNotice error={error} retry={refresh} />
    {data && data.length > 0 && <div className={styles.filters} role="radiogroup" aria-label="Filtrar notificaciones">{filters.map(([value, label]) => <button key={value} type="button" role="radio" className={styles.filter} aria-checked={filter === value} onClick={() => setFilter(value)}>{label} ({value === "all" ? data.length : data.filter(n => n.state === value).length})</button>)}</div>}
    {data && <section aria-labelledby="notification-results-title"><h2 id="notification-results-title" className="sr-only">Historial de notificaciones</h2><NotificationList notifications={shown ?? data} projectLinks /></section>}
  </div>;
}
