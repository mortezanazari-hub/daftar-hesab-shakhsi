from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing pattern: {label}")
    return text.replace(old, new, 1)


def replace_between(text: str, start_marker: str, end_marker: str, replacement: str, label: str) -> str:
    start = text.find(start_marker)
    if start < 0:
        raise SystemExit(f"missing start marker: {label}")
    end = text.find(end_marker, start)
    if end < 0:
        raise SystemExit(f"missing end marker: {label}")
    return text[:start] + replacement + text[end:]

# -----------------------------------------------------------------------------
# transaction-share.ts — generated app receipt + attachment sharing
# -----------------------------------------------------------------------------
Path("app/transaction-share.ts").write_text(r'''import type { ReceiptAttachment } from "./local-db";

export type TransactionReceiptData = {
  reference: string;
  category: string;
  title: string;
  amount: number;
  date: string;
  status: string;
  direction?: "positive" | "negative" | "neutral";
  fields: Array<{ label: string; value: string }>;
  note?: string;
};

const number = new Intl.NumberFormat("fa-IR");
const money = (value: number) => `${number.format(value)} تومان`;

export async function attachmentFromFormData(form: FormData): Promise<ReceiptAttachment | null> {
  const value = form.get("receipt");
  if (!(value instanceof File) || value.size === 0) return null;
  if (!(value.type.startsWith("image/") || value.type === "application/pdf")) throw new Error("پیوست باید عکس یا فایل PDF باشد.");
  if (value.size > 5_000_000) throw new Error("حجم پیوست باید کمتر از ۵ مگابایت باشد.");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("خواندن فایل پیوست انجام نشد."));
    reader.readAsDataURL(value);
  });
  return { fileName: value.name || "attachment", mimeType: value.type, size: value.size, dataUrl };
}

export async function shareAttachment(attachment: ReceiptAttachment, title = "پیوست تراکنش") {
  try {
    const blob = await (await fetch(attachment.dataUrl)).blob();
    const file = new File([blob], attachment.fileName || "attachment", { type: attachment.mimeType });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title, files: [file] });
      return;
    }
    const anchor = document.createElement("a");
    anchor.href = attachment.dataUrl;
    anchor.download = attachment.fileName || "attachment";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    throw error;
  }
}

function receiptText(data: TransactionReceiptData) {
  const lines = [
    "دفتر حساب شخصی",
    `${data.category} • ${data.reference}`,
    data.title,
    `مبلغ: ${money(data.amount)}`,
    `تاریخ: ${data.date}`,
    `وضعیت: ${data.status}`,
    ...data.fields.filter((item) => item.value).map((item) => `${item.label}: ${item.value}`),
  ];
  if (data.note) lines.push(`یادداشت: ${data.note}`);
  lines.push("این رسید از اطلاعات ثبت‌شده در دفتر حساب شخصی ساخته شده و جایگزین رسید بانکی نیست.");
  return lines.join("\n");
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawWrapped(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 2) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    } else {
      line = next;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  lines.forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}

async function buildReceiptImage(data: TransactionReceiptData) {
  if ("fonts" in document) await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("ساخت تصویر رسید در این مرورگر ممکن نیست.");
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.fillStyle = "#f3f0e8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  roundedRect(ctx, 70, 60, 940, 1230, 42);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  ctx.fillStyle = "#315d4c";
  ctx.font = "700 34px Vazirmatn, sans-serif";
  ctx.fillText("دفتر حساب شخصی", 930, 135);
  ctx.fillStyle = "#8a867f";
  ctx.font = "500 25px Vazirmatn, sans-serif";
  ctx.fillText(`رسید تراکنش • ${data.reference}`, 930, 180);

  ctx.fillStyle = "#1d2a25";
  ctx.font = "800 34px Vazirmatn, sans-serif";
  ctx.fillText(data.category, 930, 260);
  ctx.font = "800 48px Vazirmatn, sans-serif";
  let y = drawWrapped(ctx, data.title, 930, 330, 800, 62, 2) + 24;

  ctx.fillStyle = data.direction === "positive" ? "#2e725b" : data.direction === "negative" ? "#b85d4c" : "#1d2a25";
  ctx.font = "900 62px Vazirmatn, sans-serif";
  ctx.fillText(money(data.amount), 930, y);
  y += 78;

  ctx.fillStyle = "#f6f4ee";
  roundedRect(ctx, 120, y, 840, 94, 24);
  ctx.fill();
  ctx.fillStyle = "#6b6861";
  ctx.font = "600 25px Vazirmatn, sans-serif";
  ctx.fillText(data.date, 900, y + 58);
  ctx.textAlign = "left";
  ctx.fillStyle = "#315d4c";
  ctx.fillText(data.status, 180, y + 58);
  ctx.textAlign = "right";
  y += 130;

  ctx.font = "600 27px Vazirmatn, sans-serif";
  for (const field of data.fields.filter((item) => item.value).slice(0, 7)) {
    ctx.fillStyle = "#918d84";
    ctx.fillText(field.label, 930, y);
    ctx.fillStyle = "#252f2b";
    ctx.font = "700 29px Vazirmatn, sans-serif";
    y = drawWrapped(ctx, field.value, 930, y + 38, 760, 38, 2) + 30;
    ctx.font = "600 27px Vazirmatn, sans-serif";
    ctx.strokeStyle = "#ece8de";
    ctx.beginPath();
    ctx.moveTo(150, y - 12);
    ctx.lineTo(930, y - 12);
    ctx.stroke();
  }

  if (data.note && y < 1130) {
    ctx.fillStyle = "#918d84";
    ctx.font = "600 25px Vazirmatn, sans-serif";
    ctx.fillText("یادداشت", 930, y);
    ctx.fillStyle = "#4f514d";
    ctx.font = "600 26px Vazirmatn, sans-serif";
    drawWrapped(ctx, data.note, 930, y + 38, 760, 36, 2);
  }

  ctx.fillStyle = "#8b877f";
  ctx.font = "500 20px Vazirmatn, sans-serif";
  ctx.fillText("ساخته‌شده از اطلاعات ثبت‌شده در برنامه؛ جایگزین رسید بانکی نیست.", 930, 1235);
  ctx.fillText("daftar-hesab-shakhsi", 930, 1270);

  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("ساخت فایل رسید انجام نشد.")), "image/png", 0.94));
}

export async function shareTransactionReceipt(data: TransactionReceiptData) {
  const text = receiptText(data);
  try {
    const blob = await buildReceiptImage(data);
    const safeRef = data.reference.replace(/[^a-zA-Z0-9-_]/g, "-");
    const file = new File([blob], `daftar-receipt-${safeRef}.png`, { type: "image/png" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: `رسید ${data.category}`, text, files: [file] });
      return;
    }
    if (navigator.share) {
      await navigator.share({ title: `رسید ${data.category}`, text });
      return;
    }
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    throw error;
  }
}
''', encoding="utf-8")

# -----------------------------------------------------------------------------
# local-db.ts — attachments for direct entries and cheques
# -----------------------------------------------------------------------------
p = Path("app/local-db.ts")
s = p.read_text(encoding="utf-8")
s = replace_once(s,
'''export type Entry = { id: number; personId: number; personName: string; kind: string; direction: string; title: string; amount: number; dueDate: string | null; status: string; note: string; createdAt: string };''',
'''export type Entry = { id: number; personId: number; personName: string; kind: string; direction: string; title: string; amount: number; dueDate: string | null; status: string; note: string; createdAt: string; receipt: ReceiptAttachment | null };''', "Entry attachment")
s = replace_once(s,
'''export type CheckRecord = { id: number; direction: CheckDirection; checkType: "sayadi" | "guaranteed" | "other"; amount: number; issueDate: string | null; dueDate: string; purpose: string; sayadId: string; chequeNumber: string; bankName: string; branchName: string; issuerName: string; beneficiaryName: string; transferorName: string; relatedPersonId: number | null; counterpartyName: string; countInBalance: boolean; sayadStatus: CheckSayadStatus; status: CheckStatus; note: string; createdAt: string; currentHolderName: string; events: CheckEvent[]; overdue: boolean; financialOpen: boolean };''',
'''export type CheckRecord = { id: number; direction: CheckDirection; checkType: "sayadi" | "guaranteed" | "other"; amount: number; issueDate: string | null; dueDate: string; purpose: string; sayadId: string; chequeNumber: string; bankName: string; branchName: string; issuerName: string; beneficiaryName: string; transferorName: string; relatedPersonId: number | null; counterpartyName: string; countInBalance: boolean; sayadStatus: CheckSayadStatus; status: CheckStatus; note: string; createdAt: string; receipt: ReceiptAttachment | null; currentHolderName: string; events: CheckEvent[]; overdue: boolean; financialOpen: boolean };''', "Check attachment")
s = replace_once(s,
'''type StoredEntry = Omit<Entry, "id" | "personName"> & { id?: number };''',
'''type StoredEntry = Omit<Entry, "id" | "personName" | "receipt"> & { id?: number; receipt?: ReceiptAttachment | null };''', "StoredEntry attachment")
s = replace_once(s,
'''type StoredCheck = { id?: number; direction: CheckDirection; checkType: "sayadi" | "guaranteed" | "other"; amount: number; issueDate: string | null; dueDate: string; purpose: string; sayadId: string; chequeNumber: string; bankName: string; branchName: string; issuerName: string; beneficiaryName: string; transferorName: string; relatedPersonId: number | null; counterpartyName: string; countInBalance: boolean; sayadStatus: CheckSayadStatus; status: CheckStatus; note: string; createdAt: string; currentHolderName?: string };''',
'''type StoredCheck = { id?: number; direction: CheckDirection; checkType: "sayadi" | "guaranteed" | "other"; amount: number; issueDate: string | null; dueDate: string; purpose: string; sayadId: string; chequeNumber: string; bankName: string; branchName: string; issuerName: string; beneficiaryName: string; transferorName: string; relatedPersonId: number | null; counterpartyName: string; countInBalance: boolean; sayadStatus: CheckSayadStatus; status: CheckStatus; note: string; createdAt: string; currentHolderName?: string; receipt?: ReceiptAttachment | null };''', "StoredCheck attachment")
s = replace_once(s,
'''    .map((entry) => ({ ...entry, personName: names.get(entry.personId) ?? "نامشخص" }))''',
'''    .map((entry) => ({ ...entry, personName: names.get(entry.personId) ?? "نامشخص", receipt: entry.receipt ?? null }))''', "entry mapping attachment")
s = replace_once(s,
'''      return { ...check, currentHolderName, events, overdue: checkFinancialOpen(check.status) && check.dueDate < today, financialOpen: checkFinancialOpen(check.status) };''',
'''      return { ...check, receipt: check.receipt ?? null, currentHolderName, events, overdue: checkFinancialOpen(check.status) && check.dueDate < today, financialOpen: checkFinancialOpen(check.status) };''', "check mapping attachment")
s = replace_once(s,
'''    const id = operation === "update_entry" ? positiveInteger(payload.id, "شناسه") : null;
    const transaction = db.transaction("entries", "readwrite");''',
'''    const id = operation === "update_entry" ? positiveInteger(payload.id, "شناسه") : null;
    const receipt = payload.receipt ? cleanReceipt(payload.receipt) : null;
    const transaction = db.transaction("entries", "readwrite");''', "entry clean attachment")
