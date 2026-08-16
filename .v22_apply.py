from pathlib import Path

p = Path('app/FinanceApp.tsx')
text = p.read_text(encoding='utf-8')

old = '''function AttachmentField({ label, initialAttachment }: { label: string; initialAttachment?: ReceiptAttachment | null }) {
  return <label className="receipt-field attachment-field"><span>{label} <small>(اختیاری)</small></span><input name="receipt" type="file" accept="image/*,application/pdf" /><small>{initialAttachment ? `پیوست فعلی: ${initialAttachment.fileName} • انتخاب فایل جدید جایگزینش می‌کند` : "عکس یا PDF تا ۵ مگابایت • روی همین دستگاه ذخیره می‌شود"}</small></label>;
}'''
new = '''function AttachmentField({ label, initialAttachment }: { label: string; initialAttachment?: ReceiptAttachment | null }) {
  const [removeExisting, setRemoveExisting] = useState(false);
  return <div className="receipt-field attachment-field">
    <label><span>{label} <small>(اختیاری)</small></span><input name="receipt" type="file" accept="image/*,application/pdf" /></label>
    <input type="hidden" name="removeReceipt" value={removeExisting ? "1" : "0"} />
    {initialAttachment && <div className={`attachment-edit-current${removeExisting ? " pending-removal" : ""}`}><div><Icon name="receipt" size={15} /><span><strong>{initialAttachment.fileName}</strong><small>{removeExisting ? "با ذخیره تغییرات، این پیوست حذف می‌شود" : "پیوست فعلی • انتخاب فایل جدید جایگزینش می‌کند"}</small></span></div><button type="button" className={removeExisting ? "undo" : "danger-soft"} onClick={() => setRemoveExisting((value) => !value)}>{removeExisting ? "لغو حذف" : "حذف پیوست"}</button></div>}
    {!initialAttachment && <small>عکس یا PDF تا ۵ مگابایت • روی همین دستگاه ذخیره می‌شود</small>}
  </div>;
}'''
if old not in text: raise SystemExit('AttachmentField source not found')
text = text.replace(old, new)

text = text.replace('title: form.get("title"), amount: form.get("amount"), dueDate, note: form.get("note"), receipt: attachment,', 'title: form.get("title"), amount: form.get("amount"), dueDate, note: form.get("note"), receipt: attachment, removeReceipt: form.get("removeReceipt"),')
text = text.replace('countInBalance: form.get("countInBalance"), sayadStatus: form.get("sayadStatus"), status: form.get("status"), note: form.get("note"), receipt: attachment,', 'countInBalance: form.get("countInBalance"), sayadStatus: form.get("sayadStatus"), status: form.get("status"), note: form.get("note"), receipt: attachment, removeReceipt: form.get("removeReceipt"),')
text = text.replace('payerPersonId: form.get("payerPersonId"), title: form.get("title"), amount: form.get("amount"), expenseDate, splits, receipt });', 'payerPersonId: form.get("payerPersonId"), title: form.get("title"), amount: form.get("amount"), expenseDate, splits, receipt, removeReceipt: form.get("removeReceipt") });')

anchor = '''  function deleteCheck(check: CheckRecord) {
    if (window.confirm(`چک ${check.direction === "received" ? "دریافتی" : "پرداختی"} «${check.purpose}» حذف شود؟`)) void post({ operation: "delete_check", id: check.id }, { close: false });
  }
'''
if anchor not in text: raise SystemExit('deleteCheck anchor missing')
text = text.replace(anchor, anchor + '''\n  function removeTransactionAttachment(target: TransactionDetailTarget) {
    if (!window.confirm("پیوست این تراکنش حذف شود؟ خود تراکنش و اطلاعات مالی آن دست‌نخورده می‌ماند.")) return;
    const payload: Record<string, unknown> = { operation: "remove_attachment", targetKind: target.kind };
    if ("id" in target) payload.id = target.id;
    if (target.kind === "loan-payment") payload.id = target.paymentId;
    void post(payload, { close: false });
  }
''')

