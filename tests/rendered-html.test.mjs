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
  assert.match(localDb, /add_entry/);
  assert.match(localDb, /add_group/);
  assert.match(localDb, /add_expense/);
  assert.match(serviceWorker, /hamhesab-offline/);
  assert.match(serviceWorker, /caches\.match/);
  await assert.rejects(access(new URL("app/api/finance/route.ts", root)));
  await assert.rejects(access(new URL("app/_sites-preview/SkeletonPreview.tsx", root)));
});