s = replace_once(s,
'''      store.put({ ...current, id, personId, kind, direction, title, amount, dueDate: cleanText(payload.dueDate, 10) || null, note: cleanText(payload.note, 400) });''',
'''      store.put({ ...current, id, personId, kind, direction, title, amount, dueDate: cleanText(payload.dueDate, 10) || null, note: cleanText(payload.note, 400), receipt: receipt ?? current.receipt ?? null });''', "entry update attachment")
s = replace_once(s,
'''      store.add({ personId, kind, direction, title, amount, dueDate: cleanText(payload.dueDate, 10) || null, status: "open", note: cleanText(payload.note, 400), createdAt: new Date().toISOString() } satisfies StoredEntry);''',
'''      store.add({ personId, kind, direction, title, amount, dueDate: cleanText(payload.dueDate, 10) || null, status: "open", note: cleanText(payload.note, 400), createdAt: new Date().toISOString(), receipt } satisfies StoredEntry);''', "entry add attachment")
s = replace_once(s,
'''    const currentChecks = await all<StoredCheck & { id: number }>(db, "checks");
    if (sayadId && currentChecks.some((check) => check.sayadId === sayadId && check.id !== id)) throw new Error("این شناسه صیادی قبلاً در دفتر چک ثبت شده است.");
    const record = {''',
'''    const currentChecks = await all<StoredCheck & { id: number }>(db, "checks");
    if (sayadId && currentChecks.some((check) => check.sayadId === sayadId && check.id !== id)) throw new Error("این شناسه صیادی قبلاً در دفتر چک ثبت شده است.");
    const currentCheck = id ? currentChecks.find((check) => check.id === id) : undefined;
    const receipt = payload.receipt ? cleanReceipt(payload.receipt) : currentCheck?.receipt ?? null;
    const record = {''', "check attachment variables")
s = replace_once(s,
'''      note: cleanText(payload.note, 500), createdAt: id ? currentChecks.find((check) => check.id === id)?.createdAt ?? new Date().toISOString() : new Date().toISOString(),
      currentHolderName: id ? currentChecks.find((check) => check.id === id)?.currentHolderName || (direction === "received" ? "من" : beneficiaryName) : (direction === "received" ? "من" : beneficiaryName),
    } satisfies StoredCheck;''',
'''      note: cleanText(payload.note, 500), createdAt: currentCheck?.createdAt ?? new Date().toISOString(),
      currentHolderName: currentCheck?.currentHolderName || (direction === "received" ? "من" : beneficiaryName),
      receipt,
    } satisfies StoredCheck;''', "check record attachment")
p.write_text(s, encoding="utf-8")

# -----------------------------------------------------------------------------
# FinanceApp.tsx
# -----------------------------------------------------------------------------
p = Path("app/FinanceApp.tsx")
s = p.read_text(encoding="utf-8")
s = replace_once(s,
'''import { FormEvent, useCallback, useMemo, useRef, useState, useEffect } from "react";''',
'''import { FormEvent, type ReactNode, useCallback, useMemo, useRef, useState, useEffect } from "react";''', "ReactNode import")
s = replace_once(s,
'''  type FinanceData,
  type Group,
  type CheckRecord,
  type Loan,
  type LoanInstallment,
  type Person,''',
'''  type FinanceData,
  type Group,
  type GroupSettlement,
  type CheckRecord,
  type Loan,
  type LoanInstallment,
  type LoanPayment,
  type Person,''', "detail type imports")
s = replace_once(s,
'''} from "./local-db";

type Sheet =''',
'''} from "./local-db";
import { attachmentFromFormData, shareAttachment, shareTransactionReceipt, type TransactionReceiptData } from "./transaction-share";

type Sheet =''', "transaction share import")
s = replace_once(s,
'''type Sheet = "actions" | "person" | "entry" | "group" | "expense" | "settlement" | "person-ledger" | "loan-form" | "loan-payment" | "check-form" | "check-transfer" | "tools" | null;''',
'''type Sheet = "actions" | "person" | "entry" | "group" | "expense" | "settlement" | "person-ledger" | "loan-form" | "loan-payment" | "check-form" | "check-transfer" | "transaction-detail" | "tools" | null;''', "transaction detail sheet type")
s = replace_once(s,
'''type SettlementDraft = { groupId: number; fromPersonId?: number; toPersonId?: number; amount?: number };
type DueItem =''',
'''type SettlementDraft = { groupId: number; fromPersonId?: number; toPersonId?: number; amount?: number };
type TransactionDetailTarget =
  | { kind: "entry"; id: number }
  | { kind: "check"; id: number }
  | { kind: "expense"; groupId: number; id: number }
  | { kind: "settlement"; groupId: number; id: number }
  | { kind: "loan-installment"; loanId: number; installmentId: number }
  | { kind: "loan-payment"; loanId: number; installmentId: number; paymentId: number };
type DueItem =''', "detail target type")
# Remove the old attachment helpers from this file; they now live in transaction-share.ts.
s = replace_between(s, "async function receiptFromFormData", "export function FinanceApp()", "", "old receipt helpers")
s = replace_once(s,
'''  const [settlementDraft, setSettlementDraft] = useState<SettlementDraft | null>(null);
  const [busy, setBusy] = useState(false);''',
'''  const [settlementDraft, setSettlementDraft] = useState<SettlementDraft | null>(null);
  const [detailTarget, setDetailTarget] = useState<TransactionDetailTarget | null>(null);
  const [busy, setBusy] = useState(false);''', "detail state")
s = replace_once(s,
'''  const filteredGroups = (data?.groups ?? []).filter((group) => !normalizedGroupSearch || `${group.name} ${group.members.map((member) => member.name).join(" ")} ${group.expenses.map((expense) => expense.title).join(" ")}`.toLocaleLowerCase("fa").includes(normalizedGroupSearch));''',
'''  const filteredGroups = (data?.groups ?? []).filter((group) => !normalizedGroupSearch || `${group.name} ${group.members.map((member) => member.name).join(" ")} ${group.expenses.map((expense) => expense.title).join(" ")} ${group.settlements.map((settlement) => `${settlement.fromName} ${settlement.toName} ${settlement.note}`).join(" ")}`.toLocaleLowerCase("fa").includes(normalizedGroupSearch));''', "group search settlements")
s = replace_once(s,
'''  function openPersonLedger(personId: number) {
    setSelectedPersonId(personId);
    setSheet("person-ledger");
  }

  function openSettlement''',
'''  function openPersonLedger(personId: number) {
    setSelectedPersonId(personId);
    setSheet("person-ledger");
  }

  function openTransactionDetail(target: TransactionDetailTarget) {
    setDetailTarget(target);
    setSheet("transaction-detail");
  }

  function openLedgerItem(item: PersonAccount["items"][number]) {
    if (item.source === "entry") openTransactionDetail({ kind: "entry", id: item.sourceId });
    if (item.source === "check") openTransactionDetail({ kind: "check", id: item.sourceId });
    if (item.source === "expense" && item.groupId) openTransactionDetail({ kind: "expense", groupId: item.groupId, id: item.sourceId });
    if (item.source === "settlement" && item.groupId) openTransactionDetail({ kind: "settlement", groupId: item.groupId, id: item.sourceId });
  }

  function openSettlement''', "open transaction details")
