CREATE TABLE IF NOT EXISTS departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(50) NULL,
  description TEXT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  budget_allocated DECIMAL(15, 2) DEFAULT 0,
  budget_utilized DECIMAL(15, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  department_id INT NULL,
  is_active TINYINT(1) DEFAULT 1,
  refexone_user_id VARCHAR(36) NULL UNIQUE,
  supervisor_email VARCHAR(150) NULL,
  supervisor_name VARCHAR(120) NULL,
  l2_manager_email VARCHAR(150) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS purchase_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pr_number VARCHAR(40) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  request_type ENUM('Capex', 'Opex', 'Service') NOT NULL DEFAULT 'Opex',
  purchase_type ENUM('purchase_order', 'work_order') NOT NULL DEFAULT 'purchase_order',
  department_id INT NOT NULL,
  entity_id INT NULL,
  requester_id INT NOT NULL,
  priority ENUM('Low', 'Medium', 'High', 'Critical') DEFAULT 'Medium',
  justification TEXT,
  required_date DATE NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  total_amount DECIMAL(15, 2) DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  vendor_selection ENUM('own', 'scm') NOT NULL DEFAULT 'scm',
  pr_flow ENUM('standard', 'functional') NOT NULL DEFAULT 'standard',
  approval_user_id INT NULL,
  approval_user_ids JSON NULL,
  billing_location_id INT NULL,
  billing_location VARCHAR(255) NULL,
  billing_gst_no VARCHAR(50) NULL,
  billing_address TEXT NULL,
  delivery_poc VARCHAR(255) NULL,
  place_of_delivery TEXT NULL,
  expected_delivery_timeline VARCHAR(255) NULL,
  payment_terms VARCHAR(255) NULL,
  current_stage VARCHAR(50) NULL,
  submitted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (requester_id) REFERENCES users(id),
  INDEX idx_pr_status (status),
  INDEX idx_pr_requester (requester_id),
  INDEX idx_pr_department (department_id),
  INDEX idx_pr_entity (entity_id),
  INDEX idx_pr_status_submitted (status, submitted_at, id),
  INDEX idx_pr_status_created (status, created_at, id),
  FULLTEXT INDEX ft_pr_search (pr_number, title)
);

CREATE TABLE IF NOT EXISTS pr_line_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pr_id INT NOT NULL,
  category VARCHAR(100),
  description VARCHAR(255) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit VARCHAR(50) NOT NULL DEFAULT 'Nos',
  unit_cost DECIMAL(15, 2) NOT NULL DEFAULT 0,
  gst_percentage DECIMAL(6, 2) NOT NULL DEFAULT 18,
  total DECIMAL(15, 2) NOT NULL DEFAULT 0,
  FOREIGN KEY (pr_id) REFERENCES purchase_requests(id) ON DELETE CASCADE,
  INDEX idx_pr_line_pr (pr_id)
);

CREATE TABLE IF NOT EXISTS pr_approvals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pr_id INT NOT NULL,
  stage VARCHAR(50) NOT NULL,
  approver_id INT NULL,
  action VARCHAR(30) NOT NULL,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pr_id) REFERENCES purchase_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_pr_approvals_pr (pr_id),
  INDEX idx_pr_approvals_pr_created (pr_id, created_at)
);

CREATE TABLE IF NOT EXISTS workflow_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pr_id INT NOT NULL,
  task_type VARCHAR(50) DEFAULT 'PR_APPROVAL',
  assigned_role VARCHAR(50) NOT NULL,
  assigned_user_id INT NULL,
  status ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending',
  due_date DATE NULL,
  sla_notified_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pr_id) REFERENCES purchase_requests(id) ON DELETE CASCADE,
  INDEX idx_task_role_status (assigned_role, status),
  INDEX idx_task_pr (pr_id),
  INDEX idx_task_user_status (assigned_user_id, status)
);

CREATE TABLE IF NOT EXISTS rfq_invitations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pr_id INT NOT NULL,
  vendor_name VARCHAR(150) NOT NULL,
  vendor_email VARCHAR(150) NOT NULL,
  access_token VARCHAR(64) NOT NULL UNIQUE,
  round INT DEFAULT 1,
  status ENUM('invited', 'submitted', 'sent_back', 'accepted') DEFAULT 'invited',
  send_back_reason TEXT NULL,
  send_back_fields JSON NULL,
  created_by INT NOT NULL,
  invite_mode ENUM('email', 'manual') NOT NULL DEFAULT 'email',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (pr_id) REFERENCES purchase_requests(id) ON DELETE CASCADE,
  INDEX idx_rfq_pr (pr_id),
  INDEX idx_rfq_token (access_token)
);

