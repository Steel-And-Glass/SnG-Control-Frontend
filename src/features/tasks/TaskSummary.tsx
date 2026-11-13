import type { ProjectTask } from "./types";
import styles from "./TaskList.module.css";

// Quick read of what needs attention first; counts come from the tasks already loaded.
export function TaskSummary({ tasks }: { tasks: readonly ProjectTask[] }) {
  const count = (...statuses: ProjectTask["leadTimeStatus"][]) => tasks.filter(task => statuses.includes(task.leadTimeStatus)).length;
  const items = [
    { label: "Atrasadas", value: count("Overdue"), tone: styles.toneDanger },
    { label: "Vencen hoy", value: count("DueToday"), tone: styles.toneWarning },
    { label: "Vencen pronto", value: count("DueSoon"), tone: styles.toneWarning },
    { label: "Total", value: tasks.length, tone: "" },
  ];
  return <dl className={styles.summary} aria-label="Resumen de tareas">
    {items.map(item => <div key={item.label} className={`${styles.summaryItem} ${item.value > 0 ? item.tone : ""}`}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
  </dl>;
}
