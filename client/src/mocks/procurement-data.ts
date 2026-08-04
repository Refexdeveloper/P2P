export const purchaseRequests = [
  {
    id: "PR-2024-001",
    title: "Office Supplies - Q1 2024",
    requester: "Sarah Johnson",
    department: "Operations",
    amount: 2450.00,
    currency: "USD",
    status: "pending_approval",
    priority: "medium",
    createdDate: "2024-01-15",
    items: 12
  },
  {
    id: "PR-2024-002",
    title: "IT Equipment Upgrade",
    requester: "Michael Chen",
    department: "IT",
    amount: 15800.00,
    currency: "USD",
    status: "approved",
    priority: "high",
    createdDate: "2024-01-14",
    items: 8
  },
  {
    id: "PR-2024-003",
    title: "Marketing Materials",
    requester: "Emily Davis",
    department: "Marketing",
    amount: 3200.00,
    currency: "USD",
    status: "rejected",
    priority: "low",
    createdDate: "2024-01-13",
    items: 5
  },
  {
    id: "PR-2024-004",
    title: "Software Licenses Renewal",
    requester: "David Wilson",
    department: "IT",
    amount: 8900.00,
    currency: "USD",
    status: "pending_approval",
    priority: "high",
    createdDate: "2024-01-12",
    items: 3
  },
  {
    id: "PR-2024-005",
    title: "Facility Maintenance Equipment",
    requester: "Lisa Anderson",
    department: "Facilities",
    amount: 5600.00,
    currency: "USD",
    status: "in_review",
    priority: "medium",
    createdDate: "2024-01-11",
    items: 15
  }
];

export const purchaseOrders = [
  {
    id: "PO-2024-001",
    vendor: "TechSupply Inc.",
    amount: 15800.00,
    currency: "USD",
    status: "issued",
    issueDate: "2024-01-16",
    deliveryDate: "2024-02-01",
    items: 8
  },
  {
    id: "PO-2024-002",
    vendor: "Office Depot",
    amount: 2450.00,
    currency: "USD",
    status: "delivered",
    issueDate: "2024-01-10",
    deliveryDate: "2024-01-20",
    items: 12
  },
  {
    id: "PO-2024-003",
    vendor: "Global Software Solutions",
    amount: 8900.00,
    currency: "USD",
    status: "pending",
    issueDate: "2024-01-15",
    deliveryDate: "2024-02-05",
    items: 3
  }
];

export const invoices = [
  {
    id: "INV-2024-001",
    vendor: "Office Depot",
    poNumber: "PO-2024-002",
    amount: 2450.00,
    currency: "USD",
    status: "paid",
    invoiceDate: "2024-01-21",
    dueDate: "2024-02-20",
    paidDate: "2024-01-25"
  },
  {
    id: "INV-2024-002",
    vendor: "TechSupply Inc.",
    poNumber: "PO-2024-001",
    amount: 15800.00,
    currency: "USD",
    status: "pending_payment",
    invoiceDate: "2024-01-22",
    dueDate: "2024-02-21",
    paidDate: null
  },
  {
    id: "INV-2024-003",
    vendor: "Global Software Solutions",
    poNumber: "PO-2024-003",
    amount: 8900.00,
    currency: "USD",
    status: "under_review",
    invoiceDate: "2024-01-23",
    dueDate: "2024-02-22",
    paidDate: null
  }
];

export const activities = [
  {
    id: 1,
    type: "approval",
    user: "John Smith",
    action: "approved",
    target: "PR-2024-002",
    timestamp: "2024-01-16T10:30:00",
    description: "Approved purchase request for IT Equipment Upgrade"
  },
  {
    id: 2,
    type: "creation",
    user: "Sarah Johnson",
    action: "created",
    target: "PR-2024-001",
    timestamp: "2024-01-15T14:20:00",
    description: "Created new purchase request for Office Supplies"
  },
  {
    id: 3,
    type: "rejection",
    user: "Robert Brown",
    action: "rejected",
    target: "PR-2024-003",
    timestamp: "2024-01-15T09:15:00",
    description: "Rejected purchase request - Budget constraints"
  },
  {
    id: 4,
    type: "payment",
    user: "Finance Team",
    action: "processed",
    target: "INV-2024-001",
    timestamp: "2024-01-25T11:45:00",
    description: "Payment processed for invoice INV-2024-001"
  },
  {
    id: 5,
    type: "delivery",
    user: "System",
    action: "updated",
    target: "PO-2024-002",
    timestamp: "2024-01-20T16:00:00",
    description: "Purchase order marked as delivered"
  }
];

export const notifications = [
  {
    id: 1,
    type: "approval_required",
    title: "Approval Required",
    message: "PR-2024-004 requires your approval",
    timestamp: "2024-01-16T09:00:00",
    read: false,
    priority: "high"
  },
  {
    id: 2,
    type: "payment_due",
    title: "Payment Due Soon",
    message: "Invoice INV-2024-002 is due in 5 days",
    timestamp: "2024-01-16T08:30:00",
    read: false,
    priority: "medium"
  },
  {
    id: 3,
    type: "delivery_update",
    title: "Delivery Confirmed",
    message: "PO-2024-002 has been delivered",
    timestamp: "2024-01-20T16:00:00",
    read: true,
    priority: "low"
  },
  {
    id: 4,
    type: "budget_alert",
    title: "Budget Alert",
    message: "IT Department has used 75% of Q1 budget",
    timestamp: "2024-01-15T10:00:00",
    read: true,
    priority: "medium"
  },
  {
    id: 5,
    type: "approval_completed",
    title: "Approval Completed",
    message: "Your request PR-2024-002 has been approved",
    timestamp: "2024-01-16T10:30:00",
    read: true,
    priority: "low"
  }
];

export const dashboardStats = {
  totalSpend: 125400.00,
  pendingApprovals: 8,
  activeOrders: 15,
  overdueInvoices: 2,
  savingsThisMonth: 12500.00,
  averageProcessingTime: 3.2
};

export const vendors = [
  {
    id: "V-001",
    name: "TechSupply Inc.",
    category: "IT Equipment",
    rating: 4.8,
    totalOrders: 45,
    totalSpend: 234500.00,
    status: "active"
  },
  {
    id: "V-002",
    name: "Office Depot",
    category: "Office Supplies",
    rating: 4.5,
    totalOrders: 128,
    totalSpend: 89200.00,
    status: "active"
  },
  {
    id: "V-003",
    name: "Global Software Solutions",
    category: "Software",
    rating: 4.9,
    totalOrders: 23,
    totalSpend: 156700.00,
    status: "active"
  }
];

export const budgetData = [
  {
    department: "IT",
    allocated: 50000.00,
    spent: 37500.00,
    remaining: 12500.00,
    percentage: 75
  },
  {
    department: "Operations",
    allocated: 30000.00,
    spent: 18000.00,
    remaining: 12000.00,
    percentage: 60
  },
  {
    department: "Marketing",
    allocated: 25000.00,
    spent: 15000.00,
    remaining: 10000.00,
    percentage: 60
  },
  {
    department: "Facilities",
    allocated: 20000.00,
    spent: 8000.00,
    remaining: 12000.00,
    percentage: 40
  }
];