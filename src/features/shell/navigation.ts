import { isAvailableRole, type AvailableRole, type SystemRole } from "@/features/auth/types/auth";

const operational = [
  { href: "/", label: "Inicio", icon: "home", description: "Área actual" },
  { href: "/clients", label: "Clientes", icon: "clients", description: "Contexto de clientes" },
  { href: "/projects", label: "Proyectos", icon: "projects", description: "Expedientes disponibles" },
  { href: "/tasks", label: "Tareas", icon: "tasks", description: "Trabajo y vencimientos" },
  { href: "/notifications", label: "Notificaciones", icon: "notifications", description: "Actividad y alertas" },
] as const;
const management = [
  { href: "/management", label: "Resumen", icon: "home", description: "Resumen ejecutivo" },
  { href: "/management/tasks", label: "Operación", icon: "tasks", description: "Operación transversal" },
  operational[1], operational[2],
] as const;
// Areas without a client-portfolio role see only their projects, tasks and alerts.
const workspace = [operational[0], operational[2], operational[3], operational[4]] as const;
export const navigationByRole = {
  OperationsHead: [{ href: "/operations", label: "Preparaciones", icon: "tasks", description: "Revisión documental de Operaciones" }] as const,
  CommercialAdvisor: operational, Budgets: workspace, CommercialHead: operational, Accounting: workspace, Installation: workspace, Engineering: workspace, Management: management,
} satisfies Record<AvailableRole, readonly { href: string; label: string; icon: string; description: string }[]>;
export const capabilitiesByRole = {
  OperationsHead: { createClient: false, createProject: false, emptyProjects: "Consulta las liberaciones en Preparaciones." },
  CommercialAdvisor: { createClient: true, createProject: true, emptyProjects: "Todavía no hay proyectos." },
  Budgets: { createClient: false, createProject: false, emptyProjects: "No tienes proyectos disponibles en Presupuestos." },
  CommercialHead: { createClient: false, createProject: false, emptyProjects: "No tienes proyectos disponibles en Jefatura Comercial." },
  Accounting: { createClient: false, createProject: false, emptyProjects: "No tienes proyectos disponibles en Contabilidad." },
  Installation: { createClient: false, createProject: false, emptyProjects: "No tienes proyectos disponibles en Instalación." },
  Engineering: { createClient: false, createProject: false, emptyProjects: "No tienes proyectos disponibles en Ingeniería." },
  Management: { createClient: false, createProject: false, emptyProjects: "Todavía no hay proyectos." },
} satisfies Record<AvailableRole, { createClient: boolean; createProject: boolean; emptyProjects: string }>;
export function navigationFor(role: SystemRole | null, ownedRoles: readonly SystemRole[]) { return role && ownedRoles.includes(role) && isAvailableRole(role) ? navigationByRole[role] : []; }
export function capabilitiesFor(role: SystemRole | null) {
  return role && isAvailableRole(role) ? capabilitiesByRole[role] : { createClient: false, createProject: false, emptyProjects: "No hay proyectos disponibles." };
}
