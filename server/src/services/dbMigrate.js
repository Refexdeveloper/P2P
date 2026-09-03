import pool from '../config/db.js';

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS po_letterhead_masters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    po_type ENUM('short_po', 'long_po', 'short_wo', 'long_wo') NOT NULL UNIQUE,
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
  `ALTER TABLE purchase_orders ADD COLUMN po_type ENUM('short_po', 'long_po', 'short_wo', 'long_wo') NOT NULL DEFAULT 'short_po'`,
  `ALTER TABLE po_letterhead_masters MODIFY COLUMN po_type ENUM('short_po', 'long_po', 'short_wo', 'long_wo') NOT NULL`,
  `ALTER TABLE purchase_orders MODIFY COLUMN po_type ENUM('short_po', 'long_po', 'short_wo', 'long_wo') NOT NULL DEFAULT 'short_po'`,
  `ALTER TABLE purchase_orders ADD COLUMN letterhead_header LONGTEXT NULL`,
  `ALTER TABLE purchase_orders ADD COLUMN terms_clauses JSON NULL`,
  `ALTER TABLE purchase_orders ADD COLUMN annexure_clauses JSON NULL`,
  `ALTER TABLE purchase_orders ADD COLUMN signature_image_path VARCHAR(500) NULL`,
  `ALTER TABLE purchase_orders ADD COLUMN signature_dsc_json JSON NULL`,
  `CREATE TABLE IF NOT EXISTS user_signatures (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    label VARCHAR(100) NULL,
    image_path VARCHAR(500) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_signatures_user (user_id)
  )`,
  `ALTER TABLE purchase_requests ADD COLUMN vendor_selection ENUM('own', 'scm') NOT NULL DEFAULT 'scm'`,
  `ALTER TABLE rfq_configs ADD COLUMN requester_submitted_at TIMESTAMP NULL`,
  `ALTER TABLE purchase_orders ADD COLUMN reference_po_number VARCHAR(30) NULL`,
  `ALTER TABLE po_letterhead_masters ADD COLUMN entity VARCHAR(255) NULL`,
  `ALTER TABLE po_letterhead_masters ADD COLUMN header_logo LONGTEXT NULL`,
  `ALTER TABLE po_letterhead_masters ADD COLUMN footer_logo LONGTEXT NULL`,
  `ALTER TABLE purchase_orders ADD COLUMN entity VARCHAR(255) NULL`,
  `ALTER TABLE purchase_orders ADD COLUMN header_logo LONGTEXT NULL`,
  `ALTER TABLE purchase_orders ADD COLUMN footer_logo LONGTEXT NULL`,
  `ALTER TABLE po_letterhead_clauses MODIFY COLUMN terms_header TEXT NOT NULL`,
  `ALTER TABLE po_line_items ADD COLUMN tax_percentage DECIMAL(6, 2) NOT NULL DEFAULT 18`,
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
  `ALTER TABLE purchase_orders ADD COLUMN letterhead_id INT NULL`,
  `CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    request_type ENUM('Capex', 'Opex', 'Service', 'All') NOT NULL DEFAULT 'All',
    description TEXT NULL,
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category_status (status),
    INDEX idx_category_request_type (request_type)
  )`,
  `CREATE TABLE IF NOT EXISTS items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    description TEXT NULL,
    category_id INT NULL,
    unit VARCHAR(50) NOT NULL DEFAULT 'Nos',
    hsn_code VARCHAR(20) NULL,
    gst_percentage DECIMAL(5, 2) NOT NULL DEFAULT 18,
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    INDEX idx_item_status (status),
    INDEX idx_item_category (category_id)
  )`,
  `ALTER TABLE items ADD COLUMN hsn_code VARCHAR(20) NULL`,
  `ALTER TABLE items ADD COLUMN gst_percentage DECIMAL(5, 2) NOT NULL DEFAULT 18`,
  `CREATE TABLE IF NOT EXISTS entity_masters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL UNIQUE,
    cost_center VARCHAR(100) NOT NULL,
    description TEXT NULL,
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_entity_status (status),
    INDEX idx_entity_cost_center (cost_center)
  )`,
  `ALTER TABLE departments ADD COLUMN code VARCHAR(50) NULL`,
  `ALTER TABLE departments ADD COLUMN description TEXT NULL`,
  `ALTER TABLE departments ADD COLUMN status ENUM('active', 'inactive') NOT NULL DEFAULT 'active'`,
  `ALTER TABLE departments ADD COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  `ALTER TABLE entity_masters ADD COLUMN code VARCHAR(20) NULL`,
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
  `ALTER TABLE letterhead_masters ADD COLUMN location VARCHAR(255) NULL`,
  `ALTER TABLE letterhead_masters ADD COLUMN gst_no VARCHAR(50) NULL`,
  `ALTER TABLE purchase_requests ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'INR'`,
  `ALTER TABLE purchase_orders ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'INR'`,
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
  `ALTER TABLE purchase_requests ADD COLUMN entity_id INT NULL`,
  `ALTER TABLE purchase_orders ADD COLUMN entity_id INT NULL`,
  `ALTER TABLE purchase_requests MODIFY COLUMN pr_number VARCHAR(40) NOT NULL`,
  `ALTER TABLE purchase_orders MODIFY COLUMN po_number VARCHAR(40) NOT NULL`,
  `CREATE TABLE IF NOT EXISTS document_number_sequences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    doc_type ENUM('PR', 'PO') NOT NULL,
    entity_id INT NOT NULL,
    fy_label VARCHAR(10) NOT NULL,
    last_seq INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_doc_entity_fy (doc_type, entity_id, fy_label),
    INDEX idx_doc_seq_entity (entity_id)
  )`,
  `ALTER TABLE vendor_documents MODIFY COLUMN doc_type ENUM('gst', 'pan', 'cheque', 'msme', 'kyc', 'msme_declaration') NOT NULL`,
  // Persist vendor KYC/GST/PAN files in DB — Cloud Run disk is ephemeral
  `ALTER TABLE vendor_documents ADD COLUMN file_data LONGBLOB NULL`,
  `ALTER TABLE purchase_orders MODIFY COLUMN status ENUM(
    'draft', 'imported', 'pending_approval', 'pending_buyer_verify', 'approved', 'rejected',
    'sent_to_vendor', 'awaiting_grn', 'grn_completed', 'invoice_entry',
    'pending_accounts_approval', 'approved_for_payment', 'paid', 'cancelled'
  ) DEFAULT 'draft'`,
  // Excel / historical PO import may not link to a PR
  `ALTER TABLE purchase_orders MODIFY COLUMN pr_id INT NULL`,
  `ALTER TABLE purchase_orders MODIFY COLUMN incoterms VARCHAR(255) DEFAULT 'DDP'`,
  `ALTER TABLE purchase_orders MODIFY COLUMN payment_terms TEXT`,
  `ALTER TABLE purchase_orders ADD COLUMN po_terms_details JSON NULL`,
  `ALTER TABLE po_line_items ADD COLUMN discount DECIMAL(15, 2) NOT NULL DEFAULT 0`,
  `ALTER TABLE po_line_items MODIFY COLUMN discount DECIMAL(15, 2) NOT NULL DEFAULT 0`,
  `ALTER TABLE po_line_items MODIFY COLUMN description TEXT NOT NULL`,
  `ALTER TABLE po_line_items ADD COLUMN item_name VARCHAR(255) NULL`,
  `ALTER TABLE po_line_items ADD COLUMN unit VARCHAR(50) NOT NULL DEFAULT 'Nos'`,
  `ALTER TABLE pr_line_items ADD COLUMN unit VARCHAR(50) NOT NULL DEFAULT 'Nos'`,
  `ALTER TABLE pr_line_items ADD COLUMN gst_percentage DECIMAL(6, 2) NOT NULL DEFAULT 18`,
  `ALTER TABLE pr_line_items ADD COLUMN item_name VARCHAR(255) NULL`,
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
  `ALTER TABLE workflow_tasks ADD COLUMN sla_notified_at TIMESTAMP NULL`,
  `ALTER TABLE purchase_orders ADD COLUMN annexure_ii_html LONGTEXT NULL`,
  `ALTER TABLE purchase_orders ADD COLUMN cancellation_reason TEXT NULL`,
  `ALTER TABLE purchase_orders ADD COLUMN cancellation_attachments_json JSON NULL`,
  `ALTER TABLE purchase_orders ADD COLUMN cancelled_by INT NULL`,
  `ALTER TABLE purchase_orders ADD COLUMN cancelled_at TIMESTAMP NULL`,
  `ALTER TABLE purchase_orders ADD COLUMN po_date DATE NULL`,
  // Cloud Run disk is ephemeral — keep SCM Manager signature bytes on the PO
  `ALTER TABLE purchase_orders ADD COLUMN signature_image_data LONGBLOB NULL`,
  `ALTER TABLE purchase_orders ADD COLUMN manual_context_json JSON NULL`,
  `CREATE TABLE IF NOT EXISTS po_site_lookups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lookup_type ENUM('site_address', 'site_contact', 'project_manager') NOT NULL,
    label TEXT NOT NULL,
    email VARCHAR(150) NULL,
    phone VARCHAR(50) NULL,
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_po_site_lookup_type (lookup_type, status)
  )`,
  `ALTER TABLE po_site_lookups MODIFY COLUMN lookup_type ENUM('site_address', 'site_contact', 'project_manager') NOT NULL`,
  `ALTER TABLE document_number_sequences MODIFY COLUMN doc_type ENUM('PR', 'PO', 'WO') NOT NULL`,
  // Own-vendor HOD final: Yes → L2 → CFO; No → L2 → SCM Final (skip CFO)
  `ALTER TABLE rfq_configs ADD COLUMN require_cfo_approval TINYINT(1) NULL`,
  // SCM vendor L1: Yes → L2 → CFO (if CFO exists); No → L2 → SCM RFQ (skip CFO)
  `ALTER TABLE purchase_requests ADD COLUMN require_cfo_approval TINYINT(1) NULL`,
  `ALTER TABLE purchase_requests ADD COLUMN billing_location_id INT NULL`,
  `ALTER TABLE purchase_requests ADD COLUMN billing_location VARCHAR(255) NULL`,
  `ALTER TABLE purchase_requests ADD COLUMN billing_gst_no VARCHAR(50) NULL`,
  `ALTER TABLE purchase_requests ADD COLUMN billing_address TEXT NULL`,
  `ALTER TABLE purchase_requests ADD COLUMN delivery_poc VARCHAR(255) NULL`,
  `ALTER TABLE purchase_requests ADD COLUMN place_of_delivery TEXT NULL`,
  `ALTER TABLE purchase_requests ADD COLUMN expected_delivery_timeline VARCHAR(255) NULL`,
  `ALTER TABLE purchase_requests ADD COLUMN payment_terms VARCHAR(255) NULL`,
  `ALTER TABLE purchase_requests ADD COLUMN work_start_date DATE NULL`,
  `ALTER TABLE purchase_requests ADD COLUMN work_end_date DATE NULL`,
  `ALTER TABLE purchase_requests ADD COLUMN pr_flow ENUM('standard', 'functional') NOT NULL DEFAULT 'standard'`,
  `ALTER TABLE purchase_requests ADD COLUMN approval_user_id INT NULL`,
  `ALTER TABLE purchase_requests ADD COLUMN approval_user_ids JSON NULL`,
  `UPDATE purchase_requests SET pr_flow = 'functional' WHERE approval_user_id IS NOT NULL`,
  `UPDATE purchase_requests SET pr_flow = 'standard' WHERE approval_user_id IS NULL`,
  `UPDATE purchase_requests
     SET approval_user_ids = JSON_ARRAY(approval_user_id)
     WHERE approval_user_id IS NOT NULL
       AND (approval_user_ids IS NULL OR JSON_LENGTH(approval_user_ids) = 0)`,
  `ALTER TABLE purchase_requests MODIFY COLUMN pr_flow ENUM('standard', 'functional') NOT NULL DEFAULT 'standard'`,
  `ALTER TABLE rfq_configs ADD COLUMN recommendation_justification TEXT NULL`,
  `ALTER TABLE rfq_configs ADD COLUMN send_back_remarks TEXT NULL`,
  // WhatsApp notify — optional mobile with country code preferred (e.g. 9198xxxxxxxx)
  `ALTER TABLE users ADD COLUMN phone VARCHAR(20) NULL`,
  `ALTER TABLE users ADD COLUMN entity_id INT NULL`,
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
  `CREATE TABLE IF NOT EXISTS user_activity_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    user_email VARCHAR(255) NULL,
    user_name VARCHAR(200) NULL,
    user_role VARCHAR(80) NULL,
    action VARCHAR(64) NOT NULL,
    resource VARCHAR(255) NULL,
    description VARCHAR(500) NULL,
    ip_address VARCHAR(64) NULL,
    user_agent VARCHAR(500) NULL,
    entity_type VARCHAR(64) NULL,
    entity_id INT NULL,
    entity_label VARCHAR(120) NULL,
    status_code SMALLINT NULL,
    meta_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_activity_created (created_at),
    INDEX idx_user_activity_user (user_id),
    INDEX idx_user_activity_action (action),
    INDEX idx_user_activity_email (user_email)
  )`,
  // Post-vendor-acceptance fulfillment: GRN → Invoice → Accounts Manager → Payment
  `ALTER TABLE purchase_orders MODIFY COLUMN status ENUM(
    'draft', 'imported', 'pending_approval', 'pending_buyer_verify', 'approved', 'rejected',
    'sent_to_vendor', 'awaiting_grn', 'grn_completed', 'invoice_entry',
    'pending_accounts_approval', 'approved_for_payment', 'paid', 'cancelled'
  ) DEFAULT 'draft'`,
  `CREATE TABLE IF NOT EXISTS grn_headers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    grn_number VARCHAR(40) NOT NULL UNIQUE,
    po_id INT NOT NULL,
    pr_id INT NULL,
    status ENUM('draft', 'submitted', 'fully_received', 'partially_received', 'rejected') NOT NULL DEFAULT 'submitted',
    receipt_date DATE NULL,
    received_by VARCHAR(150) NULL,
    inspected_by VARCHAR(150) NULL,
    location VARCHAR(150) NULL,
    challan_number VARCHAR(100) NULL,
    remarks TEXT NULL,
    received_value DECIMAL(15, 2) NOT NULL DEFAULT 0,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_grn_po (po_id),
    INDEX idx_grn_status (status)
  )`,
  `CREATE TABLE IF NOT EXISTS grn_line_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    grn_id INT NOT NULL,
    po_line_item_id INT NULL,
    description TEXT NOT NULL,
    ordered_qty DECIMAL(15, 3) NOT NULL DEFAULT 0,
    received_qty DECIMAL(15, 3) NOT NULL DEFAULT 0,
    unit_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
    line_total DECIMAL(15, 2) NOT NULL DEFAULT 0,
    condition_label VARCHAR(80) NULL,
    FOREIGN KEY (grn_id) REFERENCES grn_headers(id) ON DELETE CASCADE,
    INDEX idx_grn_line_grn (grn_id)
  )`,
  `CREATE TABLE IF NOT EXISTS invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_number VARCHAR(80) NULL,
    po_id INT NOT NULL,
    grn_id INT NULL,
    pr_id INT NULL,
    status ENUM(
      'awaiting_upload', 'pending_verification', 'pending_manager_approval',
      'approved_for_payment', 'on_hold', 'discrepancy', 'paid', 'rejected'
    ) NOT NULL DEFAULT 'awaiting_upload',
    vendor_name VARCHAR(255) NULL,
    invoice_date DATE NULL,
    due_date DATE NULL,
    invoice_subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0,
    invoice_tax DECIMAL(15, 2) NOT NULL DEFAULT 0,
    invoice_grand_total DECIMAL(15, 2) NOT NULL DEFAULT 0,
    po_grand_total DECIMAL(15, 2) NOT NULL DEFAULT 0,
    grn_received_value DECIMAL(15, 2) NOT NULL DEFAULT 0,
    invoice_file_name VARCHAR(255) NULL,
    invoice_file_path VARCHAR(500) NULL,
    accounts_remarks TEXT NULL,
    approval_history JSON NULL,
    created_by INT NULL,
    verified_by INT NULL,
    manager_approved_by INT NULL,
    submitted_at TIMESTAMP NULL,
    verified_at TIMESTAMP NULL,
    manager_approved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_inv_po (po_id),
    INDEX idx_inv_grn (grn_id),
    INDEX idx_inv_status (status)
  )`,
  `ALTER TABLE invoices ADD COLUMN vendor_invoice_token VARCHAR(64) NULL`,
  `ALTER TABLE invoices ADD COLUMN vendor_invoice_mode ENUM('email', 'manual') NULL`,
  `ALTER TABLE invoices ADD COLUMN vendor_notified_at TIMESTAMP NULL`,
  `ALTER TABLE invoices ADD UNIQUE INDEX uk_inv_vendor_token (vendor_invoice_token)`,
  // Persist RFQ quotation binaries in DB — Cloud Run disk is ephemeral
  `ALTER TABLE vendor_quotation_submissions ADD COLUMN quotation_file_data LONGBLOB NULL`,
  `CREATE TABLE IF NOT EXISTS vendor_quotation_files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    submission_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NULL,
    file_data LONGBLOB NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_vqf_submission (submission_id, sort_order)
  )`,
  `CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT NOT NULL,
    po_id INT NOT NULL,
    payment_date DATE NULL,
    payment_mode ENUM('NEFT', 'RTGS', 'IMPS', 'Cheque', 'DD', 'Other') NOT NULL DEFAULT 'NEFT',
    bank_account VARCHAR(150) NULL,
    utr_reference VARCHAR(120) NULL,
    amount_paid DECIMAL(15, 2) NOT NULL DEFAULT 0,
    remarks TEXT NULL,
    receipt_file_name VARCHAR(255) NULL,
    receipt_file_path VARCHAR(500) NULL,
    uploaded_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    INDEX idx_pay_invoice (invoice_id),
    INDEX idx_pay_po (po_id)
  )`,
  `ALTER TABLE vendors ADD COLUMN contact_name VARCHAR(150) NULL`,
  `ALTER TABLE vendors ADD COLUMN msme ENUM('yes', 'no') NOT NULL DEFAULT 'no'`,
  `ALTER TABLE vendors ADD COLUMN msme_type ENUM('Micro', 'Small', 'Medium') NULL`,
  `ALTER TABLE vendors ADD COLUMN documents_complete ENUM('yes', 'no') NOT NULL DEFAULT 'no'`,
  `ALTER TABLE vendors MODIFY COLUMN msme VARCHAR(150) NULL`,
  `CREATE TABLE IF NOT EXISTS pr_attachments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pr_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT NOT NULL DEFAULT 0,
    mime_type VARCHAR(120) NULL,
    file_data LONGBLOB NULL,
    uploaded_by INT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pr_id) REFERENCES purchase_requests(id) ON DELETE CASCADE,
    INDEX idx_pr_attachments_pr (pr_id)
  )`,
  `ALTER TABLE purchase_requests ADD COLUMN request_category ENUM('Product', 'Service') NULL`,
  `ALTER TABLE purchase_requests ADD COLUMN project_detail VARCHAR(255) NULL`,
  `ALTER TABLE purchase_requests ADD COLUMN special_notes TEXT NULL`,
  `ALTER TABLE purchase_requests ADD COLUMN delivery_poc_email VARCHAR(255) NULL`,
  `ALTER TABLE purchase_requests ADD COLUMN delivery_poc_phone VARCHAR(50) NULL`,
  `ALTER TABLE purchase_requests ADD COLUMN project_manager_ho VARCHAR(255) NULL`,
  `ALTER TABLE purchase_requests ADD COLUMN project_manager_contact VARCHAR(50) NULL`,
  `ALTER TABLE purchase_requests ADD COLUMN project_manager_email VARCHAR(255) NULL`,
  `ALTER TABLE po_letterhead_masters MODIFY COLUMN po_type ENUM('short_po', 'long_po', 'short_wo', 'long_wo', 'custom_short_po', 'custom_long_po', 'custom_short_wo', 'custom_long_wo') NOT NULL`,
  `ALTER TABLE purchase_orders MODIFY COLUMN po_type ENUM('short_po', 'long_po', 'short_wo', 'long_wo', 'custom_short_po', 'custom_long_po', 'custom_short_wo', 'custom_long_wo') NOT NULL DEFAULT 'short_po'`,
];

/** Idempotent index creation for PR/PO list & track performance */
const PERFORMANCE_INDEXES = [
  // purchase_requests
  { table: 'purchase_requests', name: 'idx_pr_department', columns: 'department_id' },
  { table: 'purchase_requests', name: 'idx_pr_entity', columns: 'entity_id' },
  { table: 'purchase_requests', name: 'idx_pr_status_submitted', columns: 'status, submitted_at, id' },
  { table: 'purchase_requests', name: 'idx_pr_status_created', columns: 'status, created_at, id' },
  // purchase_orders
  { table: 'purchase_orders', name: 'idx_po_pr_status', columns: 'pr_id, status' },
  { table: 'purchase_orders', name: 'idx_po_created_by_created', columns: 'created_by, created_at' },
  { table: 'purchase_orders', name: 'idx_po_created_by_status', columns: 'created_by, status' },
  { table: 'purchase_orders', name: 'idx_po_status_created', columns: 'status, created_at' },
  { table: 'purchase_orders', name: 'idx_po_entity', columns: 'entity_id' },
  { table: 'purchase_orders', name: 'idx_po_vendor_name', columns: 'vendor_name' },
  // line items / approvals / tasks
  { table: 'pr_line_items', name: 'idx_pr_line_pr', columns: 'pr_id' },
  { table: 'po_line_items', name: 'idx_po_line_po', columns: 'po_id' },
  { table: 'pr_approvals', name: 'idx_pr_approvals_pr', columns: 'pr_id' },
  { table: 'pr_approvals', name: 'idx_pr_approvals_pr_created', columns: 'pr_id, created_at' },
  { table: 'workflow_tasks', name: 'idx_task_pr', columns: 'pr_id' },
  { table: 'workflow_tasks', name: 'idx_task_user_status', columns: 'assigned_user_id, status' },
  // RFQ lookups used by ready-for-PO EXISTS
  { table: 'rfq_configs', name: 'idx_rfq_config_finalized', columns: 'finalized_at' },
  { table: 'rfq_configs', name: 'idx_rfq_config_recommended', columns: 'recommended_invitation_id' },
];

const FULLTEXT_INDEXES = [
  {
    table: 'purchase_requests',
    name: 'ft_pr_search',
    columns: 'pr_number, title',
  },
  {
    table: 'purchase_orders',
    name: 'ft_po_search',
    columns: 'po_number, vendor_name',
  },
];

async function indexExists(table, name) {
  const [rows] = await pool.query(
    `SELECT 1 AS ok
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND index_name = ?
     LIMIT 1`,
    [table, name]
  );
  return rows.length > 0;
}

async function ensurePerformanceIndexes() {
  for (const idx of PERFORMANCE_INDEXES) {
    try {
      if (await indexExists(idx.table, idx.name)) continue;
      await pool.query(`CREATE INDEX \`${idx.name}\` ON \`${idx.table}\` (${idx.columns})`);
      console.log(`Index created: ${idx.table}.${idx.name}`);
    } catch (err) {
      const msg = String(err.message || '');
      if (msg.includes('Duplicate') || msg.includes('already exists')) continue;
      console.warn(`Index skipped ${idx.table}.${idx.name}:`, msg);
    }
  }

  for (const idx of FULLTEXT_INDEXES) {
    try {
      if (await indexExists(idx.table, idx.name)) continue;
      await pool.query(
        `CREATE FULLTEXT INDEX \`${idx.name}\` ON \`${idx.table}\` (${idx.columns})`
      );
      console.log(`Fulltext index created: ${idx.table}.${idx.name}`);
    } catch (err) {
      const msg = String(err.message || '');
      if (msg.includes('Duplicate') || msg.includes('already exists')) continue;
      console.warn(`Fulltext index skipped ${idx.table}.${idx.name}:`, msg);
    }
  }
}

