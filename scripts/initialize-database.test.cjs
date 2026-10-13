const { test } = require('node:test');
const assert = require('node:assert/strict');
const { initialize, statementsFrom } = require('./initialize-database.cjs');
function fake(names) {
  const writes = [];
  const tx = {
    $queryRawUnsafe: async sql => sql.includes('pg_tables') ? names.map(tablename => ({ tablename })) : [],
    $executeRawUnsafe: async sql => writes.push(sql),
  };
  return { writes, $transaction: fn => fn(tx) };
}
test('creates missing app tables while preserving unrelated tables', async () => {
  const db = fake(['unrelated']);
  await initialize(db, ['Conversation', 'Setting'], ['CREATE TABLE "Conversation" ()', 'CREATE TABLE "Setting" ()']);
  assert.equal(db.writes.length, 2);
});
test('refuses a partial or differently cased app schema without writes', async () => {
  for (const tables of [['Conversation'], ['conversation']]) {
    const db = fake(tables);
    await assert.rejects(initialize(db, ['Conversation', 'Setting'], ['CREATE TABLE "Setting" ()']), /partial/);
    assert.deepEqual(db.writes, []);
  }
});
test('re-running initialization leaves complete app schema unchanged', async () => {
  const db = fake(['Conversation', 'Setting', 'unrelated']);
  await initialize(db, ['Conversation', 'Setting'], ['CREATE TABLE "Setting" ()']);
  assert.deepEqual(db.writes, []);
});
test('rejects destructive SQL and allows generated table, index and foreign key statements', () => {
  assert.throws(() => statementsFrom('DROP TABLE "Conversation";'), /unexpected/);
  assert.throws(() => statementsFrom('ALTER TABLE "Conversation" DROP COLUMN "id";'), /unexpected/);
  assert.equal(statementsFrom('-- CreateTable\nCREATE TABLE "Conversation" ("id" TEXT); CREATE UNIQUE INDEX "index" ON "Conversation"("id"); ALTER TABLE "Message" ADD CONSTRAINT "fk" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id");').length, 3);
});
