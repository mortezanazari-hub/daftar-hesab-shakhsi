import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("defines the Persian mobile finance application shell", async () => {
  const [layout, app, manifest] = await Promise.all([
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/FinanceApp.tsx", root), "utf8"),
    readFile(new URL("app/manifest.ts", root), "utf8"),
  ]);
  assert.match(layout, /lang="fa" dir="rtl"/);
  assert.match(layout, /دفتر حساب شخصی/);
  assert.match(layout, /og\.png/);
  assert.match(layout, /fontsource-variable\/vazirmatn/);
  assert.match(app, /مدیریت دُنگ/);
  assert.match(app, /دفتر کل اشخاص/);
  assert.match(app, /تاریخ سررسید شمسی/);
  assert.match(app, /jalaliInputToIso/);
  assert.match(manifest, /display: "standalone"/);
  assert.match(manifest, /icon-192\.png/);
  assert.match(manifest, /icon-512\.png/);
  assert.doesNotMatch(`${layout}\n${app}`, /codex-preview|react-loading-skeleton/i);
});

test("ships a device-local offline database and no starter preview", async () => {
  const [hosting, localDb, serviceWorker] = await Promise.all([
    readFile(new URL(".openai/hosting.json", root), "utf8"),
    readFile(new URL("app/local-db.ts", root), "utf8"),
    readFile(new URL("public/sw.js", root), "utf8"),
  ]);
  assert.match(hosting, /"d1": null/);
  assert.match(localDb, /indexedDB\.open/);
  assert.match(localDb, /DB_VERSION = 5/);
  assert.match(localDb, /"settlements"/);
  assert.match(localDb, /add_entry/);
  assert.match(localDb, /add_group/);
  assert.match(localDb, /add_expense/);
  assert.match(localDb, /delete_person/);
  assert.match(serviceWorker, /daftar-hesab-offline/);
  assert.match(serviceWorker, /caches\.match/);
  await assert.rejects(access(new URL("app/api/finance/route.ts", root)));
  await assert.rejects(access(new URL("app/_sites-preview/SkeletonPreview.tsx", root)));
});

