from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing pattern: {label}")
    return text.replace(old, new, 1)

# --- local-db.ts ---
p = Path("app/local-db.ts")
s = p.read_text(encoding="utf-8")
s = replace_once(s,
'''export type Person = { id: number; name: string; phone: string; isSelf: boolean; color: string };
export type Entry = { id: number; personId: number; personName: string; kind: string; direction: string; title: string; amount: number; dueDate: string | null; status: string; note: string; createdAt: string };
export type LoanPayment = { id: number; loanId: number; installmentId: number; amount: number; paymentDate: string; note: string; createdAt: string };''',
'''export type Person = { id: number; name: string; phone: string; isSelf: boolean; color: string };
export type ReceiptAttachment = { fileName: string; mimeType: string; size: number; dataUrl: string };
export type Entry = { id: number; personId: number; personName: string; kind: string; direction: string; title: string; amount: number; dueDate: string | null; status: string; note: string; createdAt: string };
export type LoanPayment = { id: number; loanId: number; installmentId: number; amount: number; paymentDate: string; note: string; createdAt: string; receipt: ReceiptAttachment | null };''', "public receipt types")
s = replace_once(s,
'''export type Expense = { id: number; payerPersonId: number; payerName: string; title: string; amount: number; expenseDate: string; shares: ExpenseShare[] };''',
'''export type Expense = { id: number; payerPersonId: number; payerName: string; title: string; amount: number; expenseDate: string; shares: ExpenseShare[]; receipt: ReceiptAttachment | null };''', "expense receipt type")
s = replace_once(s,
'''export type GroupSettlement = { id: number; groupId: number; fromPersonId: number; fromName: string; toPersonId: number; toName: string; amount: number; settlementDate: string; note: string; createdAt: string };''',
'''export type GroupSettlement = { id: number; groupId: number; fromPersonId: number; fromName: string; toPersonId: number; toName: string; amount: number; settlementDate: string; note: string; createdAt: string; receipt: ReceiptAttachment | null };''', "settlement receipt type")
s = replace_once(s,
'''type StoredExpense = Omit<Expense, "id" | "payerName" | "shares"> & { id?: number; groupId: number; createdAt: string };''',
'''type StoredExpense = Omit<Expense, "id" | "payerName" | "shares" | "receipt"> & { id?: number; groupId: number; createdAt: string; receipt?: ReceiptAttachment | null };''', "stored expense receipt")
s = replace_once(s,
'''type StoredSettlement = { id?: number; groupId: number; fromPersonId: number; toPersonId: number; amount: number; settlementDate: string; note: string; createdAt: string };''',
'''type StoredSettlement = { id?: number; groupId: number; fromPersonId: number; toPersonId: number; amount: number; settlementDate: string; note: string; createdAt: string; receipt?: ReceiptAttachment | null };''', "stored settlement receipt")
s = replace_once(s,
'''type StoredLoanPayment = { id?: number; loanId: number; installmentId: number; amount: number; paymentDate: string; note: string; createdAt: string };''',
'''type StoredLoanPayment = { id?: number; loanId: number; installmentId: number; amount: number; paymentDate: string; note: string; createdAt: string; receipt?: ReceiptAttachment | null };''', "stored loan payment receipt")
s = replace_once(s,
'''function checkFinancialOpen(status: CheckStatus) {
  return status === "open" || status === "bounced";
}''',
'''function cleanReceipt(value: unknown): ReceiptAttachment | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const dataUrl = String(raw.dataUrl ?? "");
  const mimeType = cleanText(raw.mimeType, 80);
  const fileName = cleanText(raw.fileName, 140) || "receipt";
  const size = Math.max(0, Math.round(Number(raw.size) || 0));
  const allowedMime = mimeType.startsWith("image/") || mimeType === "application/pdf";
  if (!allowedMime || !dataUrl.startsWith(`data:${mimeType};base64,`)) throw new Error("فرمت رسید باید تصویر یا PDF باشد.");
  if (size > 5_000_000 || dataUrl.length > 7_000_000) throw new Error("حجم رسید باید کمتر از ۵ مگابایت باشد.");
  return { fileName, mimeType, size, dataUrl };
}

function checkFinancialOpen(status: CheckStatus) {
  return status === "open" || status === "bounced";
}''', "receipt validator")
s = replace_once(s,
'''          expenseDate: expense.expenseDate,
          shares: shares''',
'''          expenseDate: expense.expenseDate,
          receipt: expense.receipt ?? null,
          shares: shares''', "map expense receipt")
