export const prManagerStats = {
  totalPRs: 156,
  pendingApproval: 18,
  approvedThisMonth: 42,
  rejected: 8,
  overdueCount: 5,
  totalSpend: 8750000
};

export const departmentBudgetData = [
  { department: 'IT & Technology', allocated: 5000000, utilized: 3850000, percentage: 77 },
  { department: 'Operations', allocated: 3500000, utilized: 2940000, percentage: 84 },
  { department: 'Marketing', allocated: 2000000, utilized: 1200000, percentage: 60 },
  { department: 'HR & Admin', allocated: 1500000, utilized: 980000, percentage: 65 },
  { department: 'Finance', allocated: 1000000, utilized: 780000, percentage: 78 }
];

export const prManagerPRList = [
  {
    id: 'PR-2024-001',
    title: 'Dell Laptops for Development Team',
    requester: 'Rajesh Kumar',
    department: 'IT & Technology',
    amount: 450000,
    priority: 'High',
    status: 'Pending Approval',
    submittedDate: '2024-01-15',
    dueDate: '2024-01-20',
    isOverdue: false,
    justification: 'Current laptops are 4+ years old and causing productivity issues. Development team needs upgraded hardware for new project requirements.',
    lineItems: [
      { item: 'Dell Latitude 5540', category: 'Laptops', quantity: 5, unitPrice: 75000, total: 375000 },
      { item: 'Laptop Bags', category: 'Accessories', quantity: 5, unitPrice: 2500, total: 12500 },
      { item: 'Extended Warranty (3 Years)', category: 'Services', quantity: 5, unitPrice: 12500, total: 62500 }
    ],
    approvalHistory: [
      { stage: 'Submitted', user: 'Rajesh Kumar', role: 'Requester', date: '2024-01-15 10:30 AM', status: 'Completed', remarks: 'Urgent requirement for Q1 project' },
      { stage: 'HOD Review', user: 'Amit Sharma', role: 'HOD - IT', date: '2024-01-15 02:45 PM', status: 'Approved', remarks: 'Approved. Critical for project delivery.' }
    ]
  },
  {
    id: 'PR-2024-002',
    title: 'Office Furniture for New Workspace',
    requester: 'Priya Mehta',
    department: 'HR & Admin',
    amount: 280000,
    priority: 'Medium',
    status: 'Pending Approval',
    submittedDate: '2024-01-16',
    dueDate: '2024-01-22',
    isOverdue: false,
    justification: 'New office space expansion requires ergonomic furniture for 15 workstations to maintain employee comfort and productivity.',
    lineItems: [
      { item: 'Ergonomic Office Chairs', category: 'Furniture', quantity: 15, unitPrice: 12000, total: 180000 },
      { item: 'Height Adjustable Desks', category: 'Furniture', quantity: 15, unitPrice: 6000, total: 90000 },
      { item: 'Storage Cabinets', category: 'Furniture', quantity: 5, unitPrice: 2000, total: 10000 }
    ],
    approvalHistory: [
      { stage: 'Submitted', user: 'Priya Mehta', role: 'Requester', date: '2024-01-16 09:15 AM', status: 'Completed', remarks: 'Required for office expansion by Feb 1st' },
      { stage: 'HOD Review', user: 'Sunita Rao', role: 'HOD - HR', date: '2024-01-16 11:30 AM', status: 'Approved', remarks: 'Approved for new workspace setup' }
    ]
  },
  {
    id: 'PR-2024-003',
    title: 'Marketing Campaign Materials',
    requester: 'Vikram Singh',
    department: 'Marketing',
    amount: 185000,
    priority: 'High',
    status: 'Pending Approval',
    submittedDate: '2024-01-14',
    dueDate: '2024-01-18',
    isOverdue: true,
    justification: 'Q1 product launch campaign requires promotional materials, banners, and digital assets. Campaign starts Jan 25th.',
    lineItems: [
      { item: 'Printed Brochures (10,000 units)', category: 'Marketing Materials', quantity: 1, unitPrice: 85000, total: 85000 },
      { item: 'Roll-up Banners', category: 'Marketing Materials', quantity: 20, unitPrice: 3500, total: 70000 },
      { item: 'Digital Ad Creative Package', category: 'Services', quantity: 1, unitPrice: 30000, total: 30000 }
    ],
    approvalHistory: [
      { stage: 'Submitted', user: 'Vikram Singh', role: 'Requester', date: '2024-01-14 03:20 PM', status: 'Completed', remarks: 'Urgent - Campaign launch on Jan 25th' },
      { stage: 'HOD Review', user: 'Neha Gupta', role: 'HOD - Marketing', date: '2024-01-15 10:00 AM', status: 'Approved', remarks: 'Critical for product launch' }
    ]
  },
  {
    id: 'PR-2024-004',
    title: 'Server Infrastructure Upgrade',
    requester: 'Anil Desai',
    department: 'IT & Technology',
    amount: 950000,
    priority: 'Critical',
    status: 'Pending Approval',
    submittedDate: '2024-01-13',
    dueDate: '2024-01-17',
    isOverdue: true,
    justification: 'Current server capacity at 92%. Immediate upgrade needed to prevent service disruptions and support growing user base.',
    lineItems: [
      { item: 'Dell PowerEdge R750 Server', category: 'Hardware', quantity: 2, unitPrice: 380000, total: 760000 },
      { item: 'Enterprise SSD Storage (4TB)', category: 'Hardware', quantity: 4, unitPrice: 35000, total: 140000 },
      { item: 'Installation & Configuration', category: 'Services', quantity: 1, unitPrice: 50000, total: 50000 }
    ],
    approvalHistory: [
      { stage: 'Submitted', user: 'Anil Desai', role: 'Requester', date: '2024-01-13 11:45 AM', status: 'Completed', remarks: 'Critical infrastructure upgrade - capacity at 92%' },
      { stage: 'HOD Review', user: 'Amit Sharma', role: 'HOD - IT', date: '2024-01-13 04:30 PM', status: 'Approved', remarks: 'Urgent approval needed to prevent downtime' }
    ]
  },
  {
    id: 'PR-2024-005',
    title: 'Training Program Materials',
    requester: 'Kavita Joshi',
    department: 'HR & Admin',
    amount: 125000,
    priority: 'Medium',
    status: 'Approved',
    submittedDate: '2024-01-10',
    dueDate: '2024-01-16',
    isOverdue: false,
    justification: 'Q1 employee training program requires learning materials, certification courses, and workshop supplies for 50 employees.',
    lineItems: [
      { item: 'Online Course Licenses (50 users)', category: 'Training', quantity: 1, unitPrice: 75000, total: 75000 },
      { item: 'Training Manuals & Workbooks', category: 'Materials', quantity: 50, unitPrice: 800, total: 40000 },
      { item: 'Workshop Supplies Kit', category: 'Materials', quantity: 1, unitPrice: 10000, total: 10000 }
    ],
    approvalHistory: [
      { stage: 'Submitted', user: 'Kavita Joshi', role: 'Requester', date: '2024-01-10 09:00 AM', status: 'Completed', remarks: 'Required for Q1 training program' },
      { stage: 'HOD Review', user: 'Sunita Rao', role: 'HOD - HR', date: '2024-01-10 02:15 PM', status: 'Approved', remarks: 'Approved for training initiative' },
      { stage: 'PR Manager Review', user: 'Deepak Verma', role: 'PR Manager', date: '2024-01-11 10:30 AM', status: 'Approved', remarks: 'Approved. Within budget allocation.' }
    ]
  },
  {
    id: 'PR-2024-006',
    title: 'Warehouse Equipment Purchase',
    requester: 'Suresh Patil',
    department: 'Operations',
    amount: 680000,
    priority: 'High',
    status: 'Pending Approval',
    submittedDate: '2024-01-15',
    dueDate: '2024-01-21',
    isOverdue: false,
    justification: 'Warehouse expansion requires additional material handling equipment to improve efficiency and reduce manual labor.',
    lineItems: [
      { item: 'Electric Forklift (2 Ton)', category: 'Equipment', quantity: 2, unitPrice: 280000, total: 560000 },
      { item: 'Pallet Jacks', category: 'Equipment', quantity: 6, unitPrice: 15000, total: 90000 },
      { item: 'Safety Equipment & Training', category: 'Services', quantity: 1, unitPrice: 30000, total: 30000 }
    ],
    approvalHistory: [
      { stage: 'Submitted', user: 'Suresh Patil', role: 'Requester', date: '2024-01-15 01:45 PM', status: 'Completed', remarks: 'Required for warehouse expansion project' },
      { stage: 'HOD Review', user: 'Ramesh Iyer', role: 'HOD - Operations', date: '2024-01-16 09:30 AM', status: 'Approved', remarks: 'Critical for operational efficiency' }
    ]
  },
  {
    id: 'PR-2024-007',
    title: 'Software Licenses Renewal',
    requester: 'Meera Nair',
    department: 'IT & Technology',
    amount: 320000,
    priority: 'High',
    status: 'Pending Approval',
    submittedDate: '2024-01-12',
    dueDate: '2024-01-16',
    isOverdue: true,
    justification: 'Annual renewal of critical software licenses expiring Jan 31st. Includes project management, design tools, and security software.',
    lineItems: [
      { item: 'Jira & Confluence (100 users)', category: 'Software', quantity: 1, unitPrice: 150000, total: 150000 },
      { item: 'Adobe Creative Cloud (20 users)', category: 'Software', quantity: 1, unitPrice: 120000, total: 120000 },
      { item: 'Antivirus Enterprise (200 devices)', category: 'Software', quantity: 1, unitPrice: 50000, total: 50000 }
    ],
    approvalHistory: [
      { stage: 'Submitted', user: 'Meera Nair', role: 'Requester', date: '2024-01-12 10:15 AM', status: 'Completed', remarks: 'Licenses expiring Jan 31st - renewal required' },
      { stage: 'HOD Review', user: 'Amit Sharma', role: 'HOD - IT', date: '2024-01-12 03:45 PM', status: 'Approved', remarks: 'Critical renewal - approved' }
    ]
  },
  {
    id: 'PR-2024-008',
    title: 'Office Stationery & Supplies',
    requester: 'Anjali Reddy',
    department: 'HR & Admin',
    amount: 45000,
    priority: 'Low',
    status: 'Approved',
    submittedDate: '2024-01-08',
    dueDate: '2024-01-15',
    isOverdue: false,
    justification: 'Monthly office supplies replenishment for all departments. Standard recurring purchase.',
    lineItems: [
      { item: 'Printer Paper (A4, 100 reams)', category: 'Stationery', quantity: 1, unitPrice: 25000, total: 25000 },
      { item: 'Writing Instruments & Supplies', category: 'Stationery', quantity: 1, unitPrice: 12000, total: 12000 },
      { item: 'Miscellaneous Office Supplies', category: 'Stationery', quantity: 1, unitPrice: 8000, total: 8000 }
    ],
    approvalHistory: [
      { stage: 'Submitted', user: 'Anjali Reddy', role: 'Requester', date: '2024-01-08 11:20 AM', status: 'Completed', remarks: 'Monthly supplies replenishment' },
      { stage: 'HOD Review', user: 'Sunita Rao', role: 'HOD - HR', date: '2024-01-08 02:00 PM', status: 'Approved', remarks: 'Standard monthly order - approved' },
      { stage: 'PR Manager Review', user: 'Deepak Verma', role: 'PR Manager', date: '2024-01-09 09:15 AM', status: 'Approved', remarks: 'Routine purchase approved' }
    ]
  },
  {
    id: 'PR-2024-009',
    title: 'Customer Service Headsets',
    requester: 'Pooja Sharma',
    department: 'Operations',
    amount: 95000,
    priority: 'Medium',
    status: 'Rejected',
    submittedDate: '2024-01-11',
    dueDate: '2024-01-18',
    isOverdue: false,
    justification: 'Replacement headsets for customer service team. Current headsets have audio quality issues.',
    lineItems: [
      { item: 'Jabra Evolve2 65 Headsets', category: 'Electronics', quantity: 25, unitPrice: 3500, total: 87500 },
      { item: 'Replacement Ear Cushions', category: 'Accessories', quantity: 25, unitPrice: 300, total: 7500 }
    ],
    approvalHistory: [
      { stage: 'Submitted', user: 'Pooja Sharma', role: 'Requester', date: '2024-01-11 02:30 PM', status: 'Completed', remarks: 'Audio quality issues with current headsets' },
      { stage: 'HOD Review', user: 'Ramesh Iyer', role: 'HOD - Operations', date: '2024-01-12 10:00 AM', status: 'Approved', remarks: 'Approved for team productivity' },
      { stage: 'PR Manager Review', user: 'Deepak Verma', role: 'PR Manager', date: '2024-01-13 11:45 AM', status: 'Rejected', remarks: 'Budget exhausted for Q1. Please resubmit in Q2 or provide critical business justification.' }
    ]
  },
  {
    id: 'PR-2024-010',
    title: 'Network Security Appliances',
    requester: 'Karthik Menon',
    department: 'IT & Technology',
    amount: 580000,
    priority: 'Critical',
    status: 'Pending Approval',
    submittedDate: '2024-01-11',
    dueDate: '2024-01-15',
    isOverdue: true,
    justification: 'Security audit identified vulnerabilities. Immediate upgrade required to meet compliance standards and protect against cyber threats.',
    lineItems: [
      { item: 'Fortinet FortiGate Firewall', category: 'Security', quantity: 2, unitPrice: 220000, total: 440000 },
      { item: 'Intrusion Detection System', category: 'Security', quantity: 1, unitPrice: 95000, total: 95000 },
      { item: 'Installation & Configuration', category: 'Services', quantity: 1, unitPrice: 45000, total: 45000 }
    ],
    approvalHistory: [
      { stage: 'Submitted', user: 'Karthik Menon', role: 'Requester', date: '2024-01-11 09:30 AM', status: 'Completed', remarks: 'Critical security upgrade - audit findings' },
      { stage: 'HOD Review', user: 'Amit Sharma', role: 'HOD - IT', date: '2024-01-11 01:15 PM', status: 'Approved', remarks: 'Urgent - compliance requirement' }
    ]
  },
  {
    id: 'PR-2024-011',
    title: 'Conference Room AV Equipment',
    requester: 'Sanjay Kulkarni',
    department: 'HR & Admin',
    amount: 240000,
    priority: 'Medium',
    status: 'Approved',
    submittedDate: '2024-01-09',
    dueDate: '2024-01-16',
    isOverdue: false,
    justification: 'Upgrade conference room with modern AV equipment for better client presentations and virtual meetings.',
    lineItems: [
      { item: '75" 4K Display Screen', category: 'Electronics', quantity: 1, unitPrice: 120000, total: 120000 },
      { item: 'Video Conferencing System', category: 'Electronics', quantity: 1, unitPrice: 85000, total: 85000 },
      { item: 'Wireless Presentation System', category: 'Electronics', quantity: 1, unitPrice: 35000, total: 35000 }
    ],
    approvalHistory: [
      { stage: 'Submitted', user: 'Sanjay Kulkarni', role: 'Requester', date: '2024-01-09 10:45 AM', status: 'Completed', remarks: 'Conference room upgrade for client meetings' },
      { stage: 'HOD Review', user: 'Sunita Rao', role: 'HOD - HR', date: '2024-01-09 03:30 PM', status: 'Approved', remarks: 'Approved for facility upgrade' },
      { stage: 'PR Manager Review', user: 'Deepak Verma', role: 'PR Manager', date: '2024-01-10 11:00 AM', status: 'Approved', remarks: 'Approved. Good investment for client engagement.' }
    ]
  },
  {
    id: 'PR-2024-012',
    title: 'Digital Marketing Tools Subscription',
    requester: 'Ritu Agarwal',
    department: 'Marketing',
    amount: 180000,
    priority: 'Medium',
    status: 'Pending Approval',
    submittedDate: '2024-01-16',
    dueDate: '2024-01-23',
    isOverdue: false,
    justification: 'Annual subscription for digital marketing analytics, SEO tools, and social media management platforms to improve campaign ROI.',
    lineItems: [
      { item: 'SEMrush Pro (Annual)', category: 'Software', quantity: 1, unitPrice: 85000, total: 85000 },
      { item: 'Hootsuite Business (Annual)', category: 'Software', quantity: 1, unitPrice: 65000, total: 65000 },
      { item: 'Canva Pro Team (10 users)', category: 'Software', quantity: 1, unitPrice: 30000, total: 30000 }
    ],
    approvalHistory: [
      { stage: 'Submitted', user: 'Ritu Agarwal', role: 'Requester', date: '2024-01-16 02:15 PM', status: 'Completed', remarks: 'Essential tools for digital marketing campaigns' },
      { stage: 'HOD Review', user: 'Neha Gupta', role: 'HOD - Marketing', date: '2024-01-17 10:45 AM', status: 'Approved', remarks: 'Approved - critical for marketing operations' }
    ]
  },
  {
    id: 'PR-2024-013',
    title: 'Vehicle Fleet Maintenance',
    requester: 'Mahesh Rao',
    department: 'Operations',
    amount: 155000,
    priority: 'High',
    status: 'Approved',
    submittedDate: '2024-01-07',
    dueDate: '2024-01-14',
    isOverdue: false,
    justification: 'Scheduled maintenance and repairs for company vehicle fleet. Includes 5 vehicles due for service.',
    lineItems: [
      { item: 'Comprehensive Service (5 vehicles)', category: 'Maintenance', quantity: 1, unitPrice: 95000, total: 95000 },
      { item: 'Tire Replacement (2 vehicles)', category: 'Parts', quantity: 1, unitPrice: 45000, total: 45000 },
      { item: 'Insurance Renewal Processing', category: 'Services', quantity: 1, unitPrice: 15000, total: 15000 }
    ],
    approvalHistory: [
      { stage: 'Submitted', user: 'Mahesh Rao', role: 'Requester', date: '2024-01-07 09:45 AM', status: 'Completed', remarks: 'Scheduled fleet maintenance' },
      { stage: 'HOD Review', user: 'Ramesh Iyer', role: 'HOD - Operations', date: '2024-01-07 01:30 PM', status: 'Approved', remarks: 'Routine maintenance - approved' },
      { stage: 'PR Manager Review', user: 'Deepak Verma', role: 'PR Manager', date: '2024-01-08 10:15 AM', status: 'Approved', remarks: 'Approved for fleet maintenance' }
    ]
  },
  {
    id: 'PR-2024-014',
    title: 'Employee Wellness Program',
    requester: 'Divya Nambiar',
    department: 'HR & Admin',
    amount: 210000,
    priority: 'Low',
    status: 'Pending Approval',
    submittedDate: '2024-01-17',
    dueDate: '2024-01-24',
    isOverdue: false,
    justification: 'Q1 employee wellness initiative including gym memberships, health checkup packages, and wellness workshops for 100 employees.',
    lineItems: [
      { item: 'Gym Membership (100 employees, 3 months)', category: 'Wellness', quantity: 1, unitPrice: 120000, total: 120000 },
      { item: 'Health Checkup Packages', category: 'Healthcare', quantity: 100, unitPrice: 700, total: 70000 },
      { item: 'Wellness Workshop Series', category: 'Services', quantity: 1, unitPrice: 20000, total: 20000 }
    ],
    approvalHistory: [
      { stage: 'Submitted', user: 'Divya Nambiar', role: 'Requester', date: '2024-01-17 11:30 AM', status: 'Completed', remarks: 'Q1 wellness program for employee engagement' },
      { stage: 'HOD Review', user: 'Sunita Rao', role: 'HOD - HR', date: '2024-01-17 03:45 PM', status: 'Approved', remarks: 'Good initiative for employee wellbeing' }
    ]
  },
  {
    id: 'PR-2024-015',
    title: 'Data Backup & Recovery System',
    requester: 'Arjun Pillai',
    department: 'IT & Technology',
    amount: 420000,
    priority: 'High',
    status: 'Pending Approval',
    submittedDate: '2024-01-16',
    dueDate: '2024-01-22',
    isOverdue: false,
    justification: 'Implement automated backup solution with disaster recovery capabilities. Current backup system is outdated and poses data loss risk.',
    lineItems: [
      { item: 'Enterprise Backup Software License', category: 'Software', quantity: 1, unitPrice: 180000, total: 180000 },
      { item: 'NAS Storage Device (20TB)', category: 'Hardware', quantity: 2, unitPrice: 95000, total: 190000 },
      { item: 'Setup & Configuration Services', category: 'Services', quantity: 1, unitPrice: 50000, total: 50000 }
    ],
    approvalHistory: [
      { stage: 'Submitted', user: 'Arjun Pillai', role: 'Requester', date: '2024-01-16 09:00 AM', status: 'Completed', remarks: 'Critical data protection upgrade' },
      { stage: 'HOD Review', user: 'Amit Sharma', role: 'HOD - IT', date: '2024-01-16 02:30 PM', status: 'Approved', remarks: 'Essential for business continuity' }
    ]
  },
  {
    id: 'PR-2024-016',
    title: 'Trade Show Booth Materials',
    requester: 'Nikhil Jain',
    department: 'Marketing',
    amount: 340000,
    priority: 'High',
    status: 'Approved',
    submittedDate: '2024-01-06',
    dueDate: '2024-01-13',
    isOverdue: false,
    justification: 'Participation in industry trade show Feb 15-17. Requires booth setup, promotional materials, and demo equipment.',
    lineItems: [
      { item: 'Modular Booth Setup (3x3m)', category: 'Marketing Materials', quantity: 1, unitPrice: 180000, total: 180000 },
      { item: 'Promotional Materials & Giveaways', category: 'Marketing Materials', quantity: 1, unitPrice: 95000, total: 95000 },
      { item: 'Demo Equipment & Displays', category: 'Equipment', quantity: 1, unitPrice: 65000, total: 65000 }
    ],
    approvalHistory: [
      { stage: 'Submitted', user: 'Nikhil Jain', role: 'Requester', date: '2024-01-06 10:00 AM', status: 'Completed', remarks: 'Trade show participation - Feb 15-17' },
      { stage: 'HOD Review', user: 'Neha Gupta', role: 'HOD - Marketing', date: '2024-01-06 03:15 PM', status: 'Approved', remarks: 'Important industry event - approved' },
      { stage: 'PR Manager Review', user: 'Deepak Verma', role: 'PR Manager', date: '2024-01-07 11:30 AM', status: 'Approved', remarks: 'Approved for brand visibility' }
    ]
  },
  {
    id: 'PR-2024-017',
    title: 'Quality Testing Equipment',
    requester: 'Lakshmi Iyer',
    department: 'Operations',
    amount: 520000,
    priority: 'Medium',
    status: 'Pending Approval',
    submittedDate: '2024-01-17',
    dueDate: '2024-01-24',
    isOverdue: false,
    justification: 'New quality control equipment to improve product testing accuracy and reduce defect rates in manufacturing process.',
    lineItems: [
      { item: 'Digital Measuring Instruments', category: 'Equipment', quantity: 5, unitPrice: 65000, total: 325000 },
      { item: 'Material Testing Machine', category: 'Equipment', quantity: 1, unitPrice: 150000, total: 150000 },
      { item: 'Calibration & Training', category: 'Services', quantity: 1, unitPrice: 45000, total: 45000 }
    ],
    approvalHistory: [
      { stage: 'Submitted', user: 'Lakshmi Iyer', role: 'Requester', date: '2024-01-17 01:45 PM', status: 'Completed', remarks: 'Quality improvement initiative' },
      { stage: 'HOD Review', user: 'Ramesh Iyer', role: 'HOD - Operations', date: '2024-01-18 10:00 AM', status: 'Approved', remarks: 'Will improve quality metrics - approved' }
    ]
  },
  {
    id: 'PR-2024-018',
    title: 'Cloud Storage Expansion',
    requester: 'Pradeep Kumar',
    department: 'IT & Technology',
    amount: 195000,
    priority: 'Medium',
    status: 'Approved',
    submittedDate: '2024-01-05',
    dueDate: '2024-01-12',
    isOverdue: false,
    justification: 'Current cloud storage at 85% capacity. Expansion needed to accommodate growing data requirements and new projects.',
    lineItems: [
      { item: 'AWS S3 Storage (10TB, Annual)', category: 'Cloud Services', quantity: 1, unitPrice: 120000, total: 120000 },
      { item: 'Data Transfer & Migration', category: 'Services', quantity: 1, unitPrice: 45000, total: 45000 },
      { item: 'Backup & Redundancy Setup', category: 'Services', quantity: 1, unitPrice: 30000, total: 30000 }
    ],
    approvalHistory: [
      { stage: 'Submitted', user: 'Pradeep Kumar', role: 'Requester', date: '2024-01-05 02:30 PM', status: 'Completed', remarks: 'Storage capacity expansion required' },
      { stage: 'HOD Review', user: 'Amit Sharma', role: 'HOD - IT', date: '2024-01-06 09:45 AM', status: 'Approved', remarks: 'Necessary infrastructure upgrade' },
      { stage: 'PR Manager Review', user: 'Deepak Verma', role: 'PR Manager', date: '2024-01-06 02:15 PM', status: 'Approved', remarks: 'Approved for infrastructure scaling' }
    ]
  }
];