# Submit direct entries with attachments.
s = replace_between(s, "  function submitEntry(event: FormEvent<HTMLFormElement>) {", "\n  function submitLoan(event:", r'''  async function submitEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    let dueDate: string | null;
    let attachment: ReceiptAttachment | null;
    try {
      dueDate = jalaliInputToIso(String(form.get("dueDate") ?? ""));
      attachment = await attachmentFromFormData(form);
    } catch (formError) {
      setError(formError instanceof Error ? formError.message : "اطلاعات ثبت معتبر نیست.");
      return;
    }
    await post({
      operation: editingEntry ? "update_entry" : "add_entry",
      id: editingEntry?.id,
      personId: form.get("personId"),
      kind: entryKind,
      direction: entryKind === "receivable" ? "receivable" : entryKind === "debt" ? "debt" : form.get("direction"),
      title: form.get("title"), amount: form.get("amount"), dueDate, note: form.get("note"), receipt: attachment,
    });
  }
''', "submit entry attachments")
# Existing payment/expense/settlement attachment parser now uses the renamed helper.
s = s.replace("receiptFromFormData(form)", "attachmentFromFormData(form)")
# Submit cheques with attachments.
s = replace_between(s, "  function submitCheck(event: FormEvent<HTMLFormElement>) {", "\n  function submitCheckTransfer", r'''  async function submitCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    let dueDate: string;
    let issueDate: string | null;
    let attachment: ReceiptAttachment | null;
    try {
      dueDate = jalaliInputToIso(String(form.get("dueDate") ?? ""), true) as string;
      issueDate = jalaliInputToIso(String(form.get("issueDate") ?? ""));
      attachment = await attachmentFromFormData(form);
    } catch (formError) {
      setError(formError instanceof Error ? formError.message : "اطلاعات چک معتبر نیست.");
      return;
    }
    await post({
      operation: editingCheck ? "update_check" : "add_check", id: editingCheck?.id,
      direction: form.get("direction"), checkType: form.get("checkType"), amount: form.get("amount"), issueDate, dueDate,
      purpose: form.get("purpose"), sayadId: form.get("sayadId"), chequeNumber: form.get("chequeNumber"), bankName: form.get("bankName"), branchName: form.get("branchName"),
      issuerName: form.get("issuerName"), beneficiaryName: form.get("beneficiaryName"), transferorName: form.get("transferorName"), relatedPersonId: form.get("relatedPersonId"), counterpartyName: form.get("counterpartyName"),
      countInBalance: form.get("countInBalance"), sayadStatus: form.get("sayadStatus"), status: form.get("status"), note: form.get("note"), receipt: attachment,
    });
  }
''', "submit check attachments")
# Entry list: every direct transaction gets a details entry point.
s = replace_between(s, "function EntryRow(", "\nfunction DueItemRow", r'''function EntryRow({ entry, onToggle, onEdit, onDelete, onOpen, compact = false }: { entry: Entry; onToggle: () => void; onEdit: () => void; onDelete: () => void; onOpen: () => void; compact?: boolean }) {
  const meta = entryMeta[entry.kind] ?? entryMeta.debt;
  return <article className={`entry-row ${entry.status === "paid" ? "paid" : ""} ${compact ? "compact" : ""}`}>
    <span className={`entry-icon ${meta.tone}`}><Icon name={meta.icon} /></span>
    <button className="entry-copy entry-open-copy" onClick={onOpen}><strong>{entry.title}</strong><small>{entry.personName}{entry.dueDate ? ` • ${persianDate(entry.dueDate)}` : ""}{entry.receipt ? " • پیوست دارد" : ""}</small></button>
    <div className="entry-amount"><strong className={entry.direction === "receivable" ? "text-green" : "text-coral"}>{entry.direction === "receivable" ? "+" : "−"}{shortMoney(entry.amount)}</strong><div className="entry-actions"><button className="detail-link" onClick={onOpen}>جزئیات</button><button onClick={onToggle}>{entry.status === "paid" ? "بازگردانی" : "تسویه"}</button><button onClick={onEdit} aria-label="ویرایش"><Icon name="edit" size={13} /></button><button onClick={onDelete} aria-label="حذف"><Icon name="trash" size={13} /></button></div></div>
  </article>;
}
''', "EntryRow details")
# Due rows can open the relevant transaction/obligation detail page.
s = replace_once(s,
'''function DueItemRow({ item, onEntryToggle, onEntryEdit, onLoanPaid, onLoanPayment, onCheckOpen, onCheckClear, compact = false }: { item: DueItem; onEntryToggle: () => void; onEntryEdit: () => void; onLoanPaid: () => void; onLoanPayment: () => void; onCheckOpen: () => void; onCheckClear: () => void; compact?: boolean }) {''',
'''function DueItemRow({ item, onEntryToggle, onEntryEdit, onLoanPaid, onLoanPayment, onCheckOpen, onCheckClear, onOpen, compact = false }: { item: DueItem; onEntryToggle: () => void; onEntryEdit: () => void; onLoanPaid: () => void; onLoanPayment: () => void; onCheckOpen: () => void; onCheckClear: () => void; onOpen: () => void; compact?: boolean }) {''', "DueItemRow signature")
s = replace_once(s,
'''    <div className="due-copy"><strong>{item.title}</strong><small>{item.detail} • {persianDate(item.date, true)}</small></div>''',
'''    <button className="due-copy due-open-copy" onClick={onOpen}><strong>{item.title}</strong><small>{item.detail} • {persianDate(item.date, true)}</small></button>''', "due open copy")
# Check cards now stay compact; the complete journey moves to the transaction detail page.
s = replace_between(s, "function CheckCard(", "\nfunction LoanCard", r'''function CheckCard({ check, onOpen, onEdit, onDelete, onStatus, onTransfer, onReturn }: { check: CheckRecord; onOpen: () => void; onEdit: () => void; onDelete: () => void; onStatus: (status: CheckRecord["status"]) => void; onTransfer: () => void; onReturn: () => void }) {
  const stateTone = check.status === "bounced" ? "danger" : check.financialOpen ? "active" : "closed";
  const movementLabel = check.direction === "received"
    ? (check.currentHolderName === "من" ? `از ${check.counterpartyName} گرفتم • الان دست من` : `از ${check.counterpartyName} گرفتم • الان نزد ${check.currentHolderName}`)
    : `به ${check.currentHolderName || check.counterpartyName} دادم`;
  return <article className={`check-card ${check.direction} ${stateTone}`}>
    <div className="check-card-head"><span className="check-doc-icon"><Icon name="check" size={19} /></span><button className="check-card-open" onClick={onOpen}><small>{check.direction === "received" ? "گرفتم" : "دادم"} • {check.bankName}</small><h3>{check.purpose}</h3><i>{movementLabel}{check.receipt ? " • پیوست دارد" : ""}</i></button><span className="check-card-actions"><button onClick={onEdit} aria-label="ویرایش چک"><Icon name="edit" size={13} /></button><button className="danger" onClick={onDelete} aria-label="حذف چک"><Icon name="trash" size={13} /></button></span></div>
    <div className="check-personal-summary"><div><small>مبلغ</small><strong className={check.direction === "received" ? "text-green" : "text-coral"}>{money(check.amount)}</strong></div><div><small>سررسید</small><strong className={check.overdue ? "text-coral" : ""}>{persianDate(check.dueDate, true)}</strong></div><span className={`check-status-pill ${stateTone}`}>{checkStatusLabel[check.status]}</span></div>
    {check.financialOpen && <div className="check-primary-actions">{check.direction === "received" && check.currentHolderName === "من" && <button onClick={onTransfer}>واگذار کردم</button>}{check.direction === "received" && check.currentHolderName !== "من" && <button className="soft" onClick={onReturn}>دوباره دست من برگشت</button>}<button className="success" onClick={() => onStatus("cleared")}>{check.direction === "received" ? "وصول شد" : "پاس شد"}</button><button className="danger" onClick={() => onStatus("bounced")}>برگشت خورد</button></div>}
    <button className="check-detail-link" onClick={onOpen}><span>جزئیات و مسیر چک</span><b>{number.format(check.events.length)} رویداد ‹</b></button>
  </article>;
}
''', "compact CheckCard")
# Loan card: installment and each actual payment have dedicated detail pages.
s = replace_between(s, "function LoanCard(", "\nfunction EmptyState", r'''function LoanCard({ loan, onEdit, onDelete, onPayment, onDeletePayment, onOpenInstallment, onOpenPayment }: { loan: Loan; onEdit: () => void; onDelete: () => void; onPayment: (installment: LoanInstallment) => void; onDeletePayment: (id: number) => void; onOpenInstallment: (installment: LoanInstallment) => void; onOpenPayment: (installment: LoanInstallment, payment: LoanPayment) => void }) {
  const progress = loan.totalPayable > 0 ? Math.min(100, Math.round((loan.totalPaid / loan.totalPayable) * 100)) : 0;
  const providerIcon: IconName = loan.providerType === "store" ? "store" : "bank";
  return <article className={`loan-card personal ${loan.remainingAmount === 0 ? "settled" : ""}`}>
    <div className="loan-card-head"><span className="loan-provider-icon"><Icon name={providerIcon} size={19} /></span><div><small>{loan.providerName}</small><h3>{loan.title}</h3><i>{number.format(loan.paidCount)} از {number.format(loan.installmentCount)} قسط پرداخت شده</i></div><span className="loan-card-actions"><button onClick={onEdit} aria-label="ویرایش"><Icon name="edit" size={13} /></button><button className="danger" onClick={onDelete} aria-label="حذف"><Icon name="trash" size={13} /></button></span></div>
    {loan.nextInstallment ? <div className={`next-installment personal ${loan.nextInstallment.overdue ? "overdue" : ""}`}><button className="next-installment-open" onClick={() => onOpenInstallment(loan.nextInstallment)}><small>{loan.nextInstallment.overdue ? "این قسط عقب افتاده" : "قسط بعدی"}</small><strong>{persianDate(loan.nextInstallment.dueDate, true)}</strong></button><b>{money(loan.nextInstallment.remainingAmount)}</b><button onClick={() => onPayment(loan.nextInstallment)}>پرداخت</button></div> : <div className="loan-settled-banner"><Icon name="calendar-check" size={16} /> همه اقساط پرداخت شده‌اند</div>}
    <div className="loan-progress"><span><i style={{ width: `${progress}%` }} /></span><small>{number.format(progress)}٪ جلو رفته</small></div>
    <div className="loan-personal-stats"><span><small>مانده</small><strong className={loan.remainingAmount ? "text-coral" : "text-green"}>{loan.remainingAmount ? money(loan.remainingAmount) : "تمام شد"}</strong></span>{loan.overdueCount > 0 && <span className="danger"><small>عقب‌افتاده</small><strong>{number.format(loan.overdueCount)} قسط</strong></span>}</div>
    <details className="loan-schedule personal"><summary><span>همه قسط‌ها</span><b>{number.format(loan.installmentCount)} نوبت</b></summary><div className="loan-extra"><div className="loan-money-grid"><div><small>کل</small><strong>{money(loan.totalPayable)}</strong></div><div><small>پرداخت‌شده</small><strong className="text-green">{money(loan.totalPaid)}</strong></div><div><small>مانده</small><strong>{money(loan.remainingAmount)}</strong></div></div>{loan.contractNumber && <p className="loan-note">شماره قرارداد: {loan.contractNumber}</p>}{loan.financeCost > 0 && <p className="loan-finance-cost">اختلاف مبلغ پایه و کل پرداخت: <b>{money(loan.financeCost)}</b></p>}<div className="loan-installment-list">{loan.installments.map((installment) => <article key={installment.id} className={`${installment.status} ${installment.overdue ? "overdue" : ""}`}><span className="installment-number">{number.format(installment.number)}</span><button className="installment-copy" onClick={() => onOpenInstallment(installment)}><strong>{persianDate(installment.dueDate, true)}</strong><small>{installment.status === "paid" ? "پرداخت شد" : installment.status === "partial" ? "بخشی پرداخت شده" : installment.overdue ? "عقب افتاده" : "هنوز نرسیده"}</small></button><b>{money(installment.remainingAmount || installment.amount)}</b>{installment.remainingAmount > 0 && <button onClick={() => onPayment(installment)}>پرداخت</button>}{installment.payments.length > 0 && <details className="installment-payments"><summary>{number.format(installment.payments.length)} پرداخت</summary><div>{installment.payments.map((payment) => <span key={payment.id}><button className="payment-open" onClick={() => onOpenPayment(installment, payment)}><i>{persianDate(payment.paymentDate, true)}{payment.note ? ` • ${payment.note}` : ""}{payment.receipt ? " • پیوست" : ""}</i><b>{money(payment.amount)}</b></button><button onClick={() => onDeletePayment(payment.id)} aria-label="حذف پرداخت"><Icon name="trash" size={11} /></button></span>)}</div></details>}</article>)}</div>{loan.note && <p className="loan-note">{loan.note}</p>}</div></details>
  </article>;
}
''', "LoanCard details")
# Group preview counts all group transactions.
s = replace_once(s,
'''<small>{number.format(group.members.length)} نفر • {number.format(group.expenses.length)} خرید</small>''',
'''<small>{number.format(group.members.length)} نفر • {number.format(group.expenses.length + group.settlements.length)} تراکنش</small>''', "group preview count")
# Group cards: collapsible and one unified transaction timeline for purchases + settlements.
s = replace_between(s, "function GroupCard(", "\nfunction ActionSheet", r'''function GroupCard({ group, onEditGroup, onDeleteGroup, onExpense, onSettlement, onManualSettlement, onOpenTransaction }: { group: Group; onEditGroup: () => void; onDeleteGroup: () => void; onExpense: () => void; onSettlement: (suggestion: SettlementSuggestion) => void; onManualSettlement: () => void; onOpenTransaction: (target: TransactionDetailTarget) => void }) {
  const [expanded, setExpanded] = useState(false);
  const activity = [
    ...group.expenses.map((expense) => ({ kind: "expense" as const, id: expense.id, date: expense.expenseDate, expense })),
    ...group.settlements.map((settlement) => ({ kind: "settlement" as const, id: settlement.id, date: settlement.settlementDate, settlement })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  return <article className={`group-card ${expanded ? "expanded" : "collapsed"}`}>
    <div className="group-card-head"><button className="group-title group-title-button" onClick={() => setExpanded((current) => !current)} aria-expanded={expanded}><span className="group-mark"><Icon name="users" size={19} /></span><div><h3>{group.name}</h3><p>{number.format(group.members.length)} عضو • {number.format(activity.length)} تراکنش • {money(group.totalSpent)}</p></div></button><div className="group-head-actions"><button className="group-collapse-toggle" onClick={() => setExpanded((current) => !current)}>{expanded ? "جمع کردن" : "باز کردن"} <b>{expanded ? "⌃" : "⌄"}</b></button>{expanded && <><button className="group-icon-action" onClick={onEditGroup} aria-label={`ویرایش گروه ${group.name}`} title="ویرایش گروه"><Icon name="edit" size={13} /></button><button className="group-icon-action danger" onClick={onDeleteGroup} aria-label={`حذف گروه ${group.name}`} title="حذف گروه"><Icon name="trash" size={13} /></button><button onClick={onManualSettlement}><Icon name="settlement" size={13} /> تسویه</button><button onClick={onExpense}>+ خرید</button></>}</div></div>
    {expanded && <div className="group-expanded-body">
      <div className="balances-list">{group.balances.map((balance) => <div key={balance.personId}><span className="mini-avatar"><Icon name="user" size={14} /></span><strong>{balance.name}</strong><small>خرج کرده {money(balance.paid)} • سهم {money(balance.owed)}</small><b className={balance.balance >= 0 ? "text-green" : "text-coral"}>{balance.balance === 0 ? "تسویه" : balance.balance > 0 ? `${shortMoney(balance.balance)} بستانکار` : `${shortMoney(-balance.balance)} بدهکار`}</b></div>)}</div>
      <div className="settlement-box"><div className="settlement-title"><strong>پیشنهاد تسویه</strong><small>{group.suggestions.length ? "بر اساس مانده فعلی" : "همه حساب‌ها تسویه‌اند"}</small></div>{group.suggestions.map((item) => <div className="settlement-row" key={`${item.fromPersonId}-${item.toPersonId}`}><p><span>{item.fromName}</span><i>←</i><span>{item.toName}</span><b>{money(item.amount)}</b></p><button onClick={() => onSettlement(item)}>ثبت تسویه</button></div>)}</div>
      <section className="transaction-history unified-transaction-history">
        <div className="transaction-history-head"><span><Icon name="receipt" size={16} /><strong>ریز تراکنش‌ها</strong></span><b>{number.format(activity.length)} مورد</b></div>
        {activity.length ? <div className="transaction-list unified-transaction-list">{activity.map((item) => item.kind === "expense" ? <button className="group-transaction-row expense" key={`expense-${item.id}`} onClick={() => onOpenTransaction({ kind: "expense", groupId: group.id, id: item.expense.id })}><span className="transaction-icon"><Icon name="receipt" size={16} /></span><div><strong>{item.expense.title}</strong><small>خرید • پرداخت توسط {item.expense.payerName} • {persianDate(item.expense.expenseDate)}{item.expense.receipt ? " • پیوست دارد" : ""}</small></div><b>{money(item.expense.amount)}</b><i>‹</i></button> : <button className="group-transaction-row settlement" key={`settlement-${item.id}`} onClick={() => onOpenTransaction({ kind: "settlement", groupId: group.id, id: item.settlement.id })}><span className="transaction-icon"><Icon name="settlement" size={16} /></span><div><strong>{item.settlement.fromName} به {item.settlement.toName} پرداخت کرد</strong><small>تسویه • {persianDate(item.settlement.settlementDate)}{item.settlement.note ? ` • ${item.settlement.note}` : ""}{item.settlement.receipt ? " • پیوست دارد" : ""}</small></div><b>{money(item.settlement.amount)}</b><i>‹</i></button>)}</div> : <p className="no-transactions">هنوز تراکنشی در این گروه ثبت نشده است.</p>}
      </section>
    </div>}
  </article>;
}
''', "unified collapsible GroupCard")
# Add attachments to direct entry and cheque forms, and rename old receipt UI to attachment UI.
s = replace_once(s,
'''    <label>یادداشت <small>(اختیاری)</small><textarea name="note" rows={2} defaultValue={initialEntry?.note ?? ""} placeholder="توضیح کوتاه..." /></label>
    <SubmitButton busy={busy} label={initialEntry ? "ذخیره تغییرات" : `ثبت ${meta.label}`} />''',
'''    <label>یادداشت <small>(اختیاری)</small><textarea name="note" rows={2} defaultValue={initialEntry?.note ?? ""} placeholder="توضیح کوتاه..." /></label>
    <AttachmentField label="پیوست / مدرک" initialAttachment={initialEntry?.receipt} />
    <SubmitButton busy={busy} label={initialEntry ? "ذخیره تغییرات" : `ثبت ${meta.label}`} />''', "entry attachment field")
