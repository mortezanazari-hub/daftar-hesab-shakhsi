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
  assert.match(layout, /هم‌حساب/);
  assert.match(layout, /og\.png/);
  assert.match(layout, /fontsource-variable\/vazirmatn/);
  assert.match(app, /مدیریت دُنگ/);
  assert.match(app, /دفتر اشخاص/);
  assert.match(app, /تاریخ سررسید شمسی/);
  assert.match(app, /jalaliInputToIso/);
  assert.match(manifest, /display: "standalone"/);
  assert.doesNotMatch(`${layout}\n${app}`, /codex-preview|react-loading-skeleton/i);
});

test("ships persistent finance capabilities and no starter preview", async () => {
  const [hosting, route, schema] = await Promise.all([
    readFile(new URL(".openai/hosting.json", root), "utf8"),
    readFile(new URL("app/api/finance/route.ts", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
  ]);
  assert.match(hosting, /"d1": "DB"/);
  assert.match(route, /add_entry/);
  assert.match(route, /add_group/);
  assert.match(route, /add_expense/);
  assert.match(schema, /ledgerEntries/);
  assert.match(schema, /expenseShares/);
  await assert.rejects(access(new URL("app/_sites-preview/SkeletonPreview.tsx", root)));
});
