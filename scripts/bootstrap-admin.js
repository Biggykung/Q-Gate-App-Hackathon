require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const mysql = require('mysql2');
const { hashPassword } = require('../security');

const envPath = path.join(__dirname, '..', '.env');
const username = process.env.KIDQ_BOOTSTRAP_USERNAME || 'admin';

function updateEnv(lines, key, value) {
  const expression = new RegExp(`^${key}=`);
  const nextLine = `${key}=${value}`;
  const index = lines.findIndex((line) => expression.test(line));
  if (index >= 0) lines[index] = nextLine;
  else lines.push(nextLine);
}

async function main() {
  const connection = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_ADMIN_USER || process.env.DB_USER,
    password: process.env.DB_ADMIN_PASSWORD || process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'health_gate'
  });

  await new Promise((resolve, reject) => connection.connect((error) => error ? reject(error) : resolve()));
  try {
    const count = await new Promise((resolve, reject) => {
      connection.query('SELECT COUNT(*) AS count FROM users', (error, rows) => error ? reject(error) : resolve(rows[0].count));
    });
    if (Number(count) > 0) {
      process.stdout.write('A user account already exists. No bootstrap account was created.\n');
      return;
    }

    const password = crypto.randomBytes(24).toString('base64url');
    const passwordHash = await hashPassword(password);
    await new Promise((resolve, reject) => {
      connection.execute('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [username, passwordHash, 'admin'], (error) => error ? reject(error) : resolve());
    });

    const lines = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8').split(/\r?\n/).filter((line, index, all) => index < all.length - 1 || line !== '') : [];
    updateEnv(lines, 'KIDQ_BOOTSTRAP_USERNAME', username);
    updateEnv(lines, 'KIDQ_BOOTSTRAP_PASSWORD', password);
    fs.writeFileSync(envPath, `${lines.join('\n')}\n`, { encoding: 'utf8', mode: 0o600 });
    process.stdout.write(`Created the initial admin account "${username}". Its generated password is stored in the ignored local .env file as KIDQ_BOOTSTRAP_PASSWORD.\n`);
  } finally {
    connection.end();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