export const recentActivityData = [
  { id: 'PR-2024-018', action: 'Approved', user: 'Deepak Verma', amount: 195000, time: '2 hours ago', type: 'approval' },
  { id: 'PR-2024-016', action: 'Approved', user: 'Deepak Verma', amount: 340000, time: '5 hours ago', type: 'approval' },
  { id: 'PR-2024-013', action: 'Approved', user: 'Deepak Verma', amount: 155000, time: '1 day ago', type: 'approval' },
  { id: 'PR-2024-011', action: 'Approved', user: 'Deepak Verma', amount: 240000, time: '1 day ago', type: 'approval' },
  { id: 'PR-2024-009', action: 'Rejected', user: 'Deepak Verma', amount: 95000, time: '2 days ago', type: 'rejection' },
  { id: 'PR-2024-008', action: 'Approved', user: 'Deepak Verma', amount: 45000, time: '2 days ago', type: 'approval' },
  { id: 'PR-2024-005', action: 'Approved', user: 'Deepak Verma', amount: 125000, time: '3 days ago', type: 'approval' }
];

export const slaAlertsData = [
  { id: 'PR-2024-003', title: 'Marketing Campaign Materials', daysOverdue: 2, priority: 'High', amount: 185000 },
  { id: 'PR-2024-004', title: 'Server Infrastructure Upgrade', daysOverdue: 3, priority: 'Critical', amount: 950000 },
  { id: 'PR-2024-007', title: 'Software Licenses Renewal', daysOverdue: 4, priority: 'High', amount: 320000 },
  { id: 'PR-2024-010', title: 'Network Security Appliances', daysOverdue: 5, priority: 'Critical', amount: 580000 }
];