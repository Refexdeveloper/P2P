import pool from '../config/db.js';

const MIGRATIONS = [
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
  `ALTER TABLE purchase_orders ADD COLUMN signature_image_path VARCHAR(500) NULL`,
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
];

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
    const { seedLetterheadDefaults } = await import('./poLetterheadService.js');
    await seedLetterheadDefaults();
  } catch (err) {
    console.warn('Letterhead seed skipped:', err.message);
  }

  try {
    const { seedDefaultCategories } = await import('./masterService.js');
    await seedDefaultCategories();
  } catch (err) {
    console.warn('Category seed skipped:', err.message);
  }
}