s = replace_once(s,
'''          note: settlement.note,
          createdAt: settlement.createdAt,
        }))''',
'''          note: settlement.note,
          createdAt: settlement.createdAt,
          receipt: settlement.receipt ?? null,
        }))''', "map settlement receipt")
s = replace_once(s,
'''          .map((payment) => ({ ...payment }))''',
'''          .map((payment) => ({ ...payment, receipt: payment.receipt ?? null }))''', "map loan payment receipt")
s = replace_once(s,
'''    let groupId = positiveInteger(payload.groupId, "گروه");
    let createdAt = new Date().toISOString();
    if (id) {''',
'''    let groupId = positiveInteger(payload.groupId, "گروه");
    let createdAt = new Date().toISOString();
    let existingReceipt: ReceiptAttachment | null = null;
    if (id) {''', "expense existing receipt variable")
s = replace_once(s,
'''      groupId = current.groupId;
      createdAt = current.createdAt;
    }
    const payerPersonId''',
'''      groupId = current.groupId;
      createdAt = current.createdAt;
      existingReceipt = current.receipt ?? null;
    }
    const payerPersonId''', "capture expense receipt")
s = replace_once(s,
'''    const title = cleanText(payload.title, 100);
    if (!title) throw new Error("عنوان خرید را وارد کنید.");
    const activeMembers''',
'''    const title = cleanText(payload.title, 100);
    if (!title) throw new Error("عنوان خرید را وارد کنید.");
    const receipt = payload.receipt ? cleanReceipt(payload.receipt) : existingReceipt;
    const activeMembers''', "expense receipt payload")
s = replace_once(s,
'''expenseStore.put({ id, groupId, payerPersonId, title, amount, expenseDate: cleanText(payload.expenseDate, 10) || new Date().toISOString().slice(0, 10), createdAt } satisfies StoredExpense & { id: number });''',
'''expenseStore.put({ id, groupId, payerPersonId, title, amount, expenseDate: cleanText(payload.expenseDate, 10) || new Date().toISOString().slice(0, 10), createdAt, receipt } satisfies StoredExpense & { id: number });''', "update expense receipt")
s = replace_once(s,
'''expenseStore.add({ groupId, payerPersonId, title, amount, expenseDate: cleanText(payload.expenseDate, 10) || new Date().toISOString().slice(0, 10), createdAt } satisfies StoredExpense)''',
'''expenseStore.add({ groupId, payerPersonId, title, amount, expenseDate: cleanText(payload.expenseDate, 10) || new Date().toISOString().slice(0, 10), createdAt, receipt } satisfies StoredExpense)''', "add expense receipt")
s = replace_once(s,
'''transaction.objectStore("loanPayments").add({ loanId, installmentId, amount, paymentDate: cleanIsoDate(payload.paymentDate, "تاریخ پرداخت"), note: cleanText(payload.note, 300), createdAt: new Date().toISOString() } satisfies StoredLoanPayment);''',
'''transaction.objectStore("loanPayments").add({ loanId, installmentId, amount, paymentDate: cleanIsoDate(payload.paymentDate, "تاریخ پرداخت"), note: cleanText(payload.note, 300), createdAt: new Date().toISOString(), receipt: cleanReceipt(payload.receipt) } satisfies StoredLoanPayment);''', "loan payment receipt save")
s = replace_once(s,
'''transaction.objectStore("settlements").add({ groupId, fromPersonId, toPersonId, amount, settlementDate: cleanText(payload.settlementDate, 10) || new Date().toISOString().slice(0, 10), note: cleanText(payload.note, 300), createdAt: new Date().toISOString() } satisfies StoredSettlement);''',
'''transaction.objectStore("settlements").add({ groupId, fromPersonId, toPersonId, amount, settlementDate: cleanText(payload.settlementDate, 10) || new Date().toISOString().slice(0, 10), note: cleanText(payload.note, 300), createdAt: new Date().toISOString(), receipt: cleanReceipt(payload.receipt) } satisfies StoredSettlement);''', "settlement receipt save")
p.write_text(s, encoding="utf-8")

