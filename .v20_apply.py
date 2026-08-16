from pathlib import Path
import re

# Redesign the transaction-detail shell while preserving every transaction-specific child/action.
p = Path("app/FinanceApp.tsx")
text = p.read_text(encoding="utf-8")
pattern = re.compile(r'function TransactionDetailShell\(.*?\n}\n\nfunction TransactionDetailPage', re.S)
match = pattern.search(text)
if not match:
    raise SystemExit("TransactionDetailShell block not found")
replacement = '''function TransactionDetailShell({ category, title, amount, tone, date, status, receipt, attachment, onClose, children, actions }: { category: string; title: string; amount: number; tone: "positive" | "negative" | "neutral"; date: string; status: string; receipt: TransactionReceiptData; attachment?: ReceiptAttachment | null; onClose: () => void; children: ReactNode; actions?: ReactNode }) {
  const imageAttachment = attachment?.mimeType.startsWith("image/") ? attachment : null;
  return <div className="transaction-detail-page">
    <div className="transaction-detail-nav"><button onClick={onClose}>‹ برگشت</button><span>جزئیات تراکنش</span></div>

    <section className={`transaction-detail-hero polished ${tone}`}>
      <div className="detail-hero-heading">
        <span className="detail-hero-icon"><Icon name="receipt" size={20} /></span>
        <div><small>{category}</small><h2>{title}</h2></div>
        <b className="detail-status-pill">{status}</b>
      </div>
      <div className="detail-amount-block"><small>مبلغ تراکنش</small><strong>{money(amount)}</strong></div>
      <div className="detail-hero-meta"><span><small>تاریخ</small><strong>{date}</strong></span><span><small>شماره مرجع</small><strong>{receipt.reference}</strong></span></div>
    </section>

    <section className="transaction-receipt-panel">
      <div><span className="receipt-panel-icon"><Icon name="upload" size={18} /></span><div><strong>رسید کامل این تراکنش</strong><small>{attachment ? "رسید برنامه + مدرک پیوست‌شده با هم ارسال می‌شوند" : "یک رسید تصویری مرتب از همین جزئیات ساخته می‌شود"}</small></div></div>
      <button className="primary" onClick={() => void shareTransactionReceipt(receipt, attachment)}><Icon name="upload" size={16} /> ارسال رسید کامل</button>
    </section>

    {attachment && <section className="transaction-evidence-card">
      <div className="evidence-head"><div><span><Icon name="receipt" size={16} /></span><div><strong>مدرک پیوست‌شده</strong><small>{attachment.fileName} • {number.format(Math.max(1, Math.round(attachment.size / 1024)))} کیلوبایت</small></div></div><b>{imageAttachment ? "تصویر" : "PDF"}</b></div>
      {imageAttachment ? <button className="evidence-preview" onClick={() => void shareAttachment(attachment, `پیوست ${title}`)} aria-label="نمایش و ارسال مدرک پیوست‌شده"><img src={imageAttachment.dataUrl} alt={`مدرک پیوست‌شده برای ${title}`} /><span>لمس برای ارسال فایل اصلی</span></button> : <button className="evidence-file" onClick={() => void shareAttachment(attachment, `پیوست ${title}`)}><span className="pdf-badge">PDF</span><span><strong>{attachment.fileName}</strong><small>فایل اصلی همراه رسید کامل نیز ارسال می‌شود</small></span><b>ارسال فایل ‹</b></button>}
    </section>}

    <div className="transaction-detail-content">{children}</div>
    {actions && <section className="transaction-detail-actions-wrap"><div className="detail-section-heading"><span>مدیریت تراکنش</span></div><div className="transaction-detail-actions">{actions}</div></section>}
    <p className="generated-receipt-hint">رسید کامل، اطلاعات همین صفحه را به‌صورت تصویر مرتب تولید می‌کند. اگر مدرکی پیوست شده باشد، فایل اصلی آن هم همراه رسید ارسال می‌شود.</p>
  </div>;
}

function TransactionDetailPage'''
text = text[:match.start()] + replacement + text[match.end():]
p.write_text(text, encoding="utf-8")

