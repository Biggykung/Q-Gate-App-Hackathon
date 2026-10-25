const readline = require('node:readline/promises');
const process = require('node:process');
require('dotenv').config();
const mysql = require('mysql2');
const { hashPassword } = require('../security');

function askHidden(question) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
      reject(new Error('Run this command in an interactive terminal.'));
      return;
    }
    process.stdout.write(question);
    let value = '';
    const onData = (chunk) => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\u0003') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          reject(new Error('Cancelled.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        if (character >= ' ') value += character;
      }
    };
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

async function main() {
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  const username = (await prompt.question('Username: ')).trim();
  const role = (await prompt.question('Role (admin/clinician/viewer): ')).trim().toLowerCase();
  prompt.close();

  if (!/^[a-zA-Z0-9._-]{3,80}$/.test(username)) throw new Error('Username must be 3–80 letters, numbers, dots, dashes, or underscores.');
  if (!['admin', 'clinician', 'viewer'].includes(role)) throw new Error('Role must be admin, clinician, or viewer.');
  const password = await askHidden('Password (12+ characters; input hidden): ');
  const passwordHash = await hashPassword(password);
  const connection = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_ADMIN_USER || process.env.DB_USER,
    password: process.env.DB_ADMIN_PASSWORD || process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'health_gate'
  });

  await new Promise((resolve, reject) => connection.connect((error) => error ? reject(error) : resolve()));
  try {
    await new Promise((resolve, reject) => {
      connection.execute('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [username, passwordHash, role], (error) => error ? reject(error) : resolve());
    });
    process.stdout.write(`Created ${role} account: ${username}\n`);
  } finally {
    connection.end();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
