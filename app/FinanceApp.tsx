"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { jalaliInputToIso, persianDate, todayIso, todayJalaliInput } from "./jalali";

type Person = { id: number; name: string; phone: string; isSelf: boolean; color: string };
type Entry = { id: number; personId: number; personName: string; kind: string; direction: string; title: string; amount: number; dueDate: string | null; status: string; note: string; createdAt: string };
type GroupMember = { personId: number; name: string; shareWeight: number };
type Expense = { id: number; payerPersonId: number; payerName: string; title: string; amount: number; expenseDate: string };
type Balance = { personId: number; name: string; paid: number; owed: number; balance: number };
type Settlement = { from: string; to: string; amount: number };
type Group = { id: number; name: string; members: GroupMember[]; expenses: Expense[]; totalSpent: number; balances: Balance[]; settlements: Settlement[] };
type FinanceData = { persons: Person[]; entries: Entry[]; groups: Group[] };
type Sheet = "actions" | "person" | "entry" | "group" | "expense" | null;
type Tab = "home" | "ledger" | "groups" | "calendar";

const entryMeta: Record<string, { label: string; icon: string; tone: string }> = {
  debt: { label: "بدهی", icon: "−", tone: "coral" },
  receivable: { label: "طلب", icon: "+", tone: "green" },
  installment: { label: "قسط", icon: "ق", tone: "amber" },
  check: { label: "چک", icon: "چ", tone: "violet" },
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
      const response = await fetch("/api/finance", { cache: "no-store" });
      const result = await response.json() as FinanceData & { error?: string };
      if (!response.ok) throw new Error(result.error || "اطلاعات دریافت نشد.");
      setData(result);
      setError("");
      if (!expenseGroupId && result.groups[0]) setExpenseGroupId(result.groups[0].id);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "خطا در دریافت اطلاعات");
    }
  }, [expenseGroupId]);

  useEffect(() => { void load(); }, [load]);

  const people = data?.persons.filter((person) => !person.isSelf) ?? [];
  const self = data?.persons.find((person) => person.isSelf);
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
      const response = await fetch("/api/finance", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "ثبت انجام نشد.");
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
    setGroupMembers(self ? { [self.id]: 1 } : {});
    setSheet("group");
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
    const members = Object.entries(groupMembers).filter(([, weight]) => weight > 0).map(([personId, shareWeight]) => ({ personId: Number(personId), shareWeight }));
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
          <h1>هم‌حساب</h1>
        </div>
        <button className="avatar" aria-label="پروفایل من">م</button>
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
                    <span className={`quick-icon ${meta.tone}`}>{meta.icon}</span>
                    <span>{meta.label}</span>
                  </button>
                ))}
              </div>

              <div className="section-title"><h2>نزدیک‌ترین سررسیدها</h2><button onClick={() => setTab("calendar")}>مشاهده همه</button></div>
              <div className="surface-list">
                {upcoming.slice(0, 3).map((entry) => <EntryRow key={entry.id} entry={entry} onToggle={() => void post({ operation: "toggle_entry", id: entry.id })} />)}
                {!upcoming.length && <EmptyState icon="✓" title="سررسید نزدیکی نداری" detail="چک یا قسط بعدی را ثبت کن تا به‌موقع ببینی." action="ثبت قسط" onAction={() => openEntry("installment")} />}
              </div>

              <div className="section-title"><h2>دُنگ‌های فعال</h2><button onClick={() => setTab("groups")}>مدیریت دُنگ‌ها</button></div>
              {data.groups[0] ? <GroupPreview group={data.groups[0]} /> : <EmptyState icon="د" title="هنوز گروه دُنگی نداری" detail="برای سفر، خانه یا دورهمی یک گروه بساز و سهم‌ها را مشخص کن." action="ساخت گروه" onAction={beginGroup} />}
            </section>
          )}

          {tab === "ledger" && (
            <section className="page">
              <div className="page-heading"><div><p className="eyebrow">حساب با آدم‌ها</p><h2>دفتر اشخاص</h2></div><button className="small-primary" onClick={() => setSheet("person")}>+ شخص جدید</button></div>
              <div className="people-scroll">
                {personBalances.map((person) => (
                  <article className="person-card" key={person.id}>
                    <span className="person-avatar" style={{ background: person.color }}>{person.name.slice(0, 1)}</span>
                    <strong>{person.name}</strong>
                    <small className={person.balance >= 0 ? "text-green" : "text-coral"}>{person.balance === 0 ? "تسویه" : person.balance > 0 ? `${money(person.balance)} طلبکارم` : `${money(-person.balance)} بدهکارم`}</small>
                  </article>
                ))}
                {!people.length && <button className="person-card add-person-card" onClick={() => setSheet("person")}><span>+</span><strong>افزودن شخص</strong><small>اولین حساب را بساز</small></button>}
              </div>
              <div className="section-title"><h2>همه ثبت‌ها</h2><button onClick={() => setSheet("actions")}>+ ثبت جدید</button></div>
              <div className="surface-list entries-list">
                {data.entries.map((entry) => <EntryRow key={entry.id} entry={entry} onToggle={() => void post({ operation: "toggle_entry", id: entry.id })} />)}
                {!data.entries.length && <EmptyState icon="د" title="دفترت هنوز خالی است" detail="اولین بدهی، طلب، قسط یا چک را ثبت کن." action="ثبت مالی" onAction={() => setSheet("actions")} />}
              </div>
            </section>
          )}

          {tab === "groups" && (
            <section className="page">
              <div className="page-heading"><div><p className="eyebrow">خرج‌های مشترک</p><h2>مدیریت دُنگ</h2></div><button className="small-primary" onClick={beginGroup}>+ گروه جدید</button></div>
              {data.groups.length > 0 && <button className="expense-cta" onClick={() => setSheet("expense")}><span className="expense-plus">+</span><span><strong>ثبت خرید مشترک</strong><small>پرداخت‌کننده و مبلغ را مشخص کن</small></span><b>‹</b></button>}
              <div className="groups-stack">
                {data.groups.map((group) => <GroupCard key={group.id} group={group} onExpense={() => { setExpenseGroupId(group.id); setSheet("expense"); }} />)}
                {!data.groups.length && <EmptyState icon="د" title="دُنگ‌ها از اینجا ساده می‌شوند" detail="اعضا و سهم هر نفر را مشخص کن؛ ما حساب می‌کنیم چه کسی به چه کسی پرداخت کند." action="ساخت اولین گروه" onAction={beginGroup} />}
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
                {!upcoming.length && <EmptyState icon="ت" title="تقویمت خالی است" detail="برای اقساط و چک‌ها تاریخ سررسید بگذار." action="ثبت سررسید" onAction={() => openEntry("installment")} />}
              </div>
            </section>
          )}
        </>
      )}

      <nav className="bottom-nav" aria-label="منوی اصلی">
        <NavButton active={tab === "home"} icon="⌂" label="خانه" onClick={() => setTab("home")} />
        <NavButton active={tab === "ledger"} icon="د" label="دفتر" onClick={() => setTab("ledger")} />
        <button className="nav-add" aria-label="ثبت جدید" onClick={() => setSheet("actions")}>+</button>
        <NavButton active={tab === "groups"} icon="گ" label="دُنگ‌ها" onClick={() => setTab("groups")} />
        <NavButton active={tab === "calendar"} icon="ت" label="سررسید" onClick={() => setTab("calendar")} />
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

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: string; label: string; onClick: () => void }) {
  return <button className={active ? "active" : ""} onClick={onClick}><span>{icon}</span><small>{label}</small></button>;
}

