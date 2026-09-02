import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { loadEnvConfig } = createRequire(require.resolve('next/package.json'))('@next/env');

// Default is a read-only preflight. Never log connection strings or credentials.
loadEnvConfig(fileURLToPath(new URL('../', import.meta.url)));
const apply = process.argv.includes('--apply');
const connectionString = process.env.MASKINES_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('BLOCKED: Set MASKINES_DATABASE_URL locally to a direct/session-pooler PostgreSQL connection. A Supabase API key cannot run DDL.');
  process.exit(2);
}
const target = new URL(connectionString);
const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(target.hostname);
const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://unset.invalid').hostname.split('.')[0];
const matchesProject = target.hostname === `db.${projectRef}.supabase.co`
  || (target.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(target.username) === `postgres.${projectRef}`);
if ((!local && !matchesProject) || target.port === '6543') {
  throw new Error('Refusing unknown target or transaction-mode pooler. Use the configured project direct connection/session pooler (port 5432).');
}
// Require TLS verification on remote connections; use the supplied CA when needed.
const ca = process.env.MASKINES_DATABASE_CA_FILE ? readFileSync(process.env.MASKINES_DATABASE_CA_FILE, 'utf8') : undefined;
for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) target.searchParams.delete(key);
const client = new pg.Client({ connectionString: target.toString(), ssl: local ? undefined : { rejectUnauthorized: true, ...(ca ? { ca } : {}) }, connectionTimeoutMillis: 15000 });
try {
  await client.connect();
  await client.query("SET lock_timeout = '5s'");
  await client.query("SET statement_timeout = '20min'");
  const columns = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='listings'");
  const names = new Set(columns.rows.map(row => row.column_name));
  for (const name of ['id','created_at','price','is_sold','is_hidden','title','description','brand','model','part_number']) {
    if (!names.has(name)) throw new Error(`Missing listings column: ${name}`);
  }
  const extension = await client.query("SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pg_trgm'");
  if (extension.rows[0] && !['public','extensions'].includes(extension.rows[0].nspname)) throw new Error('pg_trgm is in an unexpected schema. Review the SQL before proceeding.');
  const sql = readFileSync(new URL('../supabase/maintenance/public-listing-search-indexes.sql', import.meta.url), 'utf8');
  const statements = sql.replace(/--[^\r\n]*/g, '').split(';').map(s=>s.trim()).filter(Boolean);
  const indexes = statements.flatMap(s => [...s.matchAll(/CREATE INDEX CONCURRENTLY IF NOT EXISTS (\w+)/g)].map(m=>m[1]));
  const status = await client.query('SELECT c.relname, i.indisvalid, i.indisready, pg_get_indexdef(c.oid) AS definition FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname=ANY($2)', ['public',indexes]);
  for (const row of status.rows) {
    if (!row.indisvalid || !row.indisready) throw new Error(`Invalid existing index ${row.relname}: repair separately before retrying.`);
    const column = row.relname.match(/public_(title|description|brand|model|part_number)_trgm/)?.[1];
    const expected = column ? `${column} gin_trgm_ops` : row.relname.includes('_price_') ? 'price, id DESC' : 'created_at DESC, id DESC';
    if (!row.definition.replaceAll("extensions.", "").includes(expected) || !row.definition.includes('(is_sold = false) AND (is_hidden = false)')) throw new Error(`Existing index ${row.relname} has a different definition. Review manually.`);
  }
  console.log(`Preflight OK: ${local ? 'local' : 'configured Supabase project'}, ${status.rows.length}/${indexes.length} valid indexes already present.`);
  if (!apply) console.log('DRY RUN: no DDL executed. Add --apply to run each statement separately, without BEGIN.');
  else {
    // One query per statement, no BEGIN and no multi-statement transaction.
    for (const statement of statements) {
      await client.query(statement);
      console.log('OK: ' + (statement.match(/(?:INDEX CONCURRENTLY IF NOT EXISTS|EXTENSION IF NOT EXISTS) (\w+)/)?.[1] || 'schema/session setup'));
    }
    const verified = await client.query('SELECT count(*)::int AS count FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname=ANY($2) AND i.indisvalid AND i.indisready', ['public',indexes]);
    if (verified.rows[0].count !== indexes.length) throw new Error('Final index validity check failed.');
    console.log(`PASS: all ${indexes.length} indexes are ready and valid.`);
  }
} catch (error) {
  console.error('Index maintenance failed:', error.code || error.name, String(error.message).replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted connection]'));
  process.exitCode = 1;
} finally { await client.end(); }
