import 'dotenv/config';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};

const DB_NAME = process.env.DB_NAME || 'p2p_system';

const DEPARTMENTS = [
  { name: 'IT & Technology', budget_allocated: 5000000, budget_utilized: 3850000 },
  { name: 'Operations', budget_allocated: 3500000, budget_utilized: 2940000 },
  { name: 'Marketing', budget_allocated: 2000000, budget_utilized: 1200000 },
  { name: 'HR & Admin', budget_allocated: 1500000, budget_utilized: 980000 },
  { name: 'Finance', budget_allocated: 1000000, budget_utilized: 780000 },
];

const USERS = [
  { name: 'Rajesh Kumar', email: 'requester@procure.com', role: 'Requester', department: 'IT & Technology' },
  { name: 'Amit Sharma', email: 'manager@procure.com', role: 'HOD Approver', department: 'IT & Technology' },
  { name: 'Robert Wilson', email: 'hod.ops@procure.com', role: 'HOD Approver', department: 'Operations' },
  { name: 'Neha Gupta', email: 'hod.hr@procure.com', role: 'HOD Approver', department: 'HR & Admin' },
  { name: 'Sarah Johnson', email: 'hod.marketing@procure.com', role: 'HOD Approver', department: 'Marketing' },
  { name: 'Priya Mehta', email: 'hod.finance@procure.com', role: 'HOD Approver', department: 'Finance' },
  { name: 'Deepak Verma', email: 'prmanager@procure.com', role: 'PR Manager', department: null },
  { name: 'Michael Chen', email: 'cfo@procure.com', role: 'CFO', department: null },
  { name: 'Neha Gupta', email: 'scm@procure.com', role: 'SCM Buyer', department: null },
  { name: 'Vikram Singh', email: 'scmmanager@procure.com', role: 'SCM Manager', department: null },
  { name: 'Priya Menon', email: 'accounts@procure.com', role: 'Accounts Payable', department: null },
  { name: 'Ramesh Iyer', email: 'accountsmanager@procure.com', role: 'Accounts Manager', department: null },
  { name: 'Tech Solutions', email: 'vendor@procure.com', role: 'Vendor', department: null },
  { name: 'Digital Systems Inc', email: 'vendor2@procure.com', role: 'Vendor', department: null },
  { name: 'Global Supplies Ltd', email: 'vendor3@procure.com', role: 'Vendor', department: null },
  { name: 'Suresh Reddy', email: 'tech@procure.com', role: 'Tech Evaluator', department: null },
  { name: 'Sarah Johnson', email: 'functional@procure.com', role: 'Functional Team', department: null },
  { name: 'System Admin', email: 'admin@procure.com', role: 'Super Admin', department: null },
];

