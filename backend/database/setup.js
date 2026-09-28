/* eslint-disable no-console */
/**
 * Creates the ServiceHub database from scratch and loads the seed data.
 *
 *   npm run db:setup   create the database (if missing), run every file in
 *                      database/migrations/ then database/seeds/, in name order
 *   npm run db:reset   DROP the database first, then do the same as db:setup
 *
 * Connection settings come from backend/.env (DB_HOST, DB_PORT, DB_USERNAME,
 * DB_PASSWORD, DB_DATABASE). Every script is idempotent, so db:setup is safe
 * to run more than once.
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

function sqlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => path.join(dir, f));
}

async function main() {
  loadEnv(path.join(__dirname, '..', '.env'));

  const reset = process.argv.includes('--reset');
  const database = process.env.DB_DATABASE || 'servicehub';
  if (!/^[A-Za-z0-9_]+$/.test(database)) {
    throw new Error(`DB_DATABASE "${database}" may only contain letters, digits and underscores`);
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  try {
    if (reset) {
      console.log(`Dropping database \`${database}\`...`);
      await connection.query(`DROP DATABASE IF EXISTS \`${database}\``);
    }
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
    );
    await connection.query(`USE \`${database}\``);

    const files = [
      ...sqlFiles(path.join(__dirname, 'migrations')),
      ...sqlFiles(path.join(__dirname, 'seeds')),
    ];
    for (const file of files) {
      console.log(`Running ${path.relative(path.join(__dirname, '..'), file)}`);
      await connection.query(fs.readFileSync(file, 'utf8'));
    }

    const [tables] = await connection.query('SHOW TABLES');
    console.log(`\nDone. Database \`${database}\` has ${tables.length} tables.`);
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error(`\nDatabase setup failed: ${err.message}`);
  process.exit(1);
});
