require('dotenv').config();

const mysql = require('mysql2');
const [username, requestedRole] = process.argv.slice(2);
const role = requestedRole || 'viewer';

if (!username || !/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
  process.stderr.write('Usage: npm run approve-user -- <username> [viewer|clinician]\n');
  process.exit(1);
}
if (!['viewer', 'clinician'].includes(role)) {
  process.stderr.write('Role must be viewer or clinician.\n');
  process.exit(1);
}

const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_ADMIN_USER || process.env.DB_USER,
  password: process.env.DB_ADMIN_PASSWORD || process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'health_gate'
});

connection.connect((connectError) => {
  if (connectError) return fail(connectError);
  connection.execute('UPDATE users SET role = ?, is_active = TRUE WHERE username = ?', [role, username], (error, result) => {
    if (error) return fail(error);
    if (result.affectedRows === 0) {
      connection.execute('SELECT user_id FROM users WHERE username = ? LIMIT 1', [username], (lookupError, rows) => {
        if (lookupError) return fail(lookupError);
        if (rows.length === 0) {
          process.stderr.write('No account found for that username.\n');
          connection.end();
          process.exitCode = 1;
          return;
        }
        process.stdout.write(`Account ${username} is already active with role ${role}.\n`);
        connection.end();
      });
      return;
    }
    process.stdout.write(`Approved ${username} with role ${role}.\n`);
    connection.end();
  });
});

function fail(error) {
  process.stderr.write(`Could not approve account: ${error.code || error.message}\n`);
  connection.end();
  process.exitCode = 1;
}
