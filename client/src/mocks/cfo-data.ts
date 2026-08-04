export const cfoStats = {
  totalPendingApprovals: 24,
  highValuePRs: 8,
  approvedThisMonth: 56,
  totalSpendAllEntities: 28450000,
  rejectedThisMonth: 4
};

export const businessEntities = [
  {
    id: 'entity-a',
    name: 'Entity A - Manufacturing',
    code: 'ENT-A',
    allocatedBudget: 15000000,
    utilizedBudget: 11250000,
    utilizationPercentage: 75,
    pendingPRsCount: 12,
    approvedAmount: 8900000,
    color: '#14B8A6'
  },
  {
    id: 'entity-b',
    name: 'Entity B - Services',
    code: 'ENT-B',
    allocatedBudget: 10000000,
    utilizedBudget: 7800000,
    utilizationPercentage: 78,
    pendingPRsCount: 8,
    approvedAmount: 6200000,
    color: '#8B5CF6'
  },
  {
    id: 'entity-c',
    name: 'Entity C - Retail',
    code: 'ENT-C',
    allocatedBudget: 8000000,
    utilizedBudget: 5600000,
    utilizationPercentage: 70,
    pendingPRsCount: 4,
    approvedAmount: 4100000,
    color: '#F59E0B'
  },
  {
    id: 'holding-co',
    name: 'Holding Company',
    code: 'HOLD',
    allocatedBudget: 12000000,
    utilizedBudget: 3800000,
    utilizationPercentage: 32,
    pendingPRsCount: 0,
    approvedAmount: 2500000,
    color: '#3B82F6'
  }
];