s = replace_once(s,
'''    <label>شناسه صیاد <small>(اختیاری؛ بعداً هم می‌تونی اضافه کنی)</small><input name="sayadId" inputMode="numeric" maxLength={16} defaultValue={initialCheck?.sayadId ?? ""} placeholder="۱۶ رقم" /></label>
    <details className="advanced-fields">''',
'''    <label>شناسه صیاد <small>(اختیاری؛ بعداً هم می‌تونی اضافه کنی)</small><input name="sayadId" inputMode="numeric" maxLength={16} defaultValue={initialCheck?.sayadId ?? ""} placeholder="۱۶ رقم" /></label>
    <AttachmentField label="پیوست چک / مدرک" initialAttachment={initialCheck?.receipt} />
    <details className="advanced-fields">''', "check attachment field")
s = s.replace('<ReceiptField label="رسید پرداخت" />', '<AttachmentField label="پیوست / مدرک پرداخت" />')
s = s.replace('<ReceiptField label="رسید خرید" initialReceipt={initialExpense?.receipt} />', '<AttachmentField label="پیوست / مدرک خرید" initialAttachment={initialExpense?.receipt} />')
s = s.replace('<ReceiptField label="رسید تسویه" />', '<AttachmentField label="پیوست / مدرک تسویه" />')
# Person ledger items open their real transaction detail page.
s = replace_between(s, "function PersonLedgerSheet(", "\nfunction ToolsSheet", r'''function PersonLedgerSheet({ account, onEditEntry, onOpenItem }: { account: PersonAccount; onEditEntry: (entryId: number) => void; onOpenItem: (item: PersonAccount["items"][number]) => void }) {
  return <div className="person-ledger-sheet"><div className="sheet-title"><p>همه منابع مالی این شخص نسبت به من</p><h2>{account.name}</h2></div>
    <div className={`final-balance-card ${account.finalBalance >= 0 ? "positive" : "negative"}`}><small>مانده نهایی</small><strong>{account.finalBalance === 0 ? "تسویه" : balanceLabel(account.finalBalance)}</strong></div>
    <div className="account-summary-grid three"><div><small>ثبت مستقیم</small><strong className={account.directBalance >= 0 ? "text-green" : "text-coral"}>{account.directBalance >= 0 ? "+" : "−"}{money(Math.abs(account.directBalance))}</strong></div><div><small>چک‌ها</small><strong className={account.checkBalance >= 0 ? "text-green" : "text-coral"}>{account.checkBalance >= 0 ? "+" : "−"}{money(Math.abs(account.checkBalance))}</strong></div><div><small>اثر دُنگ‌ها</small><strong className={account.dongBalance >= 0 ? "text-green" : "text-coral"}>{account.dongBalance >= 0 ? "+" : "−"}{money(Math.abs(account.dongBalance))}</strong></div></div>
    {account.groups.length > 0 && <div className="group-impact-list"><strong>تفکیک دُنگ‌ها</strong>{account.groups.map((impact) => <span key={impact.groupId}><i>{impact.groupName}</i><b className={impact.balance >= 0 ? "text-green" : "text-coral"}>{impact.balance >= 0 ? "+" : "−"}{money(Math.abs(impact.balance))}</b></span>)}</div>}
    <div className="section-title ledger-sheet-title"><h2>گردش کامل</h2><span>{number.format(account.items.length)} مورد</span></div>
    <div className="person-ledger-list">{account.items.map((item) => <article key={item.id} className={item.status === "paid" ? "ledger-item paid" : "ledger-item"}><span className={`ledger-source ${item.source}`}><Icon name={item.source === "entry" ? "book" : item.source === "check" ? "check" : item.source === "expense" ? "receipt" : "settlement"} size={15} /></span><button className="ledger-item-open" onClick={() => onOpenItem(item)}><strong>{item.title}</strong><small>{item.detail} • {persianDate(item.date)}</small></button><b className={item.effect >= 0 ? "text-green" : "text-coral"}>{item.status === "paid" ? "تسویه‌شده" : `${item.effect >= 0 ? "+" : "−"}${money(Math.abs(item.effect))}`}</b>{item.source === "entry" && <button onClick={() => onEditEntry(item.sourceId)} aria-label="ویرایش ثبت"><Icon name="edit" size={13} /></button>}</article>)}</div>
    {!account.items.length && <div className="member-picker-empty"><Icon name="book" size={24} /><strong>هنوز گردش مالی ندارد</strong><small>ثبت مستقیم یا دُنگی که به تو مربوط باشد اینجا دیده می‌شود.</small></div>}
  </div>;
}
''', "PersonLedgerSheet detail links")
# Rename the attachment field component so "receipt" means generated software output in the UI.
s = replace_between(s, "function ReceiptField(", "\nfunction MoneyInput", r'''function AttachmentField({ label, initialAttachment }: { label: string; initialAttachment?: ReceiptAttachment | null }) {
  return <label className="receipt-field attachment-field"><span>{label} <small>(اختیاری)</small></span><input name="receipt" type="file" accept="image/*,application/pdf" /><small>{initialAttachment ? `پیوست فعلی: ${initialAttachment.fileName} • انتخاب فایل جدید جایگزینش می‌کند` : "عکس یا PDF تا ۵ مگابایت • روی همین دستگاه ذخیره می‌شود"}</small></label>;
}
''', "AttachmentField component")
# Insert transaction detail page components immediately before ToolsSheet.
detail_component = r'''function DetailRows({ rows }: { rows: Array<[string, string]> }) {
  return <div className="transaction-detail-grid">{rows.filter(([, value]) => value).map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>;
}

function TransactionDetailShell({ category, title, amount, tone, date, status, receipt, attachment, onClose, children, actions }: { category: string; title: string; amount: number; tone: "positive" | "negative" | "neutral"; date: string; status: string; receipt: TransactionReceiptData; attachment?: ReceiptAttachment | null; onClose: () => void; children: ReactNode; actions?: ReactNode }) {
  return <div className="transaction-detail-page">
    <div className="transaction-detail-nav"><button onClick={onClose}>‹ برگشت</button><span>جزئیات تراکنش</span></div>
    <section className={`transaction-detail-hero ${tone}`}><small>{category}</small><h2>{title}</h2><strong>{money(amount)}</strong><div><span>{date}</span><b>{status}</b></div></section>
    <div className="transaction-detail-share"><button className="primary" onClick={() => void shareTransactionReceipt(receipt)}><Icon name="upload" size={16} /> ارسال رسید این تراکنش</button>{attachment && <button onClick={() => void shareAttachment(attachment, `پیوست ${title}`)}><Icon name="receipt" size={16} /> ارسال پیوست</button>}</div>
    {attachment && <div className="attachment-summary"><Icon name="receipt" size={16} /><div><strong>پیوست ذخیره‌شده</strong><small>{attachment.fileName} • {number.format(Math.max(1, Math.round(attachment.size / 1024)))} کیلوبایت</small></div></div>}
    {children}
    {actions && <div className="transaction-detail-actions">{actions}</div>}
    <p className="generated-receipt-hint">«ارسال رسید» یک تصویر مرتب از اطلاعات همین تراکنش می‌سازد. پیوست، مدرک جداگانه‌ای است که خودت قبلاً اضافه کرده‌ای.</p>
  </div>;
}

function TransactionDetailPage({ data, target, onClose, onOpenDetail, onEditEntry, onDeleteEntry, onToggleEntry, onEditCheck, onDeleteCheck, onCheckStatus, onTransferCheck, onReturnCheck, onEditExpense, onDeleteExpense, onDeleteSettlement, onAddLoanPayment, onDeleteLoanPayment }: { data: FinanceData; target: TransactionDetailTarget; onClose: () => void; onOpenDetail: (target: TransactionDetailTarget) => void; onEditEntry: (entry: Entry) => void; onDeleteEntry: (entry: Entry) => void; onToggleEntry: (entry: Entry) => void; onEditCheck: (check: CheckRecord) => void; onDeleteCheck: (check: CheckRecord) => void; onCheckStatus: (check: CheckRecord, status: CheckRecord["status"]) => void; onTransferCheck: (check: CheckRecord) => void; onReturnCheck: (check: CheckRecord) => void; onEditExpense: (groupId: number, expense: Expense) => void; onDeleteExpense: (expense: Expense) => void; onDeleteSettlement: (id: number) => void; onAddLoanPayment: (loan: Loan, installment: LoanInstallment) => void; onDeleteLoanPayment: (id: number) => void }) {
  if (target.kind === "entry") {
    const entry = data.entries.find((item) => item.id === target.id);
    if (!entry) return <div className="form-empty"><Icon name="book" size={28} /><h2>این تراکنش پیدا نشد</h2><button className="submit-button" onClick={onClose}>برگشت</button></div>;
    const category = entry.direction === "receivable" ? "طلب" : "بدهی";
    const receipt: TransactionReceiptData = { reference: `E-${entry.id}`, category, title: entry.title, amount: entry.amount, date: persianDate(entry.createdAt.slice(0, 10), true), status: entry.status === "paid" ? "تسویه‌شده" : "باز", direction: entry.direction === "receivable" ? "positive" : "negative", fields: [{ label: "طرف حساب", value: entry.personName }, { label: "سررسید", value: entry.dueDate ? persianDate(entry.dueDate, true) : "بدون سررسید" }], note: entry.note };
    return <TransactionDetailShell category={category} title={entry.title} amount={entry.amount} tone={entry.direction === "receivable" ? "positive" : "negative"} date={receipt.date} status={receipt.status} receipt={receipt} attachment={entry.receipt} onClose={onClose} actions={<><button onClick={() => onEditEntry(entry)}><Icon name="edit" size={14} /> ویرایش</button><button onClick={() => onToggleEntry(entry)}>{entry.status === "paid" ? "بازگردانی به باز" : "ثبت تسویه"}</button><button className="danger" onClick={() => onDeleteEntry(entry)}><Icon name="trash" size={14} /> حذف</button></>}><DetailRows rows={[["طرف حساب", entry.personName], ["نوع", category], ["تاریخ ثبت", receipt.date], ["سررسید", entry.dueDate ? persianDate(entry.dueDate, true) : "بدون سررسید"], ["وضعیت", receipt.status]]} />{entry.note && <div className="transaction-note"><small>یادداشت</small><p>{entry.note}</p></div>}</TransactionDetailShell>;
  }

  if (target.kind === "check") {
    const check = data.checks.find((item) => item.id === target.id);
    if (!check) return <div className="form-empty"><Icon name="check" size={28} /><h2>این چک پیدا نشد</h2><button className="submit-button" onClick={onClose}>برگشت</button></div>;
    const category = check.direction === "received" ? "چک دریافتی" : "چک پرداختی";
    const receipt: TransactionReceiptData = { reference: `C-${check.id}`, category, title: check.purpose, amount: check.amount, date: persianDate(check.issueDate || check.createdAt.slice(0, 10), true), status: checkStatusLabel[check.status], direction: check.direction === "received" ? "positive" : "negative", fields: [{ label: "طرف حساب", value: check.counterpartyName }, { label: "بانک", value: check.bankName }, { label: "سررسید", value: persianDate(check.dueDate, true) }, { label: "دارنده فعلی", value: check.currentHolderName }, { label: "شناسه صیاد", value: check.sayadId || "ثبت نشده" }], note: check.note };
    return <TransactionDetailShell category={category} title={check.purpose} amount={check.amount} tone={check.direction === "received" ? "positive" : "negative"} date={receipt.date} status={receipt.status} receipt={receipt} attachment={check.receipt} onClose={onClose} actions={<><button onClick={() => onEditCheck(check)}><Icon name="edit" size={14} /> ویرایش</button>{check.financialOpen && check.direction === "received" && check.currentHolderName === "من" && <button onClick={() => onTransferCheck(check)}>واگذار کردم</button>}{check.financialOpen && check.direction === "received" && check.currentHolderName !== "من" && <button onClick={() => onReturnCheck(check)}>برگشت دست من</button>}{check.financialOpen && <button onClick={() => onCheckStatus(check, "cleared")}>{check.direction === "received" ? "وصول شد" : "پاس شد"}</button>}{check.financialOpen && <button className="danger-soft" onClick={() => onCheckStatus(check, "bounced")}>برگشت خورد</button>}<button className="danger" onClick={() => onDeleteCheck(check)}><Icon name="trash" size={14} /> حذف</button></>}><DetailRows rows={[["طرف حساب", check.counterpartyName], ["بانک", check.bankName], ["شعبه", check.branchName], ["سررسید", persianDate(check.dueDate, true)], ["تاریخ صدور", check.issueDate ? persianDate(check.issueDate, true) : "ثبت نشده"], ["صادرکننده", check.issuerName], ["ذی‌نفع", check.beneficiaryName], ["دارنده فعلی", check.currentHolderName], ["واگذارکننده اولیه", check.transferorName], ["شناسه صیاد", check.sayadId || "ثبت نشده"], ["شماره چک", check.chequeNumber || "ثبت نشده"], ["وضعیت صیاد", sayadStatusLabel[check.sayadStatus]], ["اثر روی مانده", check.countInBalance ? "محاسبه می‌شود" : "فقط برای رهگیری"]]} />{check.events.length > 0 && <section className="detail-timeline"><h3>مسیر چک</h3><div className="check-timeline">{check.events.map((event) => <div key={event.id}><span className="timeline-dot" /><div><strong>{event.type === "received" ? `از ${event.fromName} گرفتم` : event.type === "issued" ? `به ${event.toName} دادم` : event.type === "transferred" ? `به ${event.toName} واگذار شد` : event.type === "cleared" ? "پاس / وصول شد" : event.type === "bounced" ? "برگشت خورد" : event.type === "returned" ? `از ${event.fromName} برگشت` : event.type === "cancelled" ? "باطل شد" : "دوباره در جریان قرار گرفت"}</strong><small>{persianDate(event.eventDate, true)}{event.note ? ` • ${event.note}` : ""}</small></div></div>)}</div></section>}{check.note && <div className="transaction-note"><small>یادداشت</small><p>{check.note}</p></div>}</TransactionDetailShell>;
  }

  if (target.kind === "expense") {
    const group = data.groups.find((item) => item.id === target.groupId);
    const expense = group?.expenses.find((item) => item.id === target.id);
    if (!group || !expense) return <div className="form-empty"><Icon name="receipt" size={28} /><h2>این خرید پیدا نشد</h2><button className="submit-button" onClick={onClose}>برگشت</button></div>;
    const sharesSummary = expense.shares.filter((share) => share.amount > 0).map((share) => `${share.name}: ${money(share.amount)}`).join(" • ");
    const receipt: TransactionReceiptData = { reference: `D-${group.id}-${expense.id}`, category: "خرید دُنگی", title: expense.title, amount: expense.amount, date: persianDate(expense.expenseDate, true), status: "ثبت‌شده", direction: "neutral", fields: [{ label: "گروه", value: group.name }, { label: "پرداخت‌کننده", value: expense.payerName }, { label: "تقسیم", value: sharesSummary }] };
    return <TransactionDetailShell category="خرید دُنگی" title={expense.title} amount={expense.amount} tone="neutral" date={receipt.date} status="ثبت‌شده" receipt={receipt} attachment={expense.receipt} onClose={onClose} actions={<><button onClick={() => onEditExpense(group.id, expense)}><Icon name="edit" size={14} /> ویرایش</button><button className="danger" onClick={() => onDeleteExpense(expense)}><Icon name="trash" size={14} /> حذف</button></>}><DetailRows rows={[["گروه", group.name], ["پرداخت‌کننده", expense.payerName], ["تاریخ خرید", persianDate(expense.expenseDate, true)], ["تعداد افراد دارای سهم", `${number.format(expense.shares.filter((share) => share.amount > 0).length)} نفر`]]} /><section className="detail-share-list"><h3>سهم افراد</h3>{expense.shares.map((share) => <div key={share.personId} className={share.amount === 0 ? "zero" : ""}><span>{share.name}<small>وزن {number.format(share.weight)}</small></span><strong>{money(share.amount)}</strong></div>)}</section></TransactionDetailShell>;
  }

  if (target.kind === "settlement") {
    const group = data.groups.find((item) => item.id === target.groupId);
    const settlement = group?.settlements.find((item) => item.id === target.id);
    if (!group || !settlement) return <div className="form-empty"><Icon name="settlement" size={28} /><h2>این تسویه پیدا نشد</h2><button className="submit-button" onClick={onClose}>برگشت</button></div>;
    const title = `${settlement.fromName} به ${settlement.toName}`;
    const receipt: TransactionReceiptData = { reference: `S-${group.id}-${settlement.id}`, category: "تسویه دُنگ", title, amount: settlement.amount, date: persianDate(settlement.settlementDate, true), status: "انجام‌شده", direction: "neutral", fields: [{ label: "گروه", value: group.name }, { label: "پرداخت‌کننده", value: settlement.fromName }, { label: "دریافت‌کننده", value: settlement.toName }], note: settlement.note };
    return <TransactionDetailShell category="تسویه دُنگ" title={title} amount={settlement.amount} tone="neutral" date={receipt.date} status="انجام‌شده" receipt={receipt} attachment={settlement.receipt} onClose={onClose} actions={<button className="danger" onClick={() => onDeleteSettlement(settlement.id)}><Icon name="trash" size={14} /> حذف تسویه</button>}><DetailRows rows={[["گروه", group.name], ["پرداخت‌کننده", settlement.fromName], ["دریافت‌کننده", settlement.toName], ["تاریخ تسویه", persianDate(settlement.settlementDate, true)]]} />{settlement.note && <div className="transaction-note"><small>یادداشت</small><p>{settlement.note}</p></div>}</TransactionDetailShell>;
  }

  const loan = data.loans.find((item) => item.id === target.loanId);
  const installment = loan?.installments.find((item) => item.id === target.installmentId);
  if (!loan || !installment) return <div className="form-empty"><Icon name="installment" size={28} /><h2>این قسط پیدا نشد</h2><button className="submit-button" onClick={onClose}>برگشت</button></div>;

  if (target.kind === "loan-payment") {
    const payment = installment.payments.find((item) => item.id === target.paymentId);
    if (!payment) return <div className="form-empty"><Icon name="installment" size={28} /><h2>این پرداخت پیدا نشد</h2><button className="submit-button" onClick={onClose}>برگشت</button></div>;
    const title = `پرداخت قسط ${number.format(installment.number)} • ${loan.title}`;
    const receipt: TransactionReceiptData = { reference: `P-${loan.id}-${payment.id}`, category: "پرداخت قسط", title, amount: payment.amount, date: persianDate(payment.paymentDate, true), status: "پرداخت ثبت‌شده", direction: "negative", fields: [{ label: "بانک / فروشگاه", value: loan.providerName }, { label: "قسط", value: `${number.format(installment.number)} از ${number.format(loan.installmentCount)}` }, { label: "سررسید", value: persianDate(installment.dueDate, true) }], note: payment.note };
    return <TransactionDetailShell category="پرداخت قسط" title={title} amount={payment.amount} tone="negative" date={receipt.date} status="پرداخت ثبت‌شده" receipt={receipt} attachment={payment.receipt} onClose={onClose} actions={<button className="danger" onClick={() => onDeleteLoanPayment(payment.id)}><Icon name="trash" size={14} /> حذف پرداخت</button>}><DetailRows rows={[["بانک / فروشگاه", loan.providerName], ["قرارداد", loan.title], ["شماره قسط", `${number.format(installment.number)} از ${number.format(loan.installmentCount)}`], ["سررسید", persianDate(installment.dueDate, true)], ["تاریخ پرداخت", persianDate(payment.paymentDate, true)]]} />{payment.note && <div className="transaction-note"><small>یادداشت</small><p>{payment.note}</p></div>}</TransactionDetailShell>;
  }

  const installmentStatus = installment.status === "paid" ? "پرداخت‌شده" : installment.status === "partial" ? "بخشی پرداخت‌شده" : installment.overdue ? "عقب‌افتاده" : "باز";
  const installmentReceipt: TransactionReceiptData = { reference: `I-${loan.id}-${installment.id}`, category: "قسط", title: loan.title, amount: installment.amount, date: persianDate(installment.dueDate, true), status: installmentStatus, direction: "negative", fields: [{ label: "بانک / فروشگاه", value: loan.providerName }, { label: "شماره قسط", value: `${number.format(installment.number)} از ${number.format(loan.installmentCount)}` }, { label: "پرداخت‌شده", value: money(installment.paidAmount) }, { label: "مانده", value: money(installment.remainingAmount) }] };
  return <TransactionDetailShell category="قسط" title={loan.title} amount={installment.amount} tone="negative" date={installmentReceipt.date} status={installmentStatus} receipt={installmentReceipt} onClose={onClose} actions={installment.remainingAmount > 0 ? <button onClick={() => onAddLoanPayment(loan, installment)}>ثبت پرداخت</button> : undefined}><DetailRows rows={[["بانک / فروشگاه", loan.providerName], ["شماره قسط", `${number.format(installment.number)} از ${number.format(loan.installmentCount)}`], ["سررسید", persianDate(installment.dueDate, true)], ["مبلغ قسط", money(installment.amount)], ["پرداخت‌شده", money(installment.paidAmount)], ["مانده", money(installment.remainingAmount)], ["وضعیت", installmentStatus]]} />{installment.payments.length > 0 && <section className="detail-payment-list"><h3>پرداخت‌های این قسط</h3>{installment.payments.map((payment) => <button key={payment.id} onClick={() => onOpenDetail({ kind: "loan-payment", loanId: loan.id, installmentId: installment.id, paymentId: payment.id })}><span><strong>{persianDate(payment.paymentDate, true)}</strong><small>{payment.note || (payment.receipt ? "پیوست دارد" : "جزئیات پرداخت")}</small></span><b>{money(payment.amount)} ‹</b></button>)}</section>}</TransactionDetailShell>;
}

'''
insert_at = s.find("function ToolsSheet(")
if insert_at < 0:
    raise SystemExit("missing ToolsSheet marker for detail page")
