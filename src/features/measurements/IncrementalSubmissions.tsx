"use client";
import { useEffect, useRef, useState } from "react";
import { useApiClient } from "@/features/auth/hooks/useApiClient";
import { ApiError } from "@/lib/api/apiError";
import { ErrorNotice } from "@/lib/api/ErrorNotice";
import { saveDownload } from "@/lib/api/saveDownload";
import { formatDate } from "@/lib/formatDate";
import type { MeasurementDelivery, MeasurementState, MeasurementSubmissionCommand } from "./contracts";

export function DeliveryHistory({ projectId, deliveries }: { projectId: string; deliveries: MeasurementDelivery[] }) {
  const api = useApiClient();
  const operation = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<unknown>();
  useEffect(() => () => operation.current?.abort(), []);
  async function download(id: string) {
    if (operation.current) return;
    const controller = new AbortController(); operation.current = controller; setBusy(true); setError(undefined);
    try { await saveDownload(() => api.downloadStream(`projects/${projectId}/measurements/submissions/${id}/report`, { signal: controller.signal }), "Radicacion de medidas.pdf", controller.signal, { serverFilename: true }); }
    catch (failure) { if (!controller.signal.aborted) setError(failure); }
    finally { if (!controller.signal.aborted) { operation.current = null; setBusy(false); } }
  }
  return <section className="stack" aria-label="Radicaciones enviadas"><h3>Radicaciones enviadas</h3>
    <ErrorNotice error={error} />
    {!deliveries.length && <p>Aún no hay tramos radicados.</p>}
    <ol>{deliveries.map(d => <li key={d.id}>
      <h4>Tramo {String(d.number).padStart(2, "0")}</h4>
      <p>{formatDate(d.submittedAt)} · Responsable: {d.submittedBySubject} · {d.structureIds.length} estructuras identificadas</p>
      <p>{d.evidenceStatus === "COMPLETE" ? "Radicación confirmada" : "Registro histórico con evidencia incompleta; no admite operaciones incrementales."}</p>
      <ul>{d.structureIds.map(id => <li key={id}>{id}</li>)}</ul>
      <ul>{d.documents.map(doc => <li key={doc.documentId}>{doc.fileName ?? "Documento histórico"} · Versión documental: {doc.documentId}
        <p>Respalda: {doc.structureIds.join(", ") || "Alcance no reconstruible"}</p>
        {doc.sha256 && <details><summary>Integridad documental SHA-256</summary><code>{doc.sha256}</code></details>}
        {doc.associatedAt && <p>Asociado {formatDate(doc.associatedAt)} por {doc.associatedBySubject}</p>}
      </li>)}</ul>
      {d.reportAvailability === "PRESENT" ? <button className="button-secondary" disabled={busy} onClick={() => void download(d.id)}>Descargar PDF Tramo {String(d.number).padStart(2, "0")}</button> : <p>PDF histórico no disponible.</p>}
    </li>)}</ol>
  </section>;
}

