export type Person = { id: number; name: string; phone: string; isSelf: boolean; color: string };
export type Entry = { id: number; personId: number; personName: string; kind: string; direction: string; title: string; amount: number; dueDate: string | null; status: string; note: string; createdAt: string };
export type GroupMember = { personId: number; name: string; shareWeight: number };
export type ExpenseShare = { personId: number; name: string; amount: number };
export type Expense = { id: number; payerPersonId: number; payerName: string; title: string; amount: number; expenseDate: string; shares: ExpenseShare[] };
export type Balance = { personId: number; name: string; paid: number; owed: number; balance: number };
export type Settlement = { from: string; to: string; amount: number };
export type Group = { id: number; name: string; members: GroupMember[]; expenses: Expense[]; totalSpent: number; balances: Balance[]; settlements: Settlement[] };
export type FinanceData = { persons: Person[]; entries: Entry[]; groups: Group[] };

type StoredPerson = Omit<Person, "id"> & { id?: number; createdAt: string };
type StoredEntry = Omit<Entry, "id" | "personName"> & { id?: number };
type StoredGroup = { id?: number; name: string; createdAt: string };
type StoredMember = { id?: number; groupId: number; personId: number; shareWeight: number };
type StoredExpense = Omit<Expense, "id" | "payerName" | "shares"> & { id?: number; groupId: number; createdAt: string };
type StoredShare = { id?: number; expenseId: number; personId: number; amount: number };

const DB_NAME = "hamhesab-local";
const DB_VERSION = 1;
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
      for (const name of ["persons", "entries", "groups", "members", "expenses", "shares"]) {
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
  const read = db.transaction("persons", "readonly");
  const count = await requestResult(read.objectStore("persons").count());
  await transactionDone(read);
  if (count > 0) return;
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

function positiveInteger(value: unknown, label: string) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${label} باید بیشتر از صفر باشد.`);
  return parsed;
}

function nonNegativeInteger(value: unknown, label: string) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} نمی‌تواند منفی باشد.`);
  return parsed;
}

export function allocateExpenseShares(members: Array<{ personId: number; shareWeight: number }>, amount: number) {
  const weightedMembers = members.filter((member) => member.shareWeight > 0);
  const totalWeight = weightedMembers.reduce((sum, member) => sum + member.shareWeight, 0);
  if (totalWeight <= 0) throw new Error("برای ثبت خرید، سهم حداقل یک عضو باید بیشتر از صفر باشد.");
  const lastWeightedPersonId = weightedMembers[weightedMembers.length - 1].personId;
  let allocated = 0;
  return members.map((member) => {
    if (member.shareWeight <= 0) return { personId: member.personId, amount: 0 };
    const shareAmount = member.personId === lastWeightedPersonId ? amount - allocated : Math.floor((amount * member.shareWeight) / totalWeight);
    allocated += shareAmount;
    return { personId: member.personId, amount: shareAmount };
  });
}

export function makeSettlements(balances: Array<{ personId: number; name: string; balance: number }>) {
  const creditors = balances.filter((item) => item.balance > 0).map((item) => ({ ...item }));
  const debtors = balances.filter((item) => item.balance < 0).map((item) => ({ ...item, debt: -item.balance }));
  const result: Settlement[] = [];
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

export async function getFinanceData(): Promise<FinanceData> {
  const db = await openDatabase();
  await ensureSelf(db);
  const [storedPersons, storedEntries, storedGroups, storedMembers, storedExpenses, storedShares] = await Promise.all([
    all<StoredPerson & { id: number }>(db, "persons"),
    all<StoredEntry & { id: number }>(db, "entries"),
    all<StoredGroup & { id: number }>(db, "groups"),
    all<StoredMember & { id: number }>(db, "members"),
    all<StoredExpense & { id: number }>(db, "expenses"),
    all<StoredShare & { id: number }>(db, "shares"),
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
      const members = storedMembers.filter((member) => member.groupId === group.id).map((member) => ({ personId: member.personId, name: names.get(member.personId) ?? "نامشخص", shareWeight: member.shareWeight }));
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
            .map((share) => ({ personId: share.personId, name: names.get(share.personId) ?? "نامشخص", amount: share.amount })),
        }))
        .sort((a, b) => b.expenseDate.localeCompare(a.expenseDate) || b.id - a.id);
      const balances = members.map((member) => {
        const paid = expenses.filter((expense) => expense.payerPersonId === member.personId).reduce((sum, expense) => sum + expense.amount, 0);
        const owed = shares.filter((share) => share.personId === member.personId).reduce((sum, share) => sum + share.amount, 0);
        return { personId: member.personId, name: member.name, paid, owed, balance: paid - owed };
      });
      return { id: group.id, name: group.name, members, expenses, totalSpent: expenses.reduce((sum, expense) => sum + expense.amount, 0), balances, settlements: makeSettlements(balances) };
    });
  return { persons, entries, groups };
}