export const cfoPRList = [
  {
    id: 'PR-2024-CFO-001',
    title: 'Advanced Manufacturing Equipment',
    requester: 'Rajesh Kumar',
    department: 'Production',
    entity: 'entity-a',
    entityName: 'Entity A - Manufacturing',
    amount: 8500000,
    priority: 'Critical',
    status: 'Pending CFO Approval',
    submittedDate: '2024-01-15',
    dueDate: '2024-01-22',
    isOverdue: false,
    isHighValue: true,
    justification: 'Critical production line upgrade to meet Q2 demand surge. Current equipment at 95% capacity causing bottlenecks. New machinery will increase output by 40% and reduce defect rates from 3.2% to 0.8%. ROI expected within 18 months.',
    lineItems: [
      { id: 'li-001-1', itemName: 'CNC Machining Center', description: 'High-precision CNC machining center for production line', category: 'Machinery', quantity: 2, unit: 'Units', estimatedPrice: 3200000, totalPrice: 6400000 },
      { id: 'li-001-2', itemName: 'Automated Assembly Line', description: 'Fully automated assembly line system', category: 'Machinery', quantity: 1, unit: 'Set', estimatedPrice: 1500000, totalPrice: 1500000 },
      { id: 'li-001-3', itemName: 'Quality Control Systems', description: 'Inline quality control and inspection systems', category: 'Equipment', quantity: 3, unit: 'Units', estimatedPrice: 150000, totalPrice: 450000 },
      { id: 'li-001-4', itemName: 'Installation & Training', description: 'On-site installation and operator training', category: 'Services', quantity: 1, unit: 'Lump Sum', estimatedPrice: 150000, totalPrice: 150000 }
    ],
    approvalHistory: [
      { stage: 'Submitted', approver: 'Rajesh Kumar', role: 'Requester', action: 'Submitted', remarks: 'Urgent capacity expansion requirement', timestamp: '2024-01-15 09:30 AM' },
      { stage: 'HOD Review', approver: 'Amit Sharma', role: 'HOD - Production', action: 'Approved', remarks: 'Critical for meeting Q2 targets', timestamp: '2024-01-15 02:45 PM' },
      { stage: 'PR Manager Review', approver: 'Deepak Verma', role: 'PR Manager', action: 'Approved', remarks: 'High value - forwarded to CFO', timestamp: '2024-01-16 10:30 AM' }
    ]
  },
  {
    id: 'PR-2024-CFO-002',
    title: 'Enterprise ERP System Upgrade',
    requester: 'Meera Nair',
    department: 'IT',
    entity: 'entity-b',
    entityName: 'Entity B - Services',
    amount: 6200000,
    priority: 'High',
    status: 'Pending CFO Approval',
    submittedDate: '2024-01-14',
    dueDate: '2024-01-21',
    isOverdue: false,
    isHighValue: true,
    justification: 'Current ERP system end-of-life in 6 months. Upgrade essential for business continuity, compliance, and integration with new service modules. Will improve operational efficiency by 35% and reduce manual processing time by 60%.',
    lineItems: [
      { id: 'li-002-1', itemName: 'SAP S/4HANA License (200 users)', description: 'Enterprise ERP license for 200 concurrent users', category: 'Software', quantity: 1, unit: 'License', estimatedPrice: 4500000, totalPrice: 4500000 },
      { id: 'li-002-2', itemName: 'Implementation Services', description: 'Full implementation and configuration services', category: 'Services', quantity: 1, unit: 'Lump Sum', estimatedPrice: 1200000, totalPrice: 1200000 },
      { id: 'li-002-3', itemName: 'Data Migration & Integration', description: 'Legacy data migration and system integration', category: 'Services', quantity: 1, unit: 'Lump Sum', estimatedPrice: 350000, totalPrice: 350000 },
      { id: 'li-002-4', itemName: 'Training & Support (1 Year)', description: 'User training and 1-year support contract', category: 'Services', quantity: 1, unit: 'Year', estimatedPrice: 150000, totalPrice: 150000 }
    ],
    approvalHistory: [
      { stage: 'Submitted', approver: 'Meera Nair', role: 'Requester', action: 'Submitted', remarks: 'Critical system upgrade - EOL approaching', timestamp: '2024-01-14 11:15 AM' },
      { stage: 'HOD Review', approver: 'Suresh Patil', role: 'HOD - IT', action: 'Approved', remarks: 'Essential for business operations', timestamp: '2024-01-14 04:30 PM' },
      { stage: 'PR Manager Review', approver: 'Deepak Verma', role: 'PR Manager', action: 'Approved', remarks: 'Strategic investment - CFO approval required', timestamp: '2024-01-15 09:45 AM' }
    ]
  },
  {
    id: 'PR-2024-CFO-003',
    title: 'Retail Store Expansion - Phase 2',
    requester: 'Vikram Singh',
    department: 'Retail Operations',
    entity: 'entity-c',
    entityName: 'Entity C - Retail',
    amount: 5800000,
    priority: 'High',
    status: 'Pending CFO Approval',
    submittedDate: '2024-01-16',
    dueDate: '2024-01-23',
    isOverdue: false,
    isHighValue: true,
    justification: 'Phase 2 expansion into 3 new metro locations. Market research shows 25% YoY growth potential. Projected revenue ₹18Cr in Year 1 with break-even in 14 months. Includes store fit-outs, inventory, and marketing launch.',
    lineItems: [
      { id: 'li-003-1', itemName: 'Store Fit-out & Interiors (3 locations)', description: 'Complete interior fit-out for 3 new retail locations', category: 'Infrastructure', quantity: 1, unit: 'Lump Sum', estimatedPrice: 3600000, totalPrice: 3600000 },
      { id: 'li-003-2', itemName: 'Initial Inventory Stock', description: 'Opening inventory for all 3 locations', category: 'Inventory', quantity: 1, unit: 'Lump Sum', estimatedPrice: 1500000, totalPrice: 1500000 },
      { id: 'li-003-3', itemName: 'POS Systems & IT Setup', description: 'Point-of-sale systems and IT infrastructure', category: 'Equipment', quantity: 3, unit: 'Sets', estimatedPrice: 180000, totalPrice: 540000 },
      { id: 'li-003-4', itemName: 'Launch Marketing Campaign', description: 'Grand opening marketing and promotions', category: 'Marketing', quantity: 1, unit: 'Lump Sum', estimatedPrice: 160000, totalPrice: 160000 }
    ],
    approvalHistory: [
      { stage: 'Submitted', approver: 'Vikram Singh', role: 'Requester', action: 'Submitted', remarks: 'Strategic expansion - high growth markets', timestamp: '2024-01-16 10:00 AM' },
      { stage: 'HOD Review', approver: 'Priya Mehta', role: 'HOD - Retail', action: 'Approved', remarks: 'Strong business case - approved', timestamp: '2024-01-16 03:15 PM' },
      { stage: 'PR Manager Review', approver: 'Deepak Verma', role: 'PR Manager', action: 'Approved', remarks: 'High value expansion - CFO review needed', timestamp: '2024-01-17 11:00 AM' }
    ]
  },
  {
    id: 'PR-2024-CFO-004',
    title: 'Warehouse Automation System',
    requester: 'Suresh Patil',
    department: 'Logistics',
    entity: 'entity-a',
    entityName: 'Entity A - Manufacturing',
    amount: 7200000,
    priority: 'Critical',
    status: 'Pending CFO Approval',
    submittedDate: '2024-01-13',
    dueDate: '2024-01-19',
    isOverdue: true,
    isHighValue: true,
    justification: 'Automated storage and retrieval system to handle 300% increase in SKU volume. Current manual system causing 15% order fulfillment delays. Automation will reduce labor costs by ₹45L annually and improve accuracy to 99.8%.',
    lineItems: [
      { id: 'li-004-1', itemName: 'Automated Storage & Retrieval System', description: 'Full AS/RS system for warehouse automation', category: 'Automation', quantity: 1, unit: 'System', estimatedPrice: 5500000, totalPrice: 5500000 },
      { id: 'li-004-2', itemName: 'Warehouse Management Software', description: 'WMS software with real-time tracking', category: 'Software', quantity: 1, unit: 'License', estimatedPrice: 850000, totalPrice: 850000 },
      { id: 'li-004-3', itemName: 'Conveyor Systems & Robotics', description: 'Automated conveyor and robotic picking systems', category: 'Equipment', quantity: 1, unit: 'Set', estimatedPrice: 650000, totalPrice: 650000 },
      { id: 'li-004-4', itemName: 'Installation & Commissioning', description: 'On-site installation and system commissioning', category: 'Services', quantity: 1, unit: 'Lump Sum', estimatedPrice: 200000, totalPrice: 200000 }
    ],
    approvalHistory: [
      { stage: 'Submitted', approver: 'Suresh Patil', role: 'Requester', action: 'Submitted', remarks: 'Critical automation - capacity constraints', timestamp: '2024-01-13 09:00 AM' },
      { stage: 'HOD Review', approver: 'Ramesh Iyer', role: 'HOD - Logistics', action: 'Approved', remarks: 'Urgent - operational bottleneck', timestamp: '2024-01-13 01:30 PM' },
      { stage: 'PR Manager Review', approver: 'Deepak Verma', role: 'PR Manager', action: 'Approved', remarks: 'High value automation - CFO approval required', timestamp: '2024-01-14 10:15 AM' }
    ]
  },
  {
    id: 'PR-2024-CFO-005',
    title: 'Cloud Infrastructure Migration',
    requester: 'Anil Desai',
    department: 'IT',
    entity: 'entity-b',
    entityName: 'Entity B - Services',
    amount: 4800000,
    priority: 'High',
    status: 'Pending CFO Approval',
    submittedDate: '2024-01-17',
    dueDate: '2024-01-24',
    isOverdue: false,
    isHighValue: false,
    justification: 'Migration from on-premise to AWS cloud infrastructure. Will reduce datacenter costs by ₹28L annually, improve scalability, and enhance disaster recovery capabilities. 3-year TCO savings projected at ₹1.2Cr.',
    lineItems: [
      { id: 'li-005-1', itemName: 'AWS Reserved Instances (3 Years)', description: '3-year reserved cloud compute instances', category: 'Cloud Services', quantity: 1, unit: 'Contract', estimatedPrice: 3200000, totalPrice: 3200000 },
      { id: 'li-005-2', itemName: 'Migration Services & Consulting', description: 'Cloud migration planning and execution', category: 'Services', quantity: 1, unit: 'Lump Sum', estimatedPrice: 950000, totalPrice: 950000 },
      { id: 'li-005-3', itemName: 'Security & Compliance Setup', description: 'Cloud security architecture and compliance', category: 'Services', quantity: 1, unit: 'Lump Sum', estimatedPrice: 450000, totalPrice: 450000 },
      { id: 'li-005-4', itemName: 'Training & Documentation', description: 'Team training and technical documentation', category: 'Services', quantity: 1, unit: 'Lump Sum', estimatedPrice: 200000, totalPrice: 200000 }
    ],
    approvalHistory: [
      { stage: 'Submitted', approver: 'Anil Desai', role: 'Requester', action: 'Submitted', remarks: 'Strategic cloud migration initiative', timestamp: '2024-01-17 02:30 PM' },
      { stage: 'HOD Review', approver: 'Suresh Patil', role: 'HOD - IT', action: 'Approved', remarks: 'Long-term cost savings - approved', timestamp: '2024-01-18 10:00 AM' },
      { stage: 'PR Manager Review', approver: 'Deepak Verma', role: 'PR Manager', action: 'Approved', remarks: 'Strategic investment - CFO review', timestamp: '2024-01-18 02:45 PM' }
    ]
  },
  {
    id: 'PR-2024-CFO-006',
    title: 'Customer Experience Platform',
    requester: 'Pooja Sharma',
    department: 'Customer Service',
    entity: 'entity-c',
    entityName: 'Entity C - Retail',
    amount: 3200000,
    priority: 'Medium',
    status: 'Pending CFO Approval',
    submittedDate: '2024-01-16',
    dueDate: '2024-01-23',
    isOverdue: false,
    isHighValue: false,
    justification: 'Omnichannel customer experience platform to unify online and offline touchpoints. Will improve customer satisfaction scores by 30% and reduce support costs by ₹18L annually through AI-powered automation.',
    lineItems: [
      { id: 'li-006-1', itemName: 'Salesforce Service Cloud License', description: 'Enterprise CRM and service cloud license', category: 'Software', quantity: 1, unit: 'License', estimatedPrice: 1800000, totalPrice: 1800000 },
      { id: 'li-006-2', itemName: 'AI Chatbot & Automation Tools', description: 'AI-powered chatbot and workflow automation', category: 'Software', quantity: 1, unit: 'License', estimatedPrice: 750000, totalPrice: 750000 },
      { id: 'li-006-3', itemName: 'Implementation & Integration', description: 'System implementation and third-party integrations', category: 'Services', quantity: 1, unit: 'Lump Sum', estimatedPrice: 450000, totalPrice: 450000 },
      { id: 'li-006-4', itemName: 'Training & Change Management', description: 'Staff training and change management program', category: 'Services', quantity: 1, unit: 'Lump Sum', estimatedPrice: 200000, totalPrice: 200000 }
    ],
    approvalHistory: [
      { stage: 'Submitted', approver: 'Pooja Sharma', role: 'Requester', action: 'Submitted', remarks: 'Customer experience enhancement', timestamp: '2024-01-16 11:45 AM' },
      { stage: 'HOD Review', approver: 'Priya Mehta', role: 'HOD - Customer Service', action: 'Approved', remarks: 'Will improve customer satisfaction', timestamp: '2024-01-16 04:30 PM' },
      { stage: 'PR Manager Review', approver: 'Deepak Verma', role: 'PR Manager', action: 'Approved', remarks: 'Good ROI - forwarded to CFO', timestamp: '2024-01-17 09:30 AM' }
    ]
  },
  {
    id: 'PR-2024-CFO-007',
    title: 'Quality Assurance Lab Equipment',
    requester: 'Lakshmi Iyer',
    department: 'Quality Control',
    entity: 'entity-a',
    entityName: 'Entity A - Manufacturing',
    amount: 2800000,
    priority: 'High',
    status: 'Pending CFO Approval',
    submittedDate: '2024-01-15',
    dueDate: '2024-01-22',
    isOverdue: false,
    isHighValue: false,
    justification: 'Advanced testing equipment for new product line compliance. Required for ISO 9001:2015 certification renewal and meeting international quality standards. Will reduce external testing costs by ₹12L annually.',
    lineItems: [
      { id: 'li-007-1', itemName: 'Spectrophotometer & Analysis System', description: 'High-precision spectrophotometer for material analysis', category: 'Lab Equipment', quantity: 1, unit: 'Unit', estimatedPrice: 1200000, totalPrice: 1200000 },
      { id: 'li-007-2', itemName: 'Environmental Testing Chamber', description: 'Temperature and humidity testing chamber', category: 'Lab Equipment', quantity: 1, unit: 'Unit', estimatedPrice: 950000, totalPrice: 950000 },
      { id: 'li-007-3', itemName: 'Precision Measurement Tools', description: 'Set of precision measurement and calibration tools', category: 'Equipment', quantity: 1, unit: 'Set', estimatedPrice: 450000, totalPrice: 450000 },
      { id: 'li-007-4', itemName: 'Calibration & Certification', description: 'Initial calibration and ISO certification services', category: 'Services', quantity: 1, unit: 'Lump Sum', estimatedPrice: 200000, totalPrice: 200000 }
    ],
    approvalHistory: [
      { stage: 'Submitted', approver: 'Lakshmi Iyer', role: 'Requester', action: 'Submitted', remarks: 'ISO certification requirement', timestamp: '2024-01-15 01:15 PM' },
      { stage: 'HOD Review', approver: 'Amit Sharma', role: 'HOD - Quality', action: 'Approved', remarks: 'Compliance requirement - approved', timestamp: '2024-01-15 04:45 PM' },
      { stage: 'PR Manager Review', approver: 'Deepak Verma', role: 'PR Manager', action: 'Approved', remarks: 'Compliance investment - CFO review', timestamp: '2024-01-16 11:30 AM' }
    ]
  },
  {
    id: 'PR-2024-CFO-008',
    title: 'Digital Marketing Platform',
    requester: 'Ritu Agarwal',
    department: 'Marketing',
    entity: 'entity-b',
    entityName: 'Entity B - Services',
    amount: 2400000,
    priority: 'Medium',
    status: 'Pending CFO Approval',
    submittedDate: '2024-01-18',
    dueDate: '2024-01-25',
    isOverdue: false,
    isHighValue: false,
    justification: 'Integrated marketing automation platform to improve lead generation and conversion rates. Expected to increase qualified leads by 45% and reduce customer acquisition cost by 28%. ROI projected within 10 months.',
    lineItems: [
      { id: 'li-008-1', itemName: 'HubSpot Marketing Hub Enterprise', description: 'Enterprise marketing automation platform', category: 'Software', quantity: 1, unit: 'License', estimatedPrice: 1500000, totalPrice: 1500000 },
      { id: 'li-008-2', itemName: 'Content Management System', description: 'Headless CMS for multi-channel content', category: 'Software', quantity: 1, unit: 'License', estimatedPrice: 450000, totalPrice: 450000 },
      { id: 'li-008-3', itemName: 'Implementation & Onboarding', description: 'Platform setup and team onboarding', category: 'Services', quantity: 1, unit: 'Lump Sum', estimatedPrice: 300000, totalPrice: 300000 },
      { id: 'li-008-4', itemName: 'Training & Support (1 Year)', description: 'User training and annual support contract', category: 'Services', quantity: 1, unit: 'Year', estimatedPrice: 150000, totalPrice: 150000 }
    ],
    approvalHistory: [
      { stage: 'Submitted', approver: 'Ritu Agarwal', role: 'Requester', action: 'Submitted', remarks: 'Marketing automation initiative', timestamp: '2024-01-18 10:30 AM' },
      { stage: 'HOD Review', approver: 'Neha Gupta', role: 'HOD - Marketing', action: 'Approved', remarks: 'Will improve lead generation', timestamp: '2024-01-18 03:15 PM' },
      { stage: 'PR Manager Review', approver: 'Deepak Verma', role: 'PR Manager', action: 'Approved', remarks: 'Good marketing investment - CFO approval', timestamp: '2024-01-19 09:00 AM' }
    ]
  }
];

