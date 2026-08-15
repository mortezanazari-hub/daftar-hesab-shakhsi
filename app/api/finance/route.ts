import { ensureSchema, getD1 } from "../../../db";

type DbRow = Record<string, string | number | null>;

function cleanText(value: unknown, max = 120) {
  return String(value ?? "").trim().slice(0, max);
}

function positiveInteger(value: unknown, label: string) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${label} باید بیشتر از صفر باشد.`);
  return parsed;
}

function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "خطای ناشناخته";
  return Response.json({ error: message }, { status: 400 });
}

function makeSettlements(balances: Array<{ personId: number; name: string; balance: number }>) {
  const creditors = balances.filter((item) => item.balance > 0).map((item) => ({ ...item }));
  const debtors = balances.filter((item) => item.balance < 0).map((item) => ({ ...item, debt: -item.balance }));
  const result: Array<{ from: string; to: string; amount: number }> = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amount = Math.min(creditor.balance, debtor.debt);
    if (amount > 0) result.push({ from: debtor.name, to: creditor.name, amount });
    creditor.balance -= amount;
    debtor.debt -= amount;
    if (creditor.balance === 0) creditorIndex += 1;
    if (debtor.debt === 0) debtorIndex += 1;
  }
  return result;
}

export async function GET() {
  try {
    await ensureSchema();
    const db = getD1();
    const [personsResult, entriesResult, groupsResult, membersResult, expensesResult, sharesResult] = await Promise.all([
      db.prepare("SELECT * FROM persons ORDER BY is_self DESC, name").all<DbRow>(),
      db.prepare("SELECT * FROM ledger_entries ORDER BY created_at DESC, id DESC").all<DbRow>(),
      db.prepare("SELECT * FROM expense_groups ORDER BY created_at DESC, id DESC").all<DbRow>(),
      db.prepare("SELECT * FROM group_members ORDER BY id").all<DbRow>(),
      db.prepare("SELECT * FROM expenses ORDER BY expense_date DESC, id DESC").all<DbRow>(),
      db.prepare("SELECT * FROM expense_shares ORDER BY id").all<DbRow>(),
    ]);

    const persons = personsResult.results.map((row) => ({
      id: Number(row.id), name: String(row.name), phone: String(row.phone ?? ""),
      isSelf: Boolean(row.is_self), color: String(row.color),
    }));
    const personNames = new Map(persons.map((person) => [person.id, person.name]));
    const entries = entriesResult.results.map((row) => ({
      id: Number(row.id), personId: Number(row.person_id), personName: personNames.get(Number(row.person_id)) ?? "نامشخص",
      kind: String(row.kind), direction: String(row.direction), title: String(row.title), amount: Number(row.amount),
      dueDate: row.due_date ? String(row.due_date) : null, status: String(row.status), note: String(row.note ?? ""), createdAt: String(row.created_at),
    }));

    const members = membersResult.results.map((row) => ({
      id: Number(row.id), groupId: Number(row.group_id), personId: Number(row.person_id),
      name: personNames.get(Number(row.person_id)) ?? "نامشخص", shareWeight: Number(row.share_weight),
    }));
    const expenses = expensesResult.results.map((row) => ({
      id: Number(row.id), groupId: Number(row.group_id), payerPersonId: Number(row.payer_person_id),
      payerName: personNames.get(Number(row.payer_person_id)) ?? "نامشخص", title: String(row.title),
      amount: Number(row.amount), expenseDate: String(row.expense_date),
    }));
    const shares = sharesResult.results.map((row) => ({
      expenseId: Number(row.expense_id), personId: Number(row.person_id), amount: Number(row.amount),
    }));
    const groups = groupsResult.results.map((row) => {
      const groupId = Number(row.id);
      const groupMembers = members.filter((member) => member.groupId === groupId);
      const groupExpenses = expenses.filter((expense) => expense.groupId === groupId);
      const expenseIds = new Set(groupExpenses.map((expense) => expense.id));
      const groupShares = shares.filter((share) => expenseIds.has(share.expenseId));
      const balances = groupMembers.map((member) => {
        const paid = groupExpenses.filter((expense) => expense.payerPersonId === member.personId).reduce((sum, expense) => sum + expense.amount, 0);
        const owed = groupShares.filter((share) => share.personId === member.personId).reduce((sum, share) => sum + share.amount, 0);
        return { personId: member.personId, name: member.name, paid, owed, balance: paid - owed };
      });
      return {
        id: groupId, name: String(row.name), members: groupMembers, expenses: groupExpenses,
        totalSpent: groupExpenses.reduce((sum, expense) => sum + expense.amount, 0), balances,
        settlements: makeSettlements(balances.map((item) => ({ personId: item.personId, name: item.name, balance: item.balance }))),
      };
    });

    return Response.json({ persons, entries, groups });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const db = getD1();
    const payload = await request.json() as Record<string, unknown>;
    const operation = cleanText(payload.operation, 30);

    if (operation === "add_person") {
      const name = cleanText(payload.name, 60);
      if (!name) throw new Error("نام شخص را وارد کنید.");
      const phone = cleanText(payload.phone, 30);
      const colors = ["#315d4c", "#b65b4a", "#5f659b", "#447b8b", "#9a6b38"];
      await db.prepare("INSERT INTO persons (name, phone, color) VALUES (?, ?, ?)").bind(name, phone, colors[name.length % colors.length]).run();
    } else if (operation === "add_entry") {
      const personId = positiveInteger(payload.personId, "شخص");
      const amount = positiveInteger(payload.amount, "مبلغ");
      const kind = ["debt", "receivable", "installment", "check"].includes(String(payload.kind)) ? String(payload.kind) : "debt";
      const direction = String(payload.direction) === "receivable" ? "receivable" : "debt";
      const title = cleanText(payload.title, 100) || ({ debt: "بدهی", receivable: "طلب", installment: "قسط", check: "چک" }[kind] ?? "ثبت مالی");
      const dueDate = cleanText(payload.dueDate, 10) || null;
      const note = cleanText(payload.note, 400);
      await db.prepare("INSERT INTO ledger_entries (person_id, kind, direction, title, amount, due_date, note) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(personId, kind, direction, title, amount, dueDate, note).run();
    } else if (operation === "toggle_entry") {
      const id = positiveInteger(payload.id, "شناسه");
      await db.prepare("UPDATE ledger_entries SET status = CASE WHEN status = 'open' THEN 'paid' ELSE 'open' END WHERE id = ?").bind(id).run();
    } else if (operation === "add_group") {
      const name = cleanText(payload.name, 80);
      if (!name) throw new Error("نام گروه را وارد کنید.");
      const rawMembers = Array.isArray(payload.members) ? payload.members : [];
      const members = rawMembers.map((item) => {
        const member = item as Record<string, unknown>;
        return { personId: positiveInteger(member.personId, "عضو"), shareWeight: positiveInteger(member.shareWeight, "سهم") };
      });
      if (members.length < 2) throw new Error("برای گروه دُنگی حداقل دو نفر لازم است.");
      const inserted = await db.prepare("INSERT INTO expense_groups (name) VALUES (?) RETURNING id").bind(name).first<{ id: number }>();
      if (!inserted?.id) throw new Error("گروه ساخته نشد.");
      await db.batch(members.map((member) => db.prepare("INSERT INTO group_members (group_id, person_id, share_weight) VALUES (?, ?, ?)").bind(inserted.id, member.personId, member.shareWeight)));
    } else if (operation === "add_expense") {
      const groupId = positiveInteger(payload.groupId, "گروه");
      const payerPersonId = positiveInteger(payload.payerPersonId, "پرداخت‌کننده");
      const amount = positiveInteger(payload.amount, "مبلغ");
      const title = cleanText(payload.title, 100);
      if (!title) throw new Error("عنوان خرید را وارد کنید.");
      const expenseDate = cleanText(payload.expenseDate, 10) || new Date().toISOString().slice(0, 10);
      const memberRows = await db.prepare("SELECT person_id, share_weight FROM group_members WHERE group_id = ? ORDER BY id").bind(groupId).all<{ person_id: number; share_weight: number }>();
      if (!memberRows.results.some((member) => Number(member.person_id) === payerPersonId)) throw new Error("پرداخت‌کننده عضو این گروه نیست.");
      const totalWeight = memberRows.results.reduce((sum, member) => sum + Number(member.share_weight), 0);
      let allocated = 0;
      const allocations = memberRows.results.map((member, index) => {
        const shareAmount = index === memberRows.results.length - 1 ? amount - allocated : Math.floor((amount * Number(member.share_weight)) / totalWeight);
        allocated += shareAmount;
        return { personId: Number(member.person_id), amount: shareAmount };
      });
      const inserted = await db.prepare("INSERT INTO expenses (group_id, payer_person_id, title, amount, expense_date) VALUES (?, ?, ?, ?, ?) RETURNING id")
        .bind(groupId, payerPersonId, title, amount, expenseDate).first<{ id: number }>();
      if (!inserted?.id) throw new Error("هزینه ثبت نشد.");
      await db.batch(allocations.map((share) => db.prepare("INSERT INTO expense_shares (expense_id, person_id, amount) VALUES (?, ?, ?)").bind(inserted.id, share.personId, share.amount)));
    } else {
      throw new Error("عملیات نامعتبر است.");
    }

    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
