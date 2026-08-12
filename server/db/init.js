import 'dotenv/config';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_NAME = process.env.DB_NAME || 'p2p_system';

function buildDbConfig(includeDatabase = false) {
  const instance =
    process.env.INSTANCE_CONNECTION_NAME ||
    process.env.CLOUD_SQL_CONNECTION_NAME ||
    '';
  const base = {
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  };
  if (includeDatabase) base.database = DB_NAME;
  if (instance) {
    return { ...base, socketPath: `/cloudsql/${instance}` };
  }
  return {
    ...base,
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
  };
}

const DB_CONFIG = buildDbConfig(false);

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
    try {
      await connection.query(statement);
    } catch (err) {
      // Allow re-run on existing DB: skip duplicate indexes / known alter conflicts
      const msg = String(err.message || '');
      if (
        msg.includes('already exists') ||
        msg.includes('Duplicate key name') ||
        msg.includes('Duplicate column name')
      ) {
        console.warn('Schema skip:', msg.split('\n')[0]);
        continue;
      }
      throw err;
    }
  }
  console.log('Schema applied.');

  const migrations = [
    `ALTER TABLE purchase_requests ADD COLUMN entity_id INT NULL`,
    `ALTER TABLE purchase_orders ADD COLUMN entity_id INT NULL`,
    `ALTER TABLE purchase_requests MODIFY COLUMN pr_number VARCHAR(40) NOT NULL`,
    `ALTER TABLE purchase_orders MODIFY COLUMN po_number VARCHAR(40) NOT NULL`,
    `ALTER TABLE vendor_quotation_submissions ADD COLUMN warranty VARCHAR(100) NULL`,
    `ALTER TABLE vendor_quotation_submissions ADD COLUMN delivery_terms VARCHAR(100) NULL`,
    `ALTER TABLE vendor_quotation_submissions ADD COLUMN quotation_file_name VARCHAR(255) NULL`,
    `ALTER TABLE vendor_quotation_submissions ADD COLUMN quotation_file_path VARCHAR(500) NULL`,
    `ALTER TABLE vendor_quotation_submissions ADD COLUMN quotation_file_data LONGBLOB NULL`,
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
      terms_header TEXT NOT NULL,
      terms_description LONGTEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (master_id) REFERENCES po_letterhead_masters(id) ON DELETE CASCADE,
      INDEX idx_letterhead_section (master_id, section_type, sort_order)
    )`,
    `ALTER TABLE purchase_orders ADD COLUMN po_type ENUM('short_po', 'long_po') NOT NULL DEFAULT 'short_po'`,
    `ALTER TABLE purchase_orders ADD COLUMN letterhead_header LONGTEXT NULL`,
    `ALTER TABLE purchase_orders ADD COLUMN letterhead_id INT NULL`,
    `ALTER TABLE purchase_orders ADD COLUMN terms_clauses JSON NULL`,
    `ALTER TABLE purchase_orders ADD COLUMN annexure_clauses JSON NULL`,
    `ALTER TABLE purchase_orders ADD COLUMN po_terms_details JSON NULL`,
    `ALTER TABLE po_letterhead_masters ADD COLUMN entity VARCHAR(255) NULL`,
    `ALTER TABLE po_letterhead_masters ADD COLUMN header_logo LONGTEXT NULL`,
    `ALTER TABLE po_letterhead_masters ADD COLUMN footer_logo LONGTEXT NULL`,
    `ALTER TABLE purchase_orders ADD COLUMN entity VARCHAR(255) NULL`,
    `ALTER TABLE purchase_orders ADD COLUMN header_logo LONGTEXT NULL`,
    `ALTER TABLE purchase_orders ADD COLUMN footer_logo LONGTEXT NULL`,
    `ALTER TABLE purchase_orders ADD COLUMN vendor_acceptance_token VARCHAR(64) NULL`,
    `ALTER TABLE purchase_orders ADD COLUMN vendor_acceptance_mode ENUM('email', 'manual') NULL`,
    `ALTER TABLE purchase_orders ADD COLUMN vendor_acceptance_status ENUM('pending', 'accepted', 'rejected', 'partial') NULL`,
    `ALTER TABLE purchase_orders ADD COLUMN vendor_acceptance_remarks TEXT NULL`,
    `ALTER TABLE purchase_orders ADD COLUMN vendor_acceptance_file_name VARCHAR(255) NULL`,
    `ALTER TABLE purchase_orders ADD COLUMN vendor_acceptance_file_path VARCHAR(500) NULL`,
    `ALTER TABLE purchase_orders ADD COLUMN vendor_delivery_confirmed_date DATE NULL`,
    `ALTER TABLE purchase_orders ADD COLUMN vendor_accepted_at TIMESTAMP NULL`,
    `ALTER TABLE purchase_requests ADD COLUMN purchase_type ENUM('purchase_order', 'work_order') NOT NULL DEFAULT 'purchase_order'`,
    `ALTER TABLE purchase_orders ADD COLUMN purchase_type ENUM('purchase_order', 'work_order') NOT NULL DEFAULT 'purchase_order'`,
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
      location VARCHAR(255) NULL,
      gst_no VARCHAR(50) NULL,
      header_logo LONGTEXT NULL,
      footer_logo LONGTEXT NULL,
      status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_letterhead_status (status),
      INDEX idx_letterhead_name (name)
    )`,
    `CREATE TABLE IF NOT EXISTS letterhead_locations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      letterhead_id INT NOT NULL,
      location VARCHAR(255) NOT NULL,
      gst_no VARCHAR(50) NULL,
      footer_logo LONGTEXT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_lh_loc_letterhead (letterhead_id),
      CONSTRAINT fk_letterhead_locations_master
        FOREIGN KEY (letterhead_id) REFERENCES letterhead_masters(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS document_number_sequences (
      id INT AUTO_INCREMENT PRIMARY KEY,
      doc_type ENUM('PR', 'PO', 'WO') NOT NULL,
      entity_id INT NOT NULL,
      fy_label VARCHAR(10) NOT NULL,
      last_seq INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_doc_entity_fy (doc_type, entity_id, fy_label),
      INDEX idx_doc_seq_entity (entity_id)
    )`,
    `CREATE TABLE IF NOT EXISTS entity_masters (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      code VARCHAR(20) NULL,
      cost_center VARCHAR(100) NULL,
      description TEXT NULL,
      status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_entity_name (name),
      INDEX idx_entity_code (code),
      INDEX idx_entity_status (status)
    )`,
    `CREATE TABLE IF NOT EXISTS entity_locations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      entity_id INT NOT NULL,
      location VARCHAR(255) NOT NULL,
      gst_no VARCHAR(50) NULL,
      footer_logo LONGTEXT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_entity_loc_entity (entity_id),
      CONSTRAINT fk_entity_locations_entity
        FOREIGN KEY (entity_id) REFERENCES entity_masters(id) ON DELETE CASCADE
    )`,
    `ALTER TABLE document_number_sequences MODIFY COLUMN doc_type ENUM('PR', 'PO', 'WO') NOT NULL`,
    `CREATE TABLE IF NOT EXISTS email_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      email_type VARCHAR(64) NOT NULL,
      status ENUM('queued', 'sent', 'failed', 'skipped') NOT NULL DEFAULT 'queued',
      pr_id INT NULL,
      po_id INT NULL,
      related_id INT NULL,
      pr_number VARCHAR(40) NULL,
      po_number VARCHAR(40) NULL,
      to_addresses TEXT NOT NULL,
      cc_addresses TEXT NULL,
      bcc_addresses TEXT NULL,
      subject VARCHAR(500) NOT NULL,
      message_id VARCHAR(255) NULL,
      error_message TEXT NULL,
      meta_json JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      sent_at TIMESTAMP NULL,
      INDEX idx_email_logs_created (created_at),
      INDEX idx_email_logs_status (status),
      INDEX idx_email_logs_pr (pr_id),
      INDEX idx_email_logs_type (email_type)
    )`,
    `CREATE TABLE IF NOT EXISTS whatsapp_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      notify_type VARCHAR(64) NOT NULL DEFAULT 'workflow',
      status ENUM('queued', 'sent', 'failed', 'skipped') NOT NULL DEFAULT 'queued',
      pr_id INT NULL,
      po_id INT NULL,
      related_id INT NULL,
      pr_number VARCHAR(40) NULL,
      po_number VARCHAR(40) NULL,
      to_phone VARCHAR(32) NOT NULL,
      template_name VARCHAR(120) NULL,
      stage VARCHAR(120) NULL,
      wamid VARCHAR(255) NULL,
      error_message TEXT NULL,
      parameters_json JSON NULL,
      meta_json JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      sent_at TIMESTAMP NULL,
      INDEX idx_wa_logs_created (created_at),
      INDEX idx_wa_logs_status (status),
      INDEX idx_wa_logs_pr (pr_id),
      INDEX idx_wa_logs_type (notify_type),
      INDEX idx_wa_logs_phone (to_phone)
    )`,
  ];
  for (const sql of migrations) {
    try {
      await connection.query(sql);
    } catch {
      // column/table may already exist
    }
  }

  // Indexes that need entity_id column present first
  const indexMigrations = [
    `CREATE INDEX idx_pr_entity ON purchase_requests (entity_id)`,
    `CREATE INDEX idx_po_entity ON purchase_orders (entity_id)`,
  ];
  for (const sql of indexMigrations) {
    try {
      await connection.query(sql);
    } catch {
      // index may already exist
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
