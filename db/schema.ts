import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const persons = sqliteTable("persons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  isSelf: integer("is_self", { mode: "boolean" }).notNull().default(false),
  color: text("color").notNull().default("#315d4c"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const ledgerEntries = sqliteTable("ledger_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personId: integer("person_id").notNull().references(() => persons.id),
  kind: text("kind").notNull(),
  direction: text("direction").notNull(),
  title: text("title").notNull(),
  amount: integer("amount").notNull(),
  dueDate: text("due_date"),
  status: text("status").notNull().default("open"),
  note: text("note").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const expenseGroups = sqliteTable("expense_groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const groupMembers = sqliteTable("group_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  groupId: integer("group_id").notNull().references(() => expenseGroups.id),
  personId: integer("person_id").notNull().references(() => persons.id),
  shareWeight: integer("share_weight").notNull().default(0),
}, (table) => [
  uniqueIndex("idx_group_members_unique").on(table.groupId, table.personId),
]);

export const expenses = sqliteTable("expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  groupId: integer("group_id").notNull().references(() => expenseGroups.id),
  payerPersonId: integer("payer_person_id").notNull().references(() => persons.id),
  title: text("title").notNull(),
  amount: integer("amount").notNull(),
  expenseDate: text("expense_date").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const expenseShares = sqliteTable("expense_shares", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  expenseId: integer("expense_id").notNull().references(() => expenses.id),
  personId: integer("person_id").notNull().references(() => persons.id),
  amount: integer("amount").notNull(),
}, (table) => [
  uniqueIndex("idx_expense_shares_unique").on(table.expenseId, table.personId),
]);
