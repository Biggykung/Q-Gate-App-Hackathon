require('dotenv').config();

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2');

const envPath = path.join(__dirname, '..', '.env');
const adminUser = process.env.DB_ADMIN_USER || process.env.DB_USER;
const oldPassword = process.env.DB_ADMIN_PASSWORD || process.env.DB_PASSWORD;
if (!adminUser || !oldPassword) throw new Error('Set DB_ADMIN_USER and DB_ADMIN_PASSWORD in .env first.');

function setEnvPassword(password) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  const key = 'DB_ADMIN_PASSWORD';
  const index = lines.findIndex((line) => line.startsWith(`${key}=`));
  if (index < 0) lines.push(`${key}=${password}`);
  else lines[index] = `${key}=${password}`;
  fs.writeFileSync(envPath, `${lines.filter((line, i, all) => i < all.length - 1 || line !== '').join('\n')}\n`, 'utf8');
}

function escapeSql(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: adminUser,
  password: oldPassword
});
const newPassword = crypto.randomBytes(36).toString('base64url');

connection.connect((connectError) => {
  if (connectError) {
    process.stderr.write(`Database administrator connection failed: ${connectError.code}\n`);
    process.exitCode = 1;
    return;
  }
  connection.query('SELECT CURRENT_USER() AS account', (identityError, rows) => {
    if (identityError) return rollback(identityError);
    const account = rows[0].account;
    const splitAt = account.lastIndexOf('@');
    const username = account.slice(0, splitAt);
    const host = account.slice(splitAt + 1);
    if (splitAt < 1 || username !== adminUser) return rollback(new Error('Connected account did not match DB_ADMIN_USER.'));
    connection.query(`ALTER USER ${escapeSql(username)}@${escapeSql(host)} IDENTIFIED BY ${escapeSql(newPassword)}`, (alterError) => {
      if (alterError) return rollback(alterError);
      try {
        setEnvPassword(newPassword);
      } catch (writeError) {
        return rollback(writeError, username, host, newPassword);
      }
      const verify = mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 3306,
        user: adminUser,
        password: newPassword,
        database: process.env.DB_NAME || 'health_gate'
      });
      verify.connect((verifyError) => {
        if (verifyError) return rollback(verifyError, username, host, newPassword);
        verify.end();
        connection.end();
        process.stdout.write('Rotated the database administrator password and saved it in the ignored local .env file.\n');
      });
    });
  });
});

function rollback(error, username, host, newPasswordValue) {
  const message = error.code || error.message;
  if (username && host && newPasswordValue) {
    connection.query(`ALTER USER ${escapeSql(username)}@${escapeSql(host)} IDENTIFIED BY ${escapeSql(oldPassword)}`, () => {
      try { setEnvPassword(oldPassword); } catch {}
      process.stderr.write(`Password rotation failed and was rolled back: ${message}\n`);
      connection.end();
      process.exitCode = 1;
    });
    return;
  }
  process.stderr.write(`Password rotation failed: ${message}\n`);
  connection.end();
  process.exitCode = 1;
}

