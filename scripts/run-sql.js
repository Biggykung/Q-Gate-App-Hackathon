require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2');

const allowedSqlFiles = new Set(['schema.sql', 'seed.sql']);
const fileName = process.argv[2];
if (!allowedSqlFiles.has(fileName)) {
  process.stderr.write('Usage: node scripts/run-sql.js schema.sql|seed.sql\n');
  process.exit(1);
}

const sql = fs.readFileSync(path.join(__dirname, '..', fileName), 'utf8');
const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_ADMIN_USER || process.env.DB_USER,
  password: process.env.DB_ADMIN_PASSWORD || process.env.DB_PASSWORD,
  multipleStatements: true
});

connection.query(sql, (error) => {
  if (error) {
    process.stderr.write(`${fileName} failed: ${error.message}\n`);
    connection.end();
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`${fileName} completed.\n`);
  connection.end();
});