function EntryRow({ entry, onToggle, compact = false }: { entry: Entry; onToggle: () => void; compact?: boolean }) {
  const meta = entryMeta[entry.kind] ?? entryMeta.debt;
  return <article className={`entry-row ${entry.status === "paid" ? "paid" : ""} ${compact ? "compact" : ""}`}>
    <span className={`entry-icon ${meta.tone}`}>{meta.icon}</span>
    <div className="entry-copy"><strong>{entry.title}</strong><small>{entry.personName}{entry.dueDate ? ` • ${persianDate(entry.dueDate)}` : ""}</small></div>
    <div className="entry-amount"><strong className={entry.direction === "receivable" ? "text-green" : "text-coral"}>{entry.direction === "receivable" ? "+" : "−"}{shortMoney(entry.amount)}</strong><button onClick={onToggle}>{entry.status === "paid" ? "بازگردانی" : "تسویه"}</button></div>
  </article>;
}

function EmptyState({ icon, title, detail, action, onAction }: { icon: string; title: string; detail: string; action: string; onAction: () => void }) {
  return <div className="empty-state"><span>{icon}</span><strong>{title}</strong><p>{detail}</p><button onClick={onAction}>{action}</button></div>;
}

function GroupPreview({ group }: { group: Group }) {
  return <button className="group-preview" onClick={() => undefined}>
    <div className="group-preview-top"><span className="group-mark">{group.name.slice(0, 1)}</span><div><strong>{group.name}</strong><small>{number.format(group.members.length)} نفر • {number.format(group.expenses.length)} خرید</small></div><b>{money(group.totalSpent)}</b></div>
    <div className="member-stack">{group.members.slice(0, 4).map((member) => <span key={member.personId}>{member.name.slice(0, 1)}</span>)}</div>
  </button>;
}

