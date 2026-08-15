"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { jalaliFirstWeekday, jalaliInputToIso, jalaliMonthDays, jalaliMonthName, jalaliPartsToInput, jalaliTodayParts, normalizeDigits, persianDate, todayIso, todayJalaliInput, toPersianDigits } from "./jalali";
import { applyFinanceOperation, getFinanceData, type Entry, type FinanceData, type Group, type Person } from "./local-db";
type Sheet = "actions" | "person" | "entry" | "group" | "expense" | null;
type Tab = "home" | "ledger" | "groups" | "calendar";
type IconName = "home" | "book" | "users" | "calendar" | "user" | "user-plus" | "receipt" | "calendar-check" | "debt" | "receivable" | "installment" | "check" | "trash";

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
export function FinanceApp() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [entryKind, setEntryKind] = useState("debt");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [groupMembers, setGroupMembers] = useState<Record<number, number>>({});
  const [expenseGroupId, setExpenseGroupId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await getFinanceData();
      setData(result);
      setError("");
      setExpenseGroupId((current) => current ?? result.groups[0]?.id ?? null);
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
  const totalDebt = openEntries.filter((entry) => entry.direction === "debt").reduce((sum, entry) => sum + entry.amount, 0);
  const totalReceivable = openEntries.filter((entry) => entry.direction === "receivable").reduce((sum, entry) => sum + entry.amount, 0);
  const net = totalReceivable - totalDebt;
  const selectedExpenseGroup = data?.groups.find((group) => group.id === expenseGroupId);
  const today = todayIso();
  const upcoming = openEntries.filter((entry) => entry.dueDate).sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));

  const personBalances = useMemo(() => people.map((person) => {
    const balance = openEntries.filter((entry) => entry.personId === person.id).reduce((sum, entry) => sum + (entry.direction === "receivable" ? entry.amount : -entry.amount), 0);
    return { ...person, balance };
  }), [people, openEntries]);

  async function post(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      await applyFinanceOperation(payload);
      setSheet(null);
      await load();
    } catch (postError) {
      setError(postError instanceof Error ? postError.message : "خطا در ثبت اطلاعات");
    } finally {
      setBusy(false);
    }
  }

  function openEntry(kind: string) {
    setEntryKind(kind);
    setSheet("entry");
  }

  function beginGroup() {
    setGroupMembers({});
    setSheet("group");
  }

  function deletePerson(person: Person) {
    const confirmed = window.confirm(`«${person.name}» حذف شود؟ همه ثبت‌های مالی این فرد و گروه‌های دُنگی مشترک او نیز برای حفظ درستی حساب‌ها پاک می‌شوند.`);
    if (confirmed) void post({ operation: "delete_person", id: person.id });
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
      operation: "add_entry", personId: form.get("personId"), kind: entryKind,
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

  function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    let expenseDate: string;
    try {
      expenseDate = jalaliInputToIso(String(form.get("expenseDate") ?? ""), true) as string;
    } catch (dateError) {
      setError(dateError instanceof Error ? dateError.message : "تاریخ شمسی معتبر نیست.");
      return;
    }
    void post({ operation: "add_expense", groupId: form.get("groupId"), payerPersonId: form.get("payerPersonId"), title: form.get("title"), amount: form.get("amount"), expenseDate });
  }

  return (
    <main className="app-shell" dir="rtl">
      <header className="topbar">
        <div>
          <p className="eyebrow">دفتر مالی شخصی</p>
          <h1>دفتر حساب شخصی</h1>
          <span className="local-badge">● ذخیره امن روی گوشی</span>
        </div>
        <button className="avatar" aria-label="پروفایل من"><Icon name="user" size={20} /></button>
      </header>

      {error && <button className="error-banner" onClick={() => setError("")}>{error}<span>×</span></button>}

      {!data ? <Loading /> : (
        <>
          {tab === "home" && (
            <section className="page home-page">
              <article className="balance-card">
                <div className="balance-top">
                  <span>تراز مالی من</span>
                  <span className={`net-pill ${net >= 0 ? "positive" : "negative"}`}>{net >= 0 ? "مثبت" : "منفی"}</span>
                </div>
                <strong className="balance-value">{shortMoney(net)} <small>تومان</small></strong>
                <div className="balance-grid">
                  <div><span className="dot green-dot" />طلب‌های باز<strong>{money(totalReceivable)}</strong></div>
                  <div><span className="dot coral-dot" />بدهی‌های باز<strong>{money(totalDebt)}</strong></div>
                </div>
                <div className="balance-art" aria-hidden="true"><i /><i /><i /><i /></div>
              </article>

              <div className="section-title"><h2>ثبت سریع</h2><button onClick={() => setSheet("actions")}>همه موارد</button></div>
              <div className="quick-grid">
                {Object.entries(entryMeta).map(([kind, meta]) => (
                  <button className="quick-action" key={kind} onClick={() => openEntry(kind)}>
                    <span className={`quick-icon ${meta.tone}`}><Icon name={meta.icon} /></span>
                    <span>{meta.label}</span>
                  </button>
                ))}
              </div>

              <div className="section-title"><h2>نزدیک‌ترین سررسیدها</h2><button onClick={() => setTab("calendar")}>مشاهده همه</button></div>
              <div className="surface-list">
                {upcoming.slice(0, 3).map((entry) => <EntryRow key={entry.id} entry={entry} onToggle={() => void post({ operation: "toggle_entry", id: entry.id })} />)}
                {!upcoming.length && <EmptyState icon="calendar-check" title="سررسید نزدیکی نداری" detail="چک یا قسط بعدی را ثبت کن تا به‌موقع ببینی." action="ثبت قسط" onAction={() => openEntry("installment")} />}
              </div>

              <div className="section-title"><h2>دُنگ‌های فعال</h2><button onClick={() => setTab("groups")}>مدیریت دُنگ‌ها</button></div>
              {data.groups[0] ? <GroupPreview group={data.groups[0]} /> : <EmptyState icon="users" title="هنوز گروه دُنگی نداری" detail="برای سفر، خانه یا دورهمی یک گروه بساز و سهم‌ها را مشخص کن." action="ساخت گروه" onAction={beginGroup} />}
            </section>
          )}

          {tab === "ledger" && (
            <section className="page">
              <div className="page-heading"><div><p className="eyebrow">حساب با آدم‌ها</p><h2>دفتر اشخاص</h2></div><button className="small-primary" onClick={() => setSheet("person")}>+ شخص جدید</button></div>
              <div className="people-scroll">
                {personBalances.map((person) => (
                  <article className="person-card" key={person.id}>
                    <button className="delete-person" onClick={() => deletePerson(person)} aria-label={`حذف ${person.name}`}>×</button>
                    <span className="person-avatar" style={{ background: person.color }}><Icon name="user" size={18} /></span>
                    <strong>{person.name}</strong>
                    <small className={person.balance >= 0 ? "text-green" : "text-coral"}>{person.balance === 0 ? "تسویه" : person.balance > 0 ? `${money(person.balance)} طلبکارم` : `${money(-person.balance)} بدهکارم`}</small>
                  </article>
                ))}
                {!people.length && <button className="person-card add-person-card" onClick={() => setSheet("person")}><span><Icon name="user-plus" size={20} /></span><strong>افزودن شخص</strong><small>اولین حساب را بساز</small></button>}
              </div>
              <div className="section-title"><h2>همه ثبت‌ها</h2><button onClick={() => setSheet("actions")}>+ ثبت جدید</button></div>
              <div className="surface-list entries-list">
                {data.entries.map((entry) => <EntryRow key={entry.id} entry={entry} onToggle={() => void post({ operation: "toggle_entry", id: entry.id })} />)}
                {!data.entries.length && <EmptyState icon="book" title="دفترت هنوز خالی است" detail="اولین بدهی، طلب، قسط یا چک را ثبت کن." action="ثبت مالی" onAction={() => setSheet("actions")} />}
              </div>
            </section>
          )}

          {tab === "groups" && (
            <section className="page">
              <div className="page-heading"><div><p className="eyebrow">خرج‌های مشترک</p><h2>مدیریت دُنگ</h2></div><button className="small-primary" onClick={beginGroup}>+ گروه جدید</button></div>
              {data.groups.length > 0 && <button className="expense-cta" onClick={() => setSheet("expense")}><span className="expense-plus">+</span><span><strong>ثبت خرید مشترک</strong><small>پرداخت‌کننده و مبلغ را مشخص کن</small></span><b>‹</b></button>}
              <div className="groups-stack">
                {data.groups.map((group) => <GroupCard key={group.id} group={group} onExpense={() => { setExpenseGroupId(group.id); setSheet("expense"); }} />)}
                {!data.groups.length && <EmptyState icon="users" title="دُنگ‌ها از اینجا ساده می‌شوند" detail="اعضا و سهم هر نفر را مشخص کن؛ ما حساب می‌کنیم چه کسی به چه کسی پرداخت کند." action="ساخت اولین گروه" onAction={beginGroup} />}
              </div>
            </section>
          )}

          {tab === "calendar" && (
            <section className="page">
              <div className="page-heading"><div><p className="eyebrow">برنامه پرداخت</p><h2>سررسیدها</h2></div><button className="small-primary" onClick={() => openEntry("installment")}>+ سررسید</button></div>
              <div className="timeline">
                {upcoming.map((entry) => (
                  <div className="timeline-row" key={entry.id}>
                    <div className={`date-badge ${entry.dueDate && entry.dueDate < today ? "overdue" : ""}`}><strong>{persianDate(entry.dueDate).split(" ")[0]}</strong><span>{persianDate(entry.dueDate).split(" ").slice(1).join(" ")}</span></div>
                    <EntryRow entry={entry} onToggle={() => void post({ operation: "toggle_entry", id: entry.id })} compact />
                  </div>
                ))}
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
          {sheet === "actions" && <ActionSheet onEntry={openEntry} onPerson={() => setSheet("person")} onGroup={beginGroup} onExpense={() => setSheet("expense")} hasGroup={Boolean(data?.groups.length)} />}
          {sheet === "person" && <PersonForm onSubmit={submitPerson} busy={busy} />}
          {sheet === "entry" && <EntryForm kind={entryKind} people={people} onNeedPerson={() => setSheet("person")} onSubmit={submitEntry} busy={busy} />}
          {sheet === "group" && <GroupForm persons={data?.persons ?? []} values={groupMembers} setValues={setGroupMembers} onSubmit={submitGroup} onNeedPerson={() => setSheet("person")} busy={busy} />}
          {sheet === "expense" && <ExpenseForm groups={data?.groups ?? []} selectedGroup={selectedExpenseGroup} onGroupChange={setExpenseGroupId} onSubmit={submitExpense} onNeedGroup={beginGroup} busy={busy} />}
        </section>
      </div>}
    </main>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: IconName; label: string; onClick: () => void }) {
  return <button className={active ? "active" : ""} onClick={onClick}><span><Icon name={icon} /></span><small>{label}</small></button>;
}

function EntryRow({ entry, onToggle, compact = false }: { entry: Entry; onToggle: () => void; compact?: boolean }) {
  const meta = entryMeta[entry.kind] ?? entryMeta.debt;
  return <article className={`entry-row ${entry.status === "paid" ? "paid" : ""} ${compact ? "compact" : ""}`}>
    <span className={`entry-icon ${meta.tone}`}><Icon name={meta.icon} /></span>
    <div className="entry-copy"><strong>{entry.title}</strong><small>{entry.personName}{entry.dueDate ? ` • ${persianDate(entry.dueDate)}` : ""}</small></div>
    <div className="entry-amount"><strong className={entry.direction === "receivable" ? "text-green" : "text-coral"}>{entry.direction === "receivable" ? "+" : "−"}{shortMoney(entry.amount)}</strong><button onClick={onToggle}>{entry.status === "paid" ? "بازگردانی" : "تسویه"}</button></div>
  </article>;
}

function EmptyState({ icon, title, detail, action, onAction }: { icon: IconName; title: string; detail: string; action: string; onAction: () => void }) {
  return <div className="empty-state"><span><Icon name={icon} size={24} /></span><strong>{title}</strong><p>{detail}</p><button onClick={onAction}>{action}</button></div>;
}

function GroupPreview({ group }: { group: Group }) {
  return <button className="group-preview" onClick={() => undefined}>
    <div className="group-preview-top"><span className="group-mark"><Icon name="users" size={19} /></span><div><strong>{group.name}</strong><small>{number.format(group.members.length)} نفر • {number.format(group.expenses.length)} خرید</small></div><b>{money(group.totalSpent)}</b></div>
    <div className="member-stack">{group.members.slice(0, 4).map((member) => <span key={member.personId} title={member.name}><Icon name="user" size={13} /></span>)}</div>
  </button>;
}

function GroupCard({ group, onExpense }: { group: Group; onExpense: () => void }) {
  return <article className="group-card">
    <div className="group-card-head"><div className="group-title"><span className="group-mark"><Icon name="users" size={19} /></span><div><h3>{group.name}</h3><p>{number.format(group.members.length)} عضو • جمع هزینه {money(group.totalSpent)}</p></div></div><button onClick={onExpense}>+ خرید</button></div>
    <div className="balances-list">
      {group.balances.map((balance) => <div key={balance.personId}><span className="mini-avatar"><Icon name="user" size={14} /></span><strong>{balance.name}</strong><small>خرج کرده {money(balance.paid)}</small><b className={balance.balance >= 0 ? "text-green" : "text-coral"}>{balance.balance === 0 ? "تسویه" : balance.balance > 0 ? `${shortMoney(balance.balance)} بستانکار` : `${shortMoney(-balance.balance)} بدهکار`}</b></div>)}
    </div>
    {group.settlements.length > 0 && <div className="settlement-box"><strong>پیشنهاد تسویه</strong>{group.settlements.map((item, index) => <p key={`${item.from}-${item.to}-${index}`}><span>{item.from}</span><i>←</i><span>{item.to}</span><b>{money(item.amount)}</b></p>)}</div>}
    <details className="transaction-history" open>
      <summary><span><Icon name="receipt" size={16} />ریز تراکنش‌ها</span><b>{number.format(group.expenses.length)} مورد</b></summary>
      {group.expenses.length ? <div className="transaction-list">{group.expenses.map((expense) => <article className="expense-transaction" key={expense.id}>
        <div className="expense-transaction-head"><span className="transaction-icon"><Icon name="receipt" size={16} /></span><div><strong>{expense.title}</strong><small>پرداخت توسط {expense.payerName} • {persianDate(expense.expenseDate)}</small></div><b>{money(expense.amount)}</b></div>
        <div className="expense-share-list">{expense.shares.map((share) => <span key={share.personId}><small>{share.name}</small><strong>{money(share.amount)}</strong></span>)}</div>
      </article>)}</div> : <p className="no-transactions">هنوز خریدی در این گروه ثبت نشده است.</p>}
    </details>
  </article>;
}

function ActionSheet({ onEntry, onPerson, onGroup, onExpense, hasGroup }: { onEntry: (kind: string) => void; onPerson: () => void; onGroup: () => void; onExpense: () => void; hasGroup: boolean }) {
  return <><div className="sheet-title"><p>چه چیزی می‌خواهی ثبت کنی؟</p><h2>ثبت جدید</h2></div><div className="action-list">
    {Object.entries(entryMeta).map(([kind, meta]) => <button key={kind} onClick={() => onEntry(kind)}><span className={`quick-icon ${meta.tone}`}><Icon name={meta.icon} /></span><div><strong>{meta.label}</strong><small>{kind === "debt" ? "پولی که باید پرداخت کنی" : kind === "receivable" ? "پولی که باید دریافت کنی" : kind === "installment" ? "پرداخت دوره‌ای و سررسید" : "چک دریافتی یا پرداختی"}</small></div><b>‹</b></button>)}
    <button onClick={hasGroup ? onExpense : onGroup}><span className="quick-icon blue"><Icon name="users" /></span><div><strong>{hasGroup ? "خرید دُنگی" : "گروه دُنگی"}</strong><small>{hasGroup ? "ثبت خرج مشترک جدید" : "ساخت گروه و تعیین سهم‌ها"}</small></div><b>‹</b></button>
    <button onClick={onPerson}><span className="quick-icon sand"><Icon name="user-plus" /></span><div><strong>شخص جدید</strong><small>افزودن به دفتر حساب‌ها</small></div><b>‹</b></button>
  </div></>;
}

function PersonForm({ onSubmit, busy }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <form onSubmit={onSubmit}><div className="sheet-title"><p>یک نفر را به دفترت اضافه کن</p><h2>شخص جدید</h2></div><label>نام و نام خانوادگی<input name="name" autoFocus required placeholder="مثلاً علی رضایی" /></label><label>شماره تماس <small>(اختیاری)</small><input name="phone" inputMode="tel" placeholder="۰۹۱۲۱۲۳۴۵۶۷" /></label><SubmitButton busy={busy} label="افزودن به دفتر" /></form>;
}

function EntryForm({ kind, people, onNeedPerson, onSubmit, busy }: { kind: string; people: Person[]; onNeedPerson: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  const meta = entryMeta[kind];
  if (!people.length) return <div className="form-empty"><span className={`quick-icon ${meta.tone}`}><Icon name={meta.icon} /></span><h2>اول یک شخص اضافه کن</h2><p>هر ثبت مالی باید به یک نفر وصل باشد.</p><button className="submit-button" onClick={onNeedPerson}>افزودن شخص</button></div>;
  return <form onSubmit={onSubmit}><div className="sheet-title"><p>جزئیات را وارد کن</p><h2>ثبت {meta.label}</h2></div>
    <label>طرف حساب<select name="personId" required defaultValue=""><option value="" disabled>انتخاب شخص</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
    {(kind === "installment" || kind === "check") && <label>نوع حساب<select name="direction"><option value="debt">پرداختی — من بدهکارم</option><option value="receivable">دریافتی — من طلبکارم</option></select></label>}
    <label>عنوان<input name="title" required placeholder={kind === "installment" ? "مثلاً قسط وام خودرو" : kind === "check" ? "مثلاً چک اجاره" : "بابت چه چیزی؟"} /></label>
    <label>مبلغ (تومان)<input name="amount" inputMode="numeric" type="number" min="1" required placeholder="مثلاً ۲۵۰۰۰۰۰" /></label>
    <JalaliDatePicker name="dueDate" label="تاریخ سررسید شمسی" optional />
    <label>یادداشت <small>(اختیاری)</small><textarea name="note" rows={2} placeholder="توضیح کوتاه..." /></label>
    <SubmitButton busy={busy} label={`ثبت ${meta.label}`} />
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
    <div className="member-add-row">
      <select aria-label="انتخاب عضو جدید" value={candidateId} onChange={(event) => setCandidateId(event.target.value)}><option value="">انتخاب شخص برای افزودن</option>{availablePeople.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select>
      <button type="button" onClick={addMember} disabled={!candidateId}>+ افزودن عضو</button>
    </div>
    {selectedPeople.length ? <div className="member-picker selected-members">{selectedPeople.map((person) => <div className="selected" key={person.id}>
      <div className="member-identity"><span><Icon name="user" size={14} /></span><strong>{person.name}</strong>{person.isSelf && <small>حساب من</small>}</div>
      <label>سهم<input aria-label={`سهم ${person.name}`} type="number" min="0" max="100" value={values[person.id]} onChange={(event) => setValues({ ...values, [person.id]: Math.max(0, Number(event.target.value) || 0) })} /></label>
      <button className="remove-member" type="button" onClick={() => removeMember(person.id)} aria-label={`حذف ${person.name} از گروه`}><Icon name="trash" size={14} /></button>
    </div>)}</div> : <div className="member-picker-empty"><Icon name="users" size={24} /><strong>هنوز عضوی اضافه نشده</strong><small>از فهرست بالا اعضای همین گروه را انتخاب کن.</small></div>}
    <p className="form-hint">سهم هر عضو به‌صورت پیش‌فرض صفر است و صفر هم مجاز است. هنگام ثبت خرید باید سهم حداقل یک عضو بیشتر از صفر باشد.</p>
    <SubmitButton busy={busy} label="ساخت گروه" />
  </form>;
}

function ExpenseForm({ groups, selectedGroup, onGroupChange, onSubmit, onNeedGroup, busy }: { groups: Group[]; selectedGroup?: Group; onGroupChange: (id: number) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onNeedGroup: () => void; busy: boolean }) {
  if (!groups.length) return <div className="form-empty"><span className="quick-icon blue"><Icon name="users" /></span><h2>اول یک گروه بساز</h2><p>برای ثبت خرید مشترک، اعضا و سهم‌ها باید مشخص باشند.</p><button className="submit-button" onClick={onNeedGroup}>ساخت گروه دُنگی</button></div>;
  return <form onSubmit={onSubmit}><div className="sheet-title"><p>هزینه بین اعضا طبق سهم تقسیم می‌شود</p><h2>خرید مشترک</h2></div>
    <label>گروه<select name="groupId" value={selectedGroup?.id ?? ""} onChange={(event) => onGroupChange(Number(event.target.value))}>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
    <label>چه کسی پرداخت کرد؟<select name="payerPersonId" required defaultValue=""><option value="" disabled>انتخاب پرداخت‌کننده</option>{selectedGroup?.members.map((member) => <option key={member.personId} value={member.personId}>{member.name}</option>)}</select></label>
    <label>بابت چه چیزی؟<input name="title" required placeholder="مثلاً خرید سوپرمارکت" /></label>
    <label>مبلغ کل (تومان)<input name="amount" type="number" inputMode="numeric" min="1" required placeholder="مثلاً ۱۸۵۰۰۰۰" /></label>
    <JalaliDatePicker name="expenseDate" label="تاریخ خرید شمسی" defaultToday required />
    {selectedGroup && <div className="split-preview"><strong>تقسیم طبق سهم</strong><div>{selectedGroup.members.map((member) => <span key={member.personId}>{member.name}: {number.format(member.shareWeight)} سهم</span>)}</div></div>}
    <SubmitButton busy={busy} label="ثبت و محاسبه دُنگ‌ها" />
  </form>;
}

function SubmitButton({ busy, label }: { busy: boolean; label: string }) {
  return <button className="submit-button" disabled={busy}>{busy ? "در حال ثبت..." : label}</button>;
}

function Loading() {
  return <div className="loading"><span /><span /><span /><p>دفترت را باز می‌کنیم...</p></div>;
}

function JalaliDatePicker({ name, label, optional = false, required = false, defaultToday = false }: { name: string; label: string; optional?: boolean; required?: boolean; defaultToday?: boolean }) {
  const today = jalaliTodayParts();
  const [value, setValue] = useState(defaultToday ? todayJalaliInput() : "");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState({ year: today.jy, month: today.jm });
  const firstWeekday = jalaliFirstWeekday(view.year, view.month);
  const days = jalaliMonthDays(view.year, view.month);
  const normalized = normalizeDigits(value);
  const selected = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(normalized);
  const selectedDay = selected && Number(selected[1]) === view.year && Number(selected[2]) === view.month ? Number(selected[3]) : null;

  function moveMonth(delta: number) {
    setView((current) => {
      let month = current.month + delta;
      let year = current.year;
      if (month > 12) { month = 1; year += 1; }
      if (month < 1) { month = 12; year -= 1; }
      return { year, month };
    });
  }

  function chooseDay(day: number) {
    setValue(jalaliPartsToInput(view.year, view.month, day));
    setOpen(false);
  }

  function chooseToday() {
    setView({ year: today.jy, month: today.jm });
    setValue(todayJalaliInput());
    setOpen(false);
  }

  return <div className="date-picker-field">
    <span className="date-label">{label} {optional && <small>(اختیاری)</small>}</span>
    <div className="date-input-wrap">
      <input className="jalali-input" name={name} value={value} readOnly required={required} placeholder="انتخاب تاریخ" onClick={() => setOpen((current) => !current)} aria-haspopup="dialog" aria-expanded={open} />
      <button type="button" className="calendar-trigger" onClick={() => setOpen((current) => !current)} aria-label={`باز کردن انتخاب‌گر ${label}`}><Icon name="calendar" size={16} /></button>
    </div>
    {open && <div className="jalali-calendar" role="dialog" aria-label={label}>
      <div className="calendar-head">
        <button type="button" onClick={() => moveMonth(1)} aria-label="ماه بعد">‹</button>
        <strong>{jalaliMonthName(view.month)} {toPersianDigits(view.year)}</strong>
        <button type="button" onClick={() => moveMonth(-1)} aria-label="ماه قبل">›</button>
      </div>
      <div className="weekdays">{["ش", "ی", "د", "س", "چ", "پ", "ج"].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="calendar-days">
        {Array.from({ length: firstWeekday }, (_, index) => <span key={`empty-${index}`} />)}
        {Array.from({ length: days }, (_, index) => index + 1).map((day) => {
          const isToday = view.year === today.jy && view.month === today.jm && day === today.jd;
          return <button type="button" key={day} className={`${selectedDay === day ? "selected" : ""} ${isToday ? "today" : ""}`} onClick={() => chooseDay(day)}>{toPersianDigits(day)}</button>;
        })}
      </div>
      <div className="calendar-actions">
        {optional && value && <button type="button" onClick={() => { setValue(""); setOpen(false); }}>پاک کردن</button>}
        <button type="button" onClick={chooseToday}>امروز</button>
      </div>
    </div>}
  </div>;
}
