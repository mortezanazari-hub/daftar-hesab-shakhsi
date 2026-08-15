export type Person = { id: number; name: string; phone: string; isSelf: boolean; color: string };
export type Entry = { id: number; personId: number; personName: string; kind: string; direction: string; title: string; amount: number; dueDate: string | null; status: string; note: string; createdAt: string };
export type GroupMember = { personId: number; name: string; shareWeight: number };
export type ExpenseShare = { personId: number; name: string; amount: number; weight: number };
export type Expense = { id: number; payerPersonId: number; payerName: string; title: string; amount: number; expenseDate: string; shares: ExpenseShare[] };
export type Balance = { personId: number; name: string; paid: number; owed: number; balance: number };
export type SettlementSuggestion = { fromPersonId: number; fromName: string; toPersonId: number; toName: string; amount: number };
export type GroupSettlement = { id: number; groupId: number; fromPersonId: number; fromName: string; toPersonId: number; toName: string; amount: number; settlementDate: string; note: string; createdAt: string };
export type Group = { id: number; name: string; members: GroupMember[]; expenses: Expense[]; totalSpent: number; balances: Balance[]; suggestions: SettlementSuggestion[]; settlements: GroupSettlement[] };
export type PersonLedgerItem = {
  id: string;
  source: "entry" | "expense" | "settlement";
  sourceId: number;
  groupId?: number;
  groupName?: string;
  title: string;
  detail: string;
  date: string;
  amount: number;
  effect: number;
  status?: string;
};
export type PersonGroupImpact = { groupId: number; groupName: string; balance: number };
export type PersonAccount = { personId: number; name: string; phone: string; color: string; directBalance: number; dongBalance: number; finalBalance: number; groups: PersonGroupImpact[]; items: PersonLedgerItem[] };
export type FinanceData = { persons: Person[]; entries: Entry[]; groups: Group[]; accounts: PersonAccount[] };

export type FinanceBackup = {
  app: "daftar-hesab-shakhsi";
  version: 2;
  exportedAt: string;
  stores: {
    persons: Array<Record<string, unknown>>;
    entries: Array<Record<string, unknown>>;
    groups: Array<Record<string, unknown>>;
    members: Array<Record<string, unknown>>;
    expenses: Array<Record<string, unknown>>;
    shares: Array<Record<string, unknown>>;
    settlements: Array<Record<string, unknown>>;
  };
};

type StoredPerson = Omit<Person, "id"> & { id?: number; createdAt: string };
type StoredEntry = Omit<Entry, "id" | "personName"> & { id?: number };
type StoredGroup = { id?: number; name: string; createdAt: string };
type StoredMember = { id?: number; groupId: number; personId: number; shareWeight: number; active?: boolean };
type StoredExpense = Omit<Expense, "id" | "payerName" | "shares"> & { id?: number; groupId: number; createdAt: string };
type StoredShare = { id?: number; expenseId: number; personId: number; amount: number; weight?: number };
type StoredSettlement = { id?: number; groupId: number; fromPersonId: number; toPersonId: number; amount: number; settlementDate: string; note: string; createdAt: string };

const DB_NAME = "hamhesab-local";
const DB_VERSION = 2;
const STORE_NAMES = ["persons", "entries", "groups", "members", "expenses", "shares", "settlements"] as const;
const COLORS = ["#315d4c", "#b65b4a", "#5f659b", "#447b8b", "#9a6b38"];
let databasePromise: Promise<IDBDatabase> | null = null;

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("دسترسی به دفتر داخلی ممکن نشد."));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("ذخیره‌سازی کامل نشد."));
    transaction.onabort = () => reject(transaction.error ?? new Error("ذخیره‌سازی لغو شد."));
  });
}

function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORE_NAMES) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      databasePromise = null;
      reject(request.error ?? new Error("دفتر داخلی برنامه باز نشد."));
    };
  });
  return databasePromise;
}

