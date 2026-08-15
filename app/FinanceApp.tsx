"use client";

import { FormEvent, useCallback, useMemo, useRef, useState, useEffect } from "react";
import { buildJalaliInstallmentDates, isoToJalaliInput, jalaliFirstWeekday, jalaliInputToIso, jalaliMonthDays, jalaliMonthName, jalaliPartsToInput, jalaliTodayParts, normalizeDigits, persianDate, todayIso, todayJalaliInput, toPersianDigits } from "./jalali";
import {
  applyFinanceOperation,
  exportFinanceBackup,
  getFinanceData,
  importFinanceBackup,
  type Entry,
  type Expense,
  type FinanceData,
  type Group,
  type CheckRecord,
  type Loan,
  type LoanInstallment,
  type Person,
  type PersonAccount,
  type SettlementSuggestion,
} from "./local-db";

type Sheet = "actions" | "person" | "entry" | "group" | "expense" | "settlement" | "person-ledger" | "loan-form" | "loan-payment" | "check-form" | "check-transfer" | "tools" | null;
type Tab = "home" | "ledger" | "groups" | "loans" | "checks" | "calendar";
type IconName = "home" | "book" | "users" | "calendar" | "user" | "user-plus" | "receipt" | "calendar-check" | "debt" | "receivable" | "installment" | "bank" | "store" | "check" | "trash" | "edit" | "download" | "upload" | "search" | "settlement" | "wallet";

type SettlementDraft = { groupId: number; fromPersonId?: number; toPersonId?: number; amount?: number };
type DueItem =
  | { id: string; source: "entry"; date: string; title: string; detail: string; amount: number; overdue: boolean; completed: boolean; completionLabel: string; entry: Entry }
  | { id: string; source: "loan"; date: string; title: string; detail: string; amount: number; overdue: boolean; completed: boolean; completionLabel: string; loan: Loan; installment: LoanInstallment }
  | { id: string; source: "check"; date: string; title: string; detail: string; amount: number; overdue: boolean; completed: boolean; completionLabel: string; check: CheckRecord };

const providerTypeLabel: Record<Loan["providerType"], string> = { bank: "بانک", store: "فروشگاه", other: "مؤسسه / سایر" };
const checkStatusLabel: Record<CheckRecord["status"], string> = { open: "در جریان", cleared: "پاس شده", bounced: "برگشت خورده", cancelled: "باطل شده", returned: "برگشته" };
const sayadStatusLabel: Record<CheckRecord["sayadStatus"], string> = { not_registered: "ثبت نشده", registered: "ثبت شده", confirmed: "تأیید شده", transferred: "منتقل شده" };

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className: "app-icon", "data-icon": name, "aria-hidden": true };
  if (name === "home") return <svg {...common}><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/></svg>;
  if (name === "book") return <svg {...common}><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v17H7.5A3.5 3.5 0 0 0 4 22z"/><path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H13v17h3.5A3.5 3.5 0 0 1 20 22z"/></svg>;
  if (name === "users") return <svg {...common}><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.5-3.3 2.4-5 5.5-5s5 1.7 5.5 5"/><circle cx="17" cy="9" r="2.4"/><path d="M15.7 14.2c2.8-.5 4.5 1 4.8 3.8"/></svg>;
  if (name === "calendar" || name === "calendar-check") return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>{name === "calendar-check" ? <path d="m8 15 2.2 2.2L16 12.5"/> : <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>}</svg>;
  if (name === "user") return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4.5 21c.7-4.3 3.2-6.5 7.5-6.5s6.8 2.2 7.5 6.5"/></svg>;
  if (name === "user-plus") return <svg {...common}><circle cx="10" cy="8" r="3.5"/><path d="M4 20c.6-3.8 2.6-5.7 6-5.7 1.3 0 2.4.3 3.3.8"/><path d="M18 13v6M15 16h6"/></svg>;
  if (name === "receipt") return <svg {...common}><path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>;
  if (name === "debt") return <svg {...common}><path d="M7 17 17 7M10 7h7v7"/><path d="M5 20h14"/></svg>;
  if (name === "receivable") return <svg {...common}><path d="M17 7 7 17M7 10v7h7"/><path d="M5 20h14"/></svg>;
  if (name === "installment") return <svg {...common}><path d="M7 7h11l-2.5-2.5M17 17H6l2.5 2.5"/><path d="M18 7a7 7 0 0 1 1 7M6 17a7 7 0 0 1-1-7"/></svg>;
  if (name === "bank") return <svg {...common}><path d="m3 9 9-5 9 5"/><path d="M5 10h14M6 10v8M10 10v8M14 10v8M18 10v8M4 18h16M3 21h18"/></svg>;
  if (name === "store") return <svg {...common}><path d="M4 9h16l-1.5-5h-13z"/><path d="M5 9v11h14V9M8 20v-6h5v6"/><path d="M4 9c0 1.7 1.2 3 2.7 3S9.3 10.7 9.3 9c0 1.7 1.2 3 2.7 3s2.7-1.3 2.7-3c0 1.7 1.2 3 2.7 3S20 10.7 20 9"/></svg>;
  if (name === "check") return <svg {...common}><path d="M5 3h11l3 3v15H5z"/><path d="M16 3v4h4M8 13l2.2 2.2L16 10"/></svg>;
  if (name === "edit") return <svg {...common}><path d="M4 20h4l11-11-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>;
  if (name === "download") return <svg {...common}><path d="M12 3v12M7.5 10.5 12 15l4.5-4.5"/><path d="M5 20h14"/></svg>;
  if (name === "upload") return <svg {...common}><path d="M12 16V4M7.5 8.5 12 4l4.5 4.5"/><path d="M5 20h14"/></svg>;
  if (name === "search") return <svg {...common}><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>;
  if (name === "settlement") return <svg {...common}><path d="M5 8h12l-3-3M19 16H7l3 3"/><path d="M17 8a5 5 0 0 1 2 4M7 16a5 5 0 0 1-2-4"/></svg>;
  if (name === "wallet") return <svg {...common}><path d="M4 6.5h14a2 2 0 0 1 2 2V19H5a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h11"/><path d="M15 11h5v5h-5a2.5 2.5 0 0 1 0-5z"/></svg>;
  return <svg {...common}><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/></svg>;
}

const entryMeta: Record<string, { label: string; icon: IconName; tone: string }> = {
  debt: { label: "بدهی", icon: "debt", tone: "coral" },
  receivable: { label: "طلب", icon: "receivable", tone: "green" },
  installment: { label: "قسط قدیمی", icon: "installment", tone: "amber" },
  check: { label: "چک قدیمی", icon: "check", tone: "violet" },
};

const quickEntryKinds = ["debt", "receivable"] as const;

const number = new Intl.NumberFormat("fa-IR");
const money = (value: number) => `${number.format(value)} تومان`;
const shortMoney = (value: number) => {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `${number.format(Math.round(absolute / 100_000) / 10)} م.`;
  if (absolute >= 1_000) return `${number.format(Math.round(absolute / 1_000))} هـ.`;
  return number.format(absolute);
};

function balanceLabel(value: number) {
  if (value === 0) return "تسویه";
  return value > 0 ? `${money(value)} طلبکارم` : `${money(-value)} بدهکارم`;
}