old_sig = 'function TransactionDetailShell({ category, title, amount, tone, date, status, receipt, attachment, onClose, children, actions }: { category: string; title: string; amount: number; tone: "positive" | "negative" | "neutral"; date: string; status: string; receipt: TransactionReceiptData; attachment?: ReceiptAttachment | null; onClose: () => void; children: ReactNode; actions?: ReactNode }) {'
new_sig = 'function TransactionDetailShell({ category, title, amount, tone, date, status, receipt, attachment, onRemoveAttachment, onClose, children, actions }: { category: string; title: string; amount: number; tone: "positive" | "negative" | "neutral"; date: string; status: string; receipt: TransactionReceiptData; attachment?: ReceiptAttachment | null; onRemoveAttachment?: () => void; onClose: () => void; children: ReactNode; actions?: ReactNode }) {'
if old_sig not in text: raise SystemExit('detail shell signature missing')
text = text.replace(old_sig, new_sig)
text = text.replace('<div className="evidence-actions"><button type="button" onClick={() => void shareAttachment(attachment, `پیوست ${title}`)}><Icon name="upload" size={14} /> ارسال فایل اصلی</button></div>', '<div className="evidence-actions"><button type="button" onClick={() => void shareAttachment(attachment, `پیوست ${title}`)}><Icon name="upload" size={14} /> ارسال فایل اصلی</button>{onRemoveAttachment && <button type="button" className="danger-soft" onClick={onRemoveAttachment}><Icon name="trash" size={14} /> حذف پیوست</button>}</div>')

old_page = 'function TransactionDetailPage({ data, target, onClose, onOpenDetail, onEditEntry, onDeleteEntry, onToggleEntry, onEditCheck, onDeleteCheck, onCheckStatus, onTransferCheck, onReturnCheck, onEditExpense, onDeleteExpense, onDeleteSettlement, onAddLoanPayment, onDeleteLoanPayment }: { data: FinanceData; target: TransactionDetailTarget; onClose: () => void; onOpenDetail: (target: TransactionDetailTarget) => void;'
new_page = 'function TransactionDetailPage({ data, target, onClose, onOpenDetail, onRemoveAttachment, onEditEntry, onDeleteEntry, onToggleEntry, onEditCheck, onDeleteCheck, onCheckStatus, onTransferCheck, onReturnCheck, onEditExpense, onDeleteExpense, onDeleteSettlement, onAddLoanPayment, onDeleteLoanPayment }: { data: FinanceData; target: TransactionDetailTarget; onClose: () => void; onOpenDetail: (target: TransactionDetailTarget) => void; onRemoveAttachment: (target: TransactionDetailTarget) => void;'
if old_page not in text: raise SystemExit('detail page signature missing')
text = text.replace(old_page, new_page)
for source in ['entry.receipt','check.receipt','expense.receipt','settlement.receipt','payment.receipt']:
    text = text.replace(f' attachment={{{source}}} onClose=', f' attachment={{{source}}} onRemoveAttachment={{() => onRemoveAttachment(target)}} onClose=')
text = text.replace('onOpenDetail={openTransactionDetail} onEditEntry=', 'onOpenDetail={openTransactionDetail} onRemoveAttachment={removeTransactionAttachment} onEditEntry=')
p.write_text(text, encoding='utf-8')