# --- FinanceApp.tsx ---
p = Path("app/FinanceApp.tsx")
s = p.read_text(encoding="utf-8")
s = replace_once(s,
'''  type PersonAccount,
  type SettlementSuggestion,
} from "./local-db";''',
'''  type PersonAccount,
  type ReceiptAttachment,
  type SettlementSuggestion,
} from "./local-db";''', "import receipt type")
s = replace_once(s,
'''  const [dueRange, setDueRange] = useState<"current" | "next" | "all">("current");''',
'''  const [dueRange, setDueRange] = useState<"overdue" | "current" | "next" | "all">("current");''', "overdue due range state")
s = replace_once(s,
'''  const rangeDueItems = dueItems.filter((item) => {
    if (dueRange === "all") return true;
    const monthKey = normalizeDigits(isoToJalaliInput(item.date)).slice(0, 7);
    return monthKey === (dueRange === "current" ? currentMonthKey : nextMonthKey);
  });
  const completedDueCount''',
'''  const overdueDueCount = dueItems.filter((item) => item.overdue).length;
  const rangeDueItems = dueItems.filter((item) => {
    if (dueRange === "all") return true;
    if (dueRange === "overdue") return item.overdue;
    const monthKey = normalizeDigits(isoToJalaliInput(item.date)).slice(0, 7);
    return monthKey === (dueRange === "current" ? currentMonthKey : nextMonthKey);
  });
  const completedDueCount''', "overdue due filtering")
helper_anchor = '''function balanceLabel(value: number) {
  if (value === 0) return "تسویه";
  return value > 0 ? `${money(value)} طلبکارم` : `${money(-value)} بدهکارم`;
}
'''
helper_new = helper_anchor + '''
async function receiptFromFormData(form: FormData): Promise<ReceiptAttachment | null> {
  const value = form.get("receipt");
  if (!(value instanceof File) || value.size === 0) return null;
  if (!(value.type.startsWith("image/") || value.type === "application/pdf")) throw new Error("رسید باید عکس یا فایل PDF باشد.");
  if (value.size > 5_000_000) throw new Error("حجم رسید باید کمتر از ۵ مگابایت باشد.");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("خواندن فایل رسید انجام نشد."));
    reader.readAsDataURL(value);
  });
  return { fileName: value.name || "receipt", mimeType: value.type, size: value.size, dataUrl };
}

async function shareReceipt(receipt: ReceiptAttachment, title = "رسید پرداخت") {
  try {
    const blob = await (await fetch(receipt.dataUrl)).blob();
    const file = new File([blob], receipt.fileName || "receipt", { type: receipt.mimeType });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title, files: [file] });
      return;
    }
    const anchor = document.createElement("a");
    anchor.href = receipt.dataUrl;
    anchor.download = receipt.fileName || "receipt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    throw error;
  }
}
'''
s = replace_once(s, helper_anchor, helper_new, "receipt client helpers")
s = replace_once(s, '  function submitLoanPayment(event: FormEvent<HTMLFormElement>) {', '  async function submitLoanPayment(event: FormEvent<HTMLFormElement>) {', "async loan payment")
s = replace_once(s,
'''    const form = new FormData(event.currentTarget);
    let paymentDate: string;
    try {
      paymentDate = jalaliInputToIso(String(form.get("paymentDate") ?? ""), true) as string;
    } catch (dateError) {''',
'''    const form = new FormData(event.currentTarget);
    let paymentDate: string;
    let receipt: ReceiptAttachment | null;
    try {
      paymentDate = jalaliInputToIso(String(form.get("paymentDate") ?? ""), true) as string;
      receipt = await receiptFromFormData(form);
    } catch (dateError) {''', "loan receipt parse")