async function ensureSelf(db: IDBDatabase) {
  const persons = await all<StoredPerson & { id: number }>(db, "persons");
  if (persons.some((person) => person.isSelf)) return;
  const write = db.transaction("persons", "readwrite");
  write.objectStore("persons").add({ name: "من", phone: "", isSelf: true, color: COLORS[0], createdAt: new Date().toISOString() } satisfies StoredPerson);
  await transactionDone(write);
}

async function all<T>(db: IDBDatabase, store: string) {
  const transaction = db.transaction(store, "readonly");
  const result = await requestResult(transaction.objectStore(store).getAll()) as T[];
  await transactionDone(transaction);
  return result;
}

function cleanText(value: unknown, max = 120) {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeNumericText(value: unknown) {
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  const arabic = "٠١٢٣٤٥٦٧٨٩";
  return String(value ?? "")
    .replace(/[۰-۹]/g, (digit) => String(persian.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(arabic.indexOf(digit)))
    .replace(/[,_\s\u066C]/g, "");
}

function positiveInteger(value: unknown, label: string) {
  const parsed = Math.round(Number(normalizeNumericText(value)));
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${label} باید بیشتر از صفر باشد.`);
  return parsed;
}

function nonNegativeInteger(value: unknown, label: string) {
  const parsed = Math.round(Number(normalizeNumericText(value)));
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} نمی‌تواند منفی باشد.`);
  return parsed;
}

function uniqueMemberWeights(items: unknown, allowedIds?: Set<number>) {
  const seen = new Set<number>();
  const members = (Array.isArray(items) ? items : []).map((item) => {
    const member = item as Record<string, unknown>;
    const personId = positiveInteger(member.personId, "عضو");
    if (seen.has(personId)) throw new Error("یک شخص نمی‌تواند دوبار در تقسیم سهم باشد.");
    if (allowedIds && !allowedIds.has(personId)) throw new Error("یکی از افراد انتخاب‌شده عضو این گروه نیست.");
    seen.add(personId);
    return { personId, shareWeight: nonNegativeInteger(member.shareWeight, "سهم") };
  });
  return members;
}

export function allocateExpenseShares(members: Array<{ personId: number; shareWeight: number }>, amount: number) {
  const weightedMembers = members.filter((member) => member.shareWeight > 0);
  const totalWeight = weightedMembers.reduce((sum, member) => sum + member.shareWeight, 0);
  if (totalWeight <= 0) throw new Error("برای ثبت خرید، سهم حداقل یک عضو باید بیشتر از صفر باشد.");

  const calculated = weightedMembers.map((member) => {
    const exact = (amount * member.shareWeight) / totalWeight;
    const base = Math.floor(exact);
    return { ...member, amount: base, fraction: exact - base };
  });
  let remainder = amount - calculated.reduce((sum, member) => sum + member.amount, 0);
  const remainderOrder = [...calculated].sort((a, b) => b.fraction - a.fraction || a.personId - b.personId);
  for (let index = 0; index < remainder; index += 1) remainderOrder[index % remainderOrder.length].amount += 1;
  const amounts = new Map(calculated.map((member) => [member.personId, member.amount]));
  return members.map((member) => ({ personId: member.personId, amount: amounts.get(member.personId) ?? 0, weight: member.shareWeight }));
}

export function makeSettlementSuggestions(balances: Array<{ personId: number; name: string; balance: number }>) {
  const creditors = balances.filter((item) => item.balance > 0).map((item) => ({ ...item }));
  const debtors = balances.filter((item) => item.balance < 0).map((item) => ({ ...item, debt: -item.balance }));
  const result: SettlementSuggestion[] = [];
  let creditorIndex = 0;
  let debtorIndex = 0;
  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amount = Math.min(creditor.balance, debtor.debt);
    if (amount > 0) result.push({ fromPersonId: debtor.personId, fromName: debtor.name, toPersonId: creditor.personId, toName: creditor.name, amount });
    creditor.balance -= amount;
    debtor.debt -= amount;
    if (creditor.balance === 0) creditorIndex += 1;
    if (debtor.debt === 0) debtorIndex += 1;
  }
  return result;
}