# Append scoped visual overrides so older stable styles remain untouched.
p = Path("app/globals.css")
css = p.read_text(encoding="utf-8")
css += r'''

/* v20 — polished transaction details and complete generated receipts */
.transaction-detail-page {
  --detail-line: #e9e4da;
  --detail-soft: #faf8f3;
  --detail-ink: #26312c;
  padding-inline: clamp(14px, 4vw, 20px);
  background: linear-gradient(180deg, #f7f4ed 0, var(--bg) 180px);
}
.transaction-detail-nav {
  margin-inline: calc(-1 * clamp(14px, 4vw, 20px));
  padding-inline: clamp(14px, 4vw, 20px);
  box-shadow: 0 1px 0 rgba(70, 62, 48, .03);
}
.transaction-detail-nav span { font-size: 10px; letter-spacing: -.15px; }
.transaction-detail-nav button { color: var(--green); min-height: 38px; }
.transaction-detail-hero.polished {
  position: relative;
  overflow: hidden;
  padding: 18px;
  border-radius: 24px;
  border: 1px solid rgba(223, 216, 204, .9);
  box-shadow: 0 14px 42px rgba(58, 51, 42, .065);
  background: rgba(255,255,255,.96);
}
.transaction-detail-hero.polished::before {
  content: "";
  position: absolute;
  inset: 0 0 auto;
  height: 4px;
  background: #7d857f;
}
.transaction-detail-hero.polished.positive::before { background: var(--green); }
.transaction-detail-hero.polished.negative::before { background: var(--coral); }
.detail-hero-heading { display: grid !important; grid-template-columns: 38px minmax(0,1fr) auto; align-items: start !important; gap: 10px !important; color: inherit !important; }
.detail-hero-icon { width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; background: #f0f4f1; color: var(--green); }
.negative .detail-hero-icon { background: #fbefec; color: var(--coral); }
.detail-hero-heading > div { min-width: 0; }
.detail-hero-heading small { color: var(--muted); font-size: 7px; font-weight: 800; }
.transaction-detail-hero.polished .detail-hero-heading h2 { margin: 2px 0 0; font-size: 14px; line-height: 1.75; overflow-wrap: anywhere; }
.detail-status-pill { align-self: center; white-space: nowrap; color: var(--green) !important; background: var(--green-soft) !important; border: 1px solid #d9e7de; border-radius: 999px !important; padding: 6px 9px !important; font-size: 7px; }
.negative .detail-status-pill { color: var(--coral) !important; background: var(--coral-soft) !important; border-color: #edd5cf; }
.detail-amount-block { display: block !important; margin: 22px 0 18px; color: inherit !important; }
.detail-amount-block small { display: block; margin-bottom: 4px; color: var(--muted); font-size: 7px; }
.transaction-detail-hero.polished .detail-amount-block strong { display: block; margin: 0; font-size: clamp(24px, 7vw, 32px); line-height: 1.35; letter-spacing: -.5px; }
.transaction-detail-hero.polished.positive .detail-amount-block strong { color: var(--green); }
.transaction-detail-hero.polished.negative .detail-amount-block strong { color: var(--coral); }
.detail-hero-meta { display: grid !important; grid-template-columns: 1fr 1fr; gap: 8px !important; padding-top: 13px; border-top: 1px solid var(--detail-line); color: inherit !important; }
.detail-hero-meta > span { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.detail-hero-meta > span:last-child { text-align: left; align-items: flex-end; }
.detail-hero-meta small { color: var(--muted); font-size: 6.5px; }
.detail-hero-meta strong { max-width: 100%; overflow-wrap: anywhere; color: var(--detail-ink); font-size: 8px; }
.transaction-receipt-panel { margin: 12px 0; padding: 12px; border: 1px solid #d8e4dc; border-radius: 17px; background: linear-gradient(135deg, #f1f7f3, #fbfcfb); display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: 10px; }
.transaction-receipt-panel > div { min-width: 0; display: flex; align-items: center; gap: 9px; }
.receipt-panel-icon { width: 34px; height: 34px; flex: 0 0 34px; border-radius: 11px; display: grid; place-items: center; background: #fff; color: var(--green); box-shadow: 0 4px 14px rgba(49,93,76,.08); }
.transaction-receipt-panel > div > div { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.transaction-receipt-panel strong { font-size: 8.5px; }
.transaction-receipt-panel small { color: var(--muted); font-size: 6.5px; line-height: 1.65; }
.transaction-receipt-panel button.primary { min-height: 40px; border: 0; border-radius: 12px; padding: 8px 11px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; color: #fff; background: var(--green); font-size: 7.5px; font-weight: 900; white-space: nowrap; cursor: pointer; box-shadow: 0 6px 18px rgba(49,93,76,.16); }
.transaction-evidence-card { margin: 12px 0; overflow: hidden; border: 1px solid var(--detail-line); border-radius: 17px; background: #fff; }
.evidence-head { padding: 11px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px; border-bottom: 1px solid #f0ece5; }
.evidence-head > div { min-width: 0; display: flex; align-items: center; gap: 8px; }
.evidence-head > div > span { width: 31px; height: 31px; flex: 0 0 31px; border-radius: 10px; display: grid; place-items: center; color: var(--green); background: var(--green-soft); }
.evidence-head > div > div { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.evidence-head strong { font-size: 8px; }
.evidence-head small { color: var(--muted); font-size: 6.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.evidence-head > b { flex: 0 0 auto; padding: 4px 7px; border-radius: 999px; color: var(--muted); background: #f4f1eb; font-size: 6px; }
.evidence-preview { position: relative; width: 100%; height: min(42vw, 210px); min-height: 130px; padding: 0; border: 0; background: #eeeae2; overflow: hidden; cursor: pointer; }
.evidence-preview img { width: 100%; height: 100%; display: block; object-fit: cover; }
.evidence-preview::after { content: ""; position: absolute; inset: 45% 0 0; background: linear-gradient(transparent, rgba(20,23,21,.55)); }
.evidence-preview span { position: absolute; z-index: 1; right: 12px; bottom: 10px; color: #fff; font-size: 7px; font-weight: 900; }
.evidence-file { width: 100%; padding: 14px 12px; border: 0; background: transparent; display: grid; grid-template-columns: 46px minmax(0,1fr) auto; align-items: center; gap: 10px; text-align: right; cursor: pointer; }
.pdf-badge { width: 46px; height: 52px; border-radius: 12px; display: grid; place-items: center; color: var(--coral); background: var(--coral-soft); font-size: 8px; font-weight: 950; }
.evidence-file > span:nth-child(2) { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.evidence-file strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 8px; }
.evidence-file small { color: var(--muted); font-size: 6.5px; }
.evidence-file > b { color: var(--green); white-space: nowrap; font-size: 7px; }
.transaction-detail-content { display: grid; gap: 10px; }
.transaction-detail-content .transaction-detail-grid { margin: 0; gap: 0; overflow: hidden; border: 1px solid var(--detail-line); border-radius: 17px; background: #fff; grid-template-columns: 1fr 1fr; }
.transaction-detail-content .transaction-detail-grid > div { min-height: 68px; padding: 11px 12px; border: 0; border-radius: 0; background: transparent; justify-content: center; }
.transaction-detail-content .transaction-detail-grid > div:nth-child(odd) { border-left: 1px solid #f0ece5; }
.transaction-detail-content .transaction-detail-grid > div:nth-child(n+3) { border-top: 1px solid #f0ece5; }
.transaction-detail-content .transaction-detail-grid small { font-size: 6.5px; }
.transaction-detail-content .transaction-detail-grid strong { margin-top: 2px; font-size: 8px; line-height: 1.65; }
.transaction-detail-content .transaction-note,
.transaction-detail-content .detail-timeline,
.transaction-detail-content .detail-share-list,
.transaction-detail-content .detail-payment-list { margin-top: 0; border-radius: 17px; padding: 13px; border-color: var(--detail-line); box-shadow: none; }
.transaction-detail-content .transaction-note p { color: #444d48; }
.detail-section-heading { display: flex; align-items: center; gap: 8px; margin: 16px 1px 8px; color: var(--muted); font-size: 7px; font-weight: 900; }
.detail-section-heading::after { content: ""; height: 1px; flex: 1; background: var(--detail-line); }
.transaction-detail-actions-wrap { margin-top: 4px; }
.transaction-detail-actions-wrap .transaction-detail-actions { margin-top: 0; padding: 11px; border: 1px solid var(--detail-line); border-radius: 17px; background: #fff; }
.transaction-detail-actions-wrap .transaction-detail-actions button { flex: 1 1 auto; justify-content: center; min-height: 40px; border-radius: 11px; }
.generated-receipt-hint { margin: 13px 4px 2px; padding: 9px 10px; border-radius: 11px; background: rgba(239,235,226,.55); font-size: 6.5px; line-height: 1.8; text-align: center; }

@media (max-width: 390px) {
  .detail-hero-heading { grid-template-columns: 36px minmax(0,1fr) auto; }
  .detail-hero-icon { width: 36px; height: 36px; }
  .transaction-detail-hero.polished .detail-hero-heading h2 { font-size: 12px; }
  .transaction-receipt-panel { grid-template-columns: 1fr; }
  .transaction-receipt-panel button.primary { width: 100%; }
  .transaction-detail-content .transaction-detail-grid { grid-template-columns: 1fr 1fr; }
  .evidence-file { grid-template-columns: 44px minmax(0,1fr); }
  .evidence-file > b { grid-column: 2; }
}
'''
p.write_text(css, encoding="utf-8")