s = s[:insert_at] + detail_component + s[insert_at:]
# Parent call sites.
s = replace_once(s,
'''{filteredEntries.map((entry) => <EntryRow key={entry.id} entry={entry} onToggle={() => void post({ operation: "toggle_entry", id: entry.id }, { close: false })} onEdit={() => openEntry(entry.kind, entry)} onDelete={() => deleteEntry(entry)} />)}''',
'''{filteredEntries.map((entry) => <EntryRow key={entry.id} entry={entry} onOpen={() => openTransactionDetail({ kind: "entry", id: entry.id })} onToggle={() => void post({ operation: "toggle_entry", id: entry.id }, { close: false })} onEdit={() => openEntry(entry.kind, entry)} onDelete={() => deleteEntry(entry)} />)}''', "entry row parent")
s = replace_once(s,
'''{filteredGroups.map((group) => <GroupCard key={group.id} group={group} onEditGroup={() => beginGroup(group)} onDeleteGroup={() => deleteGroup(group)} onExpense={() => openExpense(group.id)} onEditExpense={(expense) => openExpense(group.id, expense)} onDeleteExpense={deleteExpense} onSettlement={(suggestion) => openSettlement(group, suggestion)} onManualSettlement={() => openSettlement(group)} onDeleteSettlement={deleteSettlement} />)}''',
'''{filteredGroups.map((group) => <GroupCard key={group.id} group={group} onEditGroup={() => beginGroup(group)} onDeleteGroup={() => deleteGroup(group)} onExpense={() => openExpense(group.id)} onSettlement={(suggestion) => openSettlement(group, suggestion)} onManualSettlement={() => openSettlement(group)} onOpenTransaction={openTransactionDetail} />)}''', "group card parent")
s = replace_once(s,
'''{filteredLoans.map((loan) => <LoanCard key={loan.id} loan={loan} onEdit={() => openLoanForm(loan)} onDelete={() => deleteLoan(loan)} onPayment={(installment) => openLoanPayment(loan, installment)} onDeletePayment={deleteLoanPayment} />)}''',
'''{filteredLoans.map((loan) => <LoanCard key={loan.id} loan={loan} onEdit={() => openLoanForm(loan)} onDelete={() => deleteLoan(loan)} onPayment={(installment) => openLoanPayment(loan, installment)} onDeletePayment={deleteLoanPayment} onOpenInstallment={(installment) => openTransactionDetail({ kind: "loan-installment", loanId: loan.id, installmentId: installment.id })} onOpenPayment={(installment, payment) => openTransactionDetail({ kind: "loan-payment", loanId: loan.id, installmentId: installment.id, paymentId: payment.id })} />)}''', "loan card parent")
s = replace_once(s,
'''{filteredChecks.map((check) => <CheckCard key={check.id} check={check} onEdit={() => openCheckForm(check)} onDelete={() => deleteCheck(check)} onStatus={(status) => updateCheckStatus(check, status)} onTransfer={() => openCheckTransfer(check)} onReturn={() => returnCheckToMe(check)} />)}''',
'''{filteredChecks.map((check) => <CheckCard key={check.id} check={check} onOpen={() => openTransactionDetail({ kind: "check", id: check.id })} onEdit={() => openCheckForm(check)} onDelete={() => deleteCheck(check)} onStatus={(status) => updateCheckStatus(check, status)} onTransfer={() => openCheckTransfer(check)} onReturn={() => returnCheckToMe(check)} />)}''', "check card parent")
# DueItemRow occurs twice (home and calendar); add onOpen before compact/end.
s = s.replace('''onCheckClear={() => item.source === "check" && updateCheckStatus(item.check, "cleared")} />''', '''onCheckClear={() => item.source === "check" && updateCheckStatus(item.check, "cleared")} onOpen={() => item.source === "entry" ? openTransactionDetail({ kind: "entry", id: item.entry.id }) : item.source === "check" ? openTransactionDetail({ kind: "check", id: item.check.id }) : openTransactionDetail({ kind: "loan-installment", loanId: item.loan.id, installmentId: item.installment.id })} />''')
s = s.replace('''onCheckClear={() => item.source === "check" && updateCheckStatus(item.check, "cleared")} /></div>''', '''onCheckClear={() => item.source === "check" && updateCheckStatus(item.check, "cleared")} onOpen={() => item.source === "entry" ? openTransactionDetail({ kind: "entry", id: item.entry.id }) : item.source === "check" ? openTransactionDetail({ kind: "check", id: item.check.id }) : openTransactionDetail({ kind: "loan-installment", loanId: item.loan.id, installmentId: item.installment.id })} /></div>''')
# Bottom sheet becomes full-screen for transaction details and renders the detail controller.
s = replace_once(s,
'''      {sheet && <div className="sheet-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setSheet(null); }}>
        <section className="bottom-sheet" role="dialog" aria-modal="true">''',
'''      {sheet && <div className={`sheet-backdrop ${sheet === "transaction-detail" ? "detail-backdrop" : ""}`} onMouseDown={(event) => { if (event.currentTarget === event.target) setSheet(null); }}>
        <section className={`bottom-sheet ${sheet === "transaction-detail" ? "transaction-detail-sheet" : ""}`} role="dialog" aria-modal="true">''', "detail fullscreen sheet")
