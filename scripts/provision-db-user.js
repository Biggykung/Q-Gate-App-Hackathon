require('dotenv').config();

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2');

const envPath = path.join(__dirname, '..', '.env');
const database = process.env.DB_NAME || 'health_gate';
if (!/^[a-zA-Z0-9_]+$/.test(database)) throw new Error('DB_NAME may contain only letters, numbers, and underscores.');
const adminUser = process.env.DB_ADMIN_USER || process.env.DB_USER;
const adminPassword = process.env.DB_ADMIN_PASSWORD || process.env.DB_PASSWORD;
if (!adminUser || !adminPassword) throw new Error('Set DB_ADMIN_USER and DB_ADMIN_PASSWORD in .env first.');

function quote(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

function writeEnv(updates) {
  const current = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const lines = current.split(/\r?\n/);
  for (const [key, value] of Object.entries(updates)) {
    const expression = new RegExp(`^${key}=`);
    const index = lines.findIndex((line) => expression.test(line));
    if (index >= 0) lines[index] = `${key}=${value}`;
    else lines.push(`${key}=${value}`);
  }
  fs.writeFileSync(envPath, `${lines.filter((line, index, all) => index < all.length - 1 || line !== '').join('\n')}\n`, 'utf8');
}

const appPassword = crypto.randomBytes(32).toString('base64url');
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(48).toString('hex');
const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: adminUser,
  password: adminPassword,
  database
});

connection.connect((connectError) => {
  if (connectError) {
    process.stderr.write(`Database administrator connection failed: ${connectError.code}\n`);
    process.exitCode = 1;
    return;
  }
  connection.query(`CREATE USER IF NOT EXISTS 'kidq_app'@'localhost' IDENTIFIED BY ${quote(appPassword)}`, (createError) => {
    if (createError) return fail(createError);
    connection.query(`ALTER USER 'kidq_app'@'localhost' IDENTIFIED BY ${quote(appPassword)}`, (alterError) => {
      if (alterError) return fail(alterError);
      connection.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON \`${database}\`.* TO 'kidq_app'@'localhost'`, (grantError) => {
        if (grantError) return fail(grantError);
        try {
          writeEnv({ DB_ADMIN_USER: adminUser, DB_ADMIN_PASSWORD: adminPassword, DB_USER: 'kidq_app', DB_PASSWORD: appPassword, SESSION_SECRET: sessionSecret });
          process.stdout.write('Provisioned the least-privilege kidq_app account and updated local .env.\n');
          connection.end();
        } catch (writeError) {
          fail(writeError);
        }
      });
    });
  });
});

function fail(error) {
  process.stderr.write(`Database user provisioning failed: ${error.code || error.message}\n`);
  connection.end();
  process.exitCode = 1;
}