function buildPersonAccounts(persons: Person[], entries: Entry[], groups: Group[]): PersonAccount[] {
  const self = persons.find((person) => person.isSelf);
  if (!self) return [];

  return persons.filter((person) => !person.isSelf).map((person) => {
    const directEntries = entries.filter((entry) => entry.personId === person.id);
    const directBalance = directEntries
      .filter((entry) => entry.status === "open")
      .reduce((sum, entry) => sum + (entry.direction === "receivable" ? entry.amount : -entry.amount), 0);
    const items: PersonLedgerItem[] = directEntries.map((entry) => ({
      id: `entry-${entry.id}`,
      source: "entry",
      sourceId: entry.id,
      title: entry.title,
      detail: `${entry.direction === "receivable" ? "طلب مستقیم" : "بدهی مستقیم"}${entry.dueDate ? ` • سررسید ${entry.dueDate}` : ""}`,
      date: entry.createdAt.slice(0, 10),
      amount: entry.amount,
      effect: entry.status === "open" ? (entry.direction === "receivable" ? entry.amount : -entry.amount) : 0,
      status: entry.status,
    }));

    const groupImpacts: PersonGroupImpact[] = [];
    for (const group of groups) {
      const isHistoricallyInvolved = group.members.some((member) => member.personId === person.id)
        || group.expenses.some((expense) => expense.shares.some((share) => share.personId === person.id));
      if (!isHistoricallyInvolved) continue;

      // The current account-to-account exposure is taken from the group's net settlement plan.
      // This avoids incorrectly assigning a person's debt to "me" when their actual group debt
      // is currently matched to another creditor.
      const groupBalance = group.suggestions.reduce((sum, suggestion) => {
        if (suggestion.fromPersonId === person.id && suggestion.toPersonId === self.id) return sum + suggestion.amount;
        if (suggestion.fromPersonId === self.id && suggestion.toPersonId === person.id) return sum - suggestion.amount;
        return sum;
      }, 0);

      // Keep direct purchase interactions as history/context. These explain where obligations
      // originated, while groupBalance above remains the authoritative current net exposure.
      for (const expense of group.expenses) {
        let effect = 0;
        if (expense.payerPersonId === self.id) {
          effect = expense.shares.find((share) => share.personId === person.id)?.amount ?? 0;
        } else if (expense.payerPersonId === person.id) {
          effect = -(expense.shares.find((share) => share.personId === self.id)?.amount ?? 0);
        }
        if (effect !== 0) {
          items.push({
            id: `expense-${expense.id}-${person.id}`,
            source: "expense",
            sourceId: expense.id,
            groupId: group.id,
            groupName: group.name,
            title: expense.title,
            detail: effect > 0 ? `دُنگ «${group.name}» • سهم ${person.name} از پرداخت من` : `دُنگ «${group.name}» • سهم من از پرداخت ${person.name}`,
            date: expense.expenseDate,
            amount: Math.abs(effect),
            effect,
          });
        }
      }
      for (const settlement of group.settlements) {
        let effect = 0;
        let detail = "";
        if (settlement.fromPersonId === person.id && settlement.toPersonId === self.id) {
          effect = -settlement.amount;
          detail = `${person.name} به من پرداخت کرد`;
        } else if (settlement.fromPersonId === self.id && settlement.toPersonId === person.id) {
          effect = settlement.amount;
          detail = `من به ${person.name} پرداخت کردم`;
        }
        if (effect !== 0) {
          items.push({
            id: `settlement-${settlement.id}-${person.id}`,
            source: "settlement",
            sourceId: settlement.id,
            groupId: group.id,
            groupName: group.name,
            title: `تسویه دُنگ «${group.name}»`,
            detail,
            date: settlement.settlementDate,
            amount: settlement.amount,
            effect,
          });
        }
      }
      if (groupBalance !== 0) groupImpacts.push({ groupId: group.id, groupName: group.name, balance: groupBalance });
    }

    const dongBalance = groupImpacts.reduce((sum, impact) => sum + impact.balance, 0);
    items.sort((a, b) => b.date.localeCompare(a.date) || b.sourceId - a.sourceId);
    return {
      personId: person.id,
      name: person.name,
      phone: person.phone,
      color: person.color,
      directBalance,
      dongBalance,
      finalBalance: directBalance + dongBalance,
      groups: groupImpacts,
      items,
    };
  }).sort((a, b) => Math.abs(b.finalBalance) - Math.abs(a.finalBalance) || a.name.localeCompare(b.name, "fa"));
}