s = replace_once(s,
'''          {sheet === "person-ledger" && selectedAccount && <PersonLedgerSheet account={selectedAccount} onEditEntry={(entryId) => { const entry = data?.entries.find((item) => item.id === entryId); if (entry) openEntry(entry.kind, entry); }} />}
          {sheet === "loan-form"''',
'''          {sheet === "person-ledger" && selectedAccount && <PersonLedgerSheet account={selectedAccount} onEditEntry={(entryId) => { const entry = data?.entries.find((item) => item.id === entryId); if (entry) openEntry(entry.kind, entry); }} onOpenItem={openLedgerItem} />}
          {sheet === "transaction-detail" && detailTarget && data && <TransactionDetailPage data={data} target={detailTarget} onClose={() => setSheet(null)} onOpenDetail={openTransactionDetail} onEditEntry={(entry) => openEntry(entry.kind, entry)} onDeleteEntry={(entry) => { setSheet(null); deleteEntry(entry); }} onToggleEntry={(entry) => void post({ operation: "toggle_entry", id: entry.id }, { close: false })} onEditCheck={openCheckForm} onDeleteCheck={(check) => { setSheet(null); deleteCheck(check); }} onCheckStatus={updateCheckStatus} onTransferCheck={openCheckTransfer} onReturnCheck={returnCheckToMe} onEditExpense={(groupId, expense) => openExpense(groupId, expense)} onDeleteExpense={(expense) => { setSheet(null); deleteExpense(expense); }} onDeleteSettlement={(id) => { setSheet(null); deleteSettlement(id); }} onAddLoanPayment={openLoanPayment} onDeleteLoanPayment={(id) => { setSheet(null); deleteLoanPayment(id); }} />}
          {sheet === "loan-form"''', "render transaction detail")
