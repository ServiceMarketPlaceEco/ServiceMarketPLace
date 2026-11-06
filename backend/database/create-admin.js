/* eslint-disable no-console */
/**
 * Creates an admin account, or resets an admin's password.
 *
 *   npm run admin:create          asks for name, email, role and password
 *   npm run admin:reset-password  sets a new password for an existing admin
 *                                 (e.g. one who is locked out), reactivates
 *                                 the account and signs it out everywhere
 *   npm run admin:deactivate      switches an admin off (someone left) and
 *                                 signs it out everywhere. It is kept, not
 *                                 deleted, because reports it resolved point
 *                                 at it. admin:reset-password turns it back on.
 *
 * This is how the first admin is made on a live server: the production
 * database setup (`npm run db:setup -- --production`) creates no accounts,
 * and the seeded admin@servicehub.com / Admin@123 is for local development
 * only. The app has no screen for managing admins, so these commands are
 * the way to do it.
 *
 * For scripts, the answers can come from ADMIN_NAME, ADMIN_EMAIL,
 * ADMIN_PASSWORD and ADMIN_ROLE instead of the prompts. Prefer the prompts:
 * a password typed on the command line ends up in the shell history.
 *
 * Uses the DB_* settings from backend/.env, like db:setup.
 */
const crypto = require('crypto');
const readline = require('readline');
const bcrypt = require('bcrypt');
const { loadEnv, connect, run } = require('./db');

const ROLES = ['super_admin', 'admin', 'moderator'];
const MIN_PASSWORD_LENGTH = 12;
// same cost as the app uses when it hashes passwords
const BCRYPT_ROUNDS = 10;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ask(rl, question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    if (!hidden) {
      rl.question(question, (answer) => resolve(answer.trim()));
      return;
    }
    // print the question, then hide what is typed
    const write = rl._writeToOutput.bind(rl);
    rl._writeToOutput = (text) => {
      if (text.startsWith(question)) write(question);
      else if (text.includes('\n')) write('\n');
    };
    rl.question(question, (answer) => {
      rl._writeToOutput = write;
      resolve(answer);
    });
  });
}

function passwordProblem(password, email) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `the password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  // the same rule the app uses for sign-up and password reset
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[\d\W]/.test(password)) {
    return 'the password needs an uppercase letter, a lowercase letter and a number or symbol';
  }
  const lower = password.toLowerCase();
  const emailName = email.split('@')[0].toLowerCase();
  if (lower === 'admin@123' || (emailName.length >= 4 && lower.includes(emailName))) {
    return 'the password is too easy to guess';
  }
  return null;
}

async function main() {
  loadEnv();
  const resetPassword = process.argv.includes('--reset-password');
  const deactivate = process.argv.includes('--deactivate');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const connection = await connect();

  try {
    const email = (process.env.ADMIN_EMAIL || (await ask(rl, 'Admin email: '))).toLowerCase();
    if (!EMAIL.test(email)) throw new Error(`"${email}" is not an email address`);

    const [existing] = await connection.query('SELECT id, name FROM admins WHERE email = ?', [email]);
    if ((resetPassword || deactivate) && !existing.length) {
      throw new Error(`there is no admin with the email ${email}`);
    }
    if (!resetPassword && !deactivate && existing.length) {
      throw new Error(`an admin with the email ${email} already exists (use admin:reset-password to change its password)`);
    }

    if (deactivate) {
      const id = existing[0].id;
      const [[{ others }]] = await connection.query(
        'SELECT COUNT(*) AS others FROM admins WHERE is_active = 1 AND id <> ?',
        [id],
      );
      if (!Number(others)) throw new Error('this is the last active admin. Create another one first');
      await connection.query('UPDATE admins SET is_active = 0 WHERE id = ?', [id]);
      await connection.query("DELETE FROM refresh_tokens WHERE user_id = ? AND user_type = 'admin'", [id]);
      console.log(`\nDeactivated ${email}. They can no longer sign in.`);
      return;
    }

    let name = existing.length ? existing[0].name : process.env.ADMIN_NAME;
    if (!name) name = await ask(rl, 'Full name: ');
    if (!name) throw new Error('a name is required');

    let role = 'super_admin';
    if (!resetPassword) {
      role = process.env.ADMIN_ROLE || (await ask(rl, `Role (${ROLES.join(' / ')}) [super_admin]: `)) || 'super_admin';
      if (!ROLES.includes(role)) throw new Error(`the role must be one of: ${ROLES.join(', ')}`);
    }

    let password = process.env.ADMIN_PASSWORD;
    if (!password) {
      password = await ask(rl, `Password (at least ${MIN_PASSWORD_LENGTH} characters, upper + lower case + a number or symbol): `, { hidden: true });
      const again = await ask(rl, 'Type the password again: ', { hidden: true });
      if (password !== again) throw new Error('the two passwords do not match');
    }
    const problem = passwordProblem(password, email);
    if (problem) throw new Error(problem);

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    if (resetPassword) {
      const id = existing[0].id;
      await connection.query('UPDATE admins SET password_hash = ?, is_active = 1 WHERE id = ?', [hash, id]);
      // sign the admin out of every device, in case the old password leaked
      await connection.query("DELETE FROM refresh_tokens WHERE user_id = ? AND user_type = 'admin'", [id]);
      console.log(`\nNew password set for ${email}. They have been signed out everywhere.`);
    } else {
      await connection.query(
        'INSERT INTO admins (id, name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?, 1)',
        [crypto.randomUUID(), name, email, hash, role],
      );
      console.log(`\nCreated ${role} ${email}. Sign in on the admin page with this email and password.`);
    }
  } finally {
    rl.close();
    await connection.end();
  }
}

run('Admin command', main);