export function FinanceApp() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [entryKind, setEntryKind] = useState("debt");
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [editingLoanId, setEditingLoanId] = useState<number | null>(null);
  const [editingCheckId, setEditingCheckId] = useState<number | null>(null);
  const [transferCheckId, setTransferCheckId] = useState<number | null>(null);
  const [paymentLoanId, setPaymentLoanId] = useState<number | null>(null);
  const [paymentInstallmentId, setPaymentInstallmentId] = useState<number | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const [settlementDraft, setSettlementDraft] = useState<SettlementDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [groupMembers, setGroupMembers] = useState<Record<number, number>>({});
  const [expenseGroupId, setExpenseGroupId] = useState<number | null>(null);
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [entryFilter, setEntryFilter] = useState<"all" | "open" | "paid">("all");
  const [groupSearch, setGroupSearch] = useState("");
  const [loanSearch, setLoanSearch] = useState("");
  const [loanFilter, setLoanFilter] = useState<"active" | "settled" | "all">("active");
  const [checkSearch, setCheckSearch] = useState("");
  const [checkFilter, setCheckFilter] = useState<"active" | "received" | "issued" | "closed" | "all">("active");
  const [dueRange, setDueRange] = useState<"current" | "next" | "all">("current");
  const [hideCompletedDue, setHideCompletedDue] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await getFinanceData();
      setData(result);
      setError("");
      setExpenseGroupId((current) => result.groups.some((group) => group.id === current) ? current : result.groups[0]?.id ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "دفتر داخلی برنامه باز نشد.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (location.hostname !== "localhost" && "serviceWorker" in navigator) void navigator.serviceWorker.register("./sw.js");
  }, []);

  const people = data?.persons.filter((person) => !person.isSelf) ?? [];
  const linkedReceivable = data?.accounts.filter((account) => account.finalBalance > 0).reduce((sum, account) => sum + account.finalBalance, 0) ?? 0;
  const linkedDebt = data?.accounts.filter((account) => account.finalBalance < 0).reduce((sum, account) => sum - account.finalBalance, 0) ?? 0;
  const unlinkedCheckReceivable = data?.checks.filter((check) => check.financialOpen && check.countInBalance && !check.relatedPersonId && check.direction === "received").reduce((sum, check) => sum + check.amount, 0) ?? 0;
  const unlinkedCheckDebt = data?.checks.filter((check) => check.financialOpen && check.countInBalance && !check.relatedPersonId && check.direction === "issued").reduce((sum, check) => sum + check.amount, 0) ?? 0;
  const totalReceivable = linkedReceivable + unlinkedCheckReceivable;
  const loanDebt = data?.loans.reduce((sum, loan) => sum + loan.remainingAmount, 0) ?? 0;
  const totalDebt = linkedDebt + loanDebt + unlinkedCheckDebt;
  const net = totalReceivable - totalDebt;
  const selectedExpenseGroup = data?.groups.find((group) => group.id === expenseGroupId);
  const editingEntry = data?.entries.find((entry) => entry.id === editingEntryId);
  const editingExpense = data?.groups.flatMap((group) => group.expenses.map((expense) => ({ group, expense }))).find((item) => item.expense.id === editingExpenseId);
  const editingGroup = data?.groups.find((group) => group.id === editingGroupId);
  const editingLoan = data?.loans.find((loan) => loan.id === editingLoanId);
  const editingCheck = data?.checks.find((check) => check.id === editingCheckId);
  const transferCheck = data?.checks.find((check) => check.id === transferCheckId);
  const paymentLoan = data?.loans.find((loan) => loan.id === paymentLoanId);
  const paymentInstallment = paymentLoan?.installments.find((installment) => installment.id === paymentInstallmentId);
  const selectedAccount = data?.accounts.find((account) => account.personId === selectedPersonId);
  const today = todayIso();
  const dueItems: DueItem[] = [
    ...(data?.entries ?? []).filter((entry) => entry.dueDate).map((entry) => ({
      id: `entry-${entry.id}`,
      source: "entry" as const,
      date: entry.dueDate as string,
      title: entry.title,
      detail: `${entry.personName} • ${entry.kind === "check" ? "چک قدیمی" : entry.kind === "installment" ? "قسط قدیمی" : entry.direction === "receivable" ? "طلب" : "بدهی"}`,
      amount: entry.amount,
      overdue: entry.status === "open" && Boolean(entry.dueDate && entry.dueDate < today),
      completed: entry.status === "paid",
      completionLabel: "تسویه شد",
      entry,
    })),
    ...(data?.loans ?? []).flatMap((loan) => loan.installments.map((installment) => ({
      id: `loan-${loan.id}-${installment.id}`,
      source: "loan" as const,
      date: installment.dueDate,
      title: loan.title,
      detail: `${loan.providerName} • قسط ${number.format(installment.number)} از ${number.format(loan.installmentCount)}`,
      amount: installment.status === "paid" ? installment.amount : installment.remainingAmount,
      overdue: installment.status !== "paid" && installment.overdue,
      completed: installment.status === "paid",
      completionLabel: "پرداخت شد",
      loan,
      installment,
    }))),
    ...(data?.checks ?? []).map((check) => ({
      id: `check-${check.id}`,
      source: "check" as const,
      date: check.dueDate,
      title: `${check.direction === "received" ? "چک دریافتی" : "چک پرداختی"} • ${check.purpose}`,
      detail: `${check.counterpartyName} • ${check.bankName}${check.sayadId ? ` • صیاد ${check.sayadId.slice(-6)}` : ""}`,
      amount: check.amount,
      overdue: check.financialOpen && check.overdue,
      completed: !check.financialOpen,
      completionLabel: check.status === "cleared" ? (check.direction === "received" ? "وصول شد" : "پاس شد") : check.status === "cancelled" ? "باطل شد" : check.status === "returned" ? "برگشت داده شد" : "بسته شد",
      check,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || Number(a.completed) - Number(b.completed) || a.id.localeCompare(b.id));
  const upcoming = dueItems.filter((item) => !item.completed);
  const currentJalaliMonth = jalaliTodayParts();
  const nextJalaliMonth = currentJalaliMonth.jm === 12
    ? { jy: currentJalaliMonth.jy + 1, jm: 1 }
    : { jy: currentJalaliMonth.jy, jm: currentJalaliMonth.jm + 1 };
  const currentMonthKey = `${currentJalaliMonth.jy}/${String(currentJalaliMonth.jm).padStart(2, "0")}`;
  const nextMonthKey = `${nextJalaliMonth.jy}/${String(nextJalaliMonth.jm).padStart(2, "0")}`;
  const rangeDueItems = dueItems.filter((item) => {
    if (dueRange === "all") return true;
    const monthKey = normalizeDigits(isoToJalaliInput(item.date)).slice(0, 7);
    return monthKey === (dueRange === "current" ? currentMonthKey : nextMonthKey);
  });
  const completedDueCount = rangeDueItems.filter((item) => item.completed).length;
  const calendarDueItems = hideCompletedDue ? rangeDueItems.filter((item) => !item.completed) : rangeDueItems;

  const normalizedLedgerSearch = ledgerSearch.trim().toLocaleLowerCase("fa");
  const filteredAccounts = (data?.accounts ?? []).filter((account) => !normalizedLedgerSearch || `${account.name} ${account.phone}`.toLocaleLowerCase("fa").includes(normalizedLedgerSearch));
  const filteredEntries = (data?.entries ?? []).filter((entry) => {
    if (entryFilter !== "all" && entry.status !== entryFilter) return false;
    if (!normalizedLedgerSearch) return true;
    return `${entry.personName} ${entry.title} ${entry.note}`.toLocaleLowerCase("fa").includes(normalizedLedgerSearch);
  });
  const normalizedGroupSearch = groupSearch.trim().toLocaleLowerCase("fa");
  const filteredGroups = (data?.groups ?? []).filter((group) => !normalizedGroupSearch || `${group.name} ${group.members.map((member) => member.name).join(" ")} ${group.expenses.map((expense) => expense.title).join(" ")}`.toLocaleLowerCase("fa").includes(normalizedGroupSearch));
  const normalizedLoanSearch = loanSearch.trim().toLocaleLowerCase("fa");
  const filteredLoans = (data?.loans ?? []).filter((loan) => {
    if (loanFilter === "active" && loan.remainingAmount === 0) return false;
    if (loanFilter === "settled" && loan.remainingAmount !== 0) return false;
    return !normalizedLoanSearch || `${loan.providerName} ${loan.title} ${loan.contractNumber}`.toLocaleLowerCase("fa").includes(normalizedLoanSearch);
  });
  const normalizedCheckSearch = checkSearch.trim().toLocaleLowerCase("fa");
  const filteredChecks = (data?.checks ?? []).filter((check) => {
    if (checkFilter === "active" && !check.financialOpen) return false;
    if (checkFilter === "received" && check.direction !== "received") return false;
    if (checkFilter === "issued" && check.direction !== "issued") return false;
    if (checkFilter === "closed" && check.financialOpen) return false;
    return !normalizedCheckSearch || `${check.counterpartyName} ${check.bankName} ${check.branchName} ${check.purpose} ${check.sayadId} ${check.chequeNumber} ${check.issuerName} ${check.beneficiaryName} ${check.transferorName} ${check.currentHolderName}`.toLocaleLowerCase("fa").includes(normalizedCheckSearch);
  });

  async function post(payload: Record<string, unknown>, { close = true }: { close?: boolean } = {}) {
    setBusy(true);
    setError("");
    try {
      await applyFinanceOperation(payload);
      if (close) setSheet(null);
      await load();
    } catch (postError) {
      setError(postError instanceof Error ? postError.message : "خطا در ثبت اطلاعات");
    } finally {
      setBusy(false);
    }
  }

  function openEntry(kind: string, entry?: Entry) {
    setEditingEntryId(entry?.id ?? null);
    setEntryKind(entry?.kind ?? kind);
    setSheet("entry");
  }

  function openLoans() {
    setSheet(null);
    setTab("loans");
  }

  function openChecks() {
    setSheet(null);
    setTab("checks");
  }

  function openCheckForm(check?: CheckRecord) {
    setEditingCheckId(check?.id ?? null);
    setSheet("check-form");
  }

  function openCheckTransfer(check: CheckRecord) {
    setTransferCheckId(check.id);
    setSheet("check-transfer");
  }

  function openLoanForm(loan?: Loan) {
    setEditingLoanId(loan?.id ?? null);
    setSheet("loan-form");
  }

  function openLoanPayment(loan: Loan, installment: LoanInstallment) {
    setPaymentLoanId(loan.id);
    setPaymentInstallmentId(installment.id);
    setSheet("loan-payment");
  }

  function markInstallmentPaid(loan: Loan, installment: LoanInstallment) {
    if (!window.confirm(`قسط ${number.format(installment.number)} «${loan.title}» به مبلغ ${money(installment.remainingAmount)} پرداخت شد؟`)) return;
    void post({ operation: "add_loan_payment", loanId: loan.id, installmentId: installment.id, amount: installment.remainingAmount, paymentDate: todayIso(), note: "ثبت سریع از سررسید" }, { close: false });
  }

  function beginGroup(group?: Group) {
    setEditingGroupId(group?.id ?? null);
    setGroupMembers(Object.fromEntries((group?.members ?? []).map((member) => [member.personId, member.shareWeight])));
    setSheet("group");
  }

  function openExpense(groupId?: number, expense?: Expense) {
    setEditingExpenseId(expense?.id ?? null);
    setExpenseGroupId(groupId ?? expenseGroupId ?? data?.groups[0]?.id ?? null);
    setSheet("expense");
  }

  function openPersonLedger(personId: number) {
    setSelectedPersonId(personId);
    setSheet("person-ledger");
  }

  function openSettlement(group: Group, suggestion?: SettlementSuggestion) {
    setSettlementDraft({ groupId: group.id, fromPersonId: suggestion?.fromPersonId, toPersonId: suggestion?.toPersonId, amount: suggestion?.amount });
    setSheet("settlement");
  }

  function deletePerson(person: Person) {
    const confirmed = window.confirm(`«${person.name}» حذف شود؟ همه ثبت‌های مالی این فرد و گروه‌های دُنگی مشترک او نیز برای حفظ درستی حساب‌ها پاک می‌شوند.`);
    if (confirmed) void post({ operation: "delete_person", id: person.id }, { close: false });
  }

  function deleteEntry(entry: Entry) {
    if (window.confirm(`ثبت «${entry.title}» حذف شود؟`)) void post({ operation: "delete_entry", id: entry.id }, { close: false });
  }

  function deleteExpense(expense: Expense) {
    if (window.confirm(`خرید «${expense.title}» و سهم‌های آن حذف شود؟`)) void post({ operation: "delete_expense", id: expense.id }, { close: false });
  }

  function deleteGroup(group: Group) {
    const confirmed = window.confirm(`گروه «${group.name}» حذف شود؟\n\n${number.format(group.expenses.length)} خرید و ${number.format(group.settlements.length)} تسویه این گروه برای همیشه حذف می‌شوند. اشخاص و ثبت‌های مستقیم آن‌ها حذف نمی‌شوند.`);
    if (confirmed) void post({ operation: "delete_group", id: group.id }, { close: false });
  }

  function deleteSettlement(id: number) {
    if (window.confirm("این سابقه تسویه حذف شود؟ مانده گروه دوباره محاسبه خواهد شد.")) void post({ operation: "delete_settlement", id }, { close: false });
  }

  function deleteLoan(loan: Loan) {
    const confirmed = window.confirm(`«${loan.title}» از ${loan.providerName} حذف شود؟\n\nبرنامه تمام اقساط و سابقه پرداخت‌های این قرارداد را نیز حذف می‌کند.`);
    if (confirmed) void post({ operation: "delete_loan", id: loan.id }, { close: false });
  }

  function deleteLoanPayment(id: number) {
    if (window.confirm("این پرداخت حذف شود؟ مانده قسط و وام دوباره محاسبه خواهد شد.")) void post({ operation: "delete_loan_payment", id }, { close: false });
  }

  function deleteCheck(check: CheckRecord) {
    if (window.confirm(`چک ${check.direction === "received" ? "دریافتی" : "پرداختی"} «${check.purpose}» حذف شود؟`)) void post({ operation: "delete_check", id: check.id }, { close: false });
  }

  function updateCheckStatus(check: CheckRecord, status: CheckRecord["status"]) {
    const label = status === "cleared" ? (check.direction === "received" ? "وصول‌شده" : "پاس‌شده") : checkStatusLabel[status];
    if (window.confirm(`وضعیت این چک به «${label}» تغییر کند؟`)) void post({ operation: "update_check_status", id: check.id, status, eventDate: todayIso() }, { close: false });
  }

  function returnCheckToMe(check: CheckRecord) {
    if (window.confirm(`ثبت شود که چک از «${check.currentHolderName}» دوباره دست تو برگشته؟`)) void post({ operation: "return_check_to_me", id: check.id, returnDate: todayIso(), note: "بازگشت چک به من" }, { close: false });
  }

  function submitPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void post({ operation: "add_person", name: form.get("name"), phone: form.get("phone") });
  }

  function submitEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    let dueDate: string | null;
    try {
      dueDate = jalaliInputToIso(String(form.get("dueDate") ?? ""));
    } catch (dateError) {
      setError(dateError instanceof Error ? dateError.message : "تاریخ شمسی معتبر نیست.");
      return;
    }
    void post({
      operation: editingEntry ? "update_entry" : "add_entry",
      id: editingEntry?.id,
      personId: form.get("personId"),
      kind: entryKind,
      direction: entryKind === "receivable" ? "receivable" : entryKind === "debt" ? "debt" : form.get("direction"),
      title: form.get("title"), amount: form.get("amount"), dueDate, note: form.get("note"),
    });
  }

  function submitLoan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const count = Number(normalizeDigits(String(form.get("installmentCount") ?? "")));
    const intervalMonths = Number(normalizeDigits(String(form.get("intervalMonths") ?? "1")));
    let dueDates: string[];
    try {
      dueDates = buildJalaliInstallmentDates(String(form.get("firstDueDate") ?? ""), count, intervalMonths);
    } catch (dateError) {
      setError(dateError instanceof Error ? dateError.message : "زمان‌بندی اقساط معتبر نیست.");
      return;
    }
    void post({
      operation: editingLoan ? "update_loan" : "add_loan",
      id: editingLoan?.id,
      providerType: form.get("providerType"), providerName: form.get("providerName"), title: form.get("title"),
      principalAmount: form.get("principalAmount"), totalPayable: form.get("totalPayable"), downPayment: form.get("downPayment"),
      installmentCount: count, intervalMonths, dueDates, contractNumber: form.get("contractNumber"), note: form.get("note"),
    });
  }

  function submitLoanPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paymentLoan || !paymentInstallment) return;
    const form = new FormData(event.currentTarget);
    let paymentDate: string;
    try {
      paymentDate = jalaliInputToIso(String(form.get("paymentDate") ?? ""), true) as string;
    } catch (dateError) {
      setError(dateError instanceof Error ? dateError.message : "تاریخ پرداخت معتبر نیست.");
      return;
    }
    void post({ operation: "add_loan_payment", loanId: paymentLoan.id, installmentId: paymentInstallment.id, amount: form.get("amount"), paymentDate, note: form.get("note") });
  }

  function submitCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    let dueDate: string;
    let issueDate: string | null;
    try {
      dueDate = jalaliInputToIso(String(form.get("dueDate") ?? ""), true) as string;
      issueDate = jalaliInputToIso(String(form.get("issueDate") ?? ""));
    } catch (dateError) {
      setError(dateError instanceof Error ? dateError.message : "تاریخ چک معتبر نیست.");
      return;
    }
    void post({
      operation: editingCheck ? "update_check" : "add_check", id: editingCheck?.id,
      direction: form.get("direction"), checkType: form.get("checkType"), amount: form.get("amount"), issueDate, dueDate,
      purpose: form.get("purpose"), sayadId: form.get("sayadId"), chequeNumber: form.get("chequeNumber"), bankName: form.get("bankName"), branchName: form.get("branchName"),
      issuerName: form.get("issuerName"), beneficiaryName: form.get("beneficiaryName"), transferorName: form.get("transferorName"), relatedPersonId: form.get("relatedPersonId"), counterpartyName: form.get("counterpartyName"),
      countInBalance: form.get("countInBalance"), sayadStatus: form.get("sayadStatus"), status: form.get("status"), note: form.get("note"),
    });
  }

  function submitCheckTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!transferCheck) return;
    const form = new FormData(event.currentTarget);
    let transferDate: string;
    try {
      transferDate = jalaliInputToIso(String(form.get("transferDate") ?? ""), true) as string;
    } catch (dateError) {
      setError(dateError instanceof Error ? dateError.message : "تاریخ واگذاری معتبر نیست.");
      return;
    }
    void post({ operation: "transfer_check", id: transferCheck.id, holderName: form.get("holderName"), transferDate, note: form.get("note") });
  }

  function submitGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const members = Object.entries(groupMembers).map(([personId, shareWeight]) => ({ personId: Number(personId), shareWeight }));
    void post({ operation: editingGroup ? "update_group" : "add_group", id: editingGroup?.id, name: form.get("name"), members });
  }

  function submitExpense(event: FormEvent<HTMLFormElement>, splits: Array<{ personId: number; shareWeight: number }>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    let expenseDate: string;
    try {
      expenseDate = jalaliInputToIso(String(form.get("expenseDate") ?? ""), true) as string;
    } catch (dateError) {
      setError(dateError instanceof Error ? dateError.message : "تاریخ شمسی معتبر نیست.");
      return;
    }
    const groupId = editingExpense?.group.id ?? Number(form.get("groupId"));
    void post({ operation: editingExpense ? "update_expense" : "add_expense", id: editingExpense?.expense.id, groupId, payerPersonId: form.get("payerPersonId"), title: form.get("title"), amount: form.get("amount"), expenseDate, splits });
  }

  function submitSettlement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    let settlementDate: string;
    try {
      settlementDate = jalaliInputToIso(String(form.get("settlementDate") ?? ""), true) as string;
    } catch (dateError) {
      setError(dateError instanceof Error ? dateError.message : "تاریخ شمسی معتبر نیست.");
      return;
    }
    void post({ operation: "add_settlement", groupId: form.get("groupId"), fromPersonId: form.get("fromPersonId"), toPersonId: form.get("toPersonId"), amount: form.get("amount"), settlementDate, note: form.get("note") });
  }

  async function handleExport() {
    try {
      const backup = await exportFinanceBackup();
      const blob = new Blob([backup], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `daftar-hesab-backup-${todayIso()}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "تهیه نسخه پشتیبان انجام نشد.");
    }
  }

  async function handleImport(file: File) {
    if (!window.confirm("بازیابی پشتیبان، اطلاعات فعلی این دستگاه را جایگزین می‌کند. ادامه می‌دهی؟")) return;
    setBusy(true);
    try {
      await importFinanceBackup(await file.text());
      await load();
      setSheet(null);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "بازیابی نسخه پشتیبان انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell" dir="rtl">
      <header className="topbar">
        <div>
          <p className="eyebrow">دفتر مالی شخصی</p>
          <h1>دفتر حساب شخصی</h1>
          <span className="local-badge">● ذخیره امن روی گوشی</span>
        </div>
        <button className="avatar" aria-label="پشتیبان و ابزارها" onClick={() => setSheet("tools")}><Icon name="wallet" size={20} /></button>
      </header>

      {error && <button className="error-banner" onClick={() => setError("")}>{error}<span>×</span></button>}

      {!data ? <Loading /> : (
        <>
          {tab === "home" && (
            <section className="page home-page">
              <article className="balance-card">
                <div className="balance-top"><span>تراز نهایی من</span><span className={`net-pill ${net >= 0 ? "positive" : "negative"}`}>{net >= 0 ? "مثبت" : "منفی"}</span></div>
                <strong className="balance-value">{shortMoney(net)} <small>تومان</small></strong>
                <div className="balance-grid">
                  <div><span className="dot green-dot" />کل طلب باز<strong>{money(totalReceivable)}</strong></div>
                  <div><span className="dot coral-dot" />کل بدهی باز<strong>{money(totalDebt)}</strong></div>
                </div>
                <p className="balance-caption">ثبت‌های مستقیم + دُنگ‌ها + چک‌ها + تسویه‌ها + مانده وام‌ها</p>
                <div className="balance-art" aria-hidden="true"><i /><i /><i /><i /></div>
              </article>

              <div className="section-title"><h2>ثبت سریع</h2><button onClick={() => setSheet("actions")}>همه موارد</button></div>
              <div className="quick-grid">
                {quickEntryKinds.slice(0, 2).map((kind) => { const meta = entryMeta[kind]; return <button className="quick-action" key={kind} onClick={() => openEntry(kind)}><span className={`quick-icon ${meta.tone}`}><Icon name={meta.icon} /></span><span>{meta.label}</span></button>; })}
                <button className="quick-action" onClick={openLoans}><span className="quick-icon amber"><Icon name="bank" /></span><span>وام و اقساط</span></button>
                <button className="quick-action" onClick={openChecks}><span className="quick-icon violet"><Icon name="check" /></span><span>چک‌ها</span></button>
              </div>

              <div className="section-title"><h2>نزدیک‌ترین سررسیدها</h2><button onClick={() => setTab("calendar")}>مشاهده همه</button></div>
              <div className="surface-list due-list">
                {upcoming.slice(0, 3).map((item) => <DueItemRow key={item.id} item={item} onEntryToggle={() => item.source === "entry" && void post({ operation: "toggle_entry", id: item.entry.id }, { close: false })} onEntryEdit={() => item.source === "entry" && openEntry(item.entry.kind, item.entry)} onLoanPaid={() => item.source === "loan" && markInstallmentPaid(item.loan, item.installment)} onLoanPayment={() => item.source === "loan" && openLoanPayment(item.loan, item.installment)} onCheckOpen={() => item.source === "check" && openCheckForm(item.check)} onCheckClear={() => item.source === "check" && updateCheckStatus(item.check, "cleared")} />)}
                {!upcoming.length && <EmptyState icon="calendar-check" title="سررسید نزدیکی نداری" detail="چک، بدهی تاریخ‌دار یا قسط بعدی را ثبت کن تا به‌موقع ببینی." action="ثبت چک" onAction={() => openCheckForm()} />}
              </div>

              <div className="section-title"><h2>دفتر کل اشخاص</h2><button onClick={() => setTab("ledger")}>مشاهده همه</button></div>
              <div className="account-mini-list">
                {data.accounts.slice(0, 3).map((account) => <button key={account.personId} onClick={() => openPersonLedger(account.personId)}><span className="mini-avatar"><Icon name="user" size={14} /></span><div><strong>{account.name}</strong><small>مستقیم {shortMoney(account.directBalance)} • چک {shortMoney(account.checkBalance)} • دُنگ {shortMoney(account.dongBalance)}</small></div><b className={account.finalBalance >= 0 ? "text-green" : "text-coral"}>{balanceLabel(account.finalBalance)}</b></button>)}
                {!data.accounts.length && <EmptyState icon="book" title="هنوز طرف حسابی نداری" detail="یک شخص اضافه کن تا دفتر کل او ساخته شود." action="افزودن شخص" onAction={() => setSheet("person")} />}
              </div>

              <div className="section-title"><h2>چک‌ها</h2><button onClick={openChecks}>چک‌های من</button></div>
              {data.checks.some((check) => check.financialOpen) ? <button className="check-home-card" onClick={openChecks}><span className="quick-icon violet"><Icon name="check" /></span><div><strong>{number.format(data.checks.filter((check) => check.financialOpen).length)} چک برای پیگیری</strong><small>{number.format(data.checks.filter((check) => check.financialOpen && check.direction === "received" && check.currentHolderName !== "من").length)} واگذار شده • {number.format(data.checks.filter((check) => check.overdue).length)} سررسید گذشته</small></div><b>پیگیری ›</b></button> : <EmptyState icon="check" title="چک بازی نداری" detail="فقط ثبت کن از کی گرفتی یا به کی دادی؛ جزئیات بیشتر اختیاری است." action="ثبت چک" onAction={() => openCheckForm()} />}

              <div className="section-title"><h2>وام و اقساط</h2><button onClick={openLoans}>مدیریت وام‌ها</button></div>
              {data.loans.some((loan) => loan.remainingAmount > 0) ? <button className="loan-home-card" onClick={openLoans}><span className="quick-icon amber"><Icon name="bank" /></span><div><strong>{number.format(data.loans.filter((loan) => loan.remainingAmount > 0).length)} قرارداد فعال</strong><small>مانده کل تعهد اقساطی</small></div><b>{money(loanDebt)}</b></button> : <EmptyState icon="bank" title="وام فعالی ثبت نشده" detail="وام بانکی یا خرید اقساطی فروشگاهی را مستقل از دفتر اشخاص مدیریت کن." action="ثبت وام / خرید اقساطی" onAction={() => openLoanForm()} />}

              <div className="section-title"><h2>دُنگ‌های فعال</h2><button onClick={() => setTab("groups")}>مدیریت دُنگ‌ها</button></div>
              {data.groups[0] ? <GroupPreview group={data.groups[0]} onClick={() => setTab("groups")} /> : <EmptyState icon="users" title="هنوز گروه دُنگی نداری" detail="برای سفر، خانه یا دورهمی یک گروه بساز و سهم‌ها را مشخص کن." action="ساخت گروه" onAction={() => beginGroup()} />}
            </section>
          )}

          {tab === "ledger" && (
            <section className="page">
              <div className="page-heading"><div><p className="eyebrow">همه روابط مالی در یک جا</p><h2>دفتر کل اشخاص</h2></div><button className="small-primary" onClick={() => setSheet("person")}>+ شخص جدید</button></div>
              <SearchField value={ledgerSearch} onChange={setLedgerSearch} placeholder="جست‌وجوی شخص، عنوان یا یادداشت..." />
              <div className="people-scroll">
                {filteredAccounts.map((account) => <PersonAccountCard key={account.personId} account={account} onOpen={() => openPersonLedger(account.personId)} onDelete={() => { const person = people.find((item) => item.id === account.personId); if (person) deletePerson(person); }} />)}
                {!filteredAccounts.length && <button className="person-card add-person-card" onClick={() => setSheet("person")}><span><Icon name="user-plus" size={20} /></span><strong>{people.length ? "نتیجه‌ای پیدا نشد" : "افزودن شخص"}</strong><small>{people.length ? "عبارت جست‌وجو را تغییر بده" : "اولین حساب را بساز"}</small></button>}
              </div>
              <div className="section-title"><h2>ثبت‌های مستقیم</h2><button onClick={() => setSheet("actions")}>+ ثبت جدید</button></div>
              <div className="filter-row"><button className={entryFilter === "all" ? "active" : ""} onClick={() => setEntryFilter("all")}>همه</button><button className={entryFilter === "open" ? "active" : ""} onClick={() => setEntryFilter("open")}>باز</button><button className={entryFilter === "paid" ? "active" : ""} onClick={() => setEntryFilter("paid")}>تسویه‌شده</button></div>
              <div className="surface-list entries-list">
                {filteredEntries.map((entry) => <EntryRow key={entry.id} entry={entry} onToggle={() => void post({ operation: "toggle_entry", id: entry.id }, { close: false })} onEdit={() => openEntry(entry.kind, entry)} onDelete={() => deleteEntry(entry)} />)}
                {!filteredEntries.length && <EmptyState icon="book" title="ثبت مطابق فیلتر پیدا نشد" detail="ثبت جدید بساز یا جست‌وجو و فیلتر را تغییر بده." action="ثبت مالی" onAction={() => setSheet("actions")} />}
              </div>
            </section>
          )}

          {tab === "groups" && (
            <section className="page">
              <div className="page-heading"><div><p className="eyebrow">خرج‌های مشترک و تسویه واقعی</p><h2>مدیریت دُنگ</h2></div><button className="small-primary" onClick={() => beginGroup()}>+ گروه جدید</button></div>
              <SearchField value={groupSearch} onChange={setGroupSearch} placeholder="جست‌وجوی گروه، عضو یا خرید..." />
              {data.groups.length > 0 && <button className="expense-cta" onClick={() => openExpense()}><span className="expense-plus">+</span><span><strong>ثبت خرید مشترک</strong><small>افراد همین خرید و سهم هر نفر را مشخص کن</small></span><b>‹</b></button>}
              <div className="groups-stack">
                {filteredGroups.map((group) => <GroupCard key={group.id} group={group} onEditGroup={() => beginGroup(group)} onDeleteGroup={() => deleteGroup(group)} onExpense={() => openExpense(group.id)} onEditExpense={(expense) => openExpense(group.id, expense)} onDeleteExpense={deleteExpense} onSettlement={(suggestion) => openSettlement(group, suggestion)} onManualSettlement={() => openSettlement(group)} onDeleteSettlement={deleteSettlement} />)}
                {!filteredGroups.length && <EmptyState icon="users" title={data.groups.length ? "گروهی پیدا نشد" : "دُنگ‌ها از اینجا ساده می‌شوند"} detail={data.groups.length ? "عبارت جست‌وجو را تغییر بده." : "اعضا را انتخاب کن؛ در هر خرید هم می‌توانی شرکت‌کننده‌ها و سهم‌ها را جداگانه تعیین کنی."} action={data.groups.length ? "پاک کردن جست‌وجو" : "ساخت اولین گروه"} onAction={() => data.groups.length ? setGroupSearch("") : beginGroup()} />}
              </div>
            </section>
          )}

          {tab === "loans" && (
            <section className="page loans-page">
              <div className="page-heading"><div><p className="eyebrow">تعهدهای بانکی و خریدهای اقساطی</p><h2>وام و اقساط</h2></div><button className="small-primary" onClick={() => openLoanForm()}>+ قرارداد جدید</button></div>
              <div className="loan-summary-grid"><div><small>مانده کل</small><strong>{money(loanDebt)}</strong></div><div><small>عقب‌افتاده</small><strong className={(data.loans.reduce((sum, loan) => sum + loan.overdueCount, 0)) > 0 ? "text-coral" : "text-green"}>{number.format(data.loans.reduce((sum, loan) => sum + loan.overdueCount, 0))} قسط</strong></div><div><small>قرارداد فعال</small><strong>{number.format(data.loans.filter((loan) => loan.remainingAmount > 0).length)}</strong></div></div>
              <SearchField value={loanSearch} onChange={setLoanSearch} placeholder="جست‌وجوی بانک، فروشگاه، قرارداد یا عنوان..." />
              <div className="filter-row"><button className={loanFilter === "active" ? "active" : ""} onClick={() => setLoanFilter("active")}>فعال</button><button className={loanFilter === "settled" ? "active" : ""} onClick={() => setLoanFilter("settled")}>تسویه‌شده</button><button className={loanFilter === "all" ? "active" : ""} onClick={() => setLoanFilter("all")}>همه</button></div>
              <div className="loan-stack">
                {filteredLoans.map((loan) => <LoanCard key={loan.id} loan={loan} onEdit={() => openLoanForm(loan)} onDelete={() => deleteLoan(loan)} onPayment={(installment) => openLoanPayment(loan, installment)} onDeletePayment={deleteLoanPayment} />)}
                {!filteredLoans.length && <EmptyState icon="bank" title={data.loans.length ? "قراردادی مطابق فیلتر پیدا نشد" : "اولین وام یا خرید اقساطی را ثبت کن"} detail={data.loans.length ? "جست‌وجو یا فیلتر را تغییر بده." : "بانک یا فروشگاه، مبلغ، تعداد قسط و اولین سررسید کافی است."} action={data.loans.length ? "نمایش همه" : "ثبت قرارداد"} onAction={() => data.loans.length ? setLoanFilter("all") : openLoanForm()} />}
              </div>
            </section>
          )}

          {tab === "checks" && (
            <section className="page checks-page">
              <div className="page-heading"><div><p className="eyebrow">گرفتم، دادم، واگذار کردم</p><h2>چک‌های من</h2></div><button className="small-primary" onClick={() => openCheckForm()}>+ چک جدید</button></div>
              <div className="check-summary-grid personal"><div><small>چک باز</small><strong>{number.format(data.checks.filter((check) => check.financialOpen).length)} مورد</strong></div><div><small>الان دست من</small><strong>{number.format(data.checks.filter((check) => check.financialOpen && check.currentHolderName === "من").length)} مورد</strong></div><div><small>واگذار شده</small><strong>{number.format(data.checks.filter((check) => check.financialOpen && check.direction === "received" && check.currentHolderName !== "من").length)} مورد</strong></div></div>
              <SearchField value={checkSearch} onChange={setCheckSearch} placeholder="جست‌وجوی صیاد، بانک، طرف حساب یا بابت..." />
              <div className="filter-row"><button className={checkFilter === "active" ? "active" : ""} onClick={() => setCheckFilter("active")}>باز</button><button className={checkFilter === "received" ? "active" : ""} onClick={() => setCheckFilter("received")}>دریافتی</button><button className={checkFilter === "issued" ? "active" : ""} onClick={() => setCheckFilter("issued")}>پرداختی</button><button className={checkFilter === "closed" ? "active" : ""} onClick={() => setCheckFilter("closed")}>مختومه</button><button className={checkFilter === "all" ? "active" : ""} onClick={() => setCheckFilter("all")}>همه</button></div>
              <div className="check-stack">{filteredChecks.map((check) => <CheckCard key={check.id} check={check} onEdit={() => openCheckForm(check)} onDelete={() => deleteCheck(check)} onStatus={(status) => updateCheckStatus(check, status)} onTransfer={() => openCheckTransfer(check)} onReturn={() => returnCheckToMe(check)} />)}{!filteredChecks.length && <EmptyState icon="check" title={data.checks.length ? "چکی مطابق فیلتر پیدا نشد" : "اولین چک را ثبت کن"} detail={data.checks.length ? "جست‌وجو یا فیلتر را تغییر بده." : "از کی گرفتی یا به کی دادی، مبلغ و سررسید را ثبت کن؛ بقیه جزئیات اختیاری است."} action={data.checks.length ? "نمایش همه" : "ثبت چک"} onAction={() => data.checks.length ? setCheckFilter("all") : openCheckForm()} />}</div>
            </section>
          )}

          {tab === "calendar" && (
            <section className="page">
              <div className="page-heading"><div><p className="eyebrow">مثل یک To‑Do مالی</p><h2>سررسیدها</h2></div><button className="small-primary" onClick={openChecks}>چک‌های من</button></div>
              <div className="due-toolbar">
                <div className="filter-row due-range-filter">
                  <button className={dueRange === "current" ? "active" : ""} onClick={() => setDueRange("current")}><strong>این ماه</strong><small>{jalaliMonthName(currentJalaliMonth.jm)}</small></button>
                  <button className={dueRange === "next" ? "active" : ""} onClick={() => setDueRange("next")}><strong>ماه بعد</strong><small>{jalaliMonthName(nextJalaliMonth.jm)}</small></button>
                  <button className={dueRange === "all" ? "active" : ""} onClick={() => setDueRange("all")}><strong>همه</strong><small>کل سررسیدها</small></button>
                </div>
                <button className={`hide-completed-due ${hideCompletedDue ? "active" : ""}`} onClick={() => setHideCompletedDue((current) => !current)}>
                  <span>{hideCompletedDue ? "نمایش انجام‌شده‌ها" : "مخفی کردن انجام‌شده‌ها"}</span>
                  <b>{number.format(completedDueCount)}</b>
                </button>
              </div>
              <div className="timeline">
                {calendarDueItems.map((item) => <div className={`timeline-row ${item.completed ? "completed" : ""}`} key={item.id}><div className={`date-badge ${item.overdue ? "overdue" : ""} ${item.completed ? "completed" : ""}`}><strong>{persianDate(item.date).split(" ")[0]}</strong><span>{persianDate(item.date).split(" ").slice(1).join(" ")}</span></div><DueItemRow item={item} compact onEntryToggle={() => item.source === "entry" && void post({ operation: "toggle_entry", id: item.entry.id }, { close: false })} onEntryEdit={() => item.source === "entry" && openEntry(item.entry.kind, item.entry)} onLoanPaid={() => item.source === "loan" && markInstallmentPaid(item.loan, item.installment)} onLoanPayment={() => item.source === "loan" && openLoanPayment(item.loan, item.installment)} onCheckOpen={() => item.source === "check" && openCheckForm(item.check)} onCheckClear={() => item.source === "check" && updateCheckStatus(item.check, "cleared")} /></div>)}
                {!calendarDueItems.length && <EmptyState icon="calendar" title={hideCompletedDue && completedDueCount ? "همه کارهای این بازه انجام شده" : "برای این بازه سررسیدی نداری"} detail={hideCompletedDue && completedDueCount ? "برای دیدن موارد پرداخت‌شده و پاس‌شده، نمایش انجام‌شده‌ها را روشن کن." : "فیلتر ماه را عوض کن یا یک قسط، چک یا بدهی تاریخ‌دار ثبت کن."} action={dueRange === "current" ? "دیدن ماه بعد" : "نمایش همه"} onAction={() => setDueRange(dueRange === "current" ? "next" : "all")} />}
              </div>
            </section>
          )}
        </>
      )}

      <nav className="bottom-nav" aria-label="منوی اصلی">
        <NavButton active={tab === "home"} icon="home" label="خانه" onClick={() => setTab("home")} />
        <NavButton active={tab === "ledger"} icon="book" label="دفتر" onClick={() => setTab("ledger")} />
        <button className="nav-add" aria-label="ثبت جدید" onClick={() => setSheet("actions")}>+</button>
        <NavButton active={tab === "groups"} icon="users" label="دُنگ‌ها" onClick={() => setTab("groups")} />
        <NavButton active={tab === "checks"} icon="check" label="چک‌ها" onClick={openChecks} />
        <NavButton active={tab === "calendar"} icon="calendar" label="سررسید" onClick={() => setTab("calendar")} />
      </nav>

      {sheet && <div className="sheet-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setSheet(null); }}>
        <section className="bottom-sheet" role="dialog" aria-modal="true">
          <div className="sheet-handle" />
          <button className="sheet-close" onClick={() => setSheet(null)} aria-label="بستن">×</button>
          {sheet === "actions" && <ActionSheet onEntry={(kind) => openEntry(kind)} onLoan={openLoans} onCheck={() => openCheckForm()} onPerson={() => setSheet("person")} onGroup={() => beginGroup()} onExpense={() => openExpense()} hasGroup={Boolean(data?.groups.length)} />}
          {sheet === "person" && <PersonForm onSubmit={submitPerson} busy={busy} />}
          {sheet === "entry" && <EntryForm key={editingEntry?.id ?? `new-${entryKind}`} kind={entryKind} people={people} initialEntry={editingEntry} onNeedPerson={() => setSheet("person")} onSubmit={submitEntry} busy={busy} />}
          {sheet === "group" && <GroupForm key={editingGroup?.id ?? "new-group"} persons={data?.persons ?? []} values={groupMembers} setValues={setGroupMembers} initialGroup={editingGroup} onSubmit={submitGroup} onNeedPerson={() => setSheet("person")} busy={busy} />}
          {sheet === "expense" && <ExpenseForm key={`${editingExpense?.expense.id ?? "new"}-${selectedExpenseGroup?.id ?? "none"}`} groups={data?.groups ?? []} selectedGroup={editingExpense?.group ?? selectedExpenseGroup} initialExpense={editingExpense?.expense} onGroupChange={(id) => { setEditingExpenseId(null); setExpenseGroupId(id); }} onSubmit={submitExpense} onNeedGroup={() => beginGroup()} busy={busy} />}
          {sheet === "settlement" && settlementDraft && <SettlementForm group={data?.groups.find((group) => group.id === settlementDraft.groupId)} draft={settlementDraft} onSubmit={submitSettlement} busy={busy} />}
          {sheet === "person-ledger" && selectedAccount && <PersonLedgerSheet account={selectedAccount} onEditEntry={(entryId) => { const entry = data?.entries.find((item) => item.id === entryId); if (entry) openEntry(entry.kind, entry); }} />}
          {sheet === "loan-form" && <LoanForm key={editingLoan?.id ?? "new-loan"} initialLoan={editingLoan} onSubmit={submitLoan} busy={busy} />}
          {sheet === "loan-payment" && paymentLoan && paymentInstallment && <LoanPaymentForm loan={paymentLoan} installment={paymentInstallment} onSubmit={submitLoanPayment} busy={busy} />}
          {sheet === "check-form" && <CheckForm key={editingCheck?.id ?? "new-check"} initialCheck={editingCheck} people={people} onSubmit={submitCheck} busy={busy} />}
          {sheet === "check-transfer" && transferCheck && <CheckTransferForm check={transferCheck} people={people} onSubmit={submitCheckTransfer} busy={busy} />}
          {sheet === "tools" && <ToolsSheet onExport={handleExport} onImport={handleImport} busy={busy} />}
        </section>
      </div>}
    </main>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: IconName; label: string; onClick: () => void }) {
  return <button className={active ? "active" : ""} onClick={onClick}><span><Icon name={icon} /></span><small>{label}</small></button>;
}

function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="search-field"><Icon name="search" size={17} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /><span>{value && <button type="button" onClick={() => onChange("")} aria-label="پاک کردن جست‌وجو">×</button>}</span></label>;
}

function EntryRow({ entry, onToggle, onEdit, onDelete, compact = false }: { entry: Entry; onToggle: () => void; onEdit: () => void; onDelete: () => void; compact?: boolean }) {
  const meta = entryMeta[entry.kind] ?? entryMeta.debt;
  return <article className={`entry-row ${entry.status === "paid" ? "paid" : ""} ${compact ? "compact" : ""}`}>
    <span className={`entry-icon ${meta.tone}`}><Icon name={meta.icon} /></span>
    <div className="entry-copy"><strong>{entry.title}</strong><small>{entry.personName}{entry.dueDate ? ` • ${persianDate(entry.dueDate)}` : ""}</small></div>
    <div className="entry-amount"><strong className={entry.direction === "receivable" ? "text-green" : "text-coral"}>{entry.direction === "receivable" ? "+" : "−"}{shortMoney(entry.amount)}</strong><div className="entry-actions"><button onClick={onToggle}>{entry.status === "paid" ? "بازگردانی" : "تسویه"}</button><button onClick={onEdit} aria-label="ویرایش"><Icon name="edit" size={13} /></button><button onClick={onDelete} aria-label="حذف"><Icon name="trash" size={13} /></button></div></div>
  </article>;
}

function DueItemRow({ item, onEntryToggle, onEntryEdit, onLoanPaid, onLoanPayment, onCheckOpen, onCheckClear, compact = false }: { item: DueItem; onEntryToggle: () => void; onEntryEdit: () => void; onLoanPaid: () => void; onLoanPayment: () => void; onCheckOpen: () => void; onCheckClear: () => void; compact?: boolean }) {
  const icon: IconName = item.source === "loan" ? (item.loan.providerType === "store" ? "store" : "bank") : item.source === "check" ? "check" : item.entry.kind === "check" ? "check" : item.entry.direction === "receivable" ? "receivable" : "debt";
  const positive = item.source === "check" ? item.check.direction === "received" : item.source === "entry" && item.entry.direction === "receivable";
  return <article className={`due-item-row ${compact ? "compact" : ""} ${item.overdue ? "overdue" : ""} ${item.completed ? "completed" : ""}`}>
    <span className={`due-source ${item.source}`}><Icon name={item.completed ? "calendar-check" : icon} size={16} /></span>
    <div className="due-copy"><strong>{item.title}</strong><small>{item.detail} • {persianDate(item.date, true)}</small></div>
    <div className="due-amount">
      <strong className={item.completed ? "text-muted" : positive ? "text-green" : "text-coral"}>{positive ? "+" : "−"}{money(item.amount)}</strong>
      {item.completed
        ? <span className="due-completed-label"><Icon name="calendar-check" size={12} /> {item.completionLabel}</span>
        : item.source === "loan"
          ? <span className="due-entry-actions"><button className="quick-paid" onClick={onLoanPaid}>پرداخت شد</button><button onClick={onLoanPayment} aria-label="ثبت پرداخت جزئی یا تاریخ دیگر"><Icon name="edit" size={12} /></button></span>
          : item.source === "check"
            ? <span className="due-entry-actions"><button onClick={onCheckClear}>{item.check.direction === "received" ? "وصول شد" : "پاس شد"}</button><button onClick={onCheckOpen} aria-label="جزئیات چک"><Icon name="edit" size={12} /></button></span>
            : <span className="due-entry-actions"><button onClick={onEntryToggle}>تسویه</button><button onClick={onEntryEdit} aria-label="ویرایش سررسید"><Icon name="edit" size={12} /></button></span>}
    </div>
  </article>;
}

function CheckCard({ check, onEdit, onDelete, onStatus, onTransfer, onReturn }: { check: CheckRecord; onEdit: () => void; onDelete: () => void; onStatus: (status: CheckRecord["status"]) => void; onTransfer: () => void; onReturn: () => void }) {
  const stateTone = check.status === "bounced" ? "danger" : check.financialOpen ? "active" : "closed";
  const movementLabel = check.direction === "received"
    ? (check.currentHolderName === "من" ? `از ${check.counterpartyName} گرفتم • الان دست من` : `از ${check.counterpartyName} گرفتم • الان نزد ${check.currentHolderName}`)
    : `به ${check.currentHolderName || check.counterpartyName} دادم`;
  const eventLabel = (type: CheckRecord["events"][number]["type"], event: CheckRecord["events"][number]) => {
    if (type === "received") return `از ${event.fromName} گرفتم`;
    if (type === "issued") return `به ${event.toName} دادم`;
    if (type === "transferred") return `به ${event.toName} واگذار کردم`;
    if (type === "cleared") return check.direction === "received" ? "وصول شد" : "پاس شد";
    if (type === "bounced") return "برگشت خورد";
    if (type === "returned") return event.toName === "من" ? `از ${event.fromName} دوباره دست من برگشت` : "عودت شد";
    if (type === "cancelled") return "باطل شد";
    return "دوباره در جریان قرار گرفت";
  };
  return <article className={`check-card ${check.direction} ${stateTone}`}>
    <div className="check-card-head"><span className="check-doc-icon"><Icon name="check" size={19} /></span><div><small>{check.direction === "received" ? "گرفتم" : "دادم"} • {check.bankName}</small><h3>{check.purpose}</h3><i>{movementLabel}</i></div><span className="check-card-actions"><button onClick={onEdit} aria-label="ویرایش چک"><Icon name="edit" size={13} /></button><button className="danger" onClick={onDelete} aria-label="حذف چک"><Icon name="trash" size={13} /></button></span></div>
    <div className="check-personal-summary"><div><small>مبلغ</small><strong className={check.direction === "received" ? "text-green" : "text-coral"}>{money(check.amount)}</strong></div><div><small>سررسید</small><strong className={check.overdue ? "text-coral" : ""}>{persianDate(check.dueDate, true)}</strong></div><span className={`check-status-pill ${stateTone}`}>{checkStatusLabel[check.status]}</span></div>
    {check.financialOpen && <div className="check-primary-actions">{check.direction === "received" && check.currentHolderName === "من" && <button onClick={onTransfer}>واگذار کردم</button>}{check.direction === "received" && check.currentHolderName !== "من" && <button className="soft" onClick={onReturn}>دوباره دست من برگشت</button>}<button className="success" onClick={() => onStatus("cleared")}>{check.direction === "received" ? "وصول شد" : "پاس شد"}</button><button className="danger" onClick={() => onStatus("bounced")}>برگشت خورد</button></div>}
    <details className="check-details"><summary>جزئیات و مسیر چک <b>{number.format(check.events.length)} رویداد</b></summary>
      <div className="check-parties"><span><small>از / طرف حساب</small><b>{check.counterpartyName}</b></span><span><small>صادرکننده</small><b>{check.issuerName}</b></span><span><small>الان دست کیه؟</small><b>{check.currentHolderName}</b></span>{check.transferorName && <span><small>واگذارکننده اولیه</small><b>{check.transferorName}</b></span>}</div>
      <div className="check-meta-row"><span>صیاد: <b>{check.sayadId || "ثبت نشده"}</b></span><span>{sayadStatusLabel[check.sayadStatus]}</span>{check.branchName && <span>شعبه: <b>{check.branchName}</b></span>}{check.chequeNumber && <span>شماره: <b>{check.chequeNumber}</b></span>}<span>{check.countInBalance ? "در مانده حساب هست" : "فقط برای رهگیری"}</span></div>
      {check.events.length > 0 && <div className="check-timeline">{check.events.map((event) => <div key={event.id}><span className="timeline-dot" /><div><strong>{eventLabel(event.type, event)}</strong><small>{persianDate(event.eventDate, true)}{event.note ? ` • ${event.note}` : ""}</small></div></div>)}</div>}
      {check.note && <p className="check-note">{check.note}</p>}
      {check.status !== "open" && <button className="reopen-check" onClick={() => onStatus("open")}>برگردان به جریان</button>}
    </details>
  </article>;
}

function LoanCard({ loan, onEdit, onDelete, onPayment, onDeletePayment }: { loan: Loan; onEdit: () => void; onDelete: () => void; onPayment: (installment: LoanInstallment) => void; onDeletePayment: (id: number) => void }) {
  const progress = loan.totalPayable > 0 ? Math.min(100, Math.round((loan.totalPaid / loan.totalPayable) * 100)) : 0;
  const providerIcon: IconName = loan.providerType === "store" ? "store" : "bank";
  return <article className={`loan-card personal ${loan.remainingAmount === 0 ? "settled" : ""}`}>
    <div className="loan-card-head"><span className="loan-provider-icon"><Icon name={providerIcon} size={19} /></span><div><small>{loan.providerName}</small><h3>{loan.title}</h3><i>{number.format(loan.paidCount)} از {number.format(loan.installmentCount)} قسط پرداخت شده</i></div><span className="loan-card-actions"><button onClick={onEdit} aria-label="ویرایش"><Icon name="edit" size={13} /></button><button className="danger" onClick={onDelete} aria-label="حذف"><Icon name="trash" size={13} /></button></span></div>
    {loan.nextInstallment ? <div className={`next-installment personal ${loan.nextInstallment.overdue ? "overdue" : ""}`}><div><small>{loan.nextInstallment.overdue ? "این قسط عقب افتاده" : "قسط بعدی"}</small><strong>{persianDate(loan.nextInstallment.dueDate, true)}</strong></div><b>{money(loan.nextInstallment.remainingAmount)}</b><button onClick={() => onPayment(loan.nextInstallment)}>پرداخت</button></div> : <div className="loan-settled-banner"><Icon name="calendar-check" size={16} /> همه اقساط پرداخت شده‌اند</div>}
    <div className="loan-progress"><span><i style={{ width: `${progress}%` }} /></span><small>{number.format(progress)}٪ جلو رفته</small></div>
    <div className="loan-personal-stats"><span><small>مانده</small><strong className={loan.remainingAmount ? "text-coral" : "text-green"}>{loan.remainingAmount ? money(loan.remainingAmount) : "تمام شد"}</strong></span>{loan.overdueCount > 0 && <span className="danger"><small>عقب‌افتاده</small><strong>{number.format(loan.overdueCount)} قسط</strong></span>}</div>
    <details className="loan-schedule personal"><summary><span>جزئیات و همه قسط‌ها</span><b>{number.format(loan.installmentCount)} نوبت</b></summary><div className="loan-extra"><div className="loan-money-grid"><div><small>کل</small><strong>{money(loan.totalPayable)}</strong></div><div><small>پرداخت‌شده</small><strong className="text-green">{money(loan.totalPaid)}</strong></div><div><small>مانده</small><strong>{money(loan.remainingAmount)}</strong></div></div>{loan.contractNumber && <p className="loan-note">شماره قرارداد: {loan.contractNumber}</p>}{loan.financeCost > 0 && <p className="loan-finance-cost">اختلاف مبلغ پایه و کل پرداخت: <b>{money(loan.financeCost)}</b></p>}<div className="loan-installment-list">{loan.installments.map((installment) => <article key={installment.id} className={`${installment.status} ${installment.overdue ? "overdue" : ""}`}><span className="installment-number">{number.format(installment.number)}</span><div><strong>{persianDate(installment.dueDate, true)}</strong><small>{installment.status === "paid" ? "پرداخت شد" : installment.status === "partial" ? `بخشی پرداخت شده` : installment.overdue ? "عقب افتاده" : "هنوز نرسیده"}</small></div><b>{money(installment.remainingAmount || installment.amount)}</b>{installment.remainingAmount > 0 && <button onClick={() => onPayment(installment)}>پرداخت</button>}{installment.payments.length > 0 && <details className="installment-payments"><summary>{number.format(installment.payments.length)} پرداخت</summary><div>{installment.payments.map((payment) => <span key={payment.id}><i>{persianDate(payment.paymentDate, true)}{payment.note ? ` • ${payment.note}` : ""}</i><b>{money(payment.amount)}</b><button onClick={() => onDeletePayment(payment.id)} aria-label="حذف پرداخت"><Icon name="trash" size={11} /></button></span>)}</div></details>}</article>)}</div>{loan.note && <p className="loan-note">{loan.note}</p>}</div></details>
  </article>;
}

function EmptyState({ icon, title, detail, action, onAction }: { icon: IconName; title: string; detail: string; action: string; onAction: () => void }) {
  return <div className="empty-state"><span><Icon name={icon} size={24} /></span><strong>{title}</strong><p>{detail}</p><button onClick={onAction}>{action}</button></div>;
}

function PersonAccountCard({ account, onOpen, onDelete }: { account: PersonAccount; onOpen: () => void; onDelete: () => void }) {
  return <article className="person-card account-card">
    <button className="delete-person" onClick={onDelete} aria-label={`حذف ${account.name}`}>×</button>
    <button className="person-card-main" onClick={onOpen}>
      <span className="person-avatar" style={{ background: account.color }}><Icon name="user" size={18} /></span>
      <strong>{account.name}</strong>
      <small className={account.finalBalance >= 0 ? "text-green" : "text-coral"}>{balanceLabel(account.finalBalance)}</small>
      <span className="account-split"><i>مستقیم {shortMoney(account.directBalance)}</i><i>دُنگ {shortMoney(account.dongBalance)}</i></span>
    </button>
  </article>;
}

function GroupPreview({ group, onClick }: { group: Group; onClick: () => void }) {
  return <button className="group-preview" onClick={onClick}>
    <div className="group-preview-top"><span className="group-mark"><Icon name="users" size={19} /></span><div><strong>{group.name}</strong><small>{number.format(group.members.length)} نفر • {number.format(group.expenses.length)} خرید</small></div><b>{money(group.totalSpent)}</b></div>
    <div className="member-stack">{group.members.slice(0, 4).map((member) => <span key={member.personId} title={member.name}><Icon name="user" size={13} /></span>)}</div>
  </button>;
}

function GroupCard({ group, onEditGroup, onDeleteGroup, onExpense, onEditExpense, onDeleteExpense, onSettlement, onManualSettlement, onDeleteSettlement }: { group: Group; onEditGroup: () => void; onDeleteGroup: () => void; onExpense: () => void; onEditExpense: (expense: Expense) => void; onDeleteExpense: (expense: Expense) => void; onSettlement: (suggestion: SettlementSuggestion) => void; onManualSettlement: () => void; onDeleteSettlement: (id: number) => void }) {
  return <article className="group-card">
    <div className="group-card-head"><div className="group-title"><span className="group-mark"><Icon name="users" size={19} /></span><div><h3>{group.name}</h3><p>{number.format(group.members.length)} عضو فعال • جمع هزینه {money(group.totalSpent)}</p></div></div><div className="group-head-actions"><button className="group-icon-action" onClick={onEditGroup} aria-label={`ویرایش گروه ${group.name}`} title="ویرایش گروه"><Icon name="edit" size={13} /></button><button className="group-icon-action danger" onClick={onDeleteGroup} aria-label={`حذف گروه ${group.name}`} title="حذف گروه"><Icon name="trash" size={13} /></button><button onClick={onManualSettlement}><Icon name="settlement" size={13} /> تسویه</button><button onClick={onExpense}>+ خرید</button></div></div>
    <div className="balances-list">
      {group.balances.map((balance) => <div key={balance.personId}><span className="mini-avatar"><Icon name="user" size={14} /></span><strong>{balance.name}</strong><small>خرج کرده {money(balance.paid)} • سهم {money(balance.owed)}</small><b className={balance.balance >= 0 ? "text-green" : "text-coral"}>{balance.balance === 0 ? "تسویه" : balance.balance > 0 ? `${shortMoney(balance.balance)} بستانکار` : `${shortMoney(-balance.balance)} بدهکار`}</b></div>)}
    </div>
    <div className="settlement-box"><div className="settlement-title"><strong>پیشنهاد تسویه</strong><small>{group.suggestions.length ? "بر اساس مانده فعلی" : "همه حساب‌ها تسویه‌اند"}</small></div>{group.suggestions.map((item) => <div className="settlement-row" key={`${item.fromPersonId}-${item.toPersonId}`}><p><span>{item.fromName}</span><i>←</i><span>{item.toName}</span><b>{money(item.amount)}</b></p><button onClick={() => onSettlement(item)}>ثبت تسویه</button></div>)}</div>
    {group.settlements.length > 0 && <details className="settlement-history"><summary><span><Icon name="settlement" size={15} />تسویه‌های ثبت‌شده</span><b>{number.format(group.settlements.length)} مورد</b></summary><div>{group.settlements.map((settlement) => <article key={settlement.id}><span className="transaction-icon"><Icon name="settlement" size={15} /></span><div><strong>{settlement.fromName} ← {settlement.toName}</strong><small>{persianDate(settlement.settlementDate)}{settlement.note ? ` • ${settlement.note}` : ""}</small></div><b>{money(settlement.amount)}</b><button onClick={() => onDeleteSettlement(settlement.id)} aria-label="حذف تسویه"><Icon name="trash" size={13} /></button></article>)}</div></details>}
    <details className="transaction-history" open>
      <summary><span><Icon name="receipt" size={16} />ریز تراکنش‌ها</span><b>{number.format(group.expenses.length)} مورد</b></summary>
      {group.expenses.length ? <div className="transaction-list">{group.expenses.map((expense) => <article className="expense-transaction" key={expense.id}>
        <div className="expense-transaction-head"><span className="transaction-icon"><Icon name="receipt" size={16} /></span><div><strong>{expense.title}</strong><small>پرداخت توسط {expense.payerName} • {persianDate(expense.expenseDate)}</small></div><b>{money(expense.amount)}</b><span className="transaction-actions"><button onClick={() => onEditExpense(expense)} aria-label="ویرایش خرید"><Icon name="edit" size={13} /></button><button onClick={() => onDeleteExpense(expense)} aria-label="حذف خرید"><Icon name="trash" size={13} /></button></span></div>
        <div className="expense-share-list">{expense.shares.map((share) => <span key={share.personId} className={share.amount === 0 ? "zero-share" : ""}><small>{share.name} • وزن {number.format(share.weight)}</small><strong>{money(share.amount)}</strong></span>)}</div>
      </article>)}</div> : <p className="no-transactions">هنوز خریدی در این گروه ثبت نشده است.</p>}
    </details>
  </article>;
}

function ActionSheet({ onEntry, onLoan, onCheck, onPerson, onGroup, onExpense, hasGroup }: { onEntry: (kind: string) => void; onLoan: () => void; onCheck: () => void; onPerson: () => void; onGroup: () => void; onExpense: () => void; hasGroup: boolean }) {
  return <><div className="sheet-title"><p>چه چیزی می‌خواهی ثبت کنی؟</p><h2>ثبت جدید</h2></div><div className="action-list">
    {(["debt", "receivable"] as const).map((kind) => { const meta = entryMeta[kind]; return <button key={kind} onClick={() => onEntry(kind)}><span className={`quick-icon ${meta.tone}`}><Icon name={meta.icon} /></span><div><strong>{meta.label}</strong><small>{kind === "debt" ? "بدهی مستقیم به یک شخص" : "طلب مستقیم از یک شخص"}</small></div><b>‹</b></button>; })}
    <button onClick={onLoan}><span className="quick-icon amber"><Icon name="bank" /></span><div><strong>وام و اقساط</strong><small>بانک، فروشگاه، مبلغ کل و برنامه اقساط</small></div><b>‹</b></button>
    <button onClick={onCheck}><span className="quick-icon violet"><Icon name="check" /></span><div><strong>چک</strong><small>دریافتی یا پرداختی، صیاد، بانک و طرف‌های سند</small></div><b>‹</b></button>
    <button onClick={hasGroup ? onExpense : onGroup}><span className="quick-icon blue"><Icon name="users" /></span><div><strong>{hasGroup ? "خرید دُنگی" : "گروه دُنگی"}</strong><small>{hasGroup ? "ثبت خرج مشترک با سهم اختصاصی" : "ساخت گروه و تعیین سهم‌های پیش‌فرض"}</small></div><b>‹</b></button>
    <button onClick={onPerson}><span className="quick-icon sand"><Icon name="user-plus" /></span><div><strong>شخص جدید</strong><small>افزودن به دفتر حساب‌های شخصی</small></div><b>‹</b></button>
  </div></>;
}

function PersonForm({ onSubmit, busy }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <form onSubmit={onSubmit}><div className="sheet-title"><p>یک نفر را به دفترت اضافه کن</p><h2>شخص جدید</h2></div><label>نام و نام خانوادگی<input name="name" autoFocus required placeholder="مثلاً علی رضایی" /></label><label>شماره تماس <small>(اختیاری)</small><input name="phone" inputMode="tel" placeholder="۰۹۱۲۱۲۳۴۵۶۷" /></label><SubmitButton busy={busy} label="افزودن به دفتر" /></form>;
}

function EntryForm({ kind, people, initialEntry, onNeedPerson, onSubmit, busy }: { kind: string; people: Person[]; initialEntry?: Entry; onNeedPerson: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  const meta = entryMeta[kind];
  if (!people.length) return <div className="form-empty"><span className={`quick-icon ${meta.tone}`}><Icon name={meta.icon} /></span><h2>اول یک شخص اضافه کن</h2><p>هر ثبت مالی باید به یک نفر وصل باشد.</p><button className="submit-button" onClick={onNeedPerson}>افزودن شخص</button></div>;
  return <form onSubmit={onSubmit}><div className="sheet-title"><p>{initialEntry ? "اطلاعات ثبت را اصلاح کن" : "جزئیات را وارد کن"}</p><h2>{initialEntry ? "ویرایش" : "ثبت"} {meta.label}</h2></div>
    <label>طرف حساب<select name="personId" required defaultValue={initialEntry?.personId ?? ""}><option value="" disabled>انتخاب شخص</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
    {(kind === "installment" || kind === "check") && <input type="hidden" name="direction" value={initialEntry?.direction ?? "debt"} />}
    <label>عنوان<input name="title" required defaultValue={initialEntry?.title ?? ""} placeholder={kind === "installment" ? "ثبت قدیمی قسط" : kind === "check" ? "مثلاً چک اجاره" : "بابت چه چیزی؟"} /></label>
    <MoneyInput name="amount" label="مبلغ (تومان)" required defaultValue={initialEntry?.amount} placeholder="مثلاً ۲٬۵۰۰٬۰۰۰" />
    <JalaliDatePicker name="dueDate" label="تاریخ سررسید شمسی" optional initialValue={initialEntry?.dueDate ? isoToJalaliInput(initialEntry.dueDate) : ""} />
    <label>یادداشت <small>(اختیاری)</small><textarea name="note" rows={2} defaultValue={initialEntry?.note ?? ""} placeholder="توضیح کوتاه..." /></label>
    <SubmitButton busy={busy} label={initialEntry ? "ذخیره تغییرات" : `ثبت ${meta.label}`} />
  </form>;
}

function CheckForm({ initialCheck, people, onSubmit, busy }: { initialCheck?: CheckRecord; people: Person[]; onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  const [direction, setDirection] = useState<CheckRecord["direction"]>(initialCheck?.direction ?? "received");
  const [checkType, setCheckType] = useState<CheckRecord["checkType"]>(initialCheck?.checkType ?? "sayadi");
  const [counterpartyMode, setCounterpartyMode] = useState<"person" | "custom">(initialCheck?.relatedPersonId ? "person" : "custom");
  const [relatedPersonId, setRelatedPersonId] = useState(initialCheck?.relatedPersonId ? String(initialCheck.relatedPersonId) : "");
  const [customCounterparty, setCustomCounterparty] = useState(initialCheck?.relatedPersonId ? "" : initialCheck?.counterpartyName ?? "");
  const [issuerName, setIssuerName] = useState(initialCheck?.issuerName ?? (initialCheck?.direction === "issued" ? "من" : ""));
  const [beneficiaryName, setBeneficiaryName] = useState(initialCheck?.beneficiaryName ?? (initialCheck?.direction === "received" ? "من" : ""));
  const selectedPerson = people.find((person) => person.id === Number(relatedPersonId));
  const partyName = counterpartyMode === "person" ? selectedPerson?.name ?? "" : customCounterparty;
  function chooseDirection(next: CheckRecord["direction"]) {
    if (next === direction) return;
    setDirection(next);
    if (!initialCheck) {
      setIssuerName(next === "issued" ? "من" : "");
      setBeneficiaryName(next === "received" ? "من" : "");
    }
  }
  return <form onSubmit={onSubmit}><div className="sheet-title"><p>ساده ثبتش کن؛ جزئیات همیشه بعداً قابل تکمیل‌اند</p><h2>{initialCheck ? "ویرایش چک" : "چک جدید"}</h2></div>
    <div className="check-direction-picker personal"><button type="button" className={direction === "received" ? "active received" : ""} onClick={() => chooseDirection("received")}><Icon name="receivable" size={16} /><span><strong>گرفتم</strong><small>یک چک دست من آمده</small></span></button><button type="button" className={direction === "issued" ? "active issued" : ""} onClick={() => chooseDirection("issued")}><Icon name="debt" size={16} /><span><strong>دادم</strong><small>یک چک از من خارج شده</small></span></button></div>
    <input type="hidden" name="direction" value={direction} />
    <div className="check-counterparty-tabs"><button type="button" className={counterpartyMode === "person" ? "active" : ""} onClick={() => setCounterpartyMode("person")}>از آدم‌های دفتر</button><button type="button" className={counterpartyMode === "custom" ? "active" : ""} onClick={() => setCounterpartyMode("custom")}>شخص / فروشگاه دیگر</button></div>
    {counterpartyMode === "person" ? <label>{direction === "received" ? "از چه کسی گرفتم؟" : "به چه کسی دادم؟"}<select name="relatedPersonId" required value={relatedPersonId} onChange={(event) => setRelatedPersonId(event.target.value)}><option value="" disabled>انتخاب شخص</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select><input type="hidden" name="counterpartyName" value={partyName} /></label> : <><input type="hidden" name="relatedPersonId" value="" /><label>{direction === "received" ? "از چه کسی گرفتم؟" : "به چه کسی دادم؟"}<input name="counterpartyName" required value={customCounterparty} onChange={(event) => setCustomCounterparty(event.target.value)} placeholder="مثلاً علی، فروشگاه ایکس یا شرکت آلفا" /></label></>}
    <MoneyInput name="amount" label="مبلغ (تومان)" required defaultValue={initialCheck?.amount} placeholder="مثلاً ۲۵٬۰۰۰٬۰۰۰" />
    <label>بابت چی؟<input name="purpose" required defaultValue={initialCheck?.purpose ?? ""} placeholder="مثلاً اجاره، خرید یا تسویه" /></label>
    <JalaliDatePicker name="dueDate" label="کی باید پاس بشه؟" required initialValue={initialCheck ? isoToJalaliInput(initialCheck.dueDate) : ""} />
    <label>کدوم بانک؟<input name="bankName" required defaultValue={initialCheck?.bankName ?? ""} placeholder="مثلاً بانک ملت" /></label>
    <label>شناسه صیاد <small>(اختیاری؛ بعداً هم می‌تونی اضافه کنی)</small><input name="sayadId" inputMode="numeric" maxLength={16} defaultValue={initialCheck?.sayadId ?? ""} placeholder="۱۶ رقم" /></label>
    <details className="advanced-fields"><summary>جزئیات بیشتر <small>اختیاری</small></summary><div>
      <label className="balance-effect-toggle"><input type="checkbox" name="countInBalance" defaultChecked={initialCheck?.countInBalance ?? true} /><span><strong>این چک خودش روی حساب اثر بگذارد</strong><small>اگر بدهی یا طلبش را قبلاً جدا ثبت کردی، خاموشش کن.</small></span></label>
      <div className="check-two-cols"><label>نوع چک<select name="checkType" value={checkType} onChange={(event) => setCheckType(event.target.value as CheckRecord["checkType"])}><option value="sayadi">صیادی</option><option value="guaranteed">تضمین‌شده بانکی</option><option value="other">سایر / قدیمی</option></select></label><label>شعبه<input name="branchName" defaultValue={initialCheck?.branchName ?? ""} placeholder="اختیاری" /></label></div>
      <label>شماره برگه / سریال <small>(اختیاری)</small><input name="chequeNumber" inputMode="numeric" defaultValue={initialCheck?.chequeNumber ?? ""} /></label>
      <JalaliDatePicker name="issueDate" label="تاریخ صدور" optional initialValue={initialCheck?.issueDate ? isoToJalaliInput(initialCheck.issueDate) : ""} />
      <div className="check-two-cols"><label>وضعیت صیاد<select name="sayadStatus" defaultValue={initialCheck?.sayadStatus ?? "not_registered"}><option value="not_registered">نامشخص / ثبت نشده</option><option value="registered">ثبت شده</option><option value="confirmed">تأیید شده</option><option value="transferred">منتقل شده</option></select></label><label>وضعیت چک<select name="status" defaultValue={initialCheck?.status ?? "open"}><option value="open">در جریان</option><option value="cleared">پاس شده</option><option value="bounced">برگشت خورده</option><option value="cancelled">باطل شده</option><option value="returned">برگشته</option></select></label></div>
      <label>چک مال چه کسیه؟ <small>(صادرکننده)</small><input name="issuerName" value={issuerName} onChange={(event) => setIssuerName(event.target.value)} placeholder={direction === "received" ? partyName || "اگر شخص ثالث است، اسم صاحب چک" : "من"} /></label>
      <label>الان در وجه کیه؟<input name="beneficiaryName" value={beneficiaryName} onChange={(event) => setBeneficiaryName(event.target.value)} placeholder={direction === "received" ? "من" : partyName || "نام گیرنده"} /></label>
      {direction === "received" ? <label>چه کسی این چک رو به من داد؟ <small>(اگر با صادرکننده فرق دارد)</small><input name="transferorName" defaultValue={initialCheck?.transferorName ?? ""} /></label> : <input type="hidden" name="transferorName" value="" />}
      <label>یادداشت<textarea name="note" rows={2} defaultValue={initialCheck?.note ?? ""} placeholder="هر چیزی که بعداً یادت می‌رود..." /></label>
    </div></details>
    <SubmitButton busy={busy} label={initialCheck ? "ذخیره" : "ثبت چک"} />
  </form>;
}

function CheckTransferForm({ check, people, onSubmit, busy }: { check: CheckRecord; people: Person[]; onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  const [mode, setMode] = useState<"person" | "custom">("person");
  const [personId, setPersonId] = useState("");
  const [customName, setCustomName] = useState("");
  const person = people.find((item) => item.id === Number(personId));
  const holderName = mode === "person" ? person?.name ?? "" : customName;
  return <form onSubmit={onSubmit}><div className="sheet-title"><p>{check.purpose} • {money(check.amount)}</p><h2>چک رو به کی دادم؟</h2></div>
    <div className="check-current-holder"><small>الان</small><strong>دست خودته</strong><span>سررسید {persianDate(check.dueDate, true)}</span></div>
    <div className="check-counterparty-tabs"><button type="button" className={mode === "person" ? "active" : ""} onClick={() => setMode("person")}>یکی از آدم‌های دفتر</button><button type="button" className={mode === "custom" ? "active" : ""} onClick={() => setMode("custom")}>شخص / فروشگاه دیگر</button></div>
    {mode === "person" ? <label>به چه کسی دادم؟<select required value={personId} onChange={(event) => setPersonId(event.target.value)}><option value="" disabled>انتخاب شخص</option>{people.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : <label>به چه کسی دادم؟<input required value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="مثلاً فروشگاه کوروش" /></label>}
    <input type="hidden" name="holderName" value={holderName} />
    <JalaliDatePicker name="transferDate" label="کی واگذار کردم؟" defaultToday required />
    <label>بابت چی؟ <small>(اختیاری)</small><textarea name="note" rows={2} placeholder="مثلاً بابت اجاره یا تسویه بدهی" /></label>
    <p className="form-hint">این چک تا وقتی پاس شود از لیست پیگیری حذف نمی‌شود؛ فقط برنامه یادش می‌ماند الان دست چه کسی است.</p>
    <SubmitButton busy={busy} label="ثبت واگذاری" />
  </form>;
}

function LoanForm({ initialLoan, onSubmit, busy }: { initialLoan?: Loan; onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  const scheduleLocked = Boolean(initialLoan?.paymentCount);
  const [principalAmount, setPrincipalAmount] = useState(initialLoan?.principalAmount ?? 0);
  const [totalPayable, setTotalPayable] = useState(initialLoan?.totalPayable ?? 0);
  const [downPayment, setDownPayment] = useState(initialLoan?.downPayment ?? 0);
  const [installmentCount, setInstallmentCount] = useState(initialLoan?.installmentCount ?? 12);
  const [intervalMonths, setIntervalMonths] = useState(initialLoan?.intervalMonths ?? 1);
  const financedAmount = Math.max(0, totalPayable - downPayment);
  const baseInstallment = installmentCount > 0 ? Math.floor(financedAmount / installmentCount) : 0;
  const lastInstallment = installmentCount > 0 ? financedAmount - baseInstallment * Math.max(0, installmentCount - 1) : 0;
  const financeCost = principalAmount > 0 ? Math.max(0, totalPayable - principalAmount) : 0;

  return <form onSubmit={onSubmit}><div className="sheet-title"><p>فقط چیزهایی که برای یادآوری قسط لازم داری</p><h2>{initialLoan ? "ویرایش قسط" : "قسط / وام جدید"}</h2></div>
    <div className="loan-provider-fields"><label>نوع<select name="providerType" defaultValue={initialLoan?.providerType ?? "bank"}><option value="bank">بانک</option><option value="store">فروشگاه</option><option value="other">سایر</option></select></label><label>کجا؟<input name="providerName" required autoFocus defaultValue={initialLoan?.providerName ?? ""} placeholder="مثلاً بانک ملت یا دیجی‌کالا" /></label></div>
    <label>برای چی؟<input name="title" required defaultValue={initialLoan?.title ?? ""} placeholder="مثلاً وام ماشین یا لپ‌تاپ" /></label>
    {scheduleLocked ? <div className="locked-loan-schedule"><div><Icon name="calendar-check" size={18} /><span><strong>برنامه قسط‌ها شروع شده</strong><small>برای اینکه پرداخت‌های قبلی به‌هم نریزد، مبلغ و تاریخ‌ها دیگر تغییر نمی‌کنند.</small></span></div><div className="locked-loan-grid"><span><small>کل</small><b>{money(initialLoan?.totalPayable ?? 0)}</b></span><span><small>تعداد</small><b>{number.format(initialLoan?.installmentCount ?? 0)} قسط</b></span><span><small>اولین سررسید</small><b>{persianDate(initialLoan?.firstDueDate, true)}</b></span><span><small>مانده</small><b>{money(initialLoan?.remainingAmount ?? 0)}</b></span></div><input type="hidden" name="principalAmount" value={initialLoan?.principalAmount ?? 0} /><input type="hidden" name="totalPayable" value={initialLoan?.totalPayable ?? 0} /><input type="hidden" name="downPayment" value={initialLoan?.downPayment ?? 0} /><input type="hidden" name="installmentCount" value={initialLoan?.installmentCount ?? 1} /><input type="hidden" name="intervalMonths" value={initialLoan?.intervalMonths ?? 1} /><input type="hidden" name="firstDueDate" value={initialLoan ? isoToJalaliInput(initialLoan.firstDueDate) : ""} /></div> : <>
      <MoneyInput name="totalPayable" label="در مجموع چقدر باید بدم؟" required defaultValue={initialLoan?.totalPayable} placeholder="کل مبلغی که پرداخت می‌کنی" onValueChange={setTotalPayable} />
      <MoneyInput name="downPayment" label="پیش‌پرداخت (اگر داشتی)" defaultValue={initialLoan?.downPayment} placeholder="صفر هم می‌تونه باشه" onValueChange={setDownPayment} />
      <label>چند قسط؟<CountStepper name="installmentCount" label="تعداد اقساط" min={1} max={600} required value={installmentCount} onChange={setInstallmentCount} /></label>
      <JalaliDatePicker name="firstDueDate" label="اولین قسط کیه؟" required initialValue={initialLoan ? isoToJalaliInput(initialLoan.firstDueDate) : ""} />
      {financedAmount > 0 && installmentCount > 0 && <div className="loan-preview personal"><span><small>هر قسط تقریباً</small><strong>{money(baseInstallment)}</strong></span><span><small>قسط آخر</small><strong>{money(lastInstallment)}</strong></span></div>}
      <details className="advanced-fields loan-advanced"><summary>جزئیات بیشتر <small>اختیاری</small></summary><div>
        <MoneyInput name="principalAmount" label="اصل وام / قیمت پایه" defaultValue={initialLoan?.principalAmount} placeholder="برای دیدن هزینه اضافه" onValueChange={setPrincipalAmount} />
        <label>هر چند ماه یک‌بار؟<CountStepper name="intervalMonths" label="فاصله اقساط به ماه" min={1} max={24} required value={intervalMonths} onChange={setIntervalMonths} /></label>
        <label>شماره قرارداد <small>(اختیاری)</small><input name="contractNumber" defaultValue={initialLoan?.contractNumber ?? ""} /></label>
        {financeCost > 0 && <p className="loan-finance-cost">هزینه اضافه نسبت به مبلغ پایه: <b>{money(financeCost)}</b></p>}
      </div></details>
    </>}
    {scheduleLocked && <input type="hidden" name="contractNumber" value={initialLoan?.contractNumber ?? ""} />}
    <label>یادداشت <small>(اختیاری)</small><textarea name="note" rows={2} defaultValue={initialLoan?.note ?? ""} placeholder="مثلاً شماره پیگیری یا نکته‌ای که باید یادت بمونه" /></label>
    <p className="form-hint">اگر قسط ماهانه است، همان «هر ۱ ماه» پیش‌فرض را نگه دار. بعد از زدن «پرداخت شد»، سررسید بعدی خودش جلو می‌آید.</p>
    <SubmitButton busy={busy} label={initialLoan ? "ذخیره" : "ساخت قسط‌ها"} />
  </form>;
}

function LoanPaymentForm({ loan, installment, onSubmit, busy }: { loan: Loan; installment: LoanInstallment; onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <form onSubmit={onSubmit}><div className="sheet-title"><p>{loan.providerName} • {loan.title}</p><h2>ثبت پرداخت قسط {number.format(installment.number)}</h2></div>
    <div className={`payment-installment-summary ${installment.overdue ? "overdue" : ""}`}><span><small>سررسید</small><strong>{persianDate(installment.dueDate, true)}</strong></span><span><small>مبلغ قسط</small><strong>{money(installment.amount)}</strong></span><span><small>قبلاً پرداخت شده</small><strong>{money(installment.paidAmount)}</strong></span><span><small>مانده این قسط</small><strong>{money(installment.remainingAmount)}</strong></span></div>
    <MoneyInput name="amount" label="مبلغ پرداختی (تومان)" required defaultValue={installment.remainingAmount} placeholder="مبلغ پرداخت" />
    <JalaliDatePicker name="paymentDate" label="تاریخ پرداخت" defaultToday required />
    <label>یادداشت <small>(اختیاری)</small><textarea name="note" rows={2} placeholder="مثلاً پرداخت اینترنتی، شماره پیگیری..." /></label>
    <p className="form-hint">پرداخت جزئی هم مجاز است. تا وقتی مجموع پرداخت‌ها به مبلغ قسط نرسد، قسط باز باقی می‌ماند.</p>
    <SubmitButton busy={busy} label="ثبت پرداخت" />
  </form>;
}

function CountStepper({ name, value, onChange, label, min = 1, max = 99, required = false }: { name: string; value: number; onChange: (value: number) => void; label: string; min?: number; max?: number; required?: boolean }) {
  const safeValue = Math.max(min, Math.min(max, Number(value) || min));
  return <div className="share-stepper number-stepper">
    <button type="button" onClick={() => onChange(Math.max(min, safeValue - 1))} disabled={safeValue <= min} aria-label={`کم کردن ${label}`}>−</button>
    <input name={name} aria-label={label} type="number" min={min} max={max} required={required} value={safeValue} onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || min)))} />
    <button type="button" onClick={() => onChange(Math.min(max, safeValue + 1))} disabled={safeValue >= max} aria-label={`زیاد کردن ${label}`}>+</button>
  </div>;
}

function ShareStepper({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  return <div className="share-stepper">
    <button type="button" onClick={() => onChange(Math.max(0, safeValue - 1))} disabled={safeValue <= 0} aria-label={`کم کردن ${label}`}>−</button>
    <input aria-label={label} type="number" min="0" max="100" value={safeValue} onChange={(event) => onChange(Math.max(0, Math.min(100, Number(event.target.value) || 0)))} />
    <button type="button" onClick={() => onChange(Math.min(100, safeValue + 1))} disabled={safeValue >= 100} aria-label={`زیاد کردن ${label}`}>+</button>
  </div>;
}

function GroupForm({ persons, values, setValues, initialGroup, onSubmit, onNeedPerson, busy }: { persons: Person[]; values: Record<number, number>; setValues: (value: Record<number, number>) => void; initialGroup?: Group; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onNeedPerson: () => void; busy: boolean }) {
  const [candidateId, setCandidateId] = useState("");
  const selectedIds = new Set(Object.keys(values).map(Number));
  const selectedPeople = persons.filter((person) => selectedIds.has(person.id));
  const availablePeople = persons.filter((person) => !selectedIds.has(person.id));

  function addMember() {
    const personId = Number(candidateId);
    if (!personId) return;
    setValues({ ...values, [personId]: 0 });
    setCandidateId("");
  }

  function removeMember(personId: number) {
    const next = { ...values };
    delete next[personId];
    setValues(next);
  }

  return <form onSubmit={onSubmit}><div className="sheet-title"><p>{initialGroup ? "نام، اعضای فعال و سهم‌های پیش‌فرض را مدیریت کن" : "فقط افرادی را که واقعاً عضو این دُنگ هستند اضافه کن"}</p><h2>{initialGroup ? "ویرایش گروه دُنگی" : "گروه دُنگی جدید"}</h2></div>
    <label>نام گروه<input name="name" required autoFocus defaultValue={initialGroup?.name ?? ""} placeholder="مثلاً سفر شمال" /></label>
    <div className="member-picker-title"><strong>اعضای گروه</strong><button type="button" onClick={onNeedPerson}><Icon name="user-plus" size={15} /> شخص جدید</button></div>
    <div className="member-add-row"><select aria-label="انتخاب عضو جدید" value={candidateId} onChange={(event) => setCandidateId(event.target.value)}><option value="">انتخاب شخص برای افزودن</option>{availablePeople.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select><button type="button" onClick={addMember} disabled={!candidateId}>+ افزودن عضو</button></div>
    {selectedPeople.length ? <div className="member-picker selected-members">{selectedPeople.map((person) => <div className="selected" key={person.id}><div className="member-identity"><span><Icon name="user" size={14} /></span><strong>{person.name}</strong>{person.isSelf && <small>حساب من</small>}</div><div className="share-stepper-field"><span>سهم پیش‌فرض</span><ShareStepper label={`سهم ${person.name}`} value={values[person.id]} onChange={(value) => setValues({ ...values, [person.id]: value })} /></div><button className="remove-member" type="button" onClick={() => removeMember(person.id)} aria-label={`حذف ${person.name} از گروه`}><Icon name="trash" size={14} /></button></div>)}</div> : <div className="member-picker-empty"><Icon name="users" size={24} /><strong>هنوز عضوی اضافه نشده</strong><small>از فهرست بالا اعضای همین گروه را انتخاب کن.</small></div>}
    <p className="form-hint">{initialGroup ? "حذف یک عضو از این فهرست فقط عضویت فعال او را برای خریدهای آینده پایان می‌دهد؛ سابقه خریدها و تسویه‌های قبلی حفظ می‌شود. اگر مانده‌ای از گذشته باز باشد، همچنان در محاسبات گروه دیده خواهد شد." : "سهم پیش‌فرض هر عضو صفر است. این عدد فقط پیشنهاد اولیه برای خریدهای آنده است؛ در هر خرید می‌توانی افراد و وزن سهم را جداگانه تغییر بدهی."}</p>
    <SubmitButton busy={busy} label={initialGroup ? "ذخیره تغییرات گروه" : "ساخت گروه"} />
  </form>;
}

function ExpenseForm({ groups, selectedGroup, initialExpense, onGroupChange, onSubmit, onNeedGroup, busy }: { groups: Group[]; selectedGroup?: Group; initialExpense?: Expense; onGroupChange: (id: number) => void; onSubmit: (event: FormEvent<HTMLFormElement>, splits: Array<{ personId: number; shareWeight: number }>) => void; onNeedGroup: () => void; busy: boolean }) {
  const currentMembers = selectedGroup?.members ?? [];
  const historicalMembers = (initialExpense?.shares ?? []).filter((share) => !currentMembers.some((member) => member.personId === share.personId)).map((share) => ({ personId: share.personId, name: share.name, shareWeight: share.weight, historical: true }));
  const participantMembers = [...currentMembers.map((member) => ({ ...member, historical: false })), ...historicalMembers];
  const initialWeights: Record<number, number> = Object.fromEntries(participantMembers.map((member) => [member.personId, initialExpense?.shares.find((share) => share.personId === member.personId)?.weight ?? member.shareWeight]));
  const [weights, setWeights] = useState<Record<number, number>>(initialWeights);
  if (!groups.length) return <div className="form-empty"><span className="quick-icon blue"><Icon name="users" /></span><h2>اول یک گروه بساز</h2><p>برای ثبت خرید مشترک، اعضای گروه باید مشخص باشند.</p><button className="submit-button" onClick={onNeedGroup}>ساخت گروه دُنگی</button></div>;
  const splits = participantMembers.map((member) => ({ personId: member.personId, shareWeight: Math.max(0, weights[member.personId] ?? 0) }));
  return <form onSubmit={(event) => onSubmit(event, splits)}><div className="sheet-title"><p>{initialExpense ? "خرید و سهم‌ها را اصلاح کن" : "شرکت‌کننده‌های همین خرید را انتخاب کن"}</p><h2>{initialExpense ? "ویرایش خرید مشترک" : "خرید مشترک"}</h2></div>
    <label>گروه<select name="groupId" value={selectedGroup?.id ?? ""} disabled={Boolean(initialExpense)} onChange={(event) => onGroupChange(Number(event.target.value))}>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
    <label>چه کسی پرداخت کرد؟<select name="payerPersonId" required defaultValue={initialExpense?.payerPersonId ?? ""}><option value="" disabled>انتخاب پرداخت‌کننده</option>{participantMembers.map((member) => <option key={member.personId} value={member.personId}>{member.name}{member.historical ? " — عضو سابق" : ""}</option>)}</select></label>
    <label>بابت چه چیزی؟<input name="title" required defaultValue={initialExpense?.title ?? ""} placeholder="مثلاً خرید سوپرمارکت" /></label>
    <MoneyInput name="amount" label="مبلغ کل (تومان)" required defaultValue={initialExpense?.amount} placeholder="مثلاً ۱٬۸۵۰٬۰۰۰" />
    <JalaliDatePicker name="expenseDate" label="تاریخ خرید شمسی" defaultToday={!initialExpense} required initialValue={initialExpense ? isoToJalaliInput(initialExpense.expenseDate) : ""} />
    {selectedGroup && <div className="expense-participants"><div className="member-picker-title"><strong>شرکت‌کنندگان این خرید</strong><small>صفر = بدون سهم در این خرید</small></div>{participantMembers.map((member) => { const weight = weights[member.personId] ?? 0; return <div className={weight > 0 ? "participant active" : "participant"} key={member.personId}><button type="button" className="participant-toggle" onClick={() => setWeights({ ...weights, [member.personId]: weight > 0 ? 0 : Math.max(1, member.shareWeight || 1) })} aria-pressed={weight > 0}><span>{weight > 0 ? "✓" : ""}</span><strong>{member.name}{member.historical ? " (عضو سابق)" : ""}</strong></button><div className="participant-share"><span>سهم</span><ShareStepper label={`سهم خرید ${member.name}`} value={weight} onChange={(value) => setWeights({ ...weights, [member.personId]: value })} /></div></div>; })}</div>}
    <p className="form-hint">پرداخت‌کننده می‌تواند سهم صفر داشته باشد. مبلغ نهایی با روش گردکردن منصفانه تقسیم می‌شود و جمع سهم‌ها دقیقاً برابر مبلغ خرید می‌ماند.</p>
    <SubmitButton busy={busy} label={initialExpense ? "ذخیره تغییرات خرید" : "ثبت و محاسبه دُنگ‌ها"} />
  </form>;
}

function SettlementForm({ group, draft, onSubmit, busy }: { group?: Group; draft: SettlementDraft; onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  if (!group) return <div className="form-empty"><Icon name="settlement" size={28} /><h2>گروه پیدا نشد</h2></div>;
  return <form onSubmit={onSubmit}><div className="sheet-title"><p>پرداخت واقعی را ثبت کن تا مانده‌ها کم شود</p><h2>ثبت تسویه • {group.name}</h2></div>
    <input type="hidden" name="groupId" value={group.id} />
    <label>چه کسی پرداخت کرد؟<select name="fromPersonId" required defaultValue={draft.fromPersonId ?? ""}><option value="" disabled>انتخاب پرداخت‌کننده</option>{group.balances.map((member) => <option key={member.personId} value={member.personId}>{member.name}</option>)}</select></label>
    <label>چه کسی دریافت کرد؟<select name="toPersonId" required defaultValue={draft.toPersonId ?? ""}><option value="" disabled>انتخاب دریافت‌کننده</option>{group.balances.map((member) => <option key={member.personId} value={member.personId}>{member.name}</option>)}</select></label>
    <MoneyInput name="amount" label="مبلغ تسویه (تومان)" required defaultValue={draft.amount} placeholder="مثلاً ۵۰۰٬۰۰۰" />
    <JalaliDatePicker name="settlementDate" label="تاریخ تسویه شمسی" defaultToday required />
    <label>یادداشت <small>(اختیاری)</small><textarea name="note" rows={2} placeholder="مثلاً کارت‌به‌کارت" /></label>
    <SubmitButton busy={busy} label="ثبت تسویه واقعی" />
  </form>;
}

function PersonLedgerSheet({ account, onEditEntry }: { account: PersonAccount; onEditEntry: (entryId: number) => void }) {
  return <div className="person-ledger-sheet"><div className="sheet-title"><p>همه منابع مالی این شخص نسبت به من</p><h2>{account.name}</h2></div>
    <div className={`final-balance-card ${account.finalBalance >= 0 ? "positive" : "negative"}`}><small>مانده نهایی</small><strong>{account.finalBalance === 0 ? "تسویه" : balanceLabel(account.finalBalance)}</strong></div>
    <div className="account-summary-grid three"><div><small>ثبت مستقیم</small><strong className={account.directBalance >= 0 ? "text-green" : "text-coral"}>{account.directBalance >= 0 ? "+" : "−"}{money(Math.abs(account.directBalance))}</strong></div><div><small>چک‌ها</small><strong className={account.checkBalance >= 0 ? "text-green" : "text-coral"}>{account.checkBalance >= 0 ? "+" : "−"}{money(Math.abs(account.checkBalance))}</strong></div><div><small>اثر دُنگ‌ها</small><strong className={account.dongBalance >= 0 ? "text-green" : "text-coral"}>{account.dongBalance >= 0 ? "+" : "−"}{money(Math.abs(account.dongBalance))}</strong></div></div>
    {account.groups.length > 0 && <div className="group-impact-list"><strong>تفکیک دُنگ‌ها</strong>{account.groups.map((impact) => <span key={impact.groupId}><i>{impact.groupName}</i><b className={impact.balance >= 0 ? "text-green" : "text-coral"}>{impact.balance >= 0 ? "+" : "−"}{money(Math.abs(impact.balance))}</b></span>)}</div>}
    <div className="section-title ledger-sheet-title"><h2>گردش کامل</h2><span>{number.format(account.items.length)} مورد</span></div>
    <div className="person-ledger-list">{account.items.map((item) => <article key={item.id} className={item.status === "paid" ? "ledger-item paid" : "ledger-item"}><span className={`ledger-source ${item.source}`}><Icon name={item.source === "entry" ? "book" : item.source === "check" ? "check" : item.source === "expense" ? "receipt" : "settlement"} size={15} /></span><div><strong>{item.title}</strong><small>{item.detail} • {persianDate(item.date)}</small></div><b className={item.effect >= 0 ? "text-green" : "text-coral"}>{item.status === "paid" ? "تسویه‌شده" : `${item.effect >= 0 ? "+" : "−"}${money(Math.abs(item.effect))}`}</b>{item.source === "entry" && <button onClick={() => onEditEntry(item.sourceId)} aria-label="ویرایش ثبت"><Icon name="edit" size={13} /></button>}</article>)}</div>
    {!account.items.length && <div className="member-picker-empty"><Icon name="book" size={24} /><strong>هنوز گردش مالی ندارد</strong><small>ثبت مستقیم یا دُنگی که به تو مربوط باشد اینجا دیده می‌شود.</small></div>}
  </div>;
}

function ToolsSheet({ onExport, onImport, busy }: { onExport: () => void; onImport: (file: File) => void; busy: boolean }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return <div><div className="sheet-title"><p>اطلاعات روی همین مرورگر ذخیره می‌شوند</p><h2>پشتیبان و بازیابی</h2></div><div className="tools-list"><button onClick={onExport}><span className="tool-icon"><Icon name="download" /></span><div><strong>دریافت نسخه پشتیبان</strong><small>همه اشخاص، ثبت‌ها، دُنگ‌ها، وام‌ها، چک‌ها و تاریخچه حرکتشان، برنامه اقساط و پرداخت‌ها در یک فایل JSON</small></div></button><button disabled={busy} onClick={() => inputRef.current?.click()}><span className="tool-icon"><Icon name="upload" /></span><div><strong>بازیابی نسخه پشتیبان</strong><small>اطلاعات فعلی این دستگاه با فایل انتخاب‌شده جایگزین می‌شود</small></div></button></div><input ref={inputRef} className="hidden-file-input" type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onImport(file); event.currentTarget.value = ""; }} /><p className="backup-warning">نسخه پشتیبان را در جای امن نگه دار. پاک کردن داده‌های مرورگر می‌تواند دفتر محلی را حذف کند.</p></div>;
}

function MoneyInput({ name, label, required = false, defaultValue, placeholder, onValueChange }: { name: string; label: string; required?: boolean; defaultValue?: number; placeholder?: string; onValueChange?: (value: number) => void }) {
  const [digits, setDigits] = useState(defaultValue ? String(defaultValue) : "");
  const display = digits ? number.format(Number(digits)) : "";
  function update(value: string) {
    const normalized = normalizeDigits(value).replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, "");
    setDigits(normalized);
    onValueChange?.(normalized ? Number(normalized) : 0);
  }
  return <label>{label}<input className="money-input" inputMode="numeric" value={display} onChange={(event) => update(event.target.value)} required={required} placeholder={placeholder} autoComplete="off" /><input type="hidden" name={name} value={digits} /></label>;
}

function SubmitButton({ busy, label }: { busy: boolean; label: string }) {
  return <button className="submit-button" disabled={busy}>{busy ? "در حال ثبت..." : label}</button>;
}

function Loading() {
  return <div className="loading"><span /><span /><span /><p>دفترت را باز می‌کنیم...</p></div>;
}

function JalaliDatePicker({ name, label, optional = false, required = false, defaultToday = false, initialValue = "" }: { name: string; label: string; optional?: boolean; required?: boolean; defaultToday?: boolean; initialValue?: string }) {
  const today = jalaliTodayParts();
  const [value, setValue] = useState(initialValue || (defaultToday ? todayJalaliInput() : ""));
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const normalizedInitial = normalizeDigits(initialValue);
    const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(normalizedInitial);
    return match ? { year: Number(match[1]), month: Number(match[2]) } : { year: today.jy, month: today.jm };
  });
  const firstWeekday = jalaliFirstWeekday(view.year, view.month);
  const days = jalaliMonthDays(view.year, view.month);
  const normalized = normalizeDigits(value);
  const selected = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(normalized);
  const selectedDay = selected && Number(selected[1]) === view.year && Number(selected[2]) === view.month ? Number(selected[3]) : null;

  function moveMonth(delta: number) {
    setView((current) => { let month = current.month + delta; let year = current.year; if (month > 12) { month = 1; year += 1; } if (month < 1) { month = 12; year -= 1; } return { year, month }; });
  }
  function chooseDay(day: number) { setValue(jalaliPartsToInput(view.year, view.month, day)); setOpen(false); }
  function chooseToday() { setView({ year: today.jy, month: today.jm }); setValue(todayJalaliInput()); setOpen(false); }

  return <div className="date-picker-field"><span className="date-label">{label} {optional && <small>(اختیاری)</small>}</span><div className="date-input-wrap"><input className="jalali-input" name={name} value={value} readOnly required={required} placeholder="انتخاب تاریخ" onClick={() => setOpen((current) => !current)} aria-haspopup="dialog" aria-expanded={open} /><button type="button" className="calendar-trigger" onClick={() => setOpen((current) => !current)} aria-label={`باز کردن انتخاب‌گر ${label}`}><Icon name="calendar" size={16} /></button></div>{open && <div className="jalali-calendar" role="dialog" aria-label={label}><div className="calendar-head"><button type="button" onClick={() => moveMonth(1)} aria-label="ماه بعد">‹</button><strong>{jalaliMonthName(view.month)} {toPersianDigits(view.year)}</strong><button type="button" onClick={() => moveMonth(-1)} aria-label="ماه قبل">›</button></div><div className="weekdays">{["ش", "ی", "د", "س", "چ", "پ", "ج"].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-days">{Array.from({ length: firstWeekday }, (_, index) => <span key={`empty-${index}`} />)}{Array.from({ length: days }, (_, index) => index + 1).map((day) => { const isToday = view.year === today.jy && view.month === today.jm && day === today.jd; return <button type="button" key={day} className={`${selectedDay === day ? "selected" : ""} ${isToday ? "today" : ""}`} onClick={() => chooseDay(day)}>{toPersianDigits(day)}</button>; })}</div><div className="calendar-actions">{optional && value && <button type="button" onClick={() => { setValue(""); setOpen(false); }}>پاک کردن</button>}<button type="button" onClick={chooseToday}>امروز</button></div></div>}</div>;
}