# User-visible terminology: attachments are distinct from generated receipts.
s = s.replace("رسید فعلی", "پیوست فعلی")
s = s.replace("رسید روی", "پیوست روی")
p.write_text(s, encoding="utf-8")

# -----------------------------------------------------------------------------
# CSS
# -----------------------------------------------------------------------------
p = Path("app/globals.css")
s = p.read_text(encoding="utf-8")
s += r'''

/* v15 — transaction detail pages, generated receipts and unified dong activity */
.entry-open-copy,
.due-open-copy,
.check-card-open,
.group-title-button,
.ledger-item-open,
.next-installment-open,
.installment-copy,
.payment-open {
  appearance: none;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: right;
  cursor: pointer;
  padding: 0;
  min-width: 0;
}
.entry-open-copy { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; }
.due-open-copy { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; }
.detail-link { color: var(--green) !important; background: var(--green-soft) !important; }
.check-card-open { display: block; width: 100%; }
.check-card-open > * { display: block; }
.check-detail-link { width: 100%; margin-top: 10px; min-height: 38px; border: 1px solid #e5e0d7; border-radius: 11px; background: #faf8f2; display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; font-weight: 900; cursor: pointer; }
.next-installment-open, .installment-copy { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; }
.installment-payments .payment-open { flex: 1; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.attachment-field > span { font-size: 8px; font-weight: 900; }

.group-card.collapsed { padding-bottom: 12px; }
.group-card.collapsed .group-card-head { margin-bottom: 0; }
.group-title-button { display: flex; align-items: center; gap: 10px; flex: 1; }
.group-title-button div { min-width: 0; }
.group-title-button h3, .group-title-button p { margin: 0; }
.group-collapse-toggle { white-space: nowrap; }
.group-expanded-body { display: grid; gap: 12px; margin-top: 12px; }
.unified-transaction-history { border: 1px solid #e6e0d5; border-radius: 14px; background: #fff; overflow: hidden; }
.transaction-history-head { display: flex; align-items: center; justify-content: space-between; padding: 11px 12px; border-bottom: 1px solid #eee9df; }
.transaction-history-head > span { display: inline-flex; align-items: center; gap: 6px; }
.unified-transaction-list { display: grid; }
.group-transaction-row { width: 100%; border: 0; border-bottom: 1px solid #f0ece4; background: transparent; display: grid; grid-template-columns: 30px minmax(0,1fr) auto 12px; align-items: center; gap: 8px; padding: 11px 12px; text-align: right; cursor: pointer; }
.group-transaction-row:last-child { border-bottom: 0; }
.group-transaction-row > div { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.group-transaction-row > div small { color: var(--muted); line-height: 1.6; }
.group-transaction-row > b { white-space: nowrap; }
.group-transaction-row > i { color: var(--muted); font-style: normal; }
.group-transaction-row.settlement .transaction-icon { color: var(--green); background: var(--green-soft); }

.detail-backdrop { align-items: stretch; padding: 0; }
.transaction-detail-sheet { width: 100%; max-width: none; height: 100dvh; max-height: 100dvh; border-radius: 0; padding: 0; overflow: hidden; }
.transaction-detail-sheet > .sheet-handle,
.transaction-detail-sheet > .sheet-close { display: none; }
.transaction-detail-page { height: 100%; overflow-y: auto; overscroll-behavior: contain; padding: max(16px, env(safe-area-inset-top)) 16px calc(26px + env(safe-area-inset-bottom)); background: var(--bg); }
.transaction-detail-nav { position: sticky; top: calc(-1 * max(16px, env(safe-area-inset-top))); z-index: 3; margin: calc(-1 * max(16px, env(safe-area-inset-top))) -16px 14px; padding: max(14px, env(safe-area-inset-top)) 16px 10px; background: color-mix(in srgb, var(--bg) 94%, transparent); backdrop-filter: blur(10px); display: grid; grid-template-columns: 80px 1fr 80px; align-items: center; border-bottom: 1px solid #e7e1d7; }
.transaction-detail-nav button { grid-column: 1; border: 0; background: transparent; font-weight: 900; text-align: right; cursor: pointer; }
.transaction-detail-nav span { grid-column: 2; text-align: center; font-weight: 900; }
.transaction-detail-hero { border-radius: 22px; padding: 18px; background: #fff; border: 1px solid #e5e0d7; box-shadow: 0 10px 35px rgba(52,48,40,.05); }
.transaction-detail-hero > small { color: var(--muted); font-weight: 900; }
.transaction-detail-hero h2 { margin: 5px 0 16px; font-size: 18px; }
.transaction-detail-hero > strong { display: block; font-size: 26px; margin-bottom: 14px; }
.transaction-detail-hero.positive > strong { color: var(--green); }
.transaction-detail-hero.negative > strong { color: var(--coral); }
.transaction-detail-hero > div { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: var(--muted); }
.transaction-detail-hero > div b { color: var(--text); background: #f4f1ea; border-radius: 999px; padding: 5px 9px; }
.transaction-detail-share { display: grid; grid-template-columns: 1fr auto; gap: 8px; margin: 12px 0; }
.transaction-detail-share button { min-height: 46px; border-radius: 13px; border: 1px solid #dcd6cb; background: #fff; display: inline-flex; align-items: center; justify-content: center; gap: 7px; font-weight: 900; cursor: pointer; }
.transaction-detail-share button.primary { color: #fff; background: var(--green); border-color: var(--green); }
.attachment-summary { display: flex; align-items: center; gap: 9px; border: 1px dashed #d9d2c6; background: #faf8f2; border-radius: 13px; padding: 10px 12px; margin-bottom: 12px; }
.attachment-summary > div { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.attachment-summary small { color: var(--muted); overflow: hidden; text-overflow: ellipsis; }
.transaction-detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; margin: 12px 0; }
.transaction-detail-grid > div { min-width: 0; background: #fff; border: 1px solid #e8e2d8; border-radius: 13px; padding: 11px; display: flex; flex-direction: column; gap: 4px; }
.transaction-detail-grid small { color: var(--muted); }
.transaction-detail-grid strong { overflow-wrap: anywhere; }
.transaction-note, .detail-timeline, .detail-share-list, .detail-payment-list { margin-top: 12px; background: #fff; border: 1px solid #e8e2d8; border-radius: 14px; padding: 12px; }
.transaction-note small { color: var(--muted); }
.transaction-note p { margin: 5px 0 0; line-height: 1.9; }
.detail-timeline h3, .detail-share-list h3, .detail-payment-list h3 { margin: 0 0 10px; font-size: 12px; }
.detail-share-list > div { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 0; border-bottom: 1px solid #f0ece4; }
.detail-share-list > div:last-child { border-bottom: 0; }
.detail-share-list > div > span { display: flex; flex-direction: column; gap: 2px; }
.detail-share-list > div.zero { opacity: .5; }
.detail-payment-list { display: grid; gap: 6px; }
.detail-payment-list > button { border: 0; border-bottom: 1px solid #eee9df; background: transparent; padding: 9px 0; display: flex; align-items: center; justify-content: space-between; text-align: right; cursor: pointer; }
.detail-payment-list > button:last-child { border-bottom: 0; }
.detail-payment-list > button span { display: flex; flex-direction: column; gap: 3px; }
.detail-payment-list small { color: var(--muted); }
.transaction-detail-actions { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 14px; }
.transaction-detail-actions button { min-height: 38px; border-radius: 10px; border: 1px solid #ddd7cc; background: #fff; padding: 7px 10px; display: inline-flex; align-items: center; gap: 5px; font-weight: 900; cursor: pointer; }
.transaction-detail-actions button.danger { color: var(--coral); background: var(--coral-soft); border-color: #e7c7c0; }
.transaction-detail-actions button.danger-soft { color: var(--coral); }
.generated-receipt-hint { margin: 14px 2px 0; color: var(--muted); font-size: 7px; line-height: 1.8; }
.ledger-item-open { min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 3px; }

@media (max-width: 390px) {
  .group-card-head { align-items: flex-start; }
  .group-head-actions { flex-wrap: wrap; justify-content: flex-end; }
  .group-transaction-row { grid-template-columns: 28px minmax(0,1fr) auto; }
  .group-transaction-row > i { display: none; }
  .transaction-detail-grid { grid-template-columns: 1fr; }
  .transaction-detail-share { grid-template-columns: 1fr; }
}
'''
p.write_text(s, encoding="utf-8")

