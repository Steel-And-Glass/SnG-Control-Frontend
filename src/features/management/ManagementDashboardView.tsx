"use client";

import Link from "next/link";
import { useMemo } from "react";
import { taskAreaLabels, taskStatusLabels, type LeadTimeStatus } from "@/features/tasks/types";
import { timingLabels } from "@/features/tasks/TaskList";
import { formatDecimal } from "./dashboardMath";
import type { ManagementDataset } from "./dashboardDataset";
import { activeFilterCount, buildDashboard, dashboardAreas, emptyDashboardFilters, filterOptions, type DashboardFilters } from "./dashboardModel";
import styles from "./ManagementDashboard.module.css";

const timeZone = "America/Bogota";
const toneByTiming: Partial<Record<LeadTimeStatus, string>> = { Overdue: styles.timingDanger, DueToday: styles.timingWarning, DueSoon: styles.timingWarning };

function money(value: string | null) { return value === null ? "Sin cotizaciones" : `COP ${formatDecimal(value, 0)}`; }
function squares(value: string | null) { return value === null ? "—" : `${formatDecimal(value, 2)} m²`; }

export function ManagementDashboardView({ dataset, filters, onChange }: {
  dataset: ManagementDataset; filters: DashboardFilters; onChange: (next: DashboardFilters) => void;
}) {
  const view = useMemo(() => buildDashboard(dataset, filters), [dataset, filters]);
  const options = useMemo(() => filterOptions(dataset, filters.clientId), [dataset, filters.clientId]);
  const { kpis, quoted } = view;
  const drill = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
  const maxSquares = Math.max(1, ...view.squareRanking.map((p) => Number(p.quotedSquareMeters)));
  const maxArea = Math.max(1, ...view.areas.map((row) => row.pending + row.inProgress + row.completed));

  const set = (key: keyof DashboardFilters, value: string) =>
    onChange({ ...filters, [key]: value, ...(key === "clientId" ? { projectId: "" } : {}) });

  return <div className="page-stack">
    <section className={styles.toolbar} aria-label="Filtros">
      <div className={styles.filters}>
        <label className={styles.field}>Cliente
          <select className="form-control" value={filters.clientId} onChange={(e) => set("clientId", e.target.value)}>
            <option value="">Todos los clientes</option>
            {options.clients.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label className={styles.field}>Proyecto
          <select className="form-control" value={filters.projectId} onChange={(e) => set("projectId", e.target.value)}>
            <option value="">Todos los proyectos</option>
            {options.projects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label className={styles.field}>Ciudad
          <select className="form-control" value={filters.city} onChange={(e) => set("city", e.target.value)}>
            <option value="">Todas las ciudades</option>
            {options.cities.map((city) => <option key={city} value={city}>{city}</option>)}
          </select>
        </label>
        <label className={styles.field}>Línea de producto
          <select className="form-control" value={filters.productLine} onChange={(e) => set("productLine", e.target.value)}>
            <option value="">Todas las líneas</option>
            {options.productLines.map((line) => <option key={line} value={line}>{line}</option>)}
          </select>
        </label>
        <label className={styles.field}>Área
          <select className="form-control" value={filters.area} onChange={(e) => set("area", e.target.value)}>
            <option value="">Todas las áreas</option>
            {dashboardAreas.map((area) => <option key={area} value={area}>{taskAreaLabels[area]}</option>)}
          </select>
        </label>
        <label className={styles.field}>Estado de tarea
          <select className="form-control" value={filters.status} onChange={(e) => set("status", e.target.value)}>
            <option value="">Todos los estados</option>
            {Object.entries(taskStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      <div className={styles.toolbarActions}>
        <button className="button-secondary" disabled={activeFilterCount(filters) === 0} onClick={() => onChange(emptyDashboardFilters)}>Limpiar filtros</button>
        <Link className="text-link" href={`/management/tasks${drill ? `?${drill}` : ""}`}>Ver tareas con estos filtros</Link>
      </div>
      <p className="metadata">Las tareas responden a cliente, proyecto, ciudad, línea, área y estado. Los montos y m² cotizados responden a cliente, proyecto, ciudad y línea.</p>
    </section>

    <section className={styles.kpis} aria-label="Indicadores">
      <Kpi label="Tareas en curso" value={String(kpis.inProgress)} note={`${kpis.active} tareas abiertas`} />
      <Kpi label="Atrasadas" value={String(kpis.overdue)} note="Pasaron su fecha límite" tone={kpis.overdue > 0 ? styles.danger : undefined} />
      <Kpi label="Vencen hoy" value={String(kpis.dueToday)} note="Fecha límite hoy" tone={kpis.dueToday > 0 ? styles.warning : undefined} />
      <Kpi label="Entregas a tiempo" value={kpis.onTimeRate === null ? "—" : `${kpis.onTimeRate}%`}
        note={kpis.onTimeRate === null ? "Aún no hay entregas cerradas" : `${kpis.onTime} de ${kpis.onTime + kpis.late} entregas cerradas`} />
      <Kpi label="Valor cotizado" value={quoted.value === null ? "—" : money(quoted.value)} note={`${quoted.projects} proyectos con cotización`} />
      <Kpi label="m² cotizados" value={quoted.squareMeters === null ? "—" : squares(quoted.squareMeters)} note={`${quoted.items} ítems cotizados`} />
    </section>

    <div className={styles.twoColumns}>
      <section className="panel stack" aria-labelledby="areas-title">
        <h2 id="areas-title" className="section-title">Tareas por área</h2>
        {view.areas.every((row) => row.pending + row.inProgress + row.completed === 0)
          ? <p className="metadata">No hay tareas para estos filtros.</p>
          : <ul className={styles.bars}>
            {view.areas.map((row) => {
              const total = row.pending + row.inProgress + row.completed;
              const selected = filters.area === row.area;
              return <li key={row.area}>
                <button type="button" className={`${styles.barButton} ${selected ? styles.selected : ""}`} aria-pressed={selected}
                  onClick={() => set("area", selected ? "" : row.area)}>
                  <span className={styles.barLabel}>{taskAreaLabels[row.area]}</span>
                  <span className={styles.track} style={{ width: `${(total / maxArea) * 100}%` }}>
                    <span className={styles.segmentPending} style={{ flexGrow: row.pending }} />
                    <span className={styles.segmentProgress} style={{ flexGrow: row.inProgress }} />
                    <span className={styles.segmentDone} style={{ flexGrow: row.completed }} />
                  </span>
                  <span className={styles.barValue}>{total}</span>
                </button>
              </li>;
            })}
          </ul>}
        <p className={styles.legend}><span className={styles.swatchPending} /> Pendientes <span className={styles.swatchProgress} /> En curso <span className={styles.swatchDone} /> Completadas</p>
      </section>

      <section className="panel stack" aria-labelledby="squares-title">
        <h2 id="squares-title" className="section-title">m² cotizados por proyecto</h2>
        {view.squareRanking.length === 0
          ? <p className="metadata">No hay m² cotizados para estos filtros.</p>
          : <ul className={styles.bars}>
            {view.squareRanking.map((p) => <li key={p.projectId}>
              <div className={styles.barRow}>
                <span className={styles.barLabel}>{p.sgCode ? `${p.sgCode} · ` : ""}{p.projectName}</span>
                <span className={styles.track} style={{ width: `${(Number(p.quotedSquareMeters) / maxSquares) * 100}%` }}><span className={styles.segmentDone} style={{ flexGrow: 1 }} /></span>
                <span className={styles.barValue}>{squares(p.quotedSquareMeters)}</span>
              </div>
            </li>)}
          </ul>}
      </section>
    </div>

    <section className="panel stack" aria-labelledby="projects-title">
      <h2 id="projects-title" className="section-title">Seguimiento por proyecto</h2>
      {view.projectRows.length === 0
        ? <p className="metadata">No hay proyectos para estos filtros.</p>
        : <div className="table-scroll"><table className="data-table">
          <thead><tr><th>Proyecto</th><th>Cliente</th><th>Ciudad</th><th>Tareas abiertas</th><th>Atrasadas</th><th>Vencen hoy</th><th>m² cotizados</th><th>Valor cotizado</th></tr></thead>
          <tbody>{view.projectRows.map(({ project, active, overdue, dueToday }) => <tr key={project.projectId}>
            <td><Link className="text-link" href={`/projects/${project.projectId}`}>{project.sgCode ? `${project.sgCode} · ` : ""}{project.projectName}</Link></td>
            <td>{project.clientName}</td>
            <td>{project.city} · {project.productLine}</td>
            <td>{active}</td>
            <td className={overdue > 0 ? styles.danger : undefined}>{overdue}</td>
            <td>{dueToday}</td>
            <td>{squares(project.quotedSquareMeters)}</td>
            <td>{project.quotedValue === null ? "Sin cotización" : money(project.quotedValue)}</td>
          </tr>)}</tbody>
        </table></div>}
    </section>

    <section className="panel stack" aria-labelledby="attention-title">
      <h2 id="attention-title" className="section-title">Tareas que requieren atención</h2>
      {view.attention.length === 0
        ? <p className="metadata">No hay tareas atrasadas ni por vencer en estos filtros.</p>
        : <>
          <ul className={styles.attention}>
            {view.attention.slice(0, 8).map((task) => <li key={task.taskId} className={styles.attentionItem}>
              <span className={`${styles.timing} ${toneByTiming[task.leadTimeStatus] ?? ""}`}>{timingLabels[task.leadTimeStatus]}</span>
              <span><strong>{task.sgCode ? `${task.sgCode} · ` : ""}{task.projectName}</strong> · {taskAreaLabels[task.area]} · {taskStatusLabels[task.status]}</span>
              <span className="metadata">{task.deadlineAt ? new Date(task.deadlineAt).toLocaleDateString("es-CO", { timeZone, dateStyle: "medium" }) : "Sin fecha"}</span>
            </li>)}
          </ul>
          <p className="metadata">Mostrando {Math.min(8, view.attention.length)} de {view.attention.length} tareas que requieren atención.</p>
        </>}
    </section>

    <p className="metadata">Datos al {new Date(dataset.generatedAt).toLocaleString("es-CO", { timeZone, dateStyle: "medium", timeStyle: "short" })} · hora de Bogotá</p>
  </div>;
}

function Kpi({ label, value, note, tone }: { label: string; value: string; note: string; tone?: string }) {
  return <div className={`${styles.kpi} ${tone ?? ""}`}>
    <span className={styles.kpiLabel}>{label}</span>
    <strong className={styles.kpiValue}>{value}</strong>
    <span className={styles.kpiNote}>{note}</span>
  </div>;
}