export const cfoRecentActivity = [
  { id: 'PR-2024-CFO-008', action: 'Submitted for CFO Approval', user: 'Deepak Verma', amount: 2400000, entity: 'Entity B', time: '2 hours ago', type: 'submission' },
  { id: 'PR-2024-CFO-005', action: 'Submitted for CFO Approval', user: 'Deepak Verma', amount: 4800000, entity: 'Entity B', time: '5 hours ago', type: 'submission' },
  { id: 'PR-2024-CFO-003', action: 'Submitted for CFO Approval', user: 'Deepak Verma', amount: 5800000, entity: 'Entity C', time: '1 day ago', type: 'submission' },
  { id: 'PR-2024-CFO-007', action: 'Submitted for CFO Approval', user: 'Deepak Verma', amount: 2800000, entity: 'Entity A', time: '1 day ago', type: 'submission' },
  { id: 'PR-2024-CFO-002', action: 'Submitted for CFO Approval', user: 'Deepak Verma', amount: 6200000, entity: 'Entity B', time: '2 days ago', type: 'submission' },
  { id: 'PR-2024-CFO-001', action: 'Submitted for CFO Approval', user: 'Deepak Verma', amount: 8500000, entity: 'Entity A', time: '2 days ago', type: 'submission' },
  { id: 'PR-2024-CFO-006', action: 'Submitted for CFO Approval', user: 'Deepak Verma', amount: 3200000, entity: 'Entity C', time: '2 days ago', type: 'submission' },
  { id: 'PR-2024-CFO-004', action: 'Submitted for CFO Approval', user: 'Deepak Verma', amount: 7200000, entity: 'Entity A', time: '3 days ago', type: 'submission' }
];

export const highValueAlerts = [
  { id: 'PR-2024-CFO-001', title: 'Advanced Manufacturing Equipment', amount: 8500000, priority: 'Critical', entity: 'Entity A', daysWaiting: 3 },
  { id: 'PR-2024-CFO-004', title: 'Warehouse Automation System', amount: 7200000, priority: 'Critical', entity: 'Entity A', daysWaiting: 5, isOverdue: true },
  { id: 'PR-2024-CFO-002', title: 'Enterprise ERP System Upgrade', amount: 6200000, priority: 'High', entity: 'Entity B', daysWaiting: 4 },
  { id: 'PR-2024-CFO-003', title: 'Retail Store Expansion - Phase 2', amount: 5800000, priority: 'High', entity: 'Entity C', daysWaiting: 2 },
  { id: 'PR-2024-CFO-005', title: 'Cloud Infrastructure Migration', amount: 4800000, priority: 'High', entity: 'Entity B', daysWaiting: 1 }
];