export const mockCTOStats = {
    totalProjects: 8,
    openProjects: 6,
    closedProjects: 2,
    highRiskProjects: 2,
    delayedProjects: 3,
    totalTasks: 15,
    completedTasks: 6,
    aiUsage: {
        activeModels: 3,
        queriesThisMonth: 1284,
        automationSaved: '142 hrs',
    },
    ragDistribution: {
        red: 2,
        amber: 2,
        green: 4,
    },
    integrations: [
        { name: 'SAP S/4HANA', status: 'Connected', lastSync: '2 min ago', icon: 'ri-database-2-line' },
        { name: 'Tally ERP', status: 'Connected', lastSync: '15 min ago', icon: 'ri-calculator-line' },
        { name: 'Power BI', status: 'Connected', lastSync: '1 hr ago', icon: 'ri-bar-chart-grouped-line' },
        { name: 'Salesforce', status: 'Disconnected', lastSync: 'N/A', icon: 'ri-cloud-line' },
    ],
    monthlyProgress: [
        { month: 'Oct', completed: 3, total: 5 },
        { month: 'Nov', completed: 4, total: 6 },
        { month: 'Dec', completed: 2, total: 4 },
        { month: 'Jan', completed: 5, total: 7 },
        { month: 'Feb', completed: 4, total: 6 },
        { month: 'Mar', completed: 2, total: 8 },
    ],
};
export const mockPMStats = {
    myProjects: 4,
    totalTasks: 10,
    completedTasks: 4,
    overdueTasks: 2,
    upcomingDeadlines: [
        { task: 'Data Migration Scripts', project: 'SAP S/4HANA Migration', dueDate: '2026-04-10', urgency: 'high' },
        { task: 'Report Design & Visualization', project: 'Power BI Analytics', dueDate: '2026-03-15', urgency: 'medium' },
        { task: 'Sync Logic & Error Handling', project: 'Tally-ERP Integration', dueDate: '2026-03-31', urgency: 'medium' },
        { task: 'Frontend Implementation', project: 'Mobile App Revamp', dueDate: '2026-04-15', urgency: 'low' },
    ],
    taskProgress: {
        pending: 4,
        inProgress: 6,
        completed: 5,
    },
};
export const mockNotifications = [
    { id: '1', type: 'warning', message: 'SAP Migration task overdue by 12 days', time: '2 min ago', read: false },
    { id: '2', type: 'info', message: 'Power BI Dashboard — 62% complete', time: '1 hr ago', read: false },
    { id: '3', type: 'success', message: 'Tally ERP API task completed by Suresh', time: '3 hrs ago', read: true },
    { id: '4', type: 'warning', message: 'Cloud Cost project aging — 18 days delayed', time: '5 hrs ago', read: true },
    { id: '5', type: 'info', message: 'New task assigned: Penetration Testing', time: '1 day ago', read: true },
];