p = Path('app/local-db.ts')
text = p.read_text(encoding='utf-8')
text = text.replace('const receipt = payload.receipt ? cleanReceipt(payload.receipt) : null;\n    const transaction = db.transaction("entries", "readwrite");', 'const receipt = payload.receipt ? cleanReceipt(payload.receipt) : null;\n    const removeReceipt = payload.removeReceipt === true || String(payload.removeReceipt) === "1";\n    const transaction = db.transaction("entries", "readwrite");', 1)
text = text.replace('receipt: receipt ?? current.receipt ?? null, role: "obligation"', 'receipt: receipt ?? (removeReceipt ? null : current.receipt ?? null), role: "obligation"')
text = text.replace('const receipt = payload.receipt ? cleanReceipt(payload.receipt) : currentCheck?.receipt ?? null;', 'const removeReceipt = payload.removeReceipt === true || String(payload.removeReceipt) === "1";\n    const receipt = payload.receipt ? cleanReceipt(payload.receipt) : removeReceipt ? null : currentCheck?.receipt ?? null;')
text = text.replace('const receipt = payload.receipt ? cleanReceipt(payload.receipt) : existingReceipt;', 'const removeReceipt = payload.removeReceipt === true || String(payload.removeReceipt) === "1";\n    const receipt = payload.receipt ? cleanReceipt(payload.receipt) : removeReceipt ? null : existingReceipt;')
marker = '  if (operation === "delete_person") {'
if marker not in text: raise SystemExit('remove operation marker missing')
text = text.replace(marker, '''  if (operation === "remove_attachment") {
    const targetKind = cleanText(payload.targetKind, 30);
    const id = positiveInteger(payload.id, "شناسه تراکنش");
    const storeName = targetKind === "entry" ? "entries"
      : targetKind === "check" ? "checks"
      : targetKind === "expense" ? "expenses"
      : targetKind === "settlement" ? "settlements"
      : targetKind === "loan-payment" ? "loanPayments"
      : null;
    if (!storeName) throw new Error("این نوع تراکنش پیوست مستقلی برای حذف ندارد.");
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const current = await requestResult(store.get(id)) as (Record<string, unknown> & { id: number }) | undefined;
    if (!current) throw new Error("تراکنش موردنظر پیدا نشد.");
    store.put({ ...current, id, receipt: null });
    await transactionDone(transaction);
    return;
  }

''' + marker)
p.write_text(text, encoding='utf-8')

p = Path('app/globals.css')
css = p.read_text(encoding='utf-8') + '''\n\n/* v22 — explicit attachment removal in edit/detail views */\n.attachment-edit-current { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 11px; border:1px solid #e7e1d8; border-radius:13px; background:#fff; }\n.attachment-edit-current > div { min-width:0; display:flex; align-items:center; gap:8px; }\n.attachment-edit-current > div > span { min-width:0; display:flex; flex-direction:column; gap:2px; }\n.attachment-edit-current strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:8px; }\n.attachment-edit-current small { color:var(--muted); font-size:6.5px; }\n.attachment-edit-current button { flex:0 0 auto; min-height:34px; padding:6px 9px; border-radius:10px; font-size:7px; }\n.attachment-edit-current.pending-removal { border-color:#edd4ce; background:#fff8f6; opacity:.82; }\n.attachment-edit-current button.undo { color:var(--green); background:var(--green-soft); border:1px solid #d7e5dc; }\n.evidence-actions { display:flex; gap:8px; }\n.evidence-actions > button { flex:1 1 0; }\n'''
p.write_text(css, encoding='utf-8')

p = Path('public/sw.js')
sw = p.read_text(encoding='utf-8').replace('daftar-hesab-offline-v18', 'daftar-hesab-offline-v19')
p.write_text(sw, encoding='utf-8')

p = Path('tests/rendered-html.test.mjs')
t = p.read_text(encoding='utf-8').replace('daftar-hesab-offline-v18', 'daftar-hesab-offline-v19')
t += '''\n\ntest("allows existing transaction attachments to be removed from edit and detail views", async () => {\n  const [app, localDb, css, serviceWorker] = await Promise.all([\n    readFile(new URL("app/FinanceApp.tsx", root), "utf8"),\n    readFile(new URL("app/local-db.ts", root), "utf8"),\n    readFile(new URL("app/globals.css", root), "utf8"),\n    readFile(new URL("public/sw.js", root), "utf8"),\n  ]);\n  assert.match(app, /name="removeReceipt"/);\n  assert.match(app, /حذف پیوست/);\n  assert.match(app, /لغو حذف/);\n  assert.match(app, /removeTransactionAttachment/);\n  assert.match(app, /onRemoveAttachment=\{removeTransactionAttachment\}/);\n  assert.match(localDb, /operation === "remove_attachment"/);\n  assert.match(localDb, /targetKind === "loan-payment" \? "loanPayments"/);\n  assert.match(localDb, /removeReceipt \? null/);\n  assert.match(css, /\.attachment-edit-current/);\n  assert.match(serviceWorker, /daftar-hesab-offline-v19/);\n});\n'''
p.write_text(t, encoding='utf-8')
