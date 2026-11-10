import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { IncrementalSubmissions, DeliveryHistory } from "@/features/measurements/IncrementalSubmissions";
import { MeasurementPanel } from "@/features/measurements/MeasurementPanel";
import { EngineeringPanel } from "@/features/engineering/EngineeringPanel";
import { parseEngineering, type EngineeringState } from "@/features/engineering/contracts";
import type { MeasurementState } from "@/features/measurements/contracts";
import { mockBackend, renderOperational, deferred } from "./operationalFixtures";
import { incrementalEngineering, engineeringState, engineeringId as id, engineeringDate as date, engineeringDoc } from "./engineeringFixtures";
import { user } from "./fixtures";

const installer = { ...user, roles: ["Installation" as const] };
function measurements(): MeasurementState {
  return { projectId: id, taskId: id, checklistId: id, revision: 5, taskStatus: "InProgress", canModify: true, responsibleSubject: user.subject,
    isIncremental: true, deliveries: [], submissionId: null, submittedAt: null, history: [], documents: [engineeringDoc],
    summary: { initial: 10, active: 10, measured: 3, pending: 7, added: 0, retired: 0, progress: 30 },
    structures: Array.from({ length: 10 }, (_, i) => ({ ...engineeringState.structures[0].structure, id: `22222222-2222-4222-8222-${String(i).padStart(12, "0")}`, unitOrdinal: i + 1, unitCount: 10, technicalComplete: i < 3, measuredAt: i < 3 ? date : null })) };
}
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value() { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value() { this.removeAttribute("open"); } });
});
it("confirms exactly three physical IDs and explicit document coverage while seven remain pending", async () => {
  const data = measurements(); const gate = deferred<Response>(); const refresh = vi.fn();
  const fetch = mockBackend(() => gate.promise);
  renderOperational(<IncrementalSubmissions data={data} writable disabled={false} dirty={false} onBusy={vi.fn()} onRefresh={refresh} />, installer);
  expect(screen.getByRole("button", { name: "Radicar selección" })).toBeDisabled();
  const structures = within(screen.getByRole("group", { name: "Estructuras medidas disponibles" }));
  expect(structures.getAllByRole("checkbox")).toHaveLength(3);
  for (const check of structures.getAllByRole("checkbox")) await userEvent.click(check);
  await userEvent.click(screen.getByRole("checkbox", { name: `Respalda ${data.structures[0].id}` }));
  await userEvent.click(screen.getByRole("button", { name: "Radicar selección" }));
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toHaveTextContent("3 estructuras");
  expect(screen.getByRole("dialog")).toHaveTextContent(engineeringDoc.originalFileName);
  await userEvent.click(screen.getByRole("button", { name: "Confirmar tramo" }));
  expect(refresh).not.toHaveBeenCalled(); expect(screen.getByRole("status")).toHaveTextContent("radicando tramo");
  const body = JSON.parse(fetch.mock.calls[0][1].body as string);
  expect(body.structureIds).toEqual(data.structures.slice(0, 3).map(s => s.id));
  expect(body.documents).toEqual([{ documentId: engineeringDoc.id, structureIds: [data.structures[0].id] }]);
  expect(body.expectedRevision).toBe(5);
  gate.resolve(Response.json({})); await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
});
it("retries an uncertain result with the exact key and frozen selection", async () => {
  const bodies: string[] = []; const data = measurements();
  mockBackend((_, init) => { bodies.push(init.body as string); return bodies.length === 1 ? Response.json({}, { status: 503 }) : {}; });
  renderOperational(<IncrementalSubmissions data={data} writable disabled={false} dirty={false} onBusy={vi.fn()} onRefresh={vi.fn()} />, installer);
  await userEvent.click(within(screen.getByRole("group", { name: "Estructuras medidas disponibles" })).getAllByRole("checkbox")[0]);
  await userEvent.click(screen.getByRole("button", { name: "Radicar selección" }));
  await userEvent.click(screen.getByRole("button", { name: "Confirmar tramo" }));
  await userEvent.click(await screen.findByRole("button", { name: "Reintentar la misma radicación" }));
  await waitFor(() => expect(bodies).toHaveLength(2)); expect(bodies[0]).toEqual(bodies[1]);
});
it("blocks dirty drafts and excludes retired, incomplete and already delivered structures", () => {
  const data = measurements(); data.structures[0].retiredAt = date; data.structures[1].technicalComplete = false;
  data.deliveries = [{ id, number: 1, submittedAt: date, submittedBySubject: "synthetic-installer", evidenceStatus: "COMPLETE", scopeIssue: null, reportAvailability: "PRESENT", structureIds: [data.structures[2].id], documents: [] }];
  renderOperational(<IncrementalSubmissions data={data} writable disabled={false} dirty onBusy={vi.fn()} onRefresh={vi.fn()} />, installer);
  expect(screen.queryAllByRole("checkbox")).toHaveLength(0); expect(screen.getByRole("button", { name: "Radicar selección" })).toBeDisabled();
});
it("freezes delivered cards only and preserves the open Installation workspace", async () => {
  const data = measurements(); data.deliveries = [{ id, number: 1, submittedAt: date, submittedBySubject: "synthetic-installer", evidenceStatus: "COMPLETE", scopeIssue: null, reportAvailability: "PRESENT", structureIds: [data.structures[0].id], documents: [] }];
  mockBackend(() => data); renderOperational(<MeasurementPanel projectId={id} onRefresh={vi.fn()} />, installer);
  expect(await screen.findByLabelText(`Ancho en obra ${data.structures[0].id}`)).toBeDisabled();
  expect(screen.getByLabelText(`Ancho en obra ${data.structures[3].id}`)).toBeEnabled();
  expect(screen.getByRole("button", { name: "Agregar estructura" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: "Radicar medidas" })).not.toBeInTheDocument();
});
it("shows incomplete historical evidence honestly without fabricating a PDF or members", () => {
  renderOperational(<DeliveryHistory projectId={id} deliveries={[{ id, number: 1, submittedAt: date, submittedBySubject: "synthetic-installer", evidenceStatus: "LEGACY_INCOMPLETE_EVIDENCE", scopeIssue: "MISSING_SCOPE", reportAvailability: "ABSENT", structureIds: [], documents: [] }]} />, installer);
  expect(screen.getByText(/histórico con evidencia incompleta/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Descargar/ })).not.toBeInTheDocument();
});
it("cancels in-flight work on unmount without applying a late response", async () => {
  const gate = deferred<Response>(); const refresh = vi.fn(); const fetch = mockBackend(() => gate.promise);
  const view = renderOperational(<IncrementalSubmissions data={measurements()} writable disabled={false} dirty={false} onBusy={vi.fn()} onRefresh={refresh} />, installer);
  await userEvent.click(within(screen.getByRole("group", { name: "Estructuras medidas disponibles" })).getAllByRole("checkbox")[0]);
  await userEvent.click(screen.getByRole("button", { name: "Radicar selección" }));
  await userEvent.click(screen.getByRole("button", { name: "Confirmar tramo" }));
  const signal = fetch.mock.calls[0][1].signal;
  view.unmount(); expect(signal?.aborted).toBe(true);
  gate.resolve(Response.json({})); await Promise.resolve(); expect(refresh).not.toHaveBeenCalled();
});
it("refreshes a conflict without retrying or showing a successful delivery", async () => {
  const refresh = vi.fn(); const fetch = mockBackend(() => Response.json({}, { status: 409 }));
  renderOperational(<IncrementalSubmissions data={measurements()} writable disabled={false} dirty={false} onBusy={vi.fn()} onRefresh={refresh} />, installer);
  await userEvent.click(within(screen.getByRole("group", { name: "Estructuras medidas disponibles" })).getAllByRole("checkbox")[0]);
  await userEvent.click(screen.getByRole("button", { name: "Radicar selección" }));
  await userEvent.click(screen.getByRole("button", { name: "Confirmar tramo" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Revisa la selección");
  expect(fetch).toHaveBeenCalledOnce(); expect(refresh).toHaveBeenCalledOnce();
  expect(screen.queryByText("Tramo radicado y recibido por Ingeniería.")).not.toBeInTheDocument();
});
it("Engineering receives origins and checks while exposing no legacy upload or closure", async () => {
  const state: EngineeringState = incrementalEngineering();
  mockBackend(() => state); renderOperational(<EngineeringPanel projectId={id} onRefresh={vi.fn()} />, { ...user, roles: ["Engineering"] });
  expect(await screen.findByRole("heading", { name: "Ingeniería · Recepción por tramos" })).toBeInTheDocument();
  expect(screen.getAllByRole("checkbox", { name: "Estructura revisada en Ingeniería" })).toHaveLength(2);
  expect(screen.queryByLabelText("Seleccionar Acta PDF")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /finalización/ })).not.toBeInTheDocument();
  expect(() => parseEngineering({ ...state, checklistId: id }, id)).toThrow();
  expect(() => parseEngineering({ ...state, currentDocumentId: id }, id)).toThrow();
});
