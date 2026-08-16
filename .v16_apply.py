from pathlib import Path

def replace_once(path: str, old: str, new: str):
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"Expected text not found in {path}: {old[:120]}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")

replace_once("app/FinanceApp.tsx", 'import { attachmentFromFormData, shareAttachment, shareTransactionReceipt, type TransactionReceiptData } from "./transaction-share";', 'import { attachmentFromFormData, shareAttachment, shareTransactionReceipt, type TransactionReceiptData } from "./transaction-share";\nimport { shareGroupPdf, sharePersonLedgerPdf } from "./report-pdf";')
replace_once("app/FinanceApp.tsx", 'return <div className="person-ledger-sheet"><div className="sheet-title"><p>همه منابع مالی این شخص نسبت به من</p><h2>{account.name}</h2></div>', 'return <div className="person-ledger-sheet"><div className="sheet-title"><p>همه منابع مالی این شخص نسبت به من</p><h2>{account.name}</h2></div><button className="pdf-report-button" onClick={() => void sharePersonLedgerPdf(account)}><Icon name="upload" size={15} /> ارسال PDF کل دفتر</button>')
replace_once("app/FinanceApp.tsx", '{expanded && <div className="group-expanded-body">\n      <div className="balances-list">', '{expanded && <div className="group-expanded-body">\n      <button className="group-pdf-button" onClick={() => void shareGroupPdf(group)}><Icon name="upload" size={15} /> ارسال PDF کامل گروه</button>\n      <div className="balances-list">')

css = Path("app/globals.css")
css_text = css.read_text(encoding="utf-8")
marker = "/* v16 — mobile ledger/group regression fixes + full PDF report export */"
if marker not in css_text:
    css.write_text(css_text + '''

/* v16 — mobile ledger/group regression fixes + full PDF report export */
.group-card-head > .group-title-button {
  border: 0;
  border-radius: 0;
  padding: 0;
  color: inherit;
  background: transparent;
  font-size: inherit;
  font-weight: inherit;
  box-shadow: none;
}
.group-card.collapsed {
  padding: 14px 16px;
}
.group-card.collapsed .group-card-head {
  align-items: center;
  gap: 10px;
  min-height: 52px;
}
.group-card.collapsed .group-title-button {
  min-width: 0;
  min-height: 48px;
  flex: 1 1 auto;
}
.group-card.collapsed .group-title-button > div {
  min-width: 0;
}
.group-card.collapsed .group-title-button h3,
.group-card.collapsed .group-title-button p {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.group-card.collapsed .group-head-actions {
  flex: 0 0 auto;
  flex-wrap: nowrap;
  align-items: center;
}
.group-card.collapsed .group-collapse-toggle {
  min-height: 34px;
  white-space: nowrap;
}

.ledger-item {
  grid-template-columns: 32px minmax(0, 1fr) minmax(72px, auto) 27px;
  align-items: center;
}
.ledger-item > .ledger-item-open {
  width: 100%;
  min-width: 0;
  height: auto;
  min-height: 42px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: inherit;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 4px;
  text-align: right;
  overflow: hidden;
}
.ledger-item > .ledger-item-open strong {
  width: 100%;
  font-size: 9px;
  line-height: 1.65;
  white-space: normal;
  overflow-wrap: anywhere;
}
.ledger-item > .ledger-item-open small {
  width: 100%;
  color: var(--muted);
  font-size: 7px;
  line-height: 1.75;
  white-space: normal;
  overflow-wrap: anywhere;
}
.ledger-item > b {
  max-width: 112px;
  line-height: 1.6;
  text-align: left;
  direction: ltr;
  white-space: normal;
}

.pdf-report-button,
.group-pdf-button {
  width: 100%;
  min-height: 44px;
  border: 1px solid #b9cfc3;
  border-radius: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: var(--green);
  background: #edf5f0;
  font-size: 9px;
  font-weight: 900;
  cursor: pointer;
}
.pdf-report-button {
  margin: 0 0 12px;
}
.group-pdf-button {
  margin: 0;
}

@media (max-width: 390px) {
  .group-card.collapsed .group-card-head {
    align-items: center;
    flex-wrap: nowrap;
  }
  .group-card.collapsed .group-head-actions {
    justify-content: flex-end;
    flex-wrap: nowrap;
  }
  .ledger-item {
    grid-template-columns: 30px minmax(0, 1fr) minmax(66px, 92px) 25px;
    gap: 6px;
  }
  .ledger-item > b {
    max-width: 92px;
    font-size: 7px;
  }
}
''', encoding="utf-8")

sw = Path("public/sw.js")
sw_text = sw.read_text(encoding="utf-8")
if 'daftar-hesab-offline-v13' not in sw_text:
    raise SystemExit("Expected v13 service-worker cache not found")
sw.write_text(sw_text.replace('daftar-hesab-offline-v13', 'daftar-hesab-offline-v14'), encoding="utf-8")

tests = Path("tests/rendered-html.test.mjs")
test_text = tests.read_text(encoding="utf-8").replace('daftar-hesab-offline-v13', 'daftar-hesab-offline-v14')
if 'keeps mobile person/group layouts readable and exports complete PDF reports' not in test_text:
    test_text += '''

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
  assert.match(serviceWorker, /daftar-hesab-offline-v14/);
});
'''
tests.write_text(test_text, encoding="utf-8")
