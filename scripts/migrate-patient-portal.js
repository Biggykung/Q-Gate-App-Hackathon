require('dotenv').config();
const mysql = require('mysql2/promise');
async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_ADMIN_USER || process.env.DB_USER,
    password: process.env.DB_ADMIN_PASSWORD || process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'health_gate'
  });
  try {
    await addColumnIfMissing(connection, 'patients', 'portal_code_hash', 'CHAR(64) NULL');
    await addColumnIfMissing(connection, 'patients', 'portal_code_expires_at', 'DATETIME NULL');
    const [portalIndexes] = await connection.query("SHOW INDEX FROM patients WHERE Key_name = 'idx_patient_portal_code_hash'");
    if (!portalIndexes.length) await connection.query('ALTER TABLE patients ADD KEY idx_patient_portal_code_hash (portal_code_hash)');
    await addColumnIfMissing(connection, 'users', 'patient_id', 'INT UNSIGNED NULL');
    const [roleColumns] = await connection.query("SHOW COLUMNS FROM users LIKE 'role'");
    if (roleColumns.length && !roleColumns[0].Type.includes("'patient'")) {
      await connection.query("ALTER TABLE users MODIFY role ENUM('admin', 'clinician', 'viewer', 'patient') NOT NULL DEFAULT 'clinician'");
    }
    const [indexes] = await connection.query("SHOW INDEX FROM users WHERE Key_name = 'uq_users_patient'");
    if (!indexes.length) await connection.query('ALTER TABLE users ADD UNIQUE KEY uq_users_patient (patient_id)');
    const [constraints] = await connection.query("SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND CONSTRAINT_NAME = 'fk_user_patient'");
    if (!constraints.length) await connection.query('ALTER TABLE users ADD CONSTRAINT fk_user_patient FOREIGN KEY (patient_id) REFERENCES patients (Patient_id) ON DELETE CASCADE');
    process.stdout.write('Patient portal database migration completed. Existing data was preserved.\n');
  } finally { await connection.end(); }
}
async function addColumnIfMissing(connection, table, column, definition) {
  const [columns] = await connection.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
  if (!columns.length) await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
}
main().catch((error) => { process.stderr.write(`Patient portal migration failed: ${error.code || error.message}\n`); process.exitCode = 1; });