export async function runStartupMigrations() {
  for (const sql of MIGRATIONS) {
    try {
      await pool.query(sql);
    } catch (err) {
      if (String(err.message || '').includes('Duplicate column')) continue;
      console.warn('Migration skipped:', err.message);
    }
  }

  try {
    await ensurePerformanceIndexes();
  } catch (err) {
    console.warn('Performance index migration skipped:', err.message);
  }

  try {
    const { seedNavigationPermissions } = await import('./permissionService.js');
    await seedNavigationPermissions();
  } catch (err) {
    console.warn('Navigation permission seed skipped:', err.message);
  }

  try {
    const { seedLetterheadDefaults } = await import('./poLetterheadService.js');
    await seedLetterheadDefaults();
  } catch (err) {
    console.warn('Letterhead seed skipped:', err.message);
  }

  try {
    const { seedDefaultCategories, seedDefaultSiteContacts, seedDefaultProjectManagers } =
      await import('./masterService.js');
    await seedDefaultCategories();
    const siteContacts = await seedDefaultSiteContacts();
    const projectManagers = await seedDefaultProjectManagers();
    console.log(`Site contact lookup seed: ${siteContacts} contacts`);
    console.log(`Project manager lookup seed: ${projectManagers} managers`);
  } catch (err) {
    console.warn('Category / site-contact / project-manager seed skipped:', err.message);
  }

  try {
    const { ensurePreferredScmBuyerRole, reassignPendingScmBuyerTasks, getPreferredScmBuyerEmails } =
      await import('../utils/scmAssignee.js');
    const roleUpdated = await ensurePreferredScmBuyerRole();
    const reassigned = await reassignPendingScmBuyerTasks();
    console.log(
      `SCM Buyer assignees: ${getPreferredScmBuyerEmails().join(', ')}` +
        ` (role updates=${roleUpdated}, pending tasks role-queued=${reassigned.updated})`
    );
  } catch (err) {
    console.warn('SCM Buyer assignee seed skipped:', err.message);
  }

  try {
    const {
      ensurePreferredScmManagerUser,
      reassignPendingScmManagerTasks,
      getPreferredScmManagerEmail,
    } = await import('../utils/scmAssignee.js');
    const managerId = await ensurePreferredScmManagerUser();
    const reassignedMgr = await reassignPendingScmManagerTasks();
    if (managerId) {
      const { seedUserPermissionsForRole } = await import('./permissionService.js');
      await seedUserPermissionsForRole(managerId, 'SCM Manager');
      await pool.query(
        `INSERT IGNORE INTO user_permissions (user_id, permission_code) VALUES (?, ?)`,
        [managerId, 'nav.scm_manager_dashboard']
      );
    }
    console.log(
      `SCM Manager assignee: ${getPreferredScmManagerEmail()} id=${managerId}` +
        ` (pending tasks assigned=${reassignedMgr.updated})`
    );
  } catch (err) {
    console.warn('SCM Manager assignee seed skipped:', err.message);
  }

  try {
    const { reassignVendorAcceptanceTasksToRequesters } = await import('./poService.js');
    const va = await reassignVendorAcceptanceTasksToRequesters();
    console.log(`Vendor acceptance tasks assigned to requesters: ${va.updated}`);
  } catch (err) {
    console.warn('Vendor acceptance task migration skipped:', err.message);
  }

  try {
    const { ensureDefaultScmManagerSignature } = await import('./signatureService.js');
    const sig = await ensureDefaultScmManagerSignature({ backfill: true });
    if (sig?.ok) {
      console.log(
        `SCM Manager default signature seeded for ${sig.managerEmail}` +
          ` (galleryId=${sig.galleryId}, backfilledPOs=${sig.backfilled})`
      );
    } else {
      console.warn('SCM Manager default signature seed skipped:', sig?.reason || 'unknown');
    }
  } catch (err) {
    console.warn('SCM Manager default signature seed skipped:', err.message);
  }
}
