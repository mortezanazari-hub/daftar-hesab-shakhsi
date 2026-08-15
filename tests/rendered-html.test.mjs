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
  assert.match(localDb, /DB_VERSION = 2/);
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
  assert.match(localDb, /finalBalance: directBalance \+ dongBalance/);
  assert.match(localDb, /expense\.payerPersonId === self\.id/);
  assert.match(localDb, /expense\.payerPersonId === person\.id/);
  assert.match(localDb, /settlement\.fromPersonId === person\.id && settlement\.toPersonId === self\.id/);
  assert.match(app, /ثبت‌های مستقیم \+ اثر دُنگ‌ها \+ تسویه‌های ثبت‌شده/);
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
