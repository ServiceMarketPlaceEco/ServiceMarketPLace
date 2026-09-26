# Legacy scripts

`001_schema_update.sql` was written to patch an older, hand-built database
(it only `ALTER`s tables that must already exist, and uses MariaDB-only
syntax such as `ADD COLUMN IF NOT EXISTS`). It **cannot** create a database
from scratch and is **not** part of the local setup.

For a fresh database use `database/migrations/000_initial_schema.sql`
followed by the files in `database/seeds/` — or simply run `npm run db:setup`.