# Cache bump.
for path in ["public/sw.js", "tests/rendered-html.test.mjs"]:
    p = Path(path)
    value = p.read_text(encoding="utf-8")
    if "daftar-hesab-offline-v16" not in value:
        raise SystemExit(f"v16 cache marker missing in {path}")
    p.write_text(value.replace("daftar-hesab-offline-v16", "daftar-hesab-offline-v17"), encoding="utf-8")

# Regression checks for complete receipt/attachment sharing and polished details.
p = Path("tests/rendered-html.test.mjs")
tests = p.read_text(encoding="utf-8")
tests += '''\n\ntest("polishes transaction details and shares generated receipts together with attachments", async () => {\n  const [app, sharing, css, serviceWorker] = await Promise.all([\n    readFile(new URL("app/FinanceApp.tsx", root), "utf8"),\n    readFile(new URL("app/transaction-share.ts", root), "utf8"),\n    readFile(new URL("app/globals.css", root), "utf8"),\n    readFile(new URL("public/sw.js", root), "utf8"),\n  ]);\n  assert.match(app, /transaction-detail-hero polished/);\n  assert.match(app, /رسید کامل این تراکنش/);\n  assert.match(app, /shareTransactionReceipt\\(receipt, attachment\\)/);\n  assert.match(app, /transaction-evidence-card/);\n  assert.match(app, /imageAttachment\\.dataUrl/);\n  assert.match(sharing, /async function buildReceiptImage\\(data: TransactionReceiptData, attachment\\?/);\n  assert.match(sharing, /const completeFiles = attachmentFile \\? \\[receiptFile, attachmentFile\\] : \\[receiptFile\\]/);\n  assert.match(sharing, /navigator\\.canShare\\?\\.\\(\\{ files: completeFiles \\}\\)/);\n  assert.match(sharing, /drawCoverImage/);\n  assert.match(sharing, /مدرک پیوست‌شده/);\n  assert.match(css, /\\.transaction-receipt-panel/);\n  assert.match(css, /\\.transaction-evidence-card/);\n  assert.match(css, /\\.detail-amount-block/);\n  assert.match(serviceWorker, /daftar-hesab-offline-v17/);\n});\n'''
p.write_text(tests, encoding="utf-8")
