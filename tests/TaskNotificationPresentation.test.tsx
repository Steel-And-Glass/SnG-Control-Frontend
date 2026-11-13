import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { sortTasksByUrgency } from "@/features/tasks/TaskList";
import { TaskSummary } from "@/features/tasks/TaskSummary";
import type { ProjectTask } from "@/features/tasks/types";

const task = (id: string, leadTimeStatus: ProjectTask["leadTimeStatus"], deadlineAt: string | null) =>
  ({ id, leadTimeStatus, deadlineAt }) as ProjectTask;

describe("task presentation", () => {
  it("orders by urgency, then nearest deadline, deadline-less last", () => {
    const sorted = sortTasksByUrgency([
      task("ok", "OnTrack", "2026-12-01T00:00:00Z"),
      task("late-b", "Overdue", null),
      task("late-a", "Overdue", "2026-11-01T00:00:00Z"),
      task("today", "DueToday", "2026-11-13T22:00:00Z"),
    ]);
    expect(sorted.map(t => t.id)).toEqual(["late-a", "late-b", "today", "ok"]);
  });
  it("summarizes counts of loaded tasks", () => {
    render(<TaskSummary tasks={[task("a", "Overdue", null), task("b", "Overdue", null), task("c", "DueToday", null)]} />);
    expect(screen.getByText("Atrasadas").nextElementSibling).toHaveTextContent("2");
    expect(screen.getByText("Vencen hoy").nextElementSibling).toHaveTextContent("1");
    expect(screen.getByText("Total").nextElementSibling).toHaveTextContent("3");
  });
});