export async function getFinanceData(): Promise<FinanceData> {
  const db = await openDatabase();
  await ensureSelf(db);
  const [storedPersons, storedEntries, storedGroups, storedMembers, storedExpenses, storedShares, storedSettlements] = await Promise.all([
    all<StoredPerson & { id: number }>(db, "persons"),
    all<StoredEntry & { id: number }>(db, "entries"),
    all<StoredGroup & { id: number }>(db, "groups"),
    all<StoredMember & { id: number }>(db, "members"),
    all<StoredExpense & { id: number }>(db, "expenses"),
    all<StoredShare & { id: number }>(db, "shares"),
    all<StoredSettlement & { id: number }>(db, "settlements"),
  ]);
  const persons = storedPersons
    .map(({ id, name, phone, isSelf, color }) => ({ id, name, phone, isSelf, color }))
    .sort((a, b) => Number(b.isSelf) - Number(a.isSelf) || a.name.localeCompare(b.name, "fa"));
  const names = new Map(persons.map((person) => [person.id, person.name]));
  const entries = storedEntries
    .map((entry) => ({ ...entry, personName: names.get(entry.personId) ?? "نامشخص" }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
  const groups = storedGroups
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
    .map((group) => {
      const storedGroupMembers = storedMembers.filter((member) => member.groupId === group.id);
      const members = storedGroupMembers.filter((member) => member.active !== false).map((member) => ({ personId: member.personId, name: names.get(member.personId) ?? "نامشخص", shareWeight: member.shareWeight }));
      const groupExpenses = storedExpenses.filter((expense) => expense.groupId === group.id);
      const expenseIds = new Set(groupExpenses.map((expense) => expense.id));
      const shares = storedShares.filter((share) => expenseIds.has(share.expenseId));
      const expenses = groupExpenses
        .map((expense) => ({
          id: expense.id,
          payerPersonId: expense.payerPersonId,
          payerName: names.get(expense.payerPersonId) ?? "نامشخص",
          title: expense.title,
          amount: expense.amount,
          expenseDate: expense.expenseDate,
          shares: shares
            .filter((share) => share.expenseId === expense.id)
            .map((share) => ({ personId: share.personId, name: names.get(share.personId) ?? "نامشخص", amount: share.amount, weight: share.weight ?? (share.amount > 0 ? 1 : 0) })),
        }))
        .sort((a, b) => b.expenseDate.localeCompare(a.expenseDate) || b.id - a.id);
      const settlements = storedSettlements
        .filter((settlement) => settlement.groupId === group.id)
        .map((settlement) => ({
          id: settlement.id,
          groupId: group.id,
          fromPersonId: settlement.fromPersonId,
          fromName: names.get(settlement.fromPersonId) ?? "نامشخص",
          toPersonId: settlement.toPersonId,
          toName: names.get(settlement.toPersonId) ?? "نامشخص",
          amount: settlement.amount,
          settlementDate: settlement.settlementDate,
          note: settlement.note,
          createdAt: settlement.createdAt,
        }))
        .sort((a, b) => b.settlementDate.localeCompare(a.settlementDate) || b.id - a.id);
      const balances = storedGroupMembers.map((member) => {
        const paid = expenses.filter((expense) => expense.payerPersonId === member.personId).reduce((sum, expense) => sum + expense.amount, 0);
        const owed = shares.filter((share) => share.personId === member.personId).reduce((sum, share) => sum + share.amount, 0);
        const settlementEffect = settlements.reduce((sum, settlement) => sum + (settlement.fromPersonId === member.personId ? settlement.amount : 0) - (settlement.toPersonId === member.personId ? settlement.amount : 0), 0);
        return { personId: member.personId, name: names.get(member.personId) ?? "نامشخص", paid, owed, balance: paid - owed + settlementEffect, active: member.active !== false };
      }).filter((balance) => balance.active || balance.balance !== 0).map(({ active: _active, ...balance }) => balance);
      return { id: group.id, name: group.name, members, expenses, totalSpent: expenses.reduce((sum, expense) => sum + expense.amount, 0), balances, suggestions: makeSettlementSuggestions(balances), settlements };
    });
  return { persons, entries, groups, accounts: buildPersonAccounts(persons, entries, groups) };
}

async function getAllGroupMembers(db: IDBDatabase, groupId: number) {
  return (await all<StoredMember & { id: number }>(db, "members")).filter((member) => member.groupId === groupId);
}

async function getGroupMembers(db: IDBDatabase, groupId: number) {
  return (await getAllGroupMembers(db, groupId)).filter((member) => member.active !== false);
}

function splitWeightsForGroup(payload: Record<string, unknown>, members: Array<StoredMember & { id: number }>) {
  const memberIds = new Set(members.map((member) => member.personId));
  const supplied = uniqueMemberWeights(payload.splits, memberIds);
  if (supplied.length) {
    const suppliedMap = new Map(supplied.map((item) => [item.personId, item.shareWeight]));
    return members.map((member) => ({ personId: member.personId, shareWeight: suppliedMap.get(member.personId) ?? 0 }));
  }
  return members.map((member) => ({ personId: member.personId, shareWeight: member.shareWeight }));
}

export async function applyFinanceOperation(payload: Record<string, unknown>) {
  const db = await openDatabase();
  await ensureSelf(db);
  const operation = cleanText(payload.operation, 40);

  if (operation === "add_person") {
    const name = cleanText(payload.name, 60);
    if (!name) throw new Error("نام شخص را وارد کنید.");
    const transaction = db.transaction("persons", "readwrite");
    transaction.objectStore("persons").add({ name, phone: cleanText(payload.phone, 30), isSelf: false, color: COLORS[name.length % COLORS.length], createdAt: new Date().toISOString() } satisfies StoredPerson);
    await transactionDone(transaction);
    return;
  }

  if (operation === "add_entry" || operation === "update_entry") {
    const personId = positiveInteger(payload.personId, "شخص");
    const amount = positiveInteger(payload.amount, "مبلغ");
    const kind = ["debt", "receivable", "installment", "check"].includes(String(payload.kind)) ? String(payload.kind) : "debt";
    const direction = String(payload.direction) === "receivable" ? "receivable" : "debt";
    const title = cleanText(payload.title, 100) || ({ debt: "بدهی", receivable: "طلب", installment: "قسط", check: "چک" }[kind] ?? "ثبت مالی");
    const id = operation === "update_entry" ? positiveInteger(payload.id, "شناسه") : null;
    const transaction = db.transaction("entries", "readwrite");
    const store = transaction.objectStore("entries");
    if (id) {
      const current = await requestResult(store.get(id)) as StoredEntry | undefined;
      if (!current) throw new Error("ثبت موردنظر پیدا نشد.");
      store.put({ ...current, id, personId, kind, direction, title, amount, dueDate: cleanText(payload.dueDate, 10) || null, note: cleanText(payload.note, 400) });
    } else {
      store.add({ personId, kind, direction, title, amount, dueDate: cleanText(payload.dueDate, 10) || null, status: "open", note: cleanText(payload.note, 400), createdAt: new Date().toISOString() } satisfies StoredEntry);
    }
    await transactionDone(transaction);
    return;
  }

  if (operation === "toggle_entry") {
    const id = positiveInteger(payload.id, "شناسه");
    const transaction = db.transaction("entries", "readwrite");
    const store = transaction.objectStore("entries");
    const entry = await requestResult(store.get(id)) as StoredEntry | undefined;
    if (!entry) throw new Error("ثبت موردنظر پیدا نشد.");
    store.put({ ...entry, id, status: entry.status === "open" ? "paid" : "open" });
    await transactionDone(transaction);
    return;
  }

  if (operation === "delete_entry") {
    const id = positiveInteger(payload.id, "شناسه");
    const transaction = db.transaction("entries", "readwrite");
    transaction.objectStore("entries").delete(id);
    await transactionDone(transaction);
    return;
  }

  if (operation === "delete_person") {
    const personId = positiveInteger(payload.id, "شناسه شخص");
    const [persons, entries, members, expenses, shares, settlements] = await Promise.all([
      all<StoredPerson & { id: number }>(db, "persons"),
      all<StoredEntry & { id: number }>(db, "entries"),
      all<StoredMember & { id: number }>(db, "members"),
      all<StoredExpense & { id: number }>(db, "expenses"),
      all<StoredShare & { id: number }>(db, "shares"),
      all<StoredSettlement & { id: number }>(db, "settlements"),
    ]);
    const person = persons.find((item) => item.id === personId);
    if (!person) throw new Error("این شخص پیدا نشد.");
    if (person.isSelf) throw new Error("پروفایل «من» قابل حذف نیست.");
    const groupIds = new Set(members.filter((member) => member.personId === personId).map((member) => member.groupId));
    const expenseIds = new Set(expenses.filter((expense) => groupIds.has(expense.groupId)).map((expense) => expense.id));
    const transaction = db.transaction([...STORE_NAMES], "readwrite");
    transaction.objectStore("persons").delete(personId);
    for (const entry of entries.filter((item) => item.personId === personId)) transaction.objectStore("entries").delete(entry.id);
    for (const groupId of groupIds) transaction.objectStore("groups").delete(groupId);
    for (const member of members.filter((item) => groupIds.has(item.groupId))) transaction.objectStore("members").delete(member.id);
    for (const expense of expenses.filter((item) => groupIds.has(item.groupId))) transaction.objectStore("expenses").delete(expense.id);
    for (const share of shares.filter((item) => expenseIds.has(item.expenseId))) transaction.objectStore("shares").delete(share.id);
    for (const settlement of settlements.filter((item) => groupIds.has(item.groupId))) transaction.objectStore("settlements").delete(settlement.id);
    await transactionDone(transaction);
    return;
  }

  if (operation === "add_group") {
    const name = cleanText(payload.name, 80);
    if (!name) throw new Error("نام گروه را وارد کنید.");
    const members = uniqueMemberWeights(payload.members);
    if (members.length < 2) throw new Error("برای گروه دُنگی حداقل دو نفر لازم است.");
    const existingPersons = new Set((await all<StoredPerson & { id: number }>(db, "persons")).map((person) => person.id));
    if (members.some((member) => !existingPersons.has(member.personId))) throw new Error("یکی از اعضای گروه در دفتر اشخاص پیدا نشد.");
    const transaction = db.transaction(["groups", "members"], "readwrite");
    const groupId = Number(await requestResult(transaction.objectStore("groups").add({ name, createdAt: new Date().toISOString() } satisfies StoredGroup)));
    for (const member of members) transaction.objectStore("members").add({ groupId, ...member, active: true } satisfies StoredMember);
    await transactionDone(transaction);
    return;
  }

  if (operation === "update_group") {
    const groupId = positiveInteger(payload.id, "شناسه گروه");
    const name = cleanText(payload.name, 80);
    if (!name) throw new Error("نام گروه را وارد کنید.");
    const members = uniqueMemberWeights(payload.members);
    if (members.length < 2) throw new Error("برای گروه دُنگی حداقل دو عضو فعال لازم است.");
    const [groups, persons, currentMembers] = await Promise.all([
      all<StoredGroup & { id: number }>(db, "groups"),
      all<StoredPerson & { id: number }>(db, "persons"),
      getAllGroupMembers(db, groupId),
    ]);
    const group = groups.find((item) => item.id === groupId);
    if (!group) throw new Error("گروه موردنظر پیدا نشد.");
    const existingPersons = new Set(persons.map((person) => person.id));
    if (members.some((member) => !existingPersons.has(member.personId))) throw new Error("یکی از اعضای گروه در دفتر اشخاص پیدا نشد.");
    const next = new Map(members.map((member) => [member.personId, member.shareWeight]));
    const existingByPerson = new Map(currentMembers.map((member) => [member.personId, member]));
    const transaction = db.transaction(["groups", "members"], "readwrite");
    transaction.objectStore("groups").put({ ...group, id: groupId, name });
    const memberStore = transaction.objectStore("members");
    for (const current of currentMembers) {
      const nextWeight = next.get(current.personId);
      memberStore.put({ ...current, id: current.id, shareWeight: nextWeight ?? current.shareWeight, active: nextWeight !== undefined });
    }
    for (const member of members) {
      if (!existingByPerson.has(member.personId)) memberStore.add({ groupId, ...member, active: true } satisfies StoredMember);
    }
    await transactionDone(transaction);
    return;
  }

  if (operation === "delete_group") {
    const groupId = positiveInteger(payload.id, "شناسه گروه");
    const [groups, members, expenses, shares, settlements] = await Promise.all([
      all<StoredGroup & { id: number }>(db, "groups"),
      all<StoredMember & { id: number }>(db, "members"),
      all<StoredExpense & { id: number }>(db, "expenses"),
      all<StoredShare & { id: number }>(db, "shares"),
      all<StoredSettlement & { id: number }>(db, "settlements"),
    ]);
    if (!groups.some((group) => group.id === groupId)) throw new Error("گروه موردنظر پیدا نشد.");
    const groupExpenses = expenses.filter((expense) => expense.groupId === groupId);
    const expenseIds = new Set(groupExpenses.map((expense) => expense.id));
    const transaction = db.transaction(["groups", "members", "expenses", "shares", "settlements"], "readwrite");
    transaction.objectStore("groups").delete(groupId);
    for (const member of members.filter((member) => member.groupId === groupId)) transaction.objectStore("members").delete(member.id);
    for (const expense of groupExpenses) transaction.objectStore("expenses").delete(expense.id);
    for (const share of shares.filter((share) => expenseIds.has(share.expenseId))) transaction.objectStore("shares").delete(share.id);
    for (const settlement of settlements.filter((settlement) => settlement.groupId === groupId)) transaction.objectStore("settlements").delete(settlement.id);
    await transactionDone(transaction);
    return;
  }

  if (operation === "add_expense" || operation === "update_expense") {
    const id = operation === "update_expense" ? positiveInteger(payload.id, "شناسه خرید") : null;
    let groupId = positiveInteger(payload.groupId, "گروه");
    let createdAt = new Date().toISOString();
    if (id) {
      const currentExpenses = await all<StoredExpense & { id: number }>(db, "expenses");
      const current = currentExpenses.find((expense) => expense.id === id);
      if (!current) throw new Error("خرید موردنظر پیدا نشد.");
      groupId = current.groupId;
      createdAt = current.createdAt;
    }
    const payerPersonId = positiveInteger(payload.payerPersonId, "پرداخت‌کننده");
    const amount = positiveInteger(payload.amount, "مبلغ");
    const title = cleanText(payload.title, 100);
    if (!title) throw new Error("عنوان خرید را وارد کنید.");
    const activeMembers = await getGroupMembers(db, groupId);
    const oldShares = id ? (await all<StoredShare & { id: number }>(db, "shares")).filter((share) => share.expenseId === id) : [];
    const historicalIds = new Set(oldShares.map((share) => share.personId));
    const allMembers = await getAllGroupMembers(db, groupId);
    const allowedMembers = id ? allMembers.filter((member) => member.active !== false || historicalIds.has(member.personId)) : activeMembers;
    if (!allowedMembers.some((member) => member.personId === payerPersonId)) throw new Error("پرداخت‌کننده عضو فعال گروه یا از طرف‌های همین خرید نیست.");
    const weights = splitWeightsForGroup(payload, allowedMembers);
    const allocations = allocateExpenseShares(weights, amount);
    const transaction = db.transaction(["expenses", "shares"], "readwrite");
    const expenseStore = transaction.objectStore("expenses");
    const shareStore = transaction.objectStore("shares");
    let expenseId: number;
    if (id) {
      expenseId = id;
      expenseStore.put({ id, groupId, payerPersonId, title, amount, expenseDate: cleanText(payload.expenseDate, 10) || new Date().toISOString().slice(0, 10), createdAt } satisfies StoredExpense & { id: number });
      for (const share of oldShares) shareStore.delete(share.id);
    } else {
      expenseId = Number(await requestResult(expenseStore.add({ groupId, payerPersonId, title, amount, expenseDate: cleanText(payload.expenseDate, 10) || new Date().toISOString().slice(0, 10), createdAt } satisfies StoredExpense)));
    }
    for (const share of allocations) shareStore.add({ expenseId, personId: share.personId, amount: share.amount, weight: share.weight } satisfies StoredShare);
    await transactionDone(transaction);
    return;
  }

  if (operation === "delete_expense") {
    const id = positiveInteger(payload.id, "شناسه خرید");
    const shares = (await all<StoredShare & { id: number }>(db, "shares")).filter((share) => share.expenseId === id);
    const transaction = db.transaction(["expenses", "shares"], "readwrite");
    transaction.objectStore("expenses").delete(id);
    for (const share of shares) transaction.objectStore("shares").delete(share.id);
    await transactionDone(transaction);
    return;
  }

  if (operation === "add_settlement") {
    const groupId = positiveInteger(payload.groupId, "گروه");
    const fromPersonId = positiveInteger(payload.fromPersonId, "پرداخت‌کننده");
    const toPersonId = positiveInteger(payload.toPersonId, "دریافت‌کننده");
    if (fromPersonId === toPersonId) throw new Error("پرداخت‌کننده و دریافت‌کننده نمی‌توانند یک نفر باشند.");
    const amount = positiveInteger(payload.amount, "مبلغ تسویه");
    const members = await getAllGroupMembers(db, groupId);
    const memberIds = new Set(members.map((member) => member.personId));
    if (!memberIds.has(fromPersonId) || !memberIds.has(toPersonId)) throw new Error("هر دو طرف تسویه باید عضو این گروه باشند.");
    const transaction = db.transaction("settlements", "readwrite");
    transaction.objectStore("settlements").add({ groupId, fromPersonId, toPersonId, amount, settlementDate: cleanText(payload.settlementDate, 10) || new Date().toISOString().slice(0, 10), note: cleanText(payload.note, 300), createdAt: new Date().toISOString() } satisfies StoredSettlement);
    await transactionDone(transaction);
    return;
  }

  if (operation === "delete_settlement") {
    const id = positiveInteger(payload.id, "شناسه تسویه");
    const transaction = db.transaction("settlements", "readwrite");
    transaction.objectStore("settlements").delete(id);
    await transactionDone(transaction);
    return;
  }

  throw new Error("عملیات نامعتبر است.");
}

export async function exportFinanceBackup() {
  const db = await openDatabase();
  await ensureSelf(db);
  const stores = {} as FinanceBackup["stores"];
  for (const name of STORE_NAMES) {
    stores[name] = await all<Record<string, unknown>>(db, name);
  }
  const payload: FinanceBackup = { app: "daftar-hesab-shakhsi", version: 2, exportedAt: new Date().toISOString(), stores };
  return JSON.stringify(payload, null, 2);
}

export async function importFinanceBackup(raw: string) {
  let parsed: Partial<FinanceBackup> & { stores?: Record<string, unknown> };
  try {
    parsed = JSON.parse(raw) as Partial<FinanceBackup> & { stores?: Record<string, unknown> };
  } catch {
    throw new Error("فایل پشتیبان JSON معتبر نیست.");
  }
  if (parsed.app !== "daftar-hesab-shakhsi" || !parsed.stores || typeof parsed.stores !== "object") throw new Error("این فایل پشتیبان متعلق به دفتر حساب شخصی نیست.");
  const db = await openDatabase();
  const transaction = db.transaction([...STORE_NAMES], "readwrite");
  for (const name of STORE_NAMES) {
    const store = transaction.objectStore(name);
    store.clear();
    const records = Array.isArray(parsed.stores[name]) ? parsed.stores[name] as Array<Record<string, unknown>> : [];
    for (const record of records) store.put(record);
  }
  await transactionDone(transaction);
  await ensureSelf(db);
}
