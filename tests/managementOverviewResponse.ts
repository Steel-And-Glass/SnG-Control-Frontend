// Exact anonymized HTTP 200 body supplied from browser Network by the user.
export const managementOverviewResponse = {
  totalProjects: 10,
  tasks: { pending: 3, inProgress: 4, completed: 38 },
  leadTime: {
    notStarted: 3, onTrack: 0, dueSoon: 0, dueToday: 0, overdue: 1,
    completedOnTime: 23, completedLate: 0, untrackedLegacy: 18,
  },
  areas: [
    { area: "Commercial", pending: 0, inProgress: 1, completed: 17, overdue: 1, dueToday: 0, dueSoon: 0 },
    { area: "Budgets", pending: 2, inProgress: 0, completed: 8, overdue: 0, dueToday: 0, dueSoon: 0 },
    { area: "Accounting", pending: 0, inProgress: 0, completed: 6, overdue: 0, dueToday: 0, dueSoon: 0 },
    { area: "Installation", pending: 0, inProgress: 1, completed: 5, overdue: 0, dueToday: 0, dueSoon: 0 },
    { area: "Engineering", pending: 1, inProgress: 2, completed: 2, overdue: 0, dueToday: 0, dueSoon: 0 },
  ],
  attention: {
    total: 1,
    items: [{
      taskId: "11111111-1111-4111-8111-111111111111",
      projectId: "22222222-2222-4222-8222-222222222222",
      projectName: "Proyecto de prueba", clientName: "Cliente de prueba", sgCode: "SG000",
      area: "Commercial", taskType: "PresentQuotationToClient", taskStatus: "InProgress",
      leadTimeStatus: "Overdue", deadlineAt: "2026-10-30T22:00:00Z",
      startedAt: "2026-10-24T13:57:01.582491Z",
    }],
  },
};
