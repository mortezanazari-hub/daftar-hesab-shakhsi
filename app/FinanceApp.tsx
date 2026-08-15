"use client";

import { FormEvent, useCallback, useMemo, useRef, useState, useEffect } from "react";
import { isoToJalaliInput, jalaliFirstWeekday, jalaliInputToIso, jalaliMonthDays, jalaliMonthName, jalaliPartsToInput, jalaliTodayParts, normalizeDigits, persianDate, todayIso, todayJalaliInput, toPersianDigits } from "./jalali";
import {
  applyFinanceOperation,
  exportFinanceBackup,
  getFinanceData,
  importFinanceBackup,
  type Entry,
  type Expense,
  type FinanceData,
  type Group,
  type Person,
  type PersonAccount,
  type SettlementSuggestion,
} from "./local-db";

type Sheet = "actions" | "person" | "entry" | "group" | "expense" | "settlement" | "person-ledger" | "tools" | null;
type Tab = "home" | "ledger" | "groups" | "calendar";
type IconName = "home" | "book" | "users" | "calendar" | "user" | "user-plus" | "receipt" | "calendar-check" | "debt" | "receivable" | "installment" | "check" | "trash" | "edit" | "download" | "upload" | "search" | "settlement" | "wallet";

type SettlementDraft = { groupId: number; fromPersonId?: number; toPersonId?: number; amount?: number };

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
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
  installment: { label: "قسط", icon: "installment", tone: "amber" },
  check: { label: "چک", icon: "check", tone: "violet" },
};

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
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const [settlementDraft, setSettlementDraft] = useState<SettlementDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [groupMembers, setGroupMembers] = useState<Record<number, number>>({});
  const [expenseGroupId, setExpenseGroupId] = useState<number | null>(null);
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [entryFilter, setEntryFilter] = useState<"all" | "open" | "paid">("all");
  const [groupSearch, setGroupSearch] = useState("");

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
  const openEntries = data?.entries.filter((entry) => entry.status === "open") ?? [];
  const totalReceivable = data?.accounts.filter((account) => account.finalBalance > 0).reduce((sum, account) => sum + account.finalBalance, 0) ?? 0;
  const totalDebt = data?.accounts.filter((account) => account.finalBalance < 0).reduce((sum, account) => sum - account.finalBalance, 0) ?? 0;
  const net = totalReceivable - totalDebt;
  const selectedExpenseGroup = data?.groups.find((group) => group.id === expenseGroupId);
  const editingEntry = data?.entries.find((entry) => entry.id === editingEntryId);
  const editingExpense = data?.groups.flatMap((group) => group.expenses.map((expense) => ({ group, expense }))).find((item) => item.expense.id === editingExpenseId);
  const selectedAccount = data?.accounts.find((account) => account.personId === selectedPersonId);
  const today = todayIso();
  const upcoming = openEntries.filter((entry) => entry.dueDate).sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));

  const normalizedLedgerSearch = ledgerSearch.trim().toLocaleLowerCase("fa");
  const filteredAccounts = (data?.accounts ?? []).filter((account) => !normalizedLedgerSearch || `${account.name} ${account.phone}`.toLocaleLowerCase("fa").includes(normalizedLedgerSearch));
  const filteredEntries = (data?.entries ?? []).filter((entry) => {
    if (entryFilter !== "all" && entry.status !== entryFilter) return false;
    if (!normalizedLedgerSearch) return true;
    return `${entry.personName} ${entry.title} ${entry.note}`.toLocaleLowerCase("fa").includes(normalizedLedgerSearch);
  });
  const normalizedGroupSearch = groupSearch.trim().toLocaleLowerCase("fa");
  const filteredGroups = (data?.groups ?? []).filter((group) => !normalizedGroupSearch || `${group.name} ${group.members.map((member) => member.name).join(" ")} ${group.expenses.map((expense) => expense.title).join(" ")}`.toLocaleLowerCase("fa").includes(normalizedGroupSearch));

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

  function beginGroup() {
    setGroupMembers({});
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

  function deleteSettlement(id: number) {
    if (window.confirm("این سابقه تسویه حذف شود؟ مانده گروه دوباره محاسبه خواهد شد.")) void post({ operation: "delete_settlement", id }, { close: false });
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

  function submitGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const members = Object.entries(groupMembers).map(([personId, shareWeight]) => ({ personId: Number(personId), shareWeight }));
    void post({ operation: "add_group", name: form.get("name"), members });
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
                <p className="balance-caption">ثبت‌های مستقیم + اثر دُنگ‌ها + تسویه‌های ثبت‌شده</p>
                <div className="balance-art" aria-hidden="true"><i /><i /><i /><i /></div>
              </article>

              <div className="section-title"><h2>ثبت سریع</h2><button onClick={() => setSheet("actions")}>همه موارد</button></div>
              <div className="quick-grid">
                {Object.entries(entryMeta).map(([kind, meta]) => <button className="quick-action" key={kind} onClick={() => openEntry(kind)}><span className={`quick-icon ${meta.tone}`}><Icon name={meta.icon} /></span><span>{meta.label}</span></button>)}
              </div>

              <div className="section-title"><h2>نزدیک‌ترین سررسیدها</h2><button onClick={() => setTab("calendar")}>مشاهده همه</button></div>
              <div className="surface-list">
                {upcoming.slice(0, 3).map((entry) => <EntryRow key={entry.id} entry={entry} onToggle={() => void post({ operation: "toggle_entry", id: entry.id }, { close: false })} onEdit={() => openEntry(entry.kind, entry)} onDelete={() => deleteEntry(entry)} />)}
                {!upcoming.length && <EmptyState icon="calendar-check" title="سررسید نزدیکی نداری" detail="چک یا قسط بعدی را ثبت کن تا به‌موقع ببینی." action="ثبت قسط" onAction={() => openEntry("installment")} />}
              </div>

              <div className="section-title"><h2>دفتر کل اشخاص</h2><button onClick={() => setTab("ledger")}>مشاهده همه</button></div>
              <div className="account-mini-list">
                {data.accounts.slice(0, 3).map((account) => <button key={account.personId} onClick={() => openPersonLedger(account.personId)}><span className="mini-avatar"><Icon name="user" size={14} /></span><div><strong>{account.name}</strong><small>مستقیم {shortMoney(account.directBalance)} • دُنگ {shortMoney(account.dongBalance)}</small></div><b className={account.finalBalance >= 0 ? "text-green" : "text-coral"}>{balanceLabel(account.finalBalance)}</b></button>)}
                {!data.accounts.length && <EmptyState icon="book" title="هنوز طرف حسابی نداری" detail="یک شخص اضافه کن تا دفتر کل او ساخته شود." action="افزودن شخص" onAction={() => setSheet("person")} />}
              </div>

              <div className="section-title"><h2>دُنگ‌های فعال</h2><button onClick={() => setTab("groups")}>مدیریت دُنگ‌ها</button></div>
              {data.groups[0] ? <GroupPreview group={data.groups[0]} onClick={() => setTab("groups")} /> : <EmptyState icon="users" title="هنوز گروه دُنگی نداری" detail="برای سفر، خانه یا دورهمی یک گروه بساز و سهم‌ها را مشخص کن." action="ساخت گروه" onAction={beginGroup} />}
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
              <div className="page-heading"><div><p className="eyebrow">خرج‌های مشترک و تسویه واقعی</p><h2>مدیریت دُنگ</h2></div><button className="small-primary" onClick={beginGroup}>+ گروه جدید</button></div>
              <SearchField value={groupSearch} onChange={setGroupSearch} placeholder="جست‌وجوی گروه، عضو یا خرید..." />
              {data.groups.length > 0 && <button className="expense-cta" onClick={() => openExpense()}><span className="expense-plus">+</span><span><strong>ثبت خرید مشترک</strong><small>افراد همین خرید و سهم هر نفر را مشخص کن</small></span><b>‹</b></button>}
              <div className="groups-stack">
                {filteredGroups.map((group) => <GroupCard key={group.id} group={group} onExpense={() => openExpense(group.id)} onEditExpense={(expense) => openExpense(group.id, expense)} onDeleteExpense={deleteExpense} onSettlement={(suggestion) => openSettlement(group, suggestion)} onManualSettlement={() => openSettlement(group)} onDeleteSettlement={deleteSettlement} />)}
                {!filteredGroups.length && <EmptyState icon="users" title={data.groups.length ? "گروهی پیدا نشد" : "دُنگ‌ها از اینجا ساده می‌شوند"} detail={data.groups.length ? "عبارت جست‌وجو را تغییر بده." : "اعضا را انتخاب کن؛ در هر خرید هم می‌توانی شرکت‌کننده‌ها و سهم‌ها را جداگانه تعیین کنی."} action={data.groups.length ? "پاک کردن جست‌وجو" : "ساخت اولین گروه"} onAction={() => data.groups.length ? setGroupSearch("") : beginGroup()} />}
              </div>
            </section>
          )}

          {tab === "calendar" && (
            <section className="page">
              <div className="page-heading"><div><p className="eyebrow">برنامه پرداخت</p><h2>سررسیدها</h2></div><button className="small-primary" onClick={() => openEntry("installment")}>+ سررسید</button></div>
              <div className="timeline">
                {upcoming.map((entry) => <div className="timeline-row" key={entry.id}><div className={`date-badge ${entry.dueDate && entry.dueDate < today ? "overdue" : ""}`}><strong>{persianDate(entry.dueDate).split(" ")[0]}</strong><span>{persianDate(entry.dueDate).split(" ").slice(1).join(" ")}</span></div><EntryRow entry={entry} onToggle={() => void post({ operation: "toggle_entry", id: entry.id }, { close: false })} onEdit={() => openEntry(entry.kind, entry)} onDelete={() => deleteEntry(entry)} compact /></div>)}
                {!upcoming.length && <EmptyState icon="calendar" title="تقویمت خالی است" detail="برای اقساط و چک‌ها تاریخ سررسید بگذار." action="ثبت سررسید" onAction={() => openEntry("installment")} />}
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
        <NavButton active={tab === "calendar"} icon="calendar" label="سررسید" onClick={() => setTab("calendar")} />
      </nav>

      {sheet && <div className="sheet-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setSheet(null); }}>
        <section className="bottom-sheet" role="dialog" aria-modal="true">
          <div className="sheet-handle" />
          <button className="sheet-close" onClick={() => setSheet(null)} aria-label="بستن">×</button>
          {sheet === "actions" && <ActionSheet onEntry={(kind) => openEntry(kind)} onPerson={() => setSheet("person")} onGroup={beginGroup} onExpense={() => openExpense()} hasGroup={Boolean(data?.groups.length)} />}
          {sheet === "person" && <PersonForm onSubmit={submitPerson} busy={busy} />}
          {sheet === "entry" && <EntryForm key={editingEntry?.id ?? `new-${entryKind}`} kind={entryKind} people={people} initialEntry={editingEntry} onNeedPerson={() => setSheet("person")} onSubmit={submitEntry} busy={busy} />}
          {sheet === "group" && <GroupForm persons={data?.persons ?? []} values={groupMembers} setValues={setGroupMembers} onSubmit={submitGroup} onNeedPerson={() => setSheet("person")} busy={busy} />}
          {sheet === "expense" && <ExpenseForm key={`${editingExpense?.expense.id ?? "new"}-${selectedExpenseGroup?.id ?? "none"}`} groups={data?.groups ?? []} selectedGroup={editingExpense?.group ?? selectedExpenseGroup} initialExpense={editingExpense?.expense} onGroupChange={(id) => { setEditingExpenseId(null); setExpenseGroupId(id); }} onSubmit={submitExpense} onNeedGroup={beginGroup} busy={busy} />}
          {sheet === "settlement" && settlementDraft && <SettlementForm group={data?.groups.find((group) => group.id === settlementDraft.groupId)} draft={settlementDraft} onSubmit={submitSettlement} busy={busy} />}
          {sheet === "person-ledger" && selectedAccount && <PersonLedgerSheet account={selectedAccount} onEditEntry={(entryId) => { const entry = data?.entries.find((item) => item.id === entryId); if (entry) openEntry(entry.kind, entry); }} />}
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

function GroupCard({ group, onExpense, onEditExpense, onDeleteExpense, onSettlement, onManualSettlement, onDeleteSettlement }: { group: Group; onExpense: () => void; onEditExpense: (expense: Expense) => void; onDeleteExpense: (expense: Expense) => void; onSettlement: (suggestion: SettlementSuggestion) => void; onManualSettlement: () => void; onDeleteSettlement: (id: number) => void }) {
  return <article className="group-card">
    <div className="group-card-head"><div className="group-title"><span className="group-mark"><Icon name="users" size={19} /></span><div><h3>{group.name}</h3><p>{number.format(group.members.length)} عضو • جمع هزینه {money(group.totalSpent)}</p></div></div><div className="group-head-actions"><button onClick={onManualSettlement}><Icon name="settlement" size={13} /> تسویه</button><button onClick={onExpense}>+ خرید</button></div></div>
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

function ActionSheet({ onEntry, onPerson, onGroup, onExpense, hasGroup }: { onEntry: (kind: string) => void; onPerson: () => void; onGroup: () => void; onExpense: () => void; hasGroup: boolean }) {
  return <><div className="sheet-title"><p>چه چیزی می‌خواهی ثبت کنی؟</p><h2>ثبت جدید</h2></div><div className="action-list">
    {Object.entries(entryMeta).map(([kind, meta]) => <button key={kind} onClick={() => onEntry(kind)}><span className={`quick-icon ${meta.tone}`}><Icon name={meta.icon} /></span><div><strong>{meta.label}</strong><small>{kind === "debt" ? "پولی که باید پرداخت کنی" : kind === "receivable" ? "پولی که باید دریافت کنی" : kind === "installment" ? "پرداخت دوره‌ای و سررسید" : "چک دریافتی یا پرداختی"}</small></div><b>‹</b></button>)}
    <button onClick={hasGroup ? onExpense : onGroup}><span className="quick-icon blue"><Icon name="users" /></span><div><strong>{hasGroup ? "خرید دُنگی" : "گروه دُنگی"}</strong><small>{hasGroup ? "ثبت خرج مشترک با سهم اختصاصی" : "ساخت گروه و تعیین سهم‌های پیش‌فرض"}</small></div><b>‹</b></button>
    <button onClick={onPerson}><span className="quick-icon sand"><Icon name="user-plus" /></span><div><strong>شخص جدید</strong><small>افزودن به دفتر حساب‌ها</small></div><b>‹</b></button>
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
    {(kind === "installment" || kind === "check") && <label>نوع حساب<select name="direction" defaultValue={initialEntry?.direction ?? "debt"}><option value="debt">پرداختی — من بدهکارم</option><option value="receivable">دریافتی — من طلبکارم</option></select></label>}
    <label>عنوان<input name="title" required defaultValue={initialEntry?.title ?? ""} placeholder={kind === "installment" ? "مثلاً قسط وام خودرو" : kind === "check" ? "مثلاً چک اجاره" : "بابت چه چیزی؟"} /></label>
    <MoneyInput name="amount" label="مبلغ (تومان)" required defaultValue={initialEntry?.amount} placeholder="مثلاً ۲٬۵۰۰٬۰۰۰" />
    <JalaliDatePicker name="dueDate" label="تاریخ سررسید شمسی" optional initialValue={initialEntry?.dueDate ? isoToJalaliInput(initialEntry.dueDate) : ""} />
    <label>یادداشت <small>(اختیاری)</small><textarea name="note" rows={2} defaultValue={initialEntry?.note ?? ""} placeholder="توضیح کوتاه..." /></label>
    <SubmitButton busy={busy} label={initialEntry ? "ذخیره تغییرات" : `ثبت ${meta.label}`} />
  </form>;
}

function GroupForm({ persons, values, setValues, onSubmit, onNeedPerson, busy }: { persons: Person[]; values: Record<number, number>; setValues: (value: Record<number, number>) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onNeedPerson: () => void; busy: boolean }) {
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

  return <form onSubmit={onSubmit}><div className="sheet-title"><p>فقط افرادی را که واقعاً عضو این دُنگ هستند اضافه کن</p><h2>گروه دُنگی جدید</h2></div>
    <label>نام گروه<input name="name" required autoFocus placeholder="مثلاً سفر شمال" /></label>
    <div className="member-picker-title"><strong>اعضای گروه</strong><button type="button" onClick={onNeedPerson}><Icon name="user-plus" size={15} /> شخص جدید</button></div>
    <div className="member-add-row"><select aria-label="انتخاب عضو جدید" value={candidateId} onChange={(event) => setCandidateId(event.target.value)}><option value="">انتخاب شخص برای افزودن</option>{availablePeople.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select><button type="button" onClick={addMember} disabled={!candidateId}>+ افزودن عضو</button></div>
    {selectedPeople.length ? <div className="member-picker selected-members">{selectedPeople.map((person) => <div className="selected" key={person.id}><div className="member-identity"><span><Icon name="user" size={14} /></span><strong>{person.name}</strong>{person.isSelf && <small>حساب من</small>}</div><label>سهم پیش‌فرض<input aria-label={`سهم ${person.name}`} type="number" min="0" max="100" value={values[person.id]} onChange={(event) => setValues({ ...values, [person.id]: Math.max(0, Number(event.target.value) || 0) })} /></label><button className="remove-member" type="button" onClick={() => removeMember(person.id)} aria-label={`حذف ${person.name} از گروه`}><Icon name="trash" size={14} /></button></div>)}</div> : <div className="member-picker-empty"><Icon name="users" size={24} /><strong>هنوز عضوی اضافه نشده</strong><small>از فهرست بالا اعضای همین گروه را انتخاب کن.</small></div>}
    <p className="form-hint">سهم پیش‌فرض هر عضو صفر است. این عدد فقط پیشنهاد اولیه برای خریدهای آینده است؛ در هر خرید می‌توانی افراد و وزن سهم را جداگانه تغییر بدهی.</p>
    <SubmitButton busy={busy} label="ساخت گروه" />
  </form>;
}

function ExpenseForm({ groups, selectedGroup, initialExpense, onGroupChange, onSubmit, onNeedGroup, busy }: { groups: Group[]; selectedGroup?: Group; initialExpense?: Expense; onGroupChange: (id: number) => void; onSubmit: (event: FormEvent<HTMLFormElement>, splits: Array<{ personId: number; shareWeight: number }>) => void; onNeedGroup: () => void; busy: boolean }) {
  const initialWeights: Record<number, number> = Object.fromEntries((selectedGroup?.members ?? []).map((member) => [member.personId, initialExpense?.shares.find((share) => share.personId === member.personId)?.weight ?? member.shareWeight]));
  const [weights, setWeights] = useState<Record<number, number>>(initialWeights);
  if (!groups.length) return <div className="form-empty"><span className="quick-icon blue"><Icon name="users" /></span><h2>اول یک گروه بساز</h2><p>برای ثبت خرید مشترک، اعضای گروه باید مشخص باشند.</p><button className="submit-button" onClick={onNeedGroup}>ساخت گروه دُنگی</button></div>;
  const splits = (selectedGroup?.members ?? []).map((member) => ({ personId: member.personId, shareWeight: Math.max(0, weights[member.personId] ?? 0) }));
  return <form onSubmit={(event) => onSubmit(event, splits)}><div className="sheet-title"><p>{initialExpense ? "خرید و سهم‌ها را اصلاح کن" : "شرکت‌کننده‌های همین خرید را انتخاب کن"}</p><h2>{initialExpense ? "ویرایش خرید مشترک" : "خرید مشترک"}</h2></div>
    <label>گروه<select name="groupId" value={selectedGroup?.id ?? ""} disabled={Boolean(initialExpense)} onChange={(event) => onGroupChange(Number(event.target.value))}>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
    <label>چه کسی پرداخت کرد؟<select name="payerPersonId" required defaultValue={initialExpense?.payerPersonId ?? ""}><option value="" disabled>انتخاب پرداخت‌کننده</option>{selectedGroup?.members.map((member) => <option key={member.personId} value={member.personId}>{member.name}</option>)}</select></label>
    <label>بابت چه چیزی؟<input name="title" required defaultValue={initialExpense?.title ?? ""} placeholder="مثلاً خرید سوپرمارکت" /></label>
    <MoneyInput name="amount" label="مبلغ کل (تومان)" required defaultValue={initialExpense?.amount} placeholder="مثلاً ۱٬۸۵۰٬۰۰۰" />
    <JalaliDatePicker name="expenseDate" label="تاریخ خرید شمسی" defaultToday={!initialExpense} required initialValue={initialExpense ? isoToJalaliInput(initialExpense.expenseDate) : ""} />
    {selectedGroup && <div className="expense-participants"><div className="member-picker-title"><strong>شرکت‌کنندگان این خرید</strong><small>صفر = بدون سهم در این خرید</small></div>{selectedGroup.members.map((member) => { const weight = weights[member.personId] ?? 0; return <div className={weight > 0 ? "participant active" : "participant"} key={member.personId}><button type="button" className="participant-toggle" onClick={() => setWeights({ ...weights, [member.personId]: weight > 0 ? 0 : Math.max(1, member.shareWeight || 1) })} aria-pressed={weight > 0}><span>{weight > 0 ? "✓" : ""}</span><strong>{member.name}</strong></button><label>وزن سهم<input type="number" min="0" max="100" value={weight} onChange={(event) => setWeights({ ...weights, [member.personId]: Math.max(0, Number(event.target.value) || 0) })} /></label></div>; })}</div>}
    <p className="form-hint">پرداخت‌کننده می‌تواند سهم صفر داشته باشد. مبلغ نهایی با روش گردکردن منصفانه تقسیم می‌شود و جمع سهم‌ها دقیقاً برابر مبلغ خرید می‌ماند.</p>
    <SubmitButton busy={busy} label={initialExpense ? "ذخیره تغییرات خرید" : "ثبت و محاسبه دُنگ‌ها"} />
  </form>;
}

function SettlementForm({ group, draft, onSubmit, busy }: { group?: Group; draft: SettlementDraft; onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  if (!group) return <div className="form-empty"><Icon name="settlement" size={28} /><h2>گروه پیدا نشد</h2></div>;
  return <form onSubmit={onSubmit}><div className="sheet-title"><p>پرداخت واقعی را ثبت کن تا مانده‌ها کم شود</p><h2>ثبت تسویه • {group.name}</h2></div>
    <input type="hidden" name="groupId" value={group.id} />
    <label>چه کسی پرداخت کرد؟<select name="fromPersonId" required defaultValue={draft.fromPersonId ?? ""}><option value="" disabled>انتخاب پرداخت‌کننده</option>{group.members.map((member) => <option key={member.personId} value={member.personId}>{member.name}</option>)}</select></label>
    <label>چه کسی دریافت کرد؟<select name="toPersonId" required defaultValue={draft.toPersonId ?? ""}><option value="" disabled>انتخاب دریافت‌کننده</option>{group.members.map((member) => <option key={member.personId} value={member.personId}>{member.name}</option>)}</select></label>
    <MoneyInput name="amount" label="مبلغ تسویه (تومان)" required defaultValue={draft.amount} placeholder="مثلاً ۵۰۰٬۰۰۰" />
    <JalaliDatePicker name="settlementDate" label="تاریخ تسویه شمسی" defaultToday required />
    <label>یادداشت <small>(اختیاری)</small><textarea name="note" rows={2} placeholder="مثلاً کارت‌به‌کارت" /></label>
    <SubmitButton busy={busy} label="ثبت تسویه واقعی" />
  </form>;
}

function PersonLedgerSheet({ account, onEditEntry }: { account: PersonAccount; onEditEntry: (entryId: number) => void }) {
  return <div className="person-ledger-sheet"><div className="sheet-title"><p>همه منابع مالی این شخص نسبت به من</p><h2>{account.name}</h2></div>
    <div className={`final-balance-card ${account.finalBalance >= 0 ? "positive" : "negative"}`}><small>مانده نهایی</small><strong>{account.finalBalance === 0 ? "تسویه" : balanceLabel(account.finalBalance)}</strong></div>
    <div className="account-summary-grid"><div><small>ثبت مستقیم</small><strong className={account.directBalance >= 0 ? "text-green" : "text-coral"}>{account.directBalance >= 0 ? "+" : "−"}{money(Math.abs(account.directBalance))}</strong></div><div><small>اثر دُنگ‌ها</small><strong className={account.dongBalance >= 0 ? "text-green" : "text-coral"}>{account.dongBalance >= 0 ? "+" : "−"}{money(Math.abs(account.dongBalance))}</strong></div></div>
    {account.groups.length > 0 && <div className="group-impact-list"><strong>تفکیک دُنگ‌ها</strong>{account.groups.map((impact) => <span key={impact.groupId}><i>{impact.groupName}</i><b className={impact.balance >= 0 ? "text-green" : "text-coral"}>{impact.balance >= 0 ? "+" : "−"}{money(Math.abs(impact.balance))}</b></span>)}</div>}
    <div className="section-title ledger-sheet-title"><h2>گردش کامل</h2><span>{number.format(account.items.length)} مورد</span></div>
    <div className="person-ledger-list">{account.items.map((item) => <article key={item.id} className={item.status === "paid" ? "ledger-item paid" : "ledger-item"}><span className={`ledger-source ${item.source}`}><Icon name={item.source === "entry" ? "book" : item.source === "expense" ? "receipt" : "settlement"} size={15} /></span><div><strong>{item.title}</strong><small>{item.detail} • {persianDate(item.date)}</small></div><b className={item.effect >= 0 ? "text-green" : "text-coral"}>{item.status === "paid" ? "تسویه‌شده" : `${item.effect >= 0 ? "+" : "−"}${money(Math.abs(item.effect))}`}</b>{item.source === "entry" && <button onClick={() => onEditEntry(item.sourceId)} aria-label="ویرایش ثبت"><Icon name="edit" size={13} /></button>}</article>)}</div>
    {!account.items.length && <div className="member-picker-empty"><Icon name="book" size={24} /><strong>هنوز گردش مالی ندارد</strong><small>ثبت مستقیم یا دُنگی که به تو مربوط باشد اینجا دیده می‌شود.</small></div>}
  </div>;
}

function ToolsSheet({ onExport, onImport, busy }: { onExport: () => void; onImport: (file: File) => void; busy: boolean }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return <div><div className="sheet-title"><p>اطلاعات روی همین مرورگر ذخیره می‌شوند</p><h2>پشتیبان و بازیابی</h2></div><div className="tools-list"><button onClick={onExport}><span className="tool-icon"><Icon name="download" /></span><div><strong>دریافت نسخه پشتیبان</strong><small>همه اشخاص، ثبت‌ها، دُنگ‌ها، خریدها، سهم‌ها و تسویه‌ها در یک فایل JSON</small></div></button><button disabled={busy} onClick={() => inputRef.current?.click()}><span className="tool-icon"><Icon name="upload" /></span><div><strong>بازیابی نسخه پشتیبان</strong><small>اطلاعات فعلی این دستگاه با فایل انتخاب‌شده جایگزین می‌شود</small></div></button></div><input ref={inputRef} className="hidden-file-input" type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onImport(file); event.currentTarget.value = ""; }} /><p className="backup-warning">نسخه پشتیبان را در جای امن نگه دار. پاک کردن داده‌های مرورگر می‌تواند دفتر محلی را حذف کند.</p></div>;
}

function MoneyInput({ name, label, required = false, defaultValue, placeholder }: { name: string; label: string; required?: boolean; defaultValue?: number; placeholder?: string }) {
  const [digits, setDigits] = useState(defaultValue ? String(defaultValue) : "");
  const display = digits ? number.format(Number(digits)) : "";
  function update(value: string) {
    const normalized = normalizeDigits(value).replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, "");
    setDigits(normalized);
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
