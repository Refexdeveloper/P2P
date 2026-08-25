import mysql from 'mysql2/promise';
import 'dotenv/config';

/**
 * Cloud Run + Cloud SQL: set INSTANCE_CONNECTION_NAME (or CLOUD_SQL_CONNECTION_NAME)
 * and attach the instance to the Cloud Run service. Uses Unix socket under /cloudsql/.
 * Local / TCP: set DB_HOST (+ DB_PORT).
 */
function buildPoolConfig() {
  const instance =
    process.env.INSTANCE_CONNECTION_NAME ||
    process.env.CLOUD_SQL_CONNECTION_NAME ||
    '';

  const base = {
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'p2p_system',
    waitForConnections: true,
    // Admin user-list + PR enrich do many parallel queries; keep headroom.
    connectionLimit: Number(process.env.DB_POOL_SIZE) || 25,
    // 0 = unlimited wait queue (mysql2 default). Finite limits surface as
    // "Queue limit reached." under RefexOne / User Permissions load.
    queueLimit: Number(process.env.DB_QUEUE_LIMIT ?? 0),
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
    // Return TIMESTAMP values as UTC and parse them as UTC so local IST and
    // Cloud Run (UTC) both produce the same correct Instant for formatting.
    timezone: 'Z',
  };

  if (instance) {
    return {
      ...base,
      socketPath: `/cloudsql/${instance}`,
    };
  }

  return {
    ...base,
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
  };
}

const pool = mysql.createPool(buildPoolConfig());

pool.on('connection', (connection) => {
  connection.query("SET time_zone = '+00:00'");
});

export async function pingDatabase() {
  const [rows] = await pool.query('SELECT 1 AS ok');
  return rows[0]?.ok === 1;
}

export default pool;