async function init() {
  console.log('Connecting to MySQL...');
  const connection = await mysql.createConnection(DB_CONFIG);

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.query(`USE \`${DB_NAME}\``);

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  for (const statement of schema.split(';').map((s) => s.trim()).filter(Boolean)) {
    await connection.query(statement);
  }
  console.log('Schema applied.');

  const migrations = [
    `ALTER TABLE vendor_quotation_submissions ADD COLUMN warranty VARCHAR(100) NULL`,
    `ALTER TABLE vendor_quotation_submissions ADD COLUMN delivery_terms VARCHAR(100) NULL`,
    `ALTER TABLE vendor_quotation_submissions ADD COLUMN quotation_file_name VARCHAR(255) NULL`,
    `ALTER TABLE vendor_quotation_submissions ADD COLUMN quotation_file_path VARCHAR(500) NULL`,
    `ALTER TABLE vendor_quotation_submissions ADD COLUMN custom_fields JSON NULL`,
    `ALTER TABLE vendor_quotation_submissions ADD COLUMN requester_fields JSON NULL`,
    `ALTER TABLE rfq_invitations ADD COLUMN invite_mode ENUM('email', 'manual') NOT NULL DEFAULT 'email'`,
    `CREATE TABLE IF NOT EXISTS vendor_documents (
      id INT AUTO_INCREMENT PRIMARY KEY,
      vendor_id INT NOT NULL,
      doc_type ENUM('gst', 'pan', 'cheque', 'msme', 'kyc', 'msme_declaration') NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
      UNIQUE KEY uniq_vendor_doc (vendor_id, doc_type)
    )`,
    `CREATE TABLE IF NOT EXISTS navigation_permissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(80) NOT NULL UNIQUE,
      label VARCHAR(120) NOT NULL,
      path VARCHAR(200) NOT NULL,
      icon VARCHAR(80) NOT NULL DEFAULT 'ri-link',
      nav_group VARCHAR(80) NULL,
      sort_order INT NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS user_permissions (
      user_id INT NOT NULL,
      permission_code VARCHAR(80) NOT NULL,
      PRIMARY KEY (user_id, permission_code),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `ALTER TABLE users ADD COLUMN refexone_user_id VARCHAR(36) NULL UNIQUE`,
    `ALTER TABLE users ADD COLUMN supervisor_email VARCHAR(150) NULL`,
    `ALTER TABLE users ADD COLUMN supervisor_name VARCHAR(120) NULL`,
    `ALTER TABLE users ADD COLUMN l2_manager_email VARCHAR(150) NULL`,
    `CREATE TABLE IF NOT EXISTS po_letterhead_masters (
      id INT AUTO_INCREMENT PRIMARY KEY,
      po_type ENUM('short_po', 'long_po') NOT NULL UNIQUE,
      title VARCHAR(200) NOT NULL DEFAULT 'Purchase Order',
      letterhead_header LONGTEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS po_letterhead_clauses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      master_id INT NOT NULL,
      section_type ENUM('terms', 'annexure') NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      terms_header VARCHAR(255) NOT NULL,
      terms_description LONGTEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (master_id) REFERENCES po_letterhead_masters(id) ON DELETE CASCADE,
      INDEX idx_letterhead_section (master_id, section_type, sort_order)
    )`,
    `ALTER TABLE purchase_orders ADD COLUMN po_type ENUM('short_po', 'long_po') NOT NULL DEFAULT 'short_po'`,
    `ALTER TABLE purchase_orders ADD COLUMN letterhead_header LONGTEXT NULL`,
    `ALTER TABLE purchase_orders ADD COLUMN terms_clauses JSON NULL`,
    `ALTER TABLE purchase_orders ADD COLUMN annexure_clauses JSON NULL`,
    `ALTER TABLE po_letterhead_masters ADD COLUMN entity VARCHAR(255) NULL`,
    `ALTER TABLE po_letterhead_masters ADD COLUMN header_logo LONGTEXT NULL`,
    `ALTER TABLE po_letterhead_masters ADD COLUMN footer_logo LONGTEXT NULL`,
    `ALTER TABLE purchase_orders ADD COLUMN entity VARCHAR(255) NULL`,
    `ALTER TABLE purchase_orders ADD COLUMN header_logo LONGTEXT NULL`,
    `ALTER TABLE purchase_orders ADD COLUMN footer_logo LONGTEXT NULL`,
    `CREATE TABLE IF NOT EXISTS letterhead_branding (
      id INT PRIMARY KEY,
      entity VARCHAR(255) NULL,
      header_logo LONGTEXT NULL,
      footer_logo LONGTEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS letterhead_masters (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      entity VARCHAR(255) NULL,
      header_logo LONGTEXT NULL,
      footer_logo LONGTEXT NULL,
      status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_letterhead_status (status),
      INDEX idx_letterhead_name (name)
    )`,
  ];
  for (const sql of migrations) {
    try {
      await connection.query(sql);
    } catch {
      // column may already exist
    }
  }

  const passwordHash = await bcrypt.hash('demo1234', 10);

  for (const dept of DEPARTMENTS) {
    await connection.query(
      `INSERT INTO departments (name, budget_allocated, budget_utilized)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE budget_allocated = VALUES(budget_allocated), budget_utilized = VALUES(budget_utilized)`,
      [dept.name, dept.budget_allocated, dept.budget_utilized]
    );
  }

  const [deptRows] = await connection.query('SELECT id, name FROM departments');
  const deptMap = Object.fromEntries(deptRows.map((d) => [d.name, d.id]));

  for (const user of USERS) {
    const departmentId = user.department ? deptMap[user.department] : null;
    await connection.query(
      `INSERT INTO users (name, email, password_hash, role, department_id)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash), role = VALUES(role), department_id = VALUES(department_id)`,
      [user.name, user.email, passwordHash, user.role, departmentId]
    );
  }

  const SEED_VENDORS = [
    { code: 'VND-2026-0001', name: 'Tech Solutions Ltd', email: 'vendor@procure.com', category: 'IT Services' },
    { code: 'VND-2026-0002', name: 'Global Supplies Inc', email: 'vendor3@procure.com', category: 'Office Supplies' },
    { code: 'VND-2026-0003', name: 'Prime Vendors Co', email: 'vendor2@procure.com', category: 'Raw Materials' },
    { code: 'VND-2026-0004', name: 'Alpha Industrial', email: 'sathishkumar.r@refex.co.in', category: 'Equipment' },
    { code: 'VND-2026-0005', name: 'Beta Traders', email: 'tech@procure.com', category: 'Professional Services' },
  ];

  for (const v of SEED_VENDORS) {
    await connection.query(
      `INSERT INTO vendors (vendor_code, name, vendor_type, email, category, status)
       VALUES (?, ?, 'Company', ?, ?, 'active')
       ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email), category = VALUES(category)`,
      [v.code, v.name, v.email, v.category]
    );
  }

  const { seedNavigationPermissions, seedUserPermissionsForRole } = await import('../src/services/permissionService.js');
  await seedNavigationPermissions();

  const [allUsers] = await connection.query('SELECT id, role FROM users');
  for (const u of allUsers) {
    await seedUserPermissionsForRole(u.id, u.role);
  }

  const [scmBuyers] = await connection.query(`SELECT id FROM users WHERE role = 'SCM Buyer'`);
  for (const u of scmBuyers) {
    await connection.query(
      `INSERT IGNORE INTO user_permissions (user_id, permission_code) VALUES (?, ?)`,
      [u.id, 'nav.po_letterhead_master']
    );
  }

  const { seedLetterheadDefaults } = await import('../src/services/poLetterheadService.js');
  await seedLetterheadDefaults();
  console.log('PO letterhead defaults seeded.');

  console.log('Seed data inserted.');
  console.log('Demo password for all users: demo1234');
  await connection.end();
  console.log('Database initialization complete.');
}

init().catch((err) => {
  console.error('DB init failed:', err.message);
  process.exit(1);
});
