import 'dotenv/config';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const DB_NAME = process.env.DB_NAME || 'p2p_rmc_business';

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 9470,
  user: process.env.DB_USER || 'p2p_rmc_app',
  password: process.env.DB_PASSWORD || '',
  database: DB_NAME,
};

const ADMIN_EMAIL = 'admin@procure.com';
const ADMIN_PASSWORD = 'Admin@12345';

async function createAdmin() {
  let connection;

  try {
    console.log('Connecting to RMC database...');
    console.log(`Database: ${DB_NAME}`);
    console.log(`User: ${DB_CONFIG.user}`);
    console.log(`Host: ${DB_CONFIG.host}`);
    console.log(`Port: ${DB_CONFIG.port}`);

    connection = await mysql.createConnection(DB_CONFIG);

    console.log('Connected to MySQL.');

    // Check users table
    const [tables] = await connection.query(
      `SHOW TABLES LIKE 'users'`
    );

    if (tables.length === 0) {
      throw new Error(
        'users table does not exist. Run db:init first to create the schema.'
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(
      ADMIN_PASSWORD,
      10
    );

    // Check whether admin already exists
    const [existing] = await connection.query(
      `SELECT id, email, role
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [ADMIN_EMAIL]
    );

    if (existing.length > 0) {
      // Update existing admin
      await connection.query(
        `UPDATE users
         SET password_hash = ?,
             role = ?,
             name = ?
         WHERE email = ?`,
        [
          passwordHash,
          'Super Admin',
          'System Admin',
          ADMIN_EMAIL,
        ]
      );

      console.log('');
      console.log('Admin user already existed.');
      console.log('Admin password has been reset.');
    } else {
      // Create new admin
      await connection.query(
        `INSERT INTO users
          (name, email, password_hash, role, department_id)
         VALUES (?, ?, ?, ?, NULL)`,
        [
          'System Admin',
          ADMIN_EMAIL,
          passwordHash,
          'Super Admin',
        ]
      );

      console.log('');
      console.log('Admin user created successfully.');
    }

    console.log('');
    console.log('======================================');
    console.log('RMC ADMIN LOGIN');
    console.log('======================================');
    console.log(`Email    : ${ADMIN_EMAIL}`);
    console.log(`Password : ${ADMIN_PASSWORD}`);
    console.log(`Role     : Super Admin`);
    console.log('======================================');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('Admin creation failed:');
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

createAdmin();