CREATE TABLE IF NOT EXISTS vendor_quotation_submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rfq_invitation_id INT NOT NULL,
  round INT NOT NULL,
  quoted_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
  lead_time_days INT DEFAULT 0,
  payment_terms VARCHAR(100) DEFAULT 'Standard',
  compliance TINYINT(1) DEFAULT 1,
  vendor_notes TEXT,
  warranty VARCHAR(100) NULL,
  delivery_terms VARCHAR(100) NULL,
  quotation_file_name VARCHAR(255) NULL,
  quotation_file_path VARCHAR(500) NULL,
  quotation_file_data LONGBLOB NULL,
  custom_fields JSON NULL,
  requester_fields JSON NULL,
  status ENUM('submitted', 'sent_back', 'accepted') DEFAULT 'submitted',
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rfq_invitation_id) REFERENCES rfq_invitations(id) ON DELETE CASCADE,
  INDEX idx_vq_invitation (rfq_invitation_id)
);

CREATE TABLE IF NOT EXISTS rfq_configs (
  pr_id INT PRIMARY KEY,
  field_definitions JSON NOT NULL,
  recommended_invitation_id INT NULL,
  recommendation_justification TEXT NULL,
  send_back_remarks TEXT NULL,
  max_rounds INT NULL,
  requester_submitted_at TIMESTAMP NULL,
  finalized_at TIMESTAMP NULL,
  require_cfo_approval TINYINT(1) NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (pr_id) REFERENCES purchase_requests(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  po_number VARCHAR(40) NOT NULL UNIQUE,
  reference_po_number VARCHAR(30) NULL,
  pr_id INT NULL,
  vendor_name VARCHAR(150) NOT NULL,
  vendor_email VARCHAR(150) NOT NULL,
  rfq_invitation_id INT NULL,
  created_by INT NOT NULL,
  delivery_address TEXT,
  expected_delivery_date DATE NULL,
  po_date DATE NULL,
  payment_terms TEXT DEFAULT NULL,
  incoterms VARCHAR(255) DEFAULT 'DDP',
  special_instructions TEXT,
  po_type ENUM('short_po', 'long_po', 'short_wo', 'long_wo') NOT NULL DEFAULT 'short_po',
  purchase_type ENUM('purchase_order', 'work_order') NOT NULL DEFAULT 'purchase_order',
  letterhead_header LONGTEXT NULL,
  letterhead_id INT NULL,
  entity_id INT NULL,
  entity VARCHAR(255) NULL,
  header_logo LONGTEXT NULL,
  footer_logo LONGTEXT NULL,
  terms_clauses JSON NULL,
  annexure_clauses JSON NULL,
  annexure_ii_html LONGTEXT NULL,
  po_terms_details JSON NULL,
  gst_percentage DECIMAL(5, 2) DEFAULT 18,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  grand_total DECIMAL(15, 2) NOT NULL DEFAULT 0,
  status ENUM('draft', 'imported', 'pending_approval', 'pending_buyer_verify', 'approved', 'rejected', 'sent_to_vendor') DEFAULT 'draft',
  pdf_path VARCHAR(500) NULL,
  signed_pdf_path VARCHAR(500) NULL,
  signer_id INT NULL,
  signature_name VARCHAR(150) NULL,
  signature_image_path VARCHAR(500) NULL,
  signer_comments TEXT NULL,
  signed_at TIMESTAMP NULL,
  vendor_notified_at TIMESTAMP NULL,
  vendor_acceptance_token VARCHAR(64) NULL,
  vendor_acceptance_mode ENUM('email', 'manual') NULL,
  vendor_acceptance_status ENUM('pending', 'accepted', 'rejected', 'partial') NULL,
  vendor_acceptance_remarks TEXT NULL,
  vendor_acceptance_file_name VARCHAR(255) NULL,
  vendor_acceptance_file_path VARCHAR(500) NULL,
  vendor_delivery_confirmed_date DATE NULL,
  vendor_accepted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (pr_id) REFERENCES purchase_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (signer_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_po_pr (pr_id),
  INDEX idx_po_status (status),
  INDEX idx_po_pr_status (pr_id, status),
  INDEX idx_po_created_by_created (created_by, created_at),
  INDEX idx_po_created_by_status (created_by, status),
  INDEX idx_po_status_created (status, created_at),
  INDEX idx_po_entity (entity_id),
  INDEX idx_po_vendor_name (vendor_name),
  FULLTEXT INDEX ft_po_search (po_number, vendor_name)
);

CREATE TABLE IF NOT EXISTS user_signatures (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  label VARCHAR(100) NULL,
  image_path VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_signatures_user (user_id)
);

CREATE TABLE IF NOT EXISTS po_line_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  po_id INT NOT NULL,
  category VARCHAR(100),
  item_name VARCHAR(255) NULL,
  description TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit VARCHAR(50) NOT NULL DEFAULT 'Nos',
  unit_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
  discount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  tax_percentage DECIMAL(6, 2) NOT NULL DEFAULT 18,
  total DECIMAL(15, 2) NOT NULL DEFAULT 0,
  FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  INDEX idx_po_line_po (po_id)
);

CREATE TABLE IF NOT EXISTS po_site_lookups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lookup_type ENUM('site_address', 'site_contact') NOT NULL,
  label TEXT NOT NULL,
  email VARCHAR(150) NULL,
  phone VARCHAR(50) NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_po_site_lookup_type (lookup_type, status)
);

CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,
  request_type ENUM('Capex', 'Opex', 'Service', 'All') NOT NULL DEFAULT 'All',
  description TEXT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_category_status (status),
  INDEX idx_category_request_type (request_type)
);

CREATE TABLE IF NOT EXISTS items (
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
);

CREATE TABLE IF NOT EXISTS vendors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  vendor_type ENUM('Company', 'Individual') NOT NULL DEFAULT 'Company',
  gst_number VARCHAR(15) NULL,
  pan_number VARCHAR(10) NULL,
  email VARCHAR(150) NOT NULL,
  phone VARCHAR(20) NULL,
  address TEXT NULL,
  category VARCHAR(100) NULL,
  contact_name VARCHAR(150) NULL,
  msme VARCHAR(150) NULL,
  msme_type ENUM('Micro', 'Small', 'Medium') NULL,
  documents_complete ENUM('yes', 'no') NOT NULL DEFAULT 'no',
  account_number VARCHAR(50) NULL,
  ifsc_code VARCHAR(11) NULL,
  bank_name VARCHAR(100) NULL,
  branch VARCHAR(100) NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_vendor_email (email),
  INDEX idx_vendor_status (status)
);

CREATE TABLE IF NOT EXISTS po_letterhead_masters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  po_type ENUM('short_po', 'long_po', 'short_wo', 'long_wo') NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL DEFAULT 'Purchase Order',
  entity VARCHAR(255) NULL,
  letterhead_header LONGTEXT NULL,
  header_logo LONGTEXT NULL,
  footer_logo LONGTEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS po_letterhead_clauses (
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
);

CREATE TABLE IF NOT EXISTS letterhead_branding (
  id INT PRIMARY KEY,
  entity VARCHAR(255) NULL,
  header_logo LONGTEXT NULL,
  footer_logo LONGTEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS letterhead_masters (
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
);

CREATE TABLE IF NOT EXISTS letterhead_locations (
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
);

CREATE TABLE IF NOT EXISTS entity_masters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL UNIQUE,
  code VARCHAR(20) NULL,
  cost_center VARCHAR(100) NOT NULL,
  description TEXT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_entity_status (status),
  INDEX idx_entity_cost_center (cost_center),
  INDEX idx_entity_code (code)
);

CREATE TABLE IF NOT EXISTS entity_locations (
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
);

CREATE TABLE IF NOT EXISTS vendor_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_id INT NOT NULL,
  doc_type ENUM('gst', 'pan', 'cheque', 'msme', 'kyc', 'msme_declaration') NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_vendor_doc (vendor_id, doc_type)
);

CREATE TABLE IF NOT EXISTS navigation_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(80) NOT NULL UNIQUE,
  label VARCHAR(120) NOT NULL,
  path VARCHAR(200) NOT NULL,
  icon VARCHAR(80) NOT NULL DEFAULT 'ri-link',
  nav_group VARCHAR(80) NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_permissions (
  user_id INT NOT NULL,
  permission_code VARCHAR(80) NOT NULL,
  PRIMARY KEY (user_id, permission_code),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS email_logs (
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
);

CREATE TABLE IF NOT EXISTS whatsapp_logs (
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
);
