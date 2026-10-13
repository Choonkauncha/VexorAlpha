const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function statementsFrom(sql) {
  const statements = sql.replace(/^\s*--.*$/gm, '').split(';').map(s => s.trim()).filter(Boolean);
  if (!statements.length || statements.some(s => !/^(CREATE TABLE|CREATE (?:UNIQUE )?INDEX|ALTER TABLE [\s\S]+ ADD CONSTRAINT|CREATE SCHEMA IF NOT EXISTS)\b/.test(s))) {
    throw new Error('Initialization SQL contains an unexpected operation; refusing to apply it.');
  }
  return statements;
}

async function initialize(db, names, statements) {
  return db.$transaction(async tx => {
    await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(1791890)::text');
    const tables = await tx.$queryRawUnsafe("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'");
    const existing = tables.filter(t => names.some(n => n.toLowerCase() === t.tablename.toLowerCase()));
    if (existing.length === names.length && names.every(n => existing.some(t => t.tablename === n))) {
      return 'Application tables already exist; no changes made.';
    }
    if (existing.length) {
      throw new Error('An existing partial application schema was found; refusing to modify it.');
    }
    for (const sql of statements) await tx.$executeRawUnsafe(sql);
    return `Created ${names.length} application tables in one transaction.`;
  }, { maxWait: 30000, timeout: 120000 });
}

async function main() {
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    throw new Error('This initialization command is restricted to the production deployment.');
  }
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error('No database connection is configured.');
  const runtimeTarget = new URL(process.env.DATABASE_URL);
  const directTarget = new URL(url);
  if (runtimeTarget.hostname.replace('-pooler', '') !== directTarget.hostname.replace('-pooler', '') || runtimeTarget.pathname !== directTarget.pathname || (runtimeTarget.searchParams.get('schema') || 'public') !== 'public' || (directTarget.searchParams.get('schema') || 'public') !== 'public') {
    throw new Error('Runtime and initialization database targets do not match the public schema.');
  }
  const schema = path.join(__dirname, '../prisma/schema.prisma');
  const names = [...fs.readFileSync(schema, 'utf8').matchAll(/^model\s+(\w+)\s*\{/gm)].map(m => m[1]);
  const generated = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', schema, '--script'], { encoding: 'utf8' });
  if (generated.status !== 0) throw new Error('Could not generate initialization SQL from the Prisma schema.');
  const statements = statementsFrom(generated.stdout);
  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient({ datasourceUrl: url });
  try { console.log(await initialize(db, names, statements)); }
  finally { await db.$disconnect(); }
}

module.exports = { initialize, statementsFrom };
if (require.main === module) main().catch(() => {
  console.error('Database initialization failed. No credentials are logged; check connectivity and whether a partial schema already exists.');
  process.exitCode = 1;
});
