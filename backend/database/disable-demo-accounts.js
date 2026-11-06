/* eslint-disable no-console */
/**
 *   npm run db:disable-demo-accounts
 *
 * Turns off the accounts the development seeds create, whose passwords are
 * public (the README and the seed files list them):
 *   - admin@servicehub.com           (seeds/005_demo_accounts_seed.sql)
 *   - *@servicehub.local providers   (the demo provider, same file)
 *   - *@test.local customers and providers (seeds/003_moderation_test_seed.sql)
 *
 * Only needed on a database that was set up in development mode and is now
 * going live; `npm run db:setup -- --production` never creates them.
 *
 * The accounts are switched off rather than deleted, because bookings,
 * reviews and reports may point at them: each one is deactivated (the app
 * refuses to sign it in), its password is replaced with a random one nobody
 * knows, it is signed out everywhere, and the demo provider's services stop
 * being bookable. Create a real admin with `npm run admin:create` first.
 */
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { loadEnv, connect, run } = require('./db');

const randomHash = () => bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

async function main() {
  loadEnv();
  const connection = await connect();
  try {
    const [[{ realAdmins }]] = await connection.query(
      "SELECT COUNT(*) AS realAdmins FROM admins WHERE is_active = 1 AND email <> 'admin@servicehub.com'",
    );
    if (!Number(realAdmins)) {
      throw new Error('there is no other active admin yet. Run `npm run admin:create` first, or nobody can sign in as admin');
    }

    const groups = [
      { table: 'admins', id: 'id', type: 'admin', where: "email = 'admin@servicehub.com'" },
      {
        table: 'service_providers',
        id: 'provider_id',
        type: 'provider',
        where: "email LIKE '%@servicehub.local' OR email LIKE '%@test.local'",
      },
      { table: 'customers', id: 'customer_id', type: 'customer', where: "email LIKE '%@test.local'" },
    ];

    let total = 0;
    for (const { table, id, type, where } of groups) {
      const [rows] = await connection.query(`SELECT ${id} AS id, email FROM ${table} WHERE ${where}`);
      for (const row of rows) {
        await connection.query(`UPDATE ${table} SET is_active = 0, password_hash = ? WHERE ${id} = ?`, [
          await randomHash(),
          row.id,
        ]);
        await connection.query('DELETE FROM refresh_tokens WHERE user_id = ? AND user_type = ?', [row.id, type]);
        if (type === 'provider') {
          await connection.query('UPDATE provider_services SET is_available = 0 WHERE provider_id = ?', [row.id]);
        }
        console.log(`Disabled ${type} ${row.email}`);
        total += 1;
      }
    }
    console.log(total ? `\nDone: ${total} demo/test account(s) disabled.` : 'No demo/test accounts found.');
  } finally {
    await connection.end();
  }
}

run('Disabling the demo accounts', main);