test("keeps dong membership explicit and supports per-expense zero shares", async () => {
  const [app, localDb, schema, bootstrap] = await Promise.all([
    readFile(new URL("app/FinanceApp.tsx", root), "utf8"),
    readFile(new URL("app/local-db.ts", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("db/index.ts", root), "utf8"),
  ]);
  assert.match(app, /setGroupMembers\(Object\.fromEntries/);
  assert.match(app, /\[personId\]: 0/);
  assert.match(app, /سهم پیش‌فرض/);
  assert.match(app, /شرکت‌کنندگان این خرید/);
  assert.match(app, /splits/);
  assert.match(app, /ریز تراکنش‌ها/);
  assert.match(app, /expense\.shares/);
  assert.match(localDb, /uniqueMemberWeights/);
  assert.match(localDb, /shareWeight > 0/);
  assert.match(localDb, /amounts\.get\(member\.personId\) \?\? 0/);
  assert.match(schema, /shareWeight: integer\("share_weight"\)\.notNull\(\)\.default\(0\)/);
  assert.match(schema, /weight: integer\("weight"\)\.notNull\(\)\.default\(0\)/);
  assert.match(bootstrap, /share_weight INTEGER NOT NULL DEFAULT 0/);
  assert.match(bootstrap, /group_settlements/);
});

test("unifies direct balances and dong effects per person", async () => {
  const [app, localDb] = await Promise.all([
    readFile(new URL("app/FinanceApp.tsx", root), "utf8"),
    readFile(new URL("app/local-db.ts", root), "utf8"),
  ]);
  assert.match(localDb, /buildPersonAccounts/);
  assert.match(localDb, /directBalance/);
  assert.match(localDb, /dongBalance/);
  assert.match(localDb, /group\.suggestions\.reduce/);
  assert.match(localDb, /finalBalance: directBalance \+ checkBalance \+ dongBalance/);
  assert.match(localDb, /expense\.payerPersonId === self\.id/);
  assert.match(localDb, /expense\.payerPersonId === person\.id/);
  assert.match(localDb, /settlement\.fromPersonId === person\.id && settlement\.toPersonId === self\.id/);
  assert.match(app, /ثبت‌های مستقیم \+ دُنگ‌ها \+ چک‌ها \+ تسویه‌ها \+ مانده وام‌ها/);
  assert.match(app, /گردش کامل/);
  assert.match(app, /تفکیک دُنگ‌ها/);
});

test("records settlements, supports safe editing, formatted money, and backup restore", async () => {
  const [app, localDb] = await Promise.all([
    readFile(new URL("app/FinanceApp.tsx", root), "utf8"),
    readFile(new URL("app/local-db.ts", root), "utf8"),
  ]);
  assert.match(localDb, /add_settlement/);
  assert.match(localDb, /delete_settlement/);
  assert.match(localDb, /update_entry/);
  assert.match(localDb, /delete_entry/);
  assert.match(localDb, /update_expense/);
  assert.match(localDb, /delete_expense/);
  assert.match(localDb, /exportFinanceBackup/);
  assert.match(localDb, /importFinanceBackup/);
  assert.match(app, /function MoneyInput/);
  assert.match(app, /number\.format\(Number\(digits\)\)/);
  assert.match(app, /دریافت نسخه پشتیبان/);
  assert.match(app, /بازیابی نسخه پشتیبان/);
  assert.match(app, /ثبت تسویه واقعی/);
  assert.match(app, /جست‌وجوی شخص، عنوان یا یادداشت/);
});


test("dong groups can be edited and deleted without erasing historical member records", async () => {
  const [app, localDb] = await Promise.all([
    readFile(new URL("app/FinanceApp.tsx", root), "utf8"),
    readFile(new URL("app/local-db.ts", root), "utf8"),
  ]);
  assert.match(app, /editingGroupId/);
  assert.match(app, /operation: editingGroup \? "update_group" : "add_group"/);
  assert.match(app, /operation: "delete_group"/);
  assert.match(app, /ویرایش گروه دُنگی/);
  assert.match(app, /ذخیره تغییرات گروه/);
  assert.match(app, /عضو سابق/);
  assert.match(localDb, /operation === "update_group"/);
  assert.match(localDb, /active: nextWeight !== undefined/);
  assert.match(localDb, /operation === "delete_group"/);
  assert.match(localDb, /getAllGroupMembers/);
});


test("models bank and store installments independently from person ledgers", async () => {
  const [app, localDb, jalali, css] = await Promise.all([
    readFile(new URL("app/FinanceApp.tsx", root), "utf8"),
    readFile(new URL("app/local-db.ts", root), "utf8"),
    readFile(new URL("app/jalali.ts", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(app, /وام و اقساط/);
  assert.match(app, /فقط چیزهایی که برای یادآوری قسط لازم داری/);
  assert.match(app, /در مجموع چقدر باید بدم/);
  assert.match(app, /بعد از زدن «پرداخت شد»، سررسید بعدی خودش جلو می‌آید/);
  assert.match(app, /پرداخت جزئی هم مجاز است/);
  assert.match(app, /data\.loans/);
  assert.match(localDb, /"loanInstallments"/);
  assert.match(localDb, /"loanPayments"/);
  assert.match(localDb, /operation === "add_loan" \|\| operation === "update_loan"/);
  assert.match(localDb, /operation === "add_loan_payment"/);
  assert.match(localDb, /remainingAmount/);
  assert.match(jalali, /buildJalaliInstallmentDates/);
  assert.match(css, /\.calendar-trigger \{[^}]*place-items: center/s);
  assert.match(css, /\.loan-card/);
});


test("tracks cheque journeys and keeps the everyday UI personal", async () => {
  const [app, localDb, serviceWorker, css] = await Promise.all([
    readFile(new URL("app/FinanceApp.tsx", root), "utf8"),
    readFile(new URL("app/local-db.ts", root), "utf8"),
    readFile(new URL("public/sw.js", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(localDb, /type CheckEvent/);
  assert.match(localDb, /DB_VERSION = 5/);
  assert.match(localDb, /"checkEvents"/);
  assert.match(localDb, /operation === "add_check" \|\| operation === "update_check"/);
  assert.match(localDb, /operation === "transfer_check"/);
  assert.match(localDb, /operation === "return_check_to_me"/);
  assert.match(localDb, /currentHolderName/);
  assert.match(localDb, /eventType: CheckEventType/);
  assert.match(localDb, /شناسه صیادی در صورت ورود باید ۱۶ رقم باشد/);
  assert.doesNotMatch(localDb, /checkType === "sayadi" && sayadId\.length !== 16/);
  assert.match(app, /چک‌های من/);
  assert.match(app, /گرفتم، دادم، واگذار کردم/);
  assert.match(app, /واگذار کردم/);
  assert.match(app, /دارنده فعلی/);
  assert.match(app, /جزئیات و مسیر چک/);
  assert.match(app, /برگردان به جریان/);
  assert.match(app, /چک رو به کی دادم/);
  assert.match(app, /این چک تا وقتی پاس شود از لیست پیگیری حذف نمی‌شود/);
  assert.match(app, /شناسه صیاد <small>\(اختیاری/);
  assert.match(app, /جزئیات بیشتر/);
  assert.match(css, /check-timeline/);
  assert.match(css, /advanced-fields/);
  assert.match(serviceWorker, /daftar-hesab-offline-v16/);
});

test("lets monthly installment reminders be completed directly from due dates", async () => {
  const [app, localDb, jalali] = await Promise.all([
    readFile(new URL("app/FinanceApp.tsx", root), "utf8"),
    readFile(new URL("app/local-db.ts", root), "utf8"),
    readFile(new URL("app/jalali.ts", root), "utf8"),
  ]);
  assert.match(app, /function markInstallmentPaid/);
  assert.match(app, /پرداخت شد/);
  assert.match(app, /ثبت سریع از سررسید/);
  assert.match(app, /onLoanPaid/);
  assert.match(localDb, /operation === "add_loan_payment"/);
  assert.match(jalali, /buildJalaliInstallmentDates/);
});


test("filters due dates by Jalali month and keeps completed items visible like a todo list", async () => {
  const [app, css] = await Promise.all([
    readFile(new URL("app/FinanceApp.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(app, /useState<"overdue" \| "current" \| "next" \| "all">\("current"\)/);
  assert.match(app, /jalaliMonthName\(currentJalaliMonth\.jm\)/);
  assert.match(app, /jalaliMonthName\(nextJalaliMonth\.jm\)/);
  assert.match(app, /مخفی کردن انجام‌شده‌ها/);
  assert.match(app, /نمایش انجام‌شده‌ها/);
  assert.match(app, /completed: installment\.status === "paid"/);
  assert.match(app, /completed: !check\.financialOpen/);
  assert.match(app, /due-completed-label/);
  assert.match(css, /timeline-row\.completed/);
  assert.match(css, /text-decoration: line-through/);
  assert.match(css, /hide-completed-due/);
});

test("uses plus and minus steppers for dong shares while keeping direct numeric editing", async () => {
  const [app, css] = await Promise.all([
    readFile(new URL("app/FinanceApp.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(app, /function ShareStepper/);
  assert.match(app, /کم کردن \$\{label\}/);
  assert.match(app, /زیاد کردن \$\{label\}/);
  assert.match(app, /type="number" min="0" max="100"/);
  assert.match(app, /<ShareStepper label=\{`سهم \$\{person\.name\}`\}/);
  assert.match(app, /<ShareStepper label=\{`سهم خرید \$\{member\.name\}`\}/);
  assert.match(css, /\.share-stepper/);
  assert.match(css, /\.participant-share/);
});


test("uses plus and minus steppers for small counting fields", async () => {
  const app = await readFile(new URL("app/FinanceApp.tsx", root), "utf8");
  assert.match(app, /function CountStepper/);
  assert.match(app, /name="installmentCount" label="تعداد اقساط" min=\{1\} max=\{600\}/);
  assert.match(app, /name="intervalMonths" label="فاصله اقساط به ماه" min=\{1\} max=\{24\}/);
  assert.match(app, /className="share-stepper number-stepper"/);
});


test("keeps cheque management directly accessible and centers home in the five-item navigation", async () => {
  const [app, css] = await Promise.all([
    readFile(new URL("app/FinanceApp.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(app, /active=\{tab === "checks"\} icon="check" label="چک‌ها" onClick=\{openChecks\}/);
  assert.match(app, /label="دُنگ‌ها"[\s\S]*label="خانه"[\s\S]*label="چک‌ها"/);
  assert.doesNotMatch(app, /className="nav-add"/);
  assert.match(css, /grid-template-columns: repeat\(5, 1fr\)/);
});

test("shows every quick action in a horizontally scrollable home strip", async () => {
  const [app, css] = await Promise.all([
    readFile(new URL("app/FinanceApp.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(app, /className="quick-grid quick-scroll"/);
  assert.match(app, /quickEntryKinds\.map/);
  assert.match(app, /<span>وام و اقساط<\/span>/);
  assert.match(app, /<span>چک<\/span>/);
  assert.match(app, /خرید دُنگی/);
  assert.match(app, /شخص جدید/);
  assert.doesNotMatch(app, /ثبت سریع<\/h2><button[^>]*>همه موارد/);
  assert.match(css, /\.quick-scroll \{/);
  assert.match(css, /overflow-x: auto/);
  assert.match(css, /flex: 0 0 92px/);
});

test("prevents iPhone form auto-zoom and page-wide horizontal drift", async () => {
  const [layout, css] = await Promise.all([
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(layout, /width:\s*"device-width"/);
  assert.match(layout, /initialScale:\s*1/);
  assert.match(layout, /viewportFit:\s*"cover"/);
  assert.match(css, /v13 — iPhone Safari zoom and horizontal-scroll stability/);
  assert.match(css, /overflow-x:\s*clip/);
  assert.match(css, /overscroll-behavior-x:\s*none/);
  assert.match(css, /touch-action:\s*manipulation/);
  assert.match(css, /@supports \(-webkit-touch-callout: none\)/);
  assert.match(css, /font-size:\s*16px !important/);
});


test("filters overdue due items separately from current and next Jalali months", async () => {
  const app = await readFile(new URL("app/FinanceApp.tsx", root), "utf8");
  assert.match(app, /useState<"overdue" \| "current" \| "next" \| "all">\("current"\)/);
  assert.match(app, /dueRange === "overdue"/);
  assert.match(app, /return item\.overdue/);
  assert.match(app, /عقب‌افتاده/);
  assert.match(app, /overdueDueCount/);
});

test("distinguishes user attachments from app-generated transaction receipts", async () => {
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
  assert.match(serviceWorker, /daftar-hesab-offline-v16/);
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


test("keeps mobile person/group layouts readable and exports complete PDF reports", async () => {
  const [app, css, report, serviceWorker] = await Promise.all([
    readFile(new URL("app/FinanceApp.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("app/report-pdf.ts", root), "utf8"),
    readFile(new URL("public/sw.js", root), "utf8"),
  ]);
  assert.match(app, /sharePersonLedgerPdf/);
  assert.match(app, /shareGroupPdf/);
  assert.match(app, /ارسال PDF کل دفتر/);
  assert.match(app, /ارسال PDF کامل گروه/);
  assert.match(report, /export async function sharePersonLedgerPdf/);
  assert.match(report, /export async function shareGroupPdf/);
  assert.match(report, /%PDF-1\.4/);
  assert.match(report, /application\/pdf/);
  assert.match(report, /navigator\.canShare/);
  assert.match(report, /ریز تراکنش‌ها/);
  assert.match(css, /v16 — mobile ledger\/group regression fixes/);
  assert.match(css, /\.ledger-item > \.ledger-item-open/);
  assert.match(css, /\.group-card-head > \.group-title-button/);
  assert.match(css, /\.group-card\.collapsed \.group-head-actions/);
  const legacyLedgerButton = css.indexOf(".ledger-item > button");
  const ledgerFix = css.lastIndexOf(".ledger-item > .ledger-item-open");
  const legacyGroupButton = css.indexOf(".group-card-head > button");
  const groupFix = css.lastIndexOf(".group-card-head > .group-title-button");
  assert.ok(ledgerFix > legacyLedgerButton);
  assert.ok(groupFix > legacyGroupButton);
  assert.match(serviceWorker, /daftar-hesab-offline-v16/);
});


test("direct debt and receivable settlements create linked counterpart transactions", async () => {
  const [app, localDb, serviceWorker] = await Promise.all([
    readFile(new URL("app/FinanceApp.tsx", root), "utf8"),
    readFile(new URL("app/local-db.ts", root), "utf8"),
    readFile(new URL("public/sw.js", root), "utf8"),
  ]);
  assert.match(localDb, /role: "obligation" \| "settlement"/);
  assert.match(localDb, /settlesEntryId/);
  assert.match(localDb, /settledByEntryId/);
  assert.match(localDb, /operation === "settle_entry"/);
  assert.match(localDb, /kind: "settlement"/);
  assert.match(localDb, /operation === "reopen_entry"/);
  assert.match(localDb, /item\.settlesEntryId === id/);
  assert.match(app, /DirectEntrySettlementForm/);
  assert.match(app, /ثبت تراکنش تسویه/);
  assert.match(app, /تراکنش تسویه‌کننده/);
  assert.match(app, /بدهی \/ طلب اصلی/);
  assert.match(app, /handleEntrySettlement\(entry\)/);
  assert.doesNotMatch(app, /onToggleEntry=\{\(entry\) => void post\(\{ operation: "toggle_entry"/);
  assert.match(serviceWorker, /daftar-hesab-offline-v16/);
});


test("uses browser history so the phone Back button moves one screen back before leaving the app", async () => {
  const [app, serviceWorker] = await Promise.all([
    readFile(new URL("app/FinanceApp.tsx", root), "utf8"),
    readFile(new URL("public/sw.js", root), "utf8"),
  ]);
  assert.match(app, /type AppHistorySnapshot/);
  assert.match(app, /type AppBrowserHistoryState/);
  assert.match(app, /window\.history\.replaceState/);
  assert.match(app, /window\.history\.pushState/);
  assert.match(app, /window\.addEventListener\("popstate", handlePopState\)/);
  assert.match(app, /if \(!state\?\.__daftarApp \|\| !state\.snapshot\) return/);
  assert.match(app, /function dismissSheet\(\)/);
  assert.match(app, /window\.history\.back\(\)/);
  assert.match(app, /onClick=\{dismissSheet\}/);
  assert.match(app, /if \(close\) dismissSheet\(\)/);
  assert.match(serviceWorker, /daftar-hesab-offline-v16/);
});
