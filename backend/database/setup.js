/* eslint-disable no-console */
/**
 * Creates the ServiceHub database from scratch and loads the seed data.
 *
 *   npm run db:setup   create the database (if missing), run every file in
 *                      database/migrations/ then database/seeds/, in name order
 *   npm run db:reset   DROP the database first, then do the same as db:setup
 *
 *   npm run db:setup -- --production
 *                      for a live server: runs the migrations and only the
 *                      production-safe seeds. Seeds with "demo" or "test" in
 *                      their file name (the default admin, the demo provider,
 *                      the moderation test accounts) are skipped, because
 *                      their passwords are public. Create the real admin
 *                      afterwards with `npm run admin:create`.
 *
 * With NODE_ENV=production in .env, db:setup refuses to run without
 * --production, and --reset is never allowed together with --production,
 * so the live database can't be loaded with test accounts or dropped by
 * mistake.
 *
 * Connection settings come from backend/.env (DB_HOST, DB_PORT, DB_USERNAME,
 * DB_PASSWORD, DB_DATABASE). Every script is idempotent, so db:setup is safe
 * to run more than once.
 */
const fs = require('fs');
const path = require('path');
const { loadEnv, databaseName, connect, run } = require('./db');

// seeds that create accounts with known passwords or fake data
const DEV_ONLY_SEED = /(demo|test)/i;

function sqlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => path.join(dir, f));
}

const relative = (file) => path.relative(path.join(__dirname, '..'), file);

async function main() {
  loadEnv();

  const reset = process.argv.includes('--reset');
  const production = process.argv.includes('--production');
  if (production && reset) {
    throw new Error('--reset is not allowed with --production (it would drop the live database)');
  }
  if (!production && process.env.NODE_ENV === 'production') {
    throw new Error(
      'NODE_ENV is production: use `npm run db:setup -- --production`, which skips the demo and test seeds',
    );
  }
  const database = databaseName();

  const connection = await connect({ withDatabase: false, multipleStatements: true });

  try {
    if (reset) {
      console.log(`Dropping database \`${database}\`...`);
      await connection.query(`DROP DATABASE IF EXISTS \`${database}\``);
    }
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
    );
    await connection.query(`USE \`${database}\``);

    const seeds = sqlFiles(path.join(__dirname, 'seeds'));
    const skipped = production ? seeds.filter((f) => DEV_ONLY_SEED.test(path.basename(f))) : [];
    const files = [
      ...sqlFiles(path.join(__dirname, 'migrations')),
      ...seeds.filter((f) => !skipped.includes(f)),
    ];
    for (const file of files) {
      console.log(`Running ${relative(file)}`);
      await connection.query(fs.readFileSync(file, 'utf8'));
    }
    skipped.forEach((f) => console.log(`Skipped ${relative(f)} (development only)`));

    const [tables] = await connection.query('SHOW TABLES');
    console.log(`\nDone. Database \`${database}\` has ${tables.length} tables.`);

    if (production) {
      // a database that was first set up in development mode may still have
      // the demo accounts, whose passwords are public
      const [leftovers] = await connection.query(
        `SELECT email FROM admins WHERE email = 'admin@servicehub.com' AND is_active = 1
         UNION ALL SELECT email FROM service_providers
           WHERE (email LIKE '%@servicehub.local' OR email LIKE '%@test.local') AND is_active = 1
         UNION ALL SELECT email FROM customers WHERE email LIKE '%@test.local' AND is_active = 1`,
      );
      if (leftovers.length) {
        console.warn(
          `\nWARNING: ${leftovers.length} demo/test account(s) with public passwords are still active:\n` +
            leftovers.map((r) => `  - ${r.email}`).join('\n') +
            '\nTurn them off with `npm run db:disable-demo-accounts` before going live.',
        );
      }
      const [[{ admins }]] = await connection.query(
        `SELECT COUNT(*) AS admins FROM admins WHERE is_active = 1 AND email <> 'admin@servicehub.com'`,
      );
      if (!Number(admins)) console.log('\nNext: create the first admin with `npm run admin:create`.');
    }
  } finally {
    await connection.end();
  }
}

run('Database setup', main);