function GroupCard({ group, onExpense }: { group: Group; onExpense: () => void }) {
  return <article className="group-card">
    <div className="group-card-head"><div className="group-title"><span className="group-mark">{group.name.slice(0, 1)}</span><div><h3>{group.name}</h3><p>{number.format(group.members.length)} عضو • جمع هزینه {money(group.totalSpent)}</p></div></div><button onClick={onExpense}>+ خرید</button></div>
    <div className="balances-list">
      {group.balances.map((balance) => <div key={balance.personId}><span className="mini-avatar">{balance.name.slice(0, 1)}</span><strong>{balance.name}</strong><small>خرج کرده {money(balance.paid)}</small><b className={balance.balance >= 0 ? "text-green" : "text-coral"}>{balance.balance === 0 ? "تسویه" : balance.balance > 0 ? `${shortMoney(balance.balance)} بستانکار` : `${shortMoney(-balance.balance)} بدهکار`}</b></div>)}
    </div>
    {group.settlements.length > 0 && <div className="settlement-box"><strong>پیشنهاد تسویه</strong>{group.settlements.map((item, index) => <p key={`${item.from}-${item.to}-${index}`}><span>{item.from}</span><i>←</i><span>{item.to}</span><b>{money(item.amount)}</b></p>)}</div>}
    {group.expenses.length > 0 && <div className="latest-expense"><span>آخرین خرید: {group.expenses[0].title}</span><strong>{money(group.expenses[0].amount)}</strong></div>}
  </article>;
}

function ActionSheet({ onEntry, onPerson, onGroup, onExpense, hasGroup }: { onEntry: (kind: string) => void; onPerson: () => void; onGroup: () => void; onExpense: () => void; hasGroup: boolean }) {
  return <><div className="sheet-title"><p>چه چیزی می‌خواهی ثبت کنی؟</p><h2>ثبت جدید</h2></div><div className="action-list">
    {Object.entries(entryMeta).map(([kind, meta]) => <button key={kind} onClick={() => onEntry(kind)}><span className={`quick-icon ${meta.tone}`}>{meta.icon}</span><div><strong>{meta.label}</strong><small>{kind === "debt" ? "پولی که باید پرداخت کنی" : kind === "receivable" ? "پولی که باید دریافت کنی" : kind === "installment" ? "پرداخت دوره‌ای و سررسید" : "چک دریافتی یا پرداختی"}</small></div><b>‹</b></button>)}
    <button onClick={hasGroup ? onExpense : onGroup}><span className="quick-icon blue">د</span><div><strong>{hasGroup ? "خرید دُنگی" : "گروه دُنگی"}</strong><small>{hasGroup ? "ثبت خرج مشترک جدید" : "ساخت گروه و تعیین سهم‌ها"}</small></div><b>‹</b></button>
    <button onClick={onPerson}><span className="quick-icon sand">ش</span><div><strong>شخص جدید</strong><small>افزودن به دفتر حساب‌ها</small></div><b>‹</b></button>
  </div></>;
}

function PersonForm({ onSubmit, busy }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <form onSubmit={onSubmit}><div className="sheet-title"><p>یک نفر را به دفترت اضافه کن</p><h2>شخص جدید</h2></div><label>نام و نام خانوادگی<input name="name" autoFocus required placeholder="مثلاً علی رضایی" /></label><label>شماره تماس <small>(اختیاری)</small><input name="phone" inputMode="tel" placeholder="۰۹۱۲۱۲۳۴۵۶۷" /></label><SubmitButton busy={busy} label="افزودن به دفتر" /></form>;
}

