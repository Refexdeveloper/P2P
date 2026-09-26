/** Fallback notifications for employee header when not supplied by Kissflow flows. */
export const employeeNotifications = [
  {
    id: 'n1',
    type: 'deadline',
    message: 'Project review deadline approaching',
    time: '2h ago',
    read: false,
  },
  {
    id: 'n2',
    type: 'update',
    message: 'Timeline revised on a project you follow',
    time: 'Yesterday',
    read: true,
  },
];
