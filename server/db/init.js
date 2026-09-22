import 'dotenv/config';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/*
 * ============================================================
 * RMC DATABASE CONFIGURATION
 * ============================================================
 *
 * Cloud Shell / local:
 *   Cloud SQL Auth Proxy -> 127.0.0.1:9470
 *
 * Cloud Run:
 *   Cloud SQL Unix Socket
 *
 * RMC database:
 *   p2p_rmc_business
 *
 * RMC DB user:
 *   p2p_rmc_app
 */

const DB_NAME = process.env.DB_NAME || 'p2p_rmc_business';

function buildDbConfig(includeDatabase = false) {
  const instance =
    process.env.INSTANCE_CONNECTION_NAME ||
    process.env.CLOUD_SQL_CONNECTION_NAME ||
    '';

  const base = {
    user: process.env.DB_USER || 'p2p_rmc_app',
    password: process.env.DB_PASSWORD || '$RMC_PASSWORD',
  };

  if (includeDatabase) {
    base.database = DB_NAME;
  }

  /*
   * CLOUD RUN
   *
   * Cloud Run environment:
   *
   * USE_CLOUD_SQL_SOCKET=true
   * INSTANCE_CONNECTION_NAME=project:region:instance
   *
   * Example:
   * master-diorama-489103-u2:asia-south1:p2p-mysql
   */
  if (
    instance &&
    process.env.USE_CLOUD_SQL_SOCKET === 'true'
  ) {
    return {
      ...base,
      socketPath: `/cloudsql/${instance}`,
    };
  }

  /*
   * CLOUD SHELL / LOCAL
   *
   * Cloud SQL Auth Proxy:
   *
   * 127.0.0.1:9470
   */
  return {
    ...base,
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 9470,
  };
}

const DB_CONFIG = buildDbConfig(false);

/*
 * ============================================================
 * KEEP YOUR EXISTING CODE BELOW THIS LINE
 * ============================================================
 */

const DEPARTMENTS = [
  {
    name: 'IT & Technology',
    budget_allocated: 5000000,
    budget_utilized: 3850000
  },
  {
    name: 'Operations',
    budget_allocated: 3500000,
    budget_utilized: 2940000
  },
  {
    name: 'Marketing',
    budget_allocated: 2000000,
    budget_utilized: 1200000
  },
  {
    name: 'HR & Admin',
    budget_allocated: 1500000,
    budget_utilized: 980000
  },
  {
    name: 'Finance',
    budget_allocated: 1000000,
    budget_utilized: 780000
  },
];

const USERS = [
  {
    name: 'Rajesh Kumar',
    email: 'requester@procure.com',
    role: 'Requester',
    department: 'IT & Technology'
  },
  {
    name: 'Amit Sharma',
    email: 'manager@procure.com',
    role: 'HOD Approver',
    department: 'IT & Technology'
  },
  {
    name: 'Robert Wilson',
    email: 'hod.ops@procure.com',
    role: 'HOD Approver',
    department: 'Operations'
  },
  {
    name: 'Neha Gupta',
    email: 'hod.hr@procure.com',
    role: 'HOD Approver',
    department: 'HR & Admin'
  },
  {
    name: 'Sarah Johnson',
    email: 'hod.marketing@procure.com',
    role: 'HOD Approver',
    department: 'Marketing'
  },
  {
    name: 'Priya Mehta',
    email: 'hod.finance@procure.com',
    role: 'HOD Approver',
    department: 'Finance'
  },
  {
    name: 'Deepak Verma',
    email: 'prmanager@procure.com',
    role: 'PR Manager',
    department: null
  },
  {
    name: 'Michael Chen',
    email: 'cfo@procure.com',
    role: 'CFO',
    department: null
  },
  {
    name: 'Neha Gupta',
    email: 'scm@procure.com',
    role: 'SCM Buyer',
    department: null
  },
  {
    name: 'Rajeev V',
    email: 'rajeev.v@refex.co.in',
    role: 'SCM Manager',
    department: null
  },
  {
    name: 'Priya Menon',
    email: 'accounts@procure.com',
    role: 'Accounts Payable',
    department: null
  },
  {
    name: 'Ramesh Iyer',
    email: 'accountsmanager@procure.com',
    role: 'Accounts Manager',
    department: null
  },
  {
    name: 'Tech Solutions',
    email: 'vendor@procure.com',
    role: 'Vendor',
    department: null
  },
  {
    name: 'Digital Systems Inc',
    email: 'vendor2@procure.com',
    role: 'Vendor',
    department: null
  },
  {
    name: 'Global Supplies Ltd',
    email: 'vendor3@procure.com',
    role: 'Vendor',
    department: null
  },
  {
    name: 'Suresh Reddy',
    email: 'tech@procure.com',
    role: 'Tech Evaluator',
    department: null
  },
  {
    name: 'Sarah Johnson',
    email: 'functional@procure.com',
    role: 'Functional Team',
    department: null
  },
  {
    name: 'System Admin',
    email: 'admin@procure.com',
    role: 'Super Admin',
    department: null
  },
];

async function init() {
  console.log('Connecting to MySQL...');
  console.log(`Database: ${DB_NAME}`);
  console.log(`User: ${DB_CONFIG.user}`);
  console.log(`Host: ${DB_CONFIG.host || 'Cloud SQL Socket'}`);
  console.log(`Port: ${DB_CONFIG.port || 'socket'}`);

  const connection = await mysql.createConnection(DB_CONFIG);

  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`
     CHARACTER SET utf8mb4
     COLLATE utf8mb4_unicode_ci`
  );

  await connection.query(`USE \`${DB_NAME}\``);

  const schema = fs.readFileSync(
    path.join(__dirname, 'schema.sql'),
    'utf8'
  );

  for (
    const statement of schema
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
  ) {
    try {
      await connection.query(statement);
    } catch (err) {
      const msg = String(err.message || '');

      if (
        msg.includes('already exists') ||
        msg.includes('Duplicate key name') ||
        msg.includes('Duplicate column name')
      ) {
        console.warn(
          'Schema skip:',
          msg.split('\n')[0]
        );
        continue;
      }

      throw err;
    }
  }

  console.log('Schema applied.');

  /*
   * Keep your existing migrations array and remaining
   * init.js code from your current file here unchanged.
   *
   * IMPORTANT:
   * Do not delete your existing migrations,
   * vendors, permissions, letterhead seed,
   * or user seed code.
   */
}

init().catch((err) => {
  console.error('DB init failed:', err.message);
  process.exit(1);
});