function EntryForm({ kind, people, onNeedPerson, onSubmit, busy }: { kind: string; people: Person[]; onNeedPerson: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  const meta = entryMeta[kind];
  if (!people.length) return <div className="form-empty"><span className={`quick-icon ${meta.tone}`}>{meta.icon}</span><h2>اول یک شخص اضافه کن</h2><p>هر ثبت مالی باید به یک نفر وصل باشد.</p><button className="submit-button" onClick={onNeedPerson}>افزودن شخص</button></div>;
  return <form onSubmit={onSubmit}><div className="sheet-title"><p>جزئیات را وارد کن</p><h2>ثبت {meta.label}</h2></div>
    <label>طرف حساب<select name="personId" required defaultValue=""><option value="" disabled>انتخاب شخص</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
    {(kind === "installment" || kind === "check") && <label>نوع حساب<select name="direction"><option value="debt">پرداختی — من بدهکارم</option><option value="receivable">دریافتی — من طلبکارم</option></select></label>}
    <label>عنوان<input name="title" required placeholder={kind === "installment" ? "مثلاً قسط وام خودرو" : kind === "check" ? "مثلاً چک اجاره" : "بابت چه چیزی؟"} /></label>
    <label>مبلغ (تومان)<input name="amount" inputMode="numeric" type="number" min="1" required placeholder="مثلاً ۲۵۰۰۰۰۰" /></label>
    <label>تاریخ سررسید شمسی <small>(اختیاری)</small><input className="jalali-input" name="dueDate" inputMode="numeric" placeholder="۱۴۰۵/۰۵/۲۴" autoComplete="off" /></label>
    <p className="date-help">تاریخ را با سال، ماه و روز شمسی وارد کنید؛ مثال: ۱۴۰۵/۰۵/۲۴</p>
    <label>یادداشت <small>(اختیاری)</small><textarea name="note" rows={2} placeholder="توضیح کوتاه..." /></label>
    <SubmitButton busy={busy} label={`ثبت ${meta.label}`} />
  </form>;
}

function GroupForm({ persons, values, setValues, onSubmit, onNeedPerson, busy }: { persons: Person[]; values: Record<number, number>; setValues: (value: Record<number, number>) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onNeedPerson: () => void; busy: boolean }) {
  return <form onSubmit={onSubmit}><div className="sheet-title"><p>اعضا و سهم هر نفر را مشخص کن</p><h2>گروه دُنگی جدید</h2></div>
    <label>نام گروه<input name="name" required autoFocus placeholder="مثلاً سفر شمال" /></label>
    <div className="member-picker-title"><strong>اعضا و ضریب سهم</strong><button type="button" onClick={onNeedPerson}>+ شخص جدید</button></div>
    <div className="member-picker">{persons.map((person) => {
      const selected = Boolean(values[person.id]);
      return <div className={selected ? "selected" : ""} key={person.id}><button type="button" onClick={() => setValues({ ...values, [person.id]: selected && !person.isSelf ? 0 : 1 })} disabled={person.isSelf}><span>{selected ? "✓" : "+"}</span><strong>{person.name}</strong>{person.isSelf && <small>همیشه عضو</small>}</button>{selected && <label>سهم<input aria-label={`سهم ${person.name}`} type="number" min="1" max="100" value={values[person.id]} onChange={(event) => setValues({ ...values, [person.id]: Math.max(1, Number(event.target.value)) })} /></label>}</div>;
    })}</div>
    <p className="form-hint">مثال: سهم ۲ یعنی هزینه این فرد دو برابر کسی است که سهم ۱ دارد.</p>
    <SubmitButton busy={busy} label="ساخت گروه" />
  </form>;
}

function ExpenseForm({ groups, selectedGroup, onGroupChange, onSubmit, onNeedGroup, busy }: { groups: Group[]; selectedGroup?: Group; onGroupChange: (id: number) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onNeedGroup: () => void; busy: boolean }) {
  if (!groups.length) return <div className="form-empty"><span className="quick-icon blue">د</span><h2>اول یک گروه بساز</h2><p>برای ثبت خرید مشترک، اعضا و سهم‌ها باید مشخص باشند.</p><button className="submit-button" onClick={onNeedGroup}>ساخت گروه دُنگی</button></div>;
  return <form onSubmit={onSubmit}><div className="sheet-title"><p>هزینه بین اعضا طبق سهم تقسیم می‌شود</p><h2>خرید مشترک</h2></div>
    <label>گروه<select name="groupId" value={selectedGroup?.id ?? ""} onChange={(event) => onGroupChange(Number(event.target.value))}>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
    <label>چه کسی پرداخت کرد؟<select name="payerPersonId" required defaultValue=""><option value="" disabled>انتخاب پرداخت‌کننده</option>{selectedGroup?.members.map((member) => <option key={member.personId} value={member.personId}>{member.name}</option>)}</select></label>
    <label>بابت چه چیزی؟<input name="title" required placeholder="مثلاً خرید سوپرمارکت" /></label>
    <label>مبلغ کل (تومان)<input name="amount" type="number" inputMode="numeric" min="1" required placeholder="مثلاً ۱۸۵۰۰۰۰" /></label>
    <label>تاریخ خرید شمسی<input className="jalali-input" name="expenseDate" inputMode="numeric" defaultValue={todayJalaliInput()} placeholder="۱۴۰۵/۰۵/۲۴" autoComplete="off" required /></label>
    <p className="date-help">تاریخ امروز به‌صورت شمسی درج شده و قابل ویرایش است.</p>
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