# -----------------------------------------------------------------------------
# Service worker cache
# -----------------------------------------------------------------------------
p = Path("public/sw.js")
s = p.read_text(encoding="utf-8").replace('daftar-hesab-offline-v12', 'daftar-hesab-offline-v13')
p.write_text(s, encoding="utf-8")

# -----------------------------------------------------------------------------
# Regression tests
# -----------------------------------------------------------------------------
p = Path("tests/rendered-html.test.mjs")
s = p.read_text(encoding="utf-8")
s = s.replace('daftar-hesab-offline-v12', 'daftar-hesab-offline-v13')
start = s.find('test("keeps dong settlements visible and stores shareable local receipts for real payments"')
if start < 0:
    raise SystemExit("missing v14 receipt regression test")
s = s[:start] + r'''test("distinguishes user attachments from app-generated transaction receipts", async () => {
  const [app, localDb, shareModule, css, serviceWorker] = await Promise.all([
    readFile(new URL("app/FinanceApp.tsx", root), "utf8"),
    readFile(new URL("app/local-db.ts", root), "utf8"),
    readFile(new URL("app/transaction-share.ts", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("public/sw.js", root), "utf8"),
  ]);
  assert.match(localDb, /export type ReceiptAttachment/);
  assert.match(localDb, /export type Entry = .*receipt: ReceiptAttachment \| null/);
  assert.match(localDb, /export type CheckRecord = .*receipt: ReceiptAttachment \| null/);
  assert.match(app, /function AttachmentField/);
  assert.match(app, /پیوست \/ مدرک/);
  assert.match(app, /پیوست چک \/ مدرک/);
  assert.match(shareModule, /export async function shareAttachment/);
  assert.match(shareModule, /export async function shareTransactionReceipt/);
  assert.match(shareModule, /جایگزین رسید بانکی نیست/);
  assert.match(app, /ارسال رسید این تراکنش/);
  assert.match(app, /ارسال پیوست/);
  assert.match(css, /\.transaction-detail-share/);
  assert.match(serviceWorker, /daftar-hesab-offline-v13/);
});

test("gives transactions full detail pages and merges dong settlements into one activity timeline", async () => {
  const [app, css] = await Promise.all([
    readFile(new URL("app/FinanceApp.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(app, /type TransactionDetailTarget/);
  assert.match(app, /"loan-payment"/);
  assert.match(app, /"loan-installment"/);
  assert.match(app, /function TransactionDetailPage/);
  assert.match(app, /جزئیات تراکنش/);
  assert.match(app, /className="transaction-detail-sheet"|transaction-detail-sheet/);
  assert.match(app, /const \[expanded, setExpanded\] = useState\(false\)/);
  assert.match(app, /const activity = \[/);
  assert.match(app, /\.\.\.group\.expenses\.map/);
  assert.match(app, /\.\.\.group\.settlements\.map/);
  assert.match(app, /ریز تراکنش‌ها/);
  assert.doesNotMatch(app, /className="settlement-history"/);
  assert.doesNotMatch(app, /تاریخچه تسویه‌ها/);
  assert.match(css, /\.group-card\.collapsed/);
  assert.match(css, /\.unified-transaction-list/);
  assert.match(css, /\.transaction-detail-page/);
});
'''
p.write_text(s, encoding="utf-8")
