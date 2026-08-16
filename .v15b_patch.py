from pathlib import Path

p = Path('app/FinanceApp.tsx')
s = p.read_text(encoding='utf-8')
old = '''{check.financialOpen && <button className="danger-soft" onClick={() => onCheckStatus(check, "bounced")}>برگشت خورد</button>}<button className="danger" onClick={() => onDeleteCheck(check)}><Icon name="trash" size={14} /> حذف</button>'''
new = '''{check.financialOpen && <button className="danger-soft" onClick={() => onCheckStatus(check, "bounced")}>برگشت خورد</button>}{check.status !== "open" && <button onClick={() => onCheckStatus(check, "open")}>برگردان به جریان</button>}<button className="danger" onClick={() => onDeleteCheck(check)}><Icon name="trash" size={14} /> حذف</button>'''
if old not in s:
    raise SystemExit('missing cheque actions pattern')
s = s.replace(old, new, 1)
s = s.replace('  type GroupSettlement,\n', '', 1)
p.write_text(s, encoding='utf-8')

p = Path('tests/rendered-html.test.mjs')
s = p.read_text(encoding='utf-8')
anchor = '  assert.match(app, /جزئیات و مسیر چک/);\n'
if anchor not in s:
    raise SystemExit('missing cheque test anchor')
s = s.replace(anchor, anchor + '  assert.match(app, /برگردان به جریان/);\n', 1)
p.write_text(s, encoding='utf-8')