export async function applyFinanceOperation(payload: Record<string, unknown>) {
  const db = await openDatabase();
  await ensureSelf(db);
  const operation = cleanText(payload.operation, 30);
  if (operation === "add_person") {
    const name = cleanText(payload.name, 60);
    if (!name) throw new Error("نام شخص را وارد کنید.");
    const transaction = db.transaction("persons", "readwrite");
    transaction.objectStore("persons").add({ name, phone: cleanText(payload.phone, 30), isSelf: false, color: COLORS[name.length % COLORS.length], createdAt: new Date().toISOString() } satisfies StoredPerson);
    await transactionDone(transaction);
    return;
  }
  if (operation === "add_entry") {
    const personId = positiveInteger(payload.personId, "شخص");
    const amount = positiveInteger(payload.amount, "مبلغ");
    const kind = ["debt", "receivable", "installment", "check"].includes(String(payload.kind)) ? String(payload.kind) : "debt";
    const direction = String(payload.direction) === "receivable" ? "receivable" : "debt";
    const title = cleanText(payload.title, 100) || ({ debt: "بدهی", receivable: "طلب", installment: "قسط", check: "چک" }[kind] ?? "ثبت مالی");
    const transaction = db.transaction("entries", "readwrite");
    transaction.objectStore("entries").add({ personId, kind, direction, title, amount, dueDate: cleanText(payload.dueDate, 10) || null, status: "open", note: cleanText(payload.note, 400), createdAt: new Date().toISOString() } satisfies StoredEntry);
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
  if (operation === "delete_person") {
    const personId = positiveInteger(payload.id, "شناسه شخص");
    const [persons, entries, members, expenses, shares] = await Promise.all([
      all<StoredPerson & { id: number }>(db, "persons"),
      all<StoredEntry & { id: number }>(db, "entries"),
      all<StoredMember & { id: number }>(db, "members"),
      all<StoredExpense & { id: number }>(db, "expenses"),
      all<StoredShare & { id: number }>(db, "shares"),
    ]);
    const person = persons.find((item) => item.id === personId);
    if (!person) throw new Error("این شخص پیدا نشد.");
    if (person.isSelf) throw new Error("پروفایل «من» قابل حذف نیست.");
    const groupIds = new Set(members.filter((member) => member.personId === personId).map((member) => member.groupId));
    const expenseIds = new Set(expenses.filter((expense) => groupIds.has(expense.groupId)).map((expense) => expense.id));
    const transaction = db.transaction(["persons", "entries", "groups", "members", "expenses", "shares"], "readwrite");
    transaction.objectStore("persons").delete(personId);
    for (const entry of entries.filter((item) => item.personId === personId)) transaction.objectStore("entries").delete(entry.id);
    for (const groupId of groupIds) transaction.objectStore("groups").delete(groupId);
    for (const member of members.filter((item) => groupIds.has(item.groupId))) transaction.objectStore("members").delete(member.id);
    for (const expense of expenses.filter((item) => groupIds.has(item.groupId))) transaction.objectStore("expenses").delete(expense.id);
    for (const share of shares.filter((item) => expenseIds.has(item.expenseId))) transaction.objectStore("shares").delete(share.id);
    await transactionDone(transaction);
    return;
  }
  if (operation === "add_group") {
    const name = cleanText(payload.name, 80);
    if (!name) throw new Error("نام گروه را وارد کنید.");
    const members = (Array.isArray(payload.members) ? payload.members : []).map((item) => {
      const member = item as Record<string, unknown>;
      return { personId: positiveInteger(member.personId, "عضو"), shareWeight: nonNegativeInteger(member.shareWeight, "سهم") };
    });
    if (members.length < 2) throw new Error("برای گروه دُنگی حداقل دو نفر لازم است.");
    const transaction = db.transaction(["groups", "members"], "readwrite");
    const groupId = Number(await requestResult(transaction.objectStore("groups").add({ name, createdAt: new Date().toISOString() } satisfies StoredGroup)));
    for (const member of members) transaction.objectStore("members").add({ groupId, ...member } satisfies StoredMember);
    await transactionDone(transaction);
    return;
  }
  if (operation === "add_expense") {
    const groupId = positiveInteger(payload.groupId, "گروه");
    const payerPersonId = positiveInteger(payload.payerPersonId, "پرداخت‌کننده");
    const amount = positiveInteger(payload.amount, "مبلغ");
    const title = cleanText(payload.title, 100);
    if (!title) throw new Error("عنوان خرید را وارد کنید.");
    const members = (await all<StoredMember & { id: number }>(db, "members")).filter((member) => member.groupId === groupId);
    if (!members.some((member) => member.personId === payerPersonId)) throw new Error("پرداخت‌کننده عضو این گروه نیست.");
    const allocations = allocateExpenseShares(members, amount);
    const transaction = db.transaction(["expenses", "shares"], "readwrite");
    const expenseId = Number(await requestResult(transaction.objectStore("expenses").add({ groupId, payerPersonId, title, amount, expenseDate: cleanText(payload.expenseDate, 10) || new Date().toISOString().slice(0, 10), createdAt: new Date().toISOString() } satisfies StoredExpense)));
    for (const share of allocations) transaction.objectStore("shares").add({ expenseId, ...share } satisfies StoredShare);
    await transactionDone(transaction);
    return;
  }
  throw new Error("عملیات نامعتبر است.");
}
