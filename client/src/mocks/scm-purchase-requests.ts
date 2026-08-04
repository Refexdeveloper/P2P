export const scmPurchaseRequests = [
  {
    id: 'PR-2024-001',
    title: 'Dell Latitude Laptops - 50 Units',
    department: 'IT Department',
    requester: 'Rajesh Kumar',
    amount: 3750000,
    recommendedVendor: 'Tech Solutions Pvt Ltd',
    overallScore: 87.5,
    status: 'Pending Approval',
    poNumber: 'PO-2024-1003',
    requestedDate: '2024-01-15',
    requiredDate: '2024-02-15',
    priority: 'High',
    requestType: 'Goods',
    justification: 'Replacement of old laptops for development team. Current laptops are 5 years old and causing productivity issues.',
    lineItems: [
      {
        id: 1,
        description: 'Dell Latitude 5540 - i7, 16GB RAM, 512GB SSD',
        quantity: 50,
        unitPrice: 75000,
        total: 3750000,
        category: 'IT Equipment'
      }
    ],
    vendorComparison: [
      {
        vendorName: 'Tech Solutions Pvt Ltd',
        quotedPrice: 3750000,
        leadTime: 15,
        paymentTerms: 'Standard',
        compliance: 'Yes',
        technicalScore: 90,
        commercialScore: 83,
        overallScore: 87.5,
        recommended: true
      },
      {
        vendorName: 'Digital Systems Inc',
        quotedPrice: 3900000,
        leadTime: 20,
        paymentTerms: 'Standard',
        compliance: 'Yes',
        technicalScore: 85,
        commercialScore: 78,
        overallScore: 82.4,
        recommended: false
      },
      {
        vendorName: 'Computer World Ltd',
        quotedPrice: 4100000,
        leadTime: 25,
        paymentTerms: 'Deviated',
        compliance: 'No',
        technicalScore: 80,
        commercialScore: 70,
        overallScore: 76.0,
        recommended: false
      }
    ],
    approvalHistory: [
      {
        stage: 'PR Submitted',
        approver: 'Rajesh Kumar',
        role: 'IT Manager',
        action: 'Submitted',
        date: '2024-01-15 10:30 AM',
        remarks: 'Urgent requirement for development team'
      },
      {
        stage: 'HOD Approval',
        approver: 'Priya Sharma',
        role: 'Head of IT',
        action: 'Approved',
        date: '2024-01-16 02:15 PM',
        remarks: 'Approved. Budget allocated for Q1 2024'
      },
      {
        stage: 'CFO Approval',
        approver: 'Amit Patel',
        role: 'Chief Financial Officer',
        action: 'Approved',
        date: '2024-01-17 11:00 AM',
        remarks: 'Financial approval granted'
      },
      {
        stage: 'Functional Evaluation',
        approver: 'Suresh Reddy',
        role: 'Technical Lead',
        action: 'Completed',
        date: '2024-01-18 04:30 PM',
        remarks: 'Technical specifications verified and approved'
      },
      {
        stage: 'RFQ Completed',
        approver: 'Neha Gupta',
        role: 'SCM Executive',
        action: 'Completed',
        date: '2024-01-20 03:45 PM',
        remarks: 'Quotations received from 3 vendors. Tech Solutions recommended'
      },
      {
        stage: 'Technical Clearance',
        approver: 'Vikram Singh',
        role: 'SCM Manager',
        action: 'Cleared',
        date: '2024-01-22 10:00 AM',
        remarks: 'All technical and commercial parameters verified. Ready for PO creation'
      },
      {
        stage: 'PO Created',
        approver: 'Neha Gupta',
        role: 'SCM Executive',
        action: 'Created',
        date: '2024-01-25 10:30 AM',
        remarks: 'PO-2024-1003 created and sent for SCM Manager approval'
      }
    ]
  },
  {
    id: 'PR-2024-002',
    title: 'Office Furniture - Ergonomic Chairs',
    department: 'Administration',
    requester: 'Meera Iyer',
    amount: 450000,
    recommendedVendor: 'Comfort Furniture Co',
    overallScore: 91.2,
    status: 'PO Approved',
    poNumber: 'PO-2024-1004',
    requestedDate: '2024-01-18',
    requiredDate: '2024-02-28',
    priority: 'Medium',
    requestType: 'Goods',
    justification: 'New office expansion requires ergonomic seating for 30 employees',
    lineItems: [
      {
        id: 1,
        description: 'Ergonomic Office Chair with Lumbar Support',
        quantity: 30,
        unitPrice: 15000,
        total: 450000,
        category: 'Furniture'
      }
    ],
    vendorComparison: [
      {
        vendorName: 'Comfort Furniture Co',
        quotedPrice: 450000,
        leadTime: 20,
        paymentTerms: 'Standard',
        compliance: 'Yes',
        technicalScore: 95,
        commercialScore: 85,
        overallScore: 91.2,
        recommended: true
      },
      {
        vendorName: 'Office Mart',
        quotedPrice: 480000,
        leadTime: 15,
        paymentTerms: 'Standard',
        compliance: 'Yes',
        technicalScore: 88,
        commercialScore: 82,
        overallScore: 85.6,
        recommended: false
      }
    ],
    approvalHistory: [
      {
        stage: 'PR Submitted',
        approver: 'Meera Iyer',
        role: 'Admin Manager',
        action: 'Submitted',
        date: '2024-01-18 09:00 AM',
        remarks: 'Required for new office wing'
      },
      {
        stage: 'HOD Approval',
        approver: 'Karthik Menon',
        role: 'Head of Administration',
        action: 'Approved',
        date: '2024-01-19 11:30 AM',
        remarks: 'Approved for office expansion project'
      },
      {
        stage: 'CFO Approval',
        approver: 'Amit Patel',
        role: 'Chief Financial Officer',
        action: 'Approved',
        date: '2024-01-20 02:00 PM',
        remarks: 'Budget approved'
      },
      {
        stage: 'Functional Evaluation',
        approver: 'Deepak Joshi',
        role: 'Facilities Manager',
        action: 'Completed',
        date: '2024-01-21 03:15 PM',
        remarks: 'Ergonomic standards verified'
      },
      {
        stage: 'RFQ Completed',
        approver: 'Neha Gupta',
        role: 'SCM Executive',
        action: 'Completed',
        date: '2024-01-23 01:30 PM',
        remarks: 'Best quote from Comfort Furniture Co'
      },
      {
        stage: 'Technical Clearance',
        approver: 'Vikram Singh',
        role: 'SCM Manager',
        action: 'Cleared',
        date: '2024-01-24 10:30 AM',
        remarks: 'Cleared for PO creation'
      },
      {
        stage: 'PO Created',
        approver: 'Neha Gupta',
        role: 'SCM Executive',
        action: 'Created',
        date: '2024-01-26 09:15 AM',
        remarks: 'PO-2024-1004 created and sent for approval'
      },
      {
        stage: 'PO Approval',
        approver: 'Vikram Singh',
        role: 'SCM Manager',
        action: 'Approved',
        date: '2024-01-26 02:30 PM',
        remarks: 'All terms verified. PO approved and ready to send to vendor.'
      }
    ]
  },
  {
    id: 'PR-2024-003',
    title: 'Annual Maintenance Contract - HVAC Systems',
    department: 'Facilities',
    requester: 'Anil Desai',
    amount: 850000,
    recommendedVendor: 'Cool Air Services Ltd',
    overallScore: 89.8,
    status: 'Ready for PO',
    requestedDate: '2024-01-10',
    requiredDate: '2024-03-01',
    priority: 'High',
    requestType: 'Services',
    justification: 'Annual maintenance contract renewal for all HVAC systems across 3 buildings',
    lineItems: [
      {
        id: 1,
        description: 'HVAC Annual Maintenance - Building A',
        quantity: 1,
        unitPrice: 300000,
        total: 300000,
        category: 'Maintenance Services'
      },
      {
        id: 2,
        description: 'HVAC Annual Maintenance - Building B',
        quantity: 1,
        unitPrice: 280000,
        total: 280000,
        category: 'Maintenance Services'
      },
      {
        id: 3,
        description: 'HVAC Annual Maintenance - Building C',
        quantity: 1,
        unitPrice: 270000,
        total: 270000,
        category: 'Maintenance Services'
      }
    ],
    vendorComparison: [
      {
        vendorName: 'Cool Air Services Ltd',
        quotedPrice: 850000,
        leadTime: 7,
        paymentTerms: 'Standard',
        compliance: 'Yes',
        technicalScore: 92,
        commercialScore: 86,
        overallScore: 89.8,
        recommended: true
      },
      {
        vendorName: 'Climate Control Inc',
        quotedPrice: 920000,
        leadTime: 10,
        paymentTerms: 'Standard',
        compliance: 'Yes',
        technicalScore: 88,
        commercialScore: 80,
        overallScore: 84.8,
        recommended: false
      }
    ],
    approvalHistory: [
      {
        stage: 'PR Submitted',
        approver: 'Anil Desai',
        role: 'Facilities Manager',
        action: 'Submitted',
        date: '2024-01-10 08:45 AM',
        remarks: 'Contract renewal required before expiry'
      },
      {
        stage: 'HOD Approval',
        approver: 'Karthik Menon',
        role: 'Head of Administration',
        action: 'Approved',
        date: '2024-01-11 10:00 AM',
        remarks: 'Critical service. Approved'
      },
      {
        stage: 'CFO Approval',
        approver: 'Amit Patel',
        role: 'Chief Financial Officer',
        action: 'Approved',
        date: '2024-01-12 03:30 PM',
        remarks: 'Budget allocated'
      },
      {
        stage: 'Functional Evaluation',
        approver: 'Deepak Joshi',
        role: 'Facilities Manager',
        action: 'Completed',
        date: '2024-01-14 11:15 AM',
        remarks: 'Service scope verified'
      },
      {
        stage: 'RFQ Completed',
        approver: 'Neha Gupta',
        role: 'SCM Executive',
        action: 'Completed',
        date: '2024-01-16 02:45 PM',
        remarks: 'Cool Air Services recommended'
      },
      {
        stage: 'Technical Clearance',
        approver: 'Vikram Singh',
        role: 'SCM Manager',
        action: 'Cleared',
        date: '2024-01-17 09:30 AM',
        remarks: 'Cleared for PO'
      }
    ]
  },
  {
    id: 'PR-2024-004',
    title: 'Software Licenses - Adobe Creative Cloud',
    department: 'Marketing',
    requester: 'Pooja Nair',
    amount: 720000,
    recommendedVendor: 'Adobe Authorized Reseller',
    overallScore: 94.5,
    status: 'PO Rejected',
    poNumber: 'PO-2024-1005',
    requestedDate: '2024-01-20',
    requiredDate: '2024-02-10',
    priority: 'High',
    requestType: 'Services',
    justification: 'Annual license renewal for design team - 20 users',
    lineItems: [
      {
        id: 1,
        description: 'Adobe Creative Cloud All Apps - Annual License',
        quantity: 20,
        unitPrice: 36000,
        total: 720000,
        category: 'Software Licenses'
      }
    ],
    vendorComparison: [
      {
        vendorName: 'Adobe Authorized Reseller',
        quotedPrice: 720000,
        leadTime: 2,
        paymentTerms: 'Standard',
        compliance: 'Yes',
        technicalScore: 98,
        commercialScore: 89,
        overallScore: 94.5,
        recommended: true
      }
    ],
    approvalHistory: [
      {
        stage: 'PR Submitted',
        approver: 'Pooja Nair',
        role: 'Marketing Manager',
        action: 'Submitted',
        date: '2024-01-20 09:30 AM',
        remarks: 'License renewal required urgently'
      },
      {
        stage: 'HOD Approval',
        approver: 'Sanjay Malhotra',
        role: 'Head of Marketing',
        action: 'Approved',
        date: '2024-01-20 02:00 PM',
        remarks: 'Critical for design team operations'
      },
      {
        stage: 'CFO Approval',
        approver: 'Amit Patel',
        role: 'Chief Financial Officer',
        action: 'Approved',
        date: '2024-01-21 11:30 AM',
        remarks: 'Approved'
      },
      {
        stage: 'Functional Evaluation',
        approver: 'Rahul Verma',
        role: 'IT Manager',
        action: 'Completed',
        date: '2024-01-22 10:15 AM',
        remarks: 'License terms verified'
      },
      {
        stage: 'RFQ Completed',
        approver: 'Neha Gupta',
        role: 'SCM Executive',
        action: 'Completed',
        date: '2024-01-23 03:00 PM',
        remarks: 'Single vendor - Adobe authorized reseller'
      },
      {
        stage: 'Technical Clearance',
        approver: 'Vikram Singh',
        role: 'SCM Manager',
        action: 'Cleared',
        date: '2024-01-24 02:30 PM',
        remarks: 'Ready for PO creation'
      },
      {
        stage: 'PO Created',
        approver: 'Neha Gupta',
        role: 'SCM Executive',
        action: 'Created',
        date: '2024-01-27 11:00 AM',
        remarks: 'PO-2024-1005 created from PR-2024-004'
      },
      {
        stage: 'PO Approval',
        approver: 'Vikram Singh',
        role: 'SCM Manager',
        action: 'Rejected',
        date: '2024-01-27 03:45 PM',
        remarks: 'Payment terms need revision. Advance payment not aligned with company policy for software licenses. Please revise to Net 30 and resubmit.'
      }
    ]
  },
  {
    id: 'PR-2024-005',
    title: 'Network Switches - Cisco Catalyst Series',
    department: 'IT Infrastructure',
    requester: 'Sunil Rao',
    amount: 1250000,
    recommendedVendor: 'Network Solutions India',
    overallScore: 88.4,
    status: 'Ready for PO',
    requestedDate: '2024-01-22',
    requiredDate: '2024-03-15',
    priority: 'Medium',
    requestType: 'Goods',
    justification: 'Network infrastructure upgrade for new data center',
    lineItems: [
      {
        id: 1,
        description: 'Cisco Catalyst 9300 48-Port Switch',
        quantity: 5,
        unitPrice: 250000,
        total: 1250000,
        category: 'Network Equipment'
      }
    ],
    vendorComparison: [
      {
        vendorName: 'Network Solutions India',
        quotedPrice: 1250000,
        leadTime: 30,
        paymentTerms: 'Standard',
        compliance: 'Yes',
        technicalScore: 90,
        commercialScore: 86,
        overallScore: 88.4,
        recommended: true
      },
      {
        vendorName: 'Tech Networks Pvt Ltd',
        quotedPrice: 1320000,
        leadTime: 35,
        paymentTerms: 'Standard',
        compliance: 'Yes',
        technicalScore: 87,
        commercialScore: 80,
        overallScore: 84.2,
        recommended: false
      }
    ],
    approvalHistory: [
      {
        stage: 'PR Submitted',
        approver: 'Sunil Rao',
        role: 'Network Administrator',
        action: 'Submitted',
        date: '2024-01-22 10:00 AM',
        remarks: 'Required for data center expansion'
      },
      {
        stage: 'HOD Approval',
        approver: 'Priya Sharma',
        role: 'Head of IT',
        action: 'Approved',
        date: '2024-01-23 11:45 AM',
        remarks: 'Part of infrastructure upgrade project'
      },
      {
        stage: 'CFO Approval',
        approver: 'Amit Patel',
        role: 'Chief Financial Officer',
        action: 'Approved',
        date: '2024-01-24 09:30 AM',
        remarks: 'Budget approved from CAPEX'
      },
      {
        stage: 'Functional Evaluation',
        approver: 'Suresh Reddy',
        role: 'Technical Lead',
        action: 'Completed',
        date: '2024-01-25 03:00 PM',
        remarks: 'Technical specifications match requirements'
      },
      {
        stage: 'RFQ Completed',
        approver: 'Neha Gupta',
        role: 'SCM Executive',
        action: 'Completed',
        date: '2024-01-26 01:15 PM',
        remarks: 'Network Solutions India recommended'
      },
      {
        stage: 'Technical Clearance',
        approver: 'Vikram Singh',
        role: 'SCM Manager',
        action: 'Cleared',
        date: '2024-01-27 10:45 AM',
        remarks: 'All checks completed. Ready for PO'
      }
    ]
  },
  {
    id: 'PR-2024-006',
    title: 'Security Services - Annual Contract',
    department: 'Security',
    requester: 'Ramesh Pillai',
    amount: 2400000,
    recommendedVendor: 'SecureGuard Services',
    overallScore: 86.7,
    status: 'Ready for PO',
    requestedDate: '2024-01-12',
    requiredDate: '2024-02-01',
    priority: 'High',
    requestType: 'Services',
    justification: 'Annual security services contract for all office locations',
    lineItems: [
      {
        id: 1,
        description: 'Security Guard Services - 24x7 Coverage',
        quantity: 12,
        unitPrice: 200000,
        total: 2400000,
        category: 'Security Services'
      }
    ],
    vendorComparison: [
      {
        vendorName: 'SecureGuard Services',
        quotedPrice: 2400000,
        leadTime: 5,
        paymentTerms: 'Standard',
        compliance: 'Yes',
        technicalScore: 88,
        commercialScore: 84,
        overallScore: 86.7,
        recommended: true
      },
      {
        vendorName: 'Elite Security Solutions',
        quotedPrice: 2600000,
        leadTime: 7,
        paymentTerms: 'Deviated',
        compliance: 'Yes',
        technicalScore: 90,
        commercialScore: 78,
        overallScore: 85.2,
        recommended: false
      }
    ],
    approvalHistory: [
      {
        stage: 'PR Submitted',
        approver: 'Ramesh Pillai',
        role: 'Security Manager',
        action: 'Submitted',
        date: '2024-01-12 08:00 AM',
        remarks: 'Contract renewal required'
      },
      {
        stage: 'HOD Approval',
        approver: 'Karthik Menon',
        role: 'Head of Administration',
        action: 'Approved',
        date: '2024-01-13 10:30 AM',
        remarks: 'Critical service approved'
      },
      {
        stage: 'CFO Approval',
        approver: 'Amit Patel',
        role: 'Chief Financial Officer',
        action: 'Approved',
        date: '2024-01-14 02:15 PM',
        remarks: 'Budget allocated'
      },
      {
        stage: 'Functional Evaluation',
        approver: 'Deepak Joshi',
        role: 'Facilities Manager',
        action: 'Completed',
        date: '2024-01-16 11:00 AM',
        remarks: 'Service requirements verified'
      },
      {
        stage: 'RFQ Completed',
        approver: 'Neha Gupta',
        role: 'SCM Executive',
        action: 'Completed',
        date: '2024-01-18 04:00 PM',
        remarks: 'SecureGuard Services recommended'
      },
      {
        stage: 'Technical Clearance',
        approver: 'Vikram Singh',
        role: 'SCM Manager',
        action: 'Cleared',
        date: '2024-01-19 09:00 AM',
        remarks: 'Cleared for PO'
      }
    ]
  }
];