s = replace_once(s,
'''    void post({ operation: "add_loan_payment", loanId: paymentLoan.id, installmentId: paymentInstallment.id, amount: form.get("amount"), paymentDate, note: form.get("note") });''',
'''    await post({ operation: "add_loan_payment", loanId: paymentLoan.id, installmentId: paymentInstallment.id, amount: form.get("amount"), paymentDate, note: form.get("note"), receipt });''', "loan receipt submit")
s = replace_once(s, '  function submitExpense(event: FormEvent<HTMLFormElement>, splits: Array<{ personId: number; shareWeight: number }>) {', '  async function submitExpense(event: FormEvent<HTMLFormElement>, splits: Array<{ personId: number; shareWeight: number }>) {', "async expense")
s = replace_once(s,
'''    let expenseDate: string;
    try {
      expenseDate = jalaliInputToIso(String(form.get("expenseDate") ?? ""), true) as string;
    } catch (dateError) {''',
'''    let expenseDate: string;
    let receipt: ReceiptAttachment | null;
    try {
      expenseDate = jalaliInputToIso(String(form.get("expenseDate") ?? ""), true) as string;
      receipt = await receiptFromFormData(form);
    } catch (dateError) {''', "expense receipt parse")
s = replace_once(s,
'''    void post({ operation: editingExpense ? "update_expense" : "add_expense", id: editingExpense?.expense.id, groupId, payerPersonId: form.get("payerPersonId"), title: form.get("title"), amount: form.get("amount"), expenseDate, splits });''',
'''    await post({ operation: editingExpense ? "update_expense" : "add_expense", id: editingExpense?.expense.id, groupId, payerPersonId: form.get("payerPersonId"), title: form.get("title"), amount: form.get("amount"), expenseDate, splits, receipt });''', "expense receipt submit")
s = replace_once(s, '  function submitSettlement(event: FormEvent<HTMLFormElement>) {', '  async function submitSettlement(event: FormEvent<HTMLFormElement>) {', "async settlement")
s = replace_once(s,
'''    let settlementDate: string;
    try {
      settlementDate = jalaliInputToIso(String(form.get("settlementDate") ?? ""), true) as string;
    } catch (dateError) {''',
'''    let settlementDate: string;
    let receipt: ReceiptAttachment | null;
    try {
      settlementDate = jalaliInputToIso(String(form.get("settlementDate") ?? ""), true) as string;
      receipt = await receiptFromFormData(form);
    } catch (dateError) {''', "settlement receipt parse")
s = replace_once(s,
'''    void post({ operation: "add_settlement", groupId: form.get("groupId"), fromPersonId: form.get("fromPersonId"), toPersonId: form.get("toPersonId"), amount: form.get("amount"), settlementDate, note: form.get("note") });''',
'''    await post({ operation: "add_settlement", groupId: form.get("groupId"), fromPersonId: form.get("fromPersonId"), toPersonId: form.get("toPersonId"), amount: form.get("amount"), settlementDate, note: form.get("note"), receipt });''', "settlement receipt submit")
s = replace_once(s,
'''                  <button className={dueRange === "current" ? "active" : ""} onClick={() => setDueRange("current")}><strong>این ماه</strong><small>{jalaliMonthName(currentJalaliMonth.jm)}</small></button>
                  <button className={dueRange === "next" ? "active" : ""} onClick={() => setDueRange("next")}><strong>ماه بعد</strong><small>{jalaliMonthName(nextJalaliMonth.jm)}</small></button>
                  <button className={dueRange === "all" ? "active" : ""} onClick={() => setDueRange("all")}><strong>همه</strong><small>کل سررسیدها</small></button>''',
'''                  <button className={`overdue-filter ${dueRange === "overdue" ? "active" : ""}`} onClick={() => setDueRange("overdue")}><strong>عقب‌افتاده</strong><small>{number.format(overdueDueCount)} مورد</small></button>
                  <button className={dueRange === "current" ? "active" : ""} onClick={() => setDueRange("current")}><strong>این ماه</strong><small>{jalaliMonthName(currentJalaliMonth.jm)}</small></button>
                  <button className={dueRange === "next" ? "active" : ""} onClick={() => setDueRange("next")}><strong>ماه بعد</strong><small>{jalaliMonthName(nextJalaliMonth.jm)}</small></button>
                  <button className={dueRange === "all" ? "active" : ""} onClick={() => setDueRange("all")}><strong>همه</strong><small>کل سررسیدها</small></button>''', "overdue due button")
s = replace_once(s,
'''    <JalaliDatePicker name="expenseDate" label="تاریخ خرید شمسی" defaultToday={!initialExpense} required initialValue={initialExpense ? isoToJalaliInput(initialExpense.expenseDate) : ""} />
    {selectedGroup &&''',
'''    <JalaliDatePicker name="expenseDate" label="تاریخ خرید شمسی" defaultToday={!initialExpense} required initialValue={initialExpense ? isoToJalaliInput(initialExpense.expenseDate) : ""} />
    <ReceiptField label="رسید خرید" initialReceipt={initialExpense?.receipt} />
    {selectedGroup &&''', "expense receipt field")
s = replace_once(s,
'''    <label>یادداشت <small>(اختیاری)</small><textarea name="note" rows={2} placeholder="مثلاً پرداخت اینترنتی، شماره پیگیری..." /></label>
    <p className="form-hint">پرداخت جزئی هم مجاز است.''',
'''    <label>یادداشت <small>(اختیاری)</small><textarea name="note" rows={2} placeholder="مثلاً پرداخت اینترنتی، شماره پیگیری..." /></label>
    <ReceiptField label="رسید پرداخت" />
    <p className="form-hint">پرداخت جزئی هم مجاز است.''', "loan payment receipt field")
s = replace_once(s,
'''    <label>یادداشت <small>(اختیاری)</small><textarea name="note" rows={2} placeholder="مثلاً کارت‌به‌کارت" /></label>
    <SubmitButton busy={busy} label="ثبت تسویه واقعی" />''',
'''    <label>یادداشت <small>(اختیاری)</small><textarea name="note" rows={2} placeholder="مثلاً کارت‌به‌کارت" /></label>
    <ReceiptField label="رسید تسویه" />
    <p className="form-hint">این پرداخت در تاریخچه همین گروه می‌ماند؛ حتی اگر هیچ‌کدام از دو طرف «من» نباشند.</p>
    <SubmitButton busy={busy} label="ثبت تسویه واقعی" />''', "settlement receipt field")
old_settlement_history = '''    {group.settlements.length > 0 && <details className="settlement-history"><summary><span><Icon name="settlement" size={15} />تسویه‌های ثبت‌شده</span><b>{number.format(group.settlements.length)} مورد</b></summary><div>{group.settlements.map((settlement) => <article key={settlement.id}><span className="transaction-icon"><Icon name="settlement" size={15} /></span><div><strong>{settlement.fromName} ← {settlement.toName}</strong><small>{persianDate(settlement.settlementDate)}{settlement.note ? ` • ${settlement.note}` : ""}</small></div><b>{money(settlement.amount)}</b><button onClick={() => onDeleteSettlement(settlement.id)} aria-label="حذف تسویه"><Icon name="trash" size={13} /></button></article>)}</div></details>}'''
new_settlement_history = '''    {group.settlements.length > 0 && <details className="settlement-history" open><summary><span><Icon name="settlement" size={15} />تاریخچه تسویه‌ها</span><b>{number.format(group.settlements.length)} مورد</b></summary><div>{group.settlements.map((settlement) => <article key={settlement.id}><span className="transaction-icon"><Icon name="settlement" size={15} /></span><div><strong>{settlement.fromName} به {settlement.toName} پرداخت کرد</strong><small>{persianDate(settlement.settlementDate)}{settlement.note ? ` • ${settlement.note}` : ""}</small></div><b>{money(settlement.amount)}</b><span className="receipt-row-actions">{settlement.receipt && <button className="receipt-share" onClick={() => void shareReceipt(settlement.receipt as ReceiptAttachment, `رسید تسویه ${group.name}`)}><Icon name="upload" size={12} /> ارسال رسید</button>}<button onClick={() => onDeleteSettlement(settlement.id)} aria-label="حذف تسویه"><Icon name="trash" size={13} /></button></span></article>)}</div></details>}'''
s = replace_once(s, old_settlement_history, new_settlement_history, "visible settlement history")
s = replace_once(s,
'''<span className="transaction-actions"><button onClick={() => onEditExpense(expense)} aria-label="ویرایش خرید"><Icon name="edit" size={13} /></button><button onClick={() => onDeleteExpense(expense)} aria-label="حذف خرید"><Icon name="trash" size={13} /></button></span>''',
'''<span className="transaction-actions">{expense.receipt && <button className="receipt-share icon-only" onClick={() => void shareReceipt(expense.receipt as ReceiptAttachment, `رسید ${expense.title}`)} aria-label="ارسال رسید خرید"><Icon name="upload" size={13} /></button>}<button onClick={() => onEditExpense(expense)} aria-label="ویرایش خرید"><Icon name="edit" size={13} /></button><button onClick={() => onDeleteExpense(expense)} aria-label="حذف خرید"><Icon name="trash" size={13} /></button></span>''', "expense receipt share")
s = replace_once(s,
'''<b>{money(payment.amount)}</b><button onClick={() => onDeletePayment(payment.id)} aria-label="حذف پرداخت"><Icon name="trash" size={11} /></button>''',
'''<b>{money(payment.amount)}</b>{payment.receipt && <button className="receipt-share icon-only" onClick={() => void shareReceipt(payment.receipt as ReceiptAttachment, `رسید قسط ${loan.title}`)} aria-label="ارسال رسید پرداخت"><Icon name="upload" size={11} /></button>}<button onClick={() => onDeletePayment(payment.id)} aria-label="حذف پرداخت"><Icon name="trash" size={11} /></button>''', "loan receipt share")
anchor = '''function MoneyInput({ name, label, required = false, defaultValue, placeholder, onValueChange }: { name: string; label: string; required?: boolean; defaultValue?: number; placeholder?: string; onValueChange?: (value: number) => void }) {'''
receipt_component = '''function ReceiptField({ label, initialReceipt }: { label: string; initialReceipt?: ReceiptAttachment | null }) {
  return <label className="receipt-field"><span>{label} <small>(اختیاری)</small></span><input name="receipt" type="file" accept="image/*,application/pdf" /><small>{initialReceipt ? `رسید فعلی: ${initialReceipt.fileName} • انتخاب فایل جدید جایگزینش می‌کند` : "عکس یا PDF تا ۵ مگابایت • روی همین دستگاه ذخیره می‌شود"}</small></label>;
}

''' + anchor
s = replace_once(s, anchor, receipt_component, "receipt field component")
p.write_text(s, encoding="utf-8")

