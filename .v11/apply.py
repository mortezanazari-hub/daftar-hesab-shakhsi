from pathlib import Path

app_path = Path('app/FinanceApp.tsx')
app = app_path.read_text()
old_nav = '''      <nav className="bottom-nav" aria-label="منوی اصلی">
        <NavButton active={tab === "home"} icon="home" label="خانه" onClick={() => setTab("home")} />
        <NavButton active={tab === "ledger"} icon="book" label="دفتر" onClick={() => setTab("ledger")} />
        <button className="nav-add" aria-label="ثبت جدید" onClick={() => setSheet("actions")}>+</button>
        <NavButton active={tab === "groups"} icon="users" label="دُنگ‌ها" onClick={() => setTab("groups")} />
        <NavButton active={tab === "calendar"} icon="calendar" label="سررسید" onClick={() => setTab("calendar")} />
      </nav>'''
new_nav = '''      <nav className="bottom-nav" aria-label="منوی اصلی">
        <NavButton active={tab === "home"} icon="home" label="خانه" onClick={() => setTab("home")} />
        <NavButton active={tab === "ledger"} icon="book" label="دفتر" onClick={() => setTab("ledger")} />
        <button className="nav-add" aria-label="ثبت جدید" onClick={() => setSheet("actions")}>+</button>
        <NavButton active={tab === "groups"} icon="users" label="دُنگ‌ها" onClick={() => setTab("groups")} />
        <NavButton active={tab === "checks"} icon="check" label="چک‌ها" onClick={openChecks} />
        <NavButton active={tab === "calendar"} icon="calendar" label="سررسید" onClick={() => setTab("calendar")} />
      </nav>'''
if old_nav not in app:
    raise SystemExit('bottom nav marker not found')
app_path.write_text(app.replace(old_nav, new_nav, 1))

css_path = Path('app/globals.css')
css = css_path.read_text()
old_grid = 'grid-template-columns: repeat(5, 1fr);'
if old_grid not in css:
    raise SystemExit('five-column bottom nav marker not found')
css = css.replace(old_grid, 'grid-template-columns: repeat(6, 1fr);', 1)
css += '''\n\n/* v11 — direct cheque navigation */\n@media (max-width: 370px) {\n  .bottom-nav { padding-left: 7px; padding-right: 7px; }\n  .bottom-nav > button small { font-size: 7.5px; }\n}\n'''
css_path.write_text(css)

sw_path = Path('public/sw.js')
sw = sw_path.read_text()
if 'daftar-hesab-offline-v8' not in sw:
    raise SystemExit('service worker v8 marker not found')
sw_path.write_text(sw.replace('daftar-hesab-offline-v8', 'daftar-hesab-offline-v9', 1))

test_path = Path('tests/rendered-html.test.mjs')
tests = test_path.read_text()
if 'assert.match(serviceWorker, /daftar-hesab-offline-v8/);' not in tests:
    raise SystemExit('service worker test marker not found')
tests = tests.replace('assert.match(serviceWorker, /daftar-hesab-offline-v8/);', 'assert.match(serviceWorker, /daftar-hesab-offline-v9/);', 1)
tests += '''\n\ntest("keeps cheque management directly accessible from the main navigation", async () => {\n  const [app, css] = await Promise.all([\n    readFile(new URL("app/FinanceApp.tsx", root), "utf8"),\n    readFile(new URL("app/globals.css", root), "utf8"),\n  ]);\n  assert.match(app, /active=\\{tab === "checks"\\} icon="check" label="چک‌ها" onClick=\\{openChecks\\}/);\n  assert.match(css, /grid-template-columns: repeat\\(6, 1fr\\)/);\n});\n'''
test_path.write_text(tests)