export function IncrementalSubmissions({ data, writable, disabled, dirty, onBusy, onRefresh }: {
  data: MeasurementState; writable: boolean; disabled: boolean; dirty: boolean;
  onBusy: (busy: boolean) => void; onRefresh: (signal: AbortSignal) => Promise<void>;
}) {
  const api = useApiClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [coverage, setCoverage] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState<MeasurementSubmissionCommand>();
  const [confirm, setConfirm] = useState(false); const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(); const [notice, setNotice] = useState("");
  const operation = useRef<AbortController | null>(null);
  useEffect(() => () => operation.current?.abort(), []);
  const frozen = new Set(data.deliveries?.flatMap(d => d.structureIds));
  const eligible = data.structures.filter(s => !s.retiredAt && s.measuredAt && s.technicalComplete && !frozen.has(s.id));
  const selectedValid = selected.length > 0 && selected.every(id => eligible.some(s => s.id === id));
  const documents = data.documents.filter(d => d.isCurrent);
  const locked = disabled || busy || !!pending || dirty;
  async function submit(command: MeasurementSubmissionCommand) {
    if (operation.current || !writable || dirty) return;
    const controller = new AbortController(); operation.current = controller; setBusy(true); onBusy(true); setPending(command); setConfirm(false); setError(undefined); setNotice("");
    try {
      await api.post<MeasurementDelivery>(`projects/${data.projectId}/measurements/submissions`, { ...command }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      await onRefresh(controller.signal);
      if (controller.signal.aborted) return;
      setPending(undefined); onBusy(false); setConfirm(false); setSelected([]); setCoverage({}); setNotice("Tramo radicado y recibido por Ingeniería.");
    } catch (failure) {
      if (controller.signal.aborted) return;
      setError(failure);
      if (failure instanceof ApiError && failure.status >= 400 && failure.status < 500) {
        setPending(undefined); onBusy(false); setConfirm(false);
        try { await onRefresh(controller.signal); } catch { /* Preserve the original error. */ }
      }
    } finally { if (!controller.signal.aborted) { operation.current = null; setBusy(false); } }
  }
  function prepare() {
    if (locked || !selectedValid) return;
    setConfirm(true);
  }
  return <section className="stack" aria-label="Radicar medidas seleccionadas">
    <h3>Radicar medidas seleccionadas</h3>
    <p>Total: {data.structures.length} · Medidas: {data.summary.measured} · Radicadas: {frozen.size} · Medidas sin radicar: {data.structures.filter(s => s.measuredAt && !s.retiredAt && !frozen.has(s.id)).length} · Pendientes de medir: {data.summary.pending} · Retiradas: {data.summary.retired}</p>
    <p>Cada tramo congela únicamente sus estructuras. Instalación permanece abierta para las siguientes entregas.</p>
    {error instanceof ApiError && error.status === 409 ? <p role="alert">El estado o los documentos cambiaron. Revisa la selección actualizada antes de confirmar de nuevo.</p> : <ErrorNotice error={error} />}
    {notice && <p role="status">{notice}</p>}{busy && <p role="status">Preparando PDF y radicando tramo…</p>}
    {writable && <>
      <fieldset disabled={locked || confirm}><legend>Estructuras medidas disponibles</legend>
        {eligible.map(s => <label className="block" key={s.id}><input type="checkbox" checked={selected.includes(s.id)} disabled={selected.length >= 500 && !selected.includes(s.id)} onChange={e => {
          setSelected(previous => e.target.checked ? [...previous, s.id] : previous.filter(id => id !== s.id));
          setCoverage(previous => Object.fromEntries(Object.entries(previous).map(([doc, ids]) => [doc, ids.filter(id => id !== s.id)])));
        }} />{s.itemNumber ?? "Agregada en obra"} · Unidad {s.unitOrdinal}/{s.unitCount} · {s.actualLocation ?? s.location} · {s.id}</label>)}
        {!eligible.length && <p>No hay estructuras medidas y completas disponibles para una nueva entrega.</p>}
      </fieldset>
      {selected.length >= 500 && <p role="status">Máximo 500 estructuras por tramo.</p>}
      <fieldset disabled={locked || confirm}><legend>Documentos y estructuras respaldadas</legend>
        <p>Incluye solo los archivos necesarios y declara las estructuras que respalda cada versión.</p>
        {documents.map(doc => <fieldset key={doc.id}><legend>{doc.originalFileName}</legend>{selected.map(id => <label className="block" key={id}><input type="checkbox" checked={coverage[doc.id]?.includes(id) ?? false} onChange={e => setCoverage(previous => ({ ...previous, [doc.id]: e.target.checked ? [...(previous[doc.id] ?? []), id] : (previous[doc.id] ?? []).filter(s => s !== id) }))} />Respalda {id}</label>)}</fieldset>)}
      </fieldset>
      <button className="button-primary" disabled={locked || !selectedValid || confirm} onClick={prepare}>Radicar selección</button>
      {confirm && <SubmissionConfirmation count={selected.length} ids={selected} names={documents.filter(d => coverage[d.id]?.some(id => selected.includes(id))).map(d => d.originalFileName)} busy={busy || !!pending}
        onCancel={() => setConfirm(false)} onConfirm={() => void submit({ requestKey: crypto.randomUUID(), expectedRevision: data.revision, structureIds: [...selected], documents: documents.flatMap(d => {
          const ids = (coverage[d.id] ?? []).filter(id => selected.includes(id)); return ids.length ? [{ documentId: d.id, structureIds: ids }] : [];
        }) })} />}
      {pending && !busy && <button className="button-secondary" onClick={() => void submit(pending)}>Reintentar la misma radicación</button>}
    </>}
  </section>;
}

function SubmissionConfirmation({ count, ids, names, busy, onConfirm, onCancel }: { count: number; ids: string[]; names: string[]; busy: boolean; onConfirm: () => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null); const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => { const element = dialog.current!; const previous = document.activeElement; element.showModal(); cancel.current?.focus(); return () => { element.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); }; }, []);
  return <dialog ref={dialog} className="panel stack" aria-label="Confirmar radicación por tramo" onCancel={e => { e.preventDefault(); if (!busy) onCancel(); }}>
    <h3>Confirmar radicación de {count} estructuras</h3><ul>{ids.map(id => <li key={id}>{id}</li>)}</ul>
    <h4>Documentos incluidos</h4>{names.length ? <ul>{names.map((name, index) => <li key={index}>{name}</li>)}</ul> : <p>Sin documentos asociados.</p>}
    <p>Las medidas, ficha técnica, croquis y evidencia de estas estructuras quedarán congelados. Ingeniería recibirá este tramo; las demás estructuras seguirán editables.</p>
    <button className="button-primary" disabled={busy} onClick={onConfirm}>Confirmar tramo</button><button ref={cancel} className="button-secondary" disabled={busy} onClick={onCancel}>Cancelar</button>
  </dialog>;
}