# --- globals.css ---
p = Path("app/globals.css")
s = p.read_text(encoding="utf-8")
s += '''

/* v14 — overdue due filter, visible settlement history and local receipts */
.due-range-filter { overflow-x: auto; scrollbar-width: none; }
.due-range-filter::-webkit-scrollbar { display: none; }
.due-range-filter .overdue-filter.active { border-color: #d9a89c; color: var(--coral); background: var(--coral-soft); }
.receipt-field { margin-bottom: 12px; padding: 10px 11px; border: 1px dashed #cfc8bb; border-radius: 13px; background: #faf8f2; }
.receipt-field > span { display: block; margin-bottom: 7px; font-size: 8px; font-weight: 900; }
.receipt-field input[type="file"] { width: 100%; min-height: 38px; padding: 7px; border: 1px solid #ddd7cc; border-radius: 10px; background: var(--surface); }
.receipt-field > small { display: block; margin-top: 6px; color: var(--muted); font-size: 6.5px; line-height: 1.7; }
.receipt-row-actions { display: inline-flex; align-items: center; gap: 5px; }
.receipt-share { min-height: 27px; border: 0; border-radius: 8px; padding: 5px 7px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; color: var(--green); background: var(--green-soft); font-size: 6.5px; font-weight: 900; cursor: pointer; white-space: nowrap; }
.receipt-share.icon-only { width: 28px; min-width: 28px; padding: 0; }
.settlement-history[open] { border-color: #d9e3dc; background: #fbfdfb; }
.settlement-history article { grid-template-columns: 30px minmax(0,1fr) auto auto; }
@media (max-width: 390px) {
  .due-range-filter button { flex: 0 0 88px; }
  .settlement-history article { grid-template-columns: 28px minmax(0,1fr) auto; }
  .settlement-history article > b { grid-column: 2; }
  .settlement-history .receipt-row-actions { grid-column: 3; grid-row: 1 / span 2; }
}
'''
p.write_text(s, encoding="utf-8")

# --- service worker ---
p = Path("public/sw.js")
s = p.read_text(encoding="utf-8")
s = replace_once(s, 'daftar-hesab-offline-v11', 'daftar-hesab-offline-v12', "service worker v12")
p.write_text(s, encoding="utf-8")

# --- regression tests ---
p = Path("tests/rendered-html.test.mjs")
s = p.read_text(encoding="utf-8")
s = s.replace('daftar-hesab-offline-v11', 'daftar-hesab-offline-v12')
s += r'''

test("filters overdue due items separately from current and next Jalali months", async () => {
  const app = await readFile(new URL("app/FinanceApp.tsx", root), "utf8");
  assert.match(app, /useState<"overdue" \| "current" \| "next" \| "all">\("current"\)/);
  assert.match(app, /dueRange === "overdue"/);
  assert.match(app, /return item\.overdue/);
  assert.match(app, /عقب‌افتاده/);
  assert.match(app, /overdueDueCount/);
});

test("keeps dong settlements visible and stores shareable local receipts for real payments", async () => {
  const [app, localDb, css, serviceWorker] = await Promise.all([
    readFile(new URL("app/FinanceApp.tsx", root), "utf8"),
    readFile(new URL("app/local-db.ts", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("public/sw.js", root), "utf8"),
  ]);
  assert.match(localDb, /export type ReceiptAttachment/);
  assert.match(localDb, /receipt: ReceiptAttachment \| null/);
  assert.match(localDb, /cleanReceipt\(payload\.receipt\)/);
  assert.match(localDb, /receipt: settlement\.receipt \?\? null/);
  assert.match(app, /function ReceiptField/);
  assert.match(app, /async function shareReceipt/);
  assert.match(app, /name="receipt" type="file"/);
  assert.match(app, /className="settlement-history" open/);
  assert.match(app, /تاریخچه تسویه‌ها/);
  assert.match(app, /ارسال رسید/);
  assert.match(app, /رسید پرداخت/);
  assert.match(app, /رسید خرید/);
  assert.match(css, /\.receipt-field/);
  assert.match(serviceWorker, /daftar-hesab-offline-v12/);
});
'''
p.write_text(s, encoding="utf-8")
