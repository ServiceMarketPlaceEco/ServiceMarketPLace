/* eslint-disable no-console */
// shared helpers for the database scripts in this folder (setup.js,
// create-admin.js, disable-demo-accounts.js): read backend/.env and open a
// MySQL connection with its DB_* settings
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// values already in the environment win over the .env file, so a server
// can pass its settings without a .env at all
function loadEnv(file = path.join(__dirname, '..', '.env')) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

function databaseName() {
  const database = process.env.DB_DATABASE || 'servicehub';
  if (!/^[A-Za-z0-9_]+$/.test(database)) {
    throw new Error(`DB_DATABASE "${database}" may only contain letters, digits and underscores`);
  }
  return database;
}

// withDatabase: false connects to the server only (for CREATE DATABASE)
function connect({ withDatabase = true, multipleStatements = false } = {}) {
  return mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    ...(withDatabase ? { database: databaseName() } : {}),
    multipleStatements,
  });
}

// runs main() and turns any error into a one-line message + exit code 1
function run(name, main) {
  main().catch((err) => {
    console.error(`\n${name} failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { loadEnv, databaseName, connect, run };
