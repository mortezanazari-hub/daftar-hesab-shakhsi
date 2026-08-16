from pathlib import Path

# FinanceApp: import openAttachment and make attachment taps open the file by default.
p = Path("app/FinanceApp.tsx")
text = p.read_text(encoding="utf-8")
old_import = 'import { attachmentFromFormData, shareAttachment, shareTransactionReceipt, type TransactionReceiptData } from "./transaction-share";'
new_import = 'import { attachmentFromFormData, openAttachment, shareAttachment, shareTransactionReceipt, type TransactionReceiptData } from "./transaction-share";'
if old_import not in text:
    raise SystemExit("transaction-share import not found")
text = text.replace(old_import, new_import, 1)
old_block = '''    {attachment && <section className="transaction-evidence-card">
      <div className="evidence-head"><div><span><Icon name="receipt" size={16} /></span><div><strong>مدرک پیوست‌شده</strong><small>{attachment.fileName} • {number.format(Math.max(1, Math.round(attachment.size / 1024)))} کیلوبایت</small></div></div><b>{imageAttachment ? "تصویر" : "PDF"}</b></div>
      {imageAttachment ? <button className="evidence-preview" onClick={() => void shareAttachment(attachment, `پیوست ${title}`)} aria-label="نمایش و ارسال مدرک پیوست‌شده"><img src={imageAttachment.dataUrl} alt={`مدرک پیوست‌شده برای ${title}`} /><span>لمس برای ارسال فایل اصلی</span></button> : <button className="evidence-file" onClick={() => void shareAttachment(attachment, `پیوست ${title}`)}><span className="pdf-badge">PDF</span><span><strong>{attachment.fileName}</strong><small>فایل اصلی همراه رسید کامل نیز ارسال می‌شود</small></span><b>ارسال فایل ‹</b></button>}
    </section>}'''
new_block = '''    {attachment && <section className="transaction-evidence-card">
      <div className="evidence-head"><div><span><Icon name="receipt" size={16} /></span><div><strong>مدرک پیوست‌شده</strong><small>{attachment.fileName} • {number.format(Math.max(1, Math.round(attachment.size / 1024)))} کیلوبایت</small></div></div><b>{imageAttachment ? "تصویر" : "PDF"}</b></div>
      {imageAttachment ? <button className="evidence-preview" onClick={() => void openAttachment(attachment)} aria-label="باز کردن مدرک پیوست‌شده"><img src={imageAttachment.dataUrl} alt={`مدرک پیوست‌شده برای ${title}`} /><span>لمس برای باز کردن مدرک</span></button> : <button className="evidence-file" onClick={() => void openAttachment(attachment)} aria-label="باز کردن فایل PDF پیوست‌شده"><span className="pdf-badge">PDF</span><span><strong>{attachment.fileName}</strong><small>برای مشاهده فایل اصلی لمس کن</small></span><b>باز کردن ‹</b></button>}
      <div className="evidence-actions"><button type="button" onClick={() => void shareAttachment(attachment, `پیوست ${title}`)}><Icon name="upload" size={14} /> ارسال فایل اصلی</button></div>
    </section>}'''
if old_block not in text:
    raise SystemExit("transaction evidence block not found")
text = text.replace(old_block, new_block, 1)
p.write_text(text, encoding="utf-8")

# transaction-share: open the local attachment in a new viewing tab/window from the original user gesture.
p = Path("app/transaction-share.ts")
text = p.read_text(encoding="utf-8")
needle = '''export async function shareAttachment(attachment: ReceiptAttachment, title = "پیوست تراکنش") {'''
insert = '''export async function openAttachment(attachment: ReceiptAttachment) {
  const previewWindow = window.open("", "_blank");
  if (previewWindow) previewWindow.opener = null;
  try {
    const file = await attachmentToFile(attachment);
    const url = URL.createObjectURL(file);
    if (previewWindow) {
      previewWindow.location.replace(url);
    } else {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
  } catch (error) {
    previewWindow?.close();
    throw error;
  }
}

export async function shareAttachment(attachment: ReceiptAttachment, title = "پیوست تراکنش") {'''
if needle not in text:
    raise SystemExit("shareAttachment marker not found")
text = text.replace(needle, insert, 1)
p.write_text(text, encoding="utf-8")

# CSS: separate the explicit share action from the default open action.
p = Path("app/globals.css")
css = p.read_text(encoding="utf-8")
css += '''\n\n/* v21 — attachment tap opens by default; sharing remains explicit */\n.evidence-actions { display: flex; justify-content: flex-end; padding: 9px 11px 11px; border-top: 1px solid #f0ece5; background: #fff; }\n.evidence-actions button { min-height: 34px; padding: 7px 10px; border: 1px solid #dce5df; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; background: #f5f9f6; color: var(--green); font: inherit; font-size: 7px; font-weight: 900; cursor: pointer; }\n.evidence-preview span { pointer-events: none; }\n'''
p.write_text(css, encoding="utf-8")

# Bump PWA cache so installed copies pick up the interaction change.
p = Path("public/sw.js")
sw = p.read_text(encoding="utf-8")
if 'daftar-hesab-offline-v17' not in sw:
    raise SystemExit("expected service-worker cache v17 not found")
sw = sw.replace('daftar-hesab-offline-v17', 'daftar-hesab-offline-v18')
p.write_text(sw, encoding="utf-8")

# Regression tests: all current SW expectations move to v18 and attachment click must open, not share.
p = Path("tests/rendered-html.test.mjs")
tests = p.read_text(encoding="utf-8").replace('daftar-hesab-offline-v17', 'daftar-hesab-offline-v18')
marker = '''  assert.match(app, /transaction-evidence-card/);\n  assert.match(app, /imageAttachment\\.dataUrl/);'''
replacement = '''  assert.match(app, /transaction-evidence-card/);\n  assert.match(app, /openAttachment\\(attachment\\)/);\n  assert.match(app, /لمس برای باز کردن مدرک/);\n  assert.match(app, /ارسال فایل اصلی/);\n  assert.match(app, /imageAttachment\\.dataUrl/);'''
if marker not in tests:
    raise SystemExit("v20 attachment regression marker not found")
tests = tests.replace(marker, replacement, 1)
sharing_marker = '''  assert.match(sharing, /async function buildReceiptImage\\(data: TransactionReceiptData, attachment\\?/);'''
sharing_replacement = '''  assert.match(sharing, /export async function openAttachment/);\n  assert.match(sharing, /window\\.open\\("", "_blank"\\)/);\n  assert.match(sharing, /URL\\.createObjectURL\\(file\\)/);\n  assert.match(sharing, /async function buildReceiptImage\\(data: TransactionReceiptData, attachment\\?/);'''
if sharing_marker not in tests:
    raise SystemExit("sharing regression marker not found")
tests = tests.replace(sharing_marker, sharing_replacement, 1)
p.write_text(tests, encoding="utf-8")
