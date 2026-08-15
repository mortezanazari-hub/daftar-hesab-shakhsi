import { env } from "cloudflare:workers";

let schemaReady: Promise<void> | null = null;

export function getD1(): D1Database {
  if (!env.DB) {
    throw new Error("پایگاه داده در دسترس نیست.");
  }
  return env.DB;
}

export function ensureSchema(): Promise<void> {
  if (schemaReady) return schemaReady;

  const db = getD1();
  schemaReady = (async () => {
    await db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS persons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL DEFAULT '',
        is_self INTEGER NOT NULL DEFAULT 0,
        color TEXT NOT NULL DEFAULT '#315d4c',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS ledger_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER NOT NULL REFERENCES persons(id),
        kind TEXT NOT NULL,
        direction TEXT NOT NULL,
        title TEXT NOT NULL,
        amount INTEGER NOT NULL,
        due_date TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS expense_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS group_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL REFERENCES expense_groups(id),
        person_id INTEGER NOT NULL REFERENCES persons(id),
        share_weight INTEGER NOT NULL DEFAULT 0
      )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL REFERENCES expense_groups(id),
        payer_person_id INTEGER NOT NULL REFERENCES persons(id),
        title TEXT NOT NULL,
        amount INTEGER NOT NULL,
        expense_date TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS expense_shares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        expense_id INTEGER NOT NULL REFERENCES expenses(id),
        person_id INTEGER NOT NULL REFERENCES persons(id),
        amount INTEGER NOT NULL,
        weight INTEGER NOT NULL DEFAULT 0
      )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS group_settlements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL REFERENCES expense_groups(id),
        from_person_id INTEGER NOT NULL REFERENCES persons(id),
        to_person_id INTEGER NOT NULL REFERENCES persons(id),
        amount INTEGER NOT NULL,
        settlement_date TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      db.prepare("CREATE INDEX IF NOT EXISTS idx_ledger_person_status ON ledger_entries(person_id, status)"),
      db.prepare("CREATE INDEX IF NOT EXISTS idx_ledger_due_date ON ledger_entries(due_date)"),
      db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_group_members_unique ON group_members(group_id, person_id)"),
      db.prepare("CREATE INDEX IF NOT EXISTS idx_expenses_group_date ON expenses(group_id, expense_date)"),
      db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_shares_unique ON expense_shares(expense_id, person_id)"),
      db.prepare("CREATE INDEX IF NOT EXISTS idx_group_settlements_group_date ON group_settlements(group_id, settlement_date)"),
    ]);
    const shareColumns = await db.prepare("PRAGMA table_info(expense_shares)").all<{ name: string }>();
    if (!shareColumns.results.some((column) => column.name === "weight")) {
      await db.prepare("ALTER TABLE expense_shares ADD COLUMN weight INTEGER NOT NULL DEFAULT 0").run();
    }
    await db.prepare("INSERT INTO persons (name, is_self, color) SELECT 'من', 1, '#e7b35a' WHERE NOT EXISTS (SELECT 1 FROM persons WHERE is_self = 1)").run();
    await db.prepare("PRAGMA optimize").run();
  })().catch((error) => {
    schemaReady = null;
    throw error;
  });

  return schemaReady;
}
