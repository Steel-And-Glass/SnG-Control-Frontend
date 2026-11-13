import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManagementOverviewPage } from "@/features/management/ManagementOverviewPage";
import { parseManagementDataset } from "@/features/management/dashboardDataset";
import { formatDecimal, sumDecimals } from "@/features/management/dashboardMath";
import { ApiError } from "@/lib/api/apiError";
import { isBackendPath } from "@/lib/api/backendPath";
import { mockBackend, renderOperational } from "./operationalFixtures";
import { manager } from "./managementFixtures";
import { datasetFixture } from "./managementDatasetFixtures";

const kpi = (label: string) => screen.getAllByText(label)[0].parentElement!;
const projectsSection = () => screen.getByRole("heading", { name: "Seguimiento por proyecto" }).parentElement!;
const projectLinks = () => within(projectsSection()).queryAllByRole("link").map((link) => link.textContent);

describe("management dashboard dataset", () => {
  it("accepts the closed contract and rejects drift in shape and exact values", () => {
    expect(parseManagementDataset(datasetFixture)).toEqual(datasetFixture);
    const [first, ...rest] = datasetFixture.projects;
    const drift = [
      { ...datasetFixture, currencyCode: "USD" },
      { ...datasetFixture, unknown: true },
      { ...datasetFixture, projects: [{ ...first, quotedValue: 1500000 }, ...rest] },
      { ...datasetFixture, projects: [{ ...first, quotedSquareMeters: "1e3" }, ...rest] },
      { ...datasetFixture, totals: { ...datasetFixture.totals, projectCount: 99 } },
    ];
    for (const payload of drift) expect(() => parseManagementDataset(payload)).toThrow(ApiError);
  });

  it("sums and rounds decimals without floating point", () => {
    expect(sumDecimals(["0.1", "0.2"])).toBe("0.3");
    expect(sumDecimals(["12.3456789", "0.5"])).toBe("12.8456789");
    expect(sumDecimals([])).toBeNull();
    expect(formatDecimal("1750000.50", 0)).toBe("1.750.001");
    expect(formatDecimal("12.8456789", 2)).toBe("12,85");
  });
});

describe("management dashboard view", () => {
  it("loads once and applies every selection in memory", async () => {
    const fetchMock = mockBackend(() => datasetFixture);
    renderOperational(<ManagementOverviewPage />, manager);
    await screen.findByRole("heading", { name: "Seguimiento por proyecto" });
    expect(within(kpi("Atrasadas")).getByText("1")).toBeInTheDocument();
    expect(within(kpi("Entregas a tiempo")).getByText("50%")).toBeInTheDocument();
    expect(within(kpi("Valor cotizado")).getByText("COP 1.750.001")).toBeInTheDocument();
    expect(within(kpi("m² cotizados")).getByText("12,85 m²")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Área"), "Engineering");
    expect(within(kpi("Tareas en curso")).getByText("1")).toBeInTheDocument();
    expect(within(kpi("Entregas a tiempo")).getByText("Aún no hay entregas cerradas")).toBeInTheDocument();
    expect(within(kpi("Valor cotizado")).getByText("COP 1.500.000")).toBeInTheDocument();
    expect(projectLinks()).toEqual(["SG001 · Proyecto Norte"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/backend/management/dashboard-dataset");
  });

  it("resets the project when the client changes and clears all filters in one step", async () => {
    mockBackend(() => datasetFixture);
    renderOperational(<ManagementOverviewPage />, manager);
    await screen.findByRole("heading", { name: "Seguimiento por proyecto" });
    expect(projectLinks()).toHaveLength(3);

    await userEvent.selectOptions(screen.getByLabelText("Cliente"), "client-2");
    expect(projectLinks()).toEqual(["Proyecto Sur", "SG004 · Proyecto Terminado"]);

    await userEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(screen.getByLabelText("Cliente")).toHaveValue("");
    expect(projectLinks()).toHaveLength(3);
  });

  it("hands the current selection to the task list", async () => {
    mockBackend(() => datasetFixture);
    renderOperational(<ManagementOverviewPage />, manager);
    await screen.findByRole("heading", { name: "Seguimiento por proyecto" });
    await userEvent.selectOptions(screen.getByLabelText("Área"), "Budgets");
    expect(screen.getByRole("link", { name: "Ver tareas con estos filtros" })).toHaveAttribute("href", "/management/tasks?area=Budgets");
  });

  it("renders plain manager language without backend internals", async () => {
    mockBackend(() => datasetFixture);
    renderOperational(<ManagementOverviewPage />, manager);
    await screen.findByRole("heading", { name: "Seguimiento por proyecto" });
    const text = (document.body.textContent ?? "").toLowerCase();
    for (const term of ["endpoint", "backend", "snapshot", "dataset", "lead time", "clasificación", "sin sla"]) {
      expect(text).not.toContain(term);
    }
  });

  it("shows empty states without invented rows", async () => {
    const empty = { ...datasetFixture, tasks: [], projects: [], totals: { ...datasetFixture.totals, projectCount: 0, quotationCount: 0, quotedItems: 0, quotedSquareMeters: null, quotedValue: "0.00", completedOnTime: 0, completedLate: 0 } };
    mockBackend(() => empty);
    renderOperational(<ManagementOverviewPage />, manager);
    expect(await screen.findByText("No hay proyectos para estos filtros.")).toBeInTheDocument();
    expect(screen.getByText("No hay tareas atrasadas ni por vencer en estos filtros.")).toBeInTheDocument();
    expect(within(kpi("Valor cotizado")).getByText("—")).toBeInTheDocument();
  });

  it("shows a safe error, hides the response body and retries", async () => {
    let failed = true;
    mockBackend(() => (failed ? Response.json({ detail: "secret network path" }, { status: 503 }) : datasetFixture));
    renderOperational(<ManagementOverviewPage />, manager);
    await screen.findByRole("alert");
    expect(screen.queryByText(/secret network path/)).not.toBeInTheDocument();
    failed = false;
    await userEvent.click(screen.getByRole("button", { name: "Volver a cargar" }));
    await screen.findByRole("heading", { name: "Seguimiento por proyecto" });
  });
});

describe("management dashboard transport", () => {
  it("allows the dashboard dataset through the BFF path allowlist", () => {
    expect(isBackendPath(["management", "dashboard-dataset"])).toBe(true);
    expect(isBackendPath(["management", "dashboard-dataset", "extra"])).toBe(false);
  });
});
