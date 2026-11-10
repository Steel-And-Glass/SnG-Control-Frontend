import { expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { parseCommercialOpening } from "@/features/engineering/commercialOpeningContracts";
import { parseEngineering } from "@/features/engineering/contracts";
import { CommercialOpeningPanel } from "@/features/engineering/CommercialOpeningPanel";
import { mockBackend, renderOperational } from "./operationalFixtures";
import { user } from "./fixtures";
import commercial from "./fixtures/incremental-e2e/commercial-state.json";
import engineering from "./fixtures/incremental-e2e/engineering-state.json";
import measurements from "./fixtures/incremental-e2e/measurement-state.json";

// Synthetic responses captured from IncrementalEndToEndTests through the real Next BFF.
it("accepts actual HTTP contracts and preserves the two tranches and independent Actas", () => {
  const state = parseCommercialOpening(commercial, commercial.projectId);
  const work = parseEngineering(engineering, commercial.projectId);
  expect(work.total).toBe(10);
  expect(work.deliveries?.map(d => d.structureIds.length)).toEqual([4, 6]);
  expect(measurements.deliveries.map(d => d.structureIds.length)).toEqual([4, 6]);
  expect(state.actas.map(a => a.rounds.length)).toEqual([2, 1]);
  expect(state.actas.flatMap(a => a.acceptances)).toHaveLength(4);
  expect(state.actas[0].rounds[1].structures.every(r => r.approval === "Confirmed")).toBe(true);
  expect(state.actas[1].rounds[0].structures.map(r => r.approval)).toEqual(["Confirmed", "AwaitingApproval"]);
});

it("renders real server evidence and keeps the pending unit isolated in Acta B", async () => {
  mockBackend(path => path.endsWith("/incremental-opening-records") ? commercial : new Response(null, { status: 404 }));
  renderOperational(<CommercialOpeningPanel projectId={commercial.projectId} onRefresh={vi.fn()} />,
    { ...user, subject: "advisor", roles: ["CommercialAdvisor"] });
  await screen.findByRole("heading", { name: /Ronda 2/ });
  expect(screen.queryByRole("button", { name: "Confirmar aceptación parcial" })).not.toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText("Acta"), commercial.actas[1].id);
  await screen.findByRole("heading", { name: /Ronda 1/ });
  expect(screen.getAllByRole("article", { name: /^Ítem/ })).toHaveLength(2);
  expect(screen.getByText(/^Pendiente de respuesta ·/)).toBeInTheDocument();
  expect(screen.getAllByRole("checkbox", { name: /^Seleccionar/ })).toHaveLength(1);
});
