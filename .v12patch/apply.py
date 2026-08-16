from pathlib import Path

app_path = Path("app/FinanceApp.tsx")
app = app_path.read_text(encoding="utf-8")

old_quick = '''              <div className="section-title"><h2>ثبت سریع</h2><button onClick={() => setSheet("actions")}>همه موارد</button></div>
              <div className="quick-grid">
                {quickEntryKinds.slice(0, 2).map((kind) => { const meta = entryMeta[kind]; return <button className="quick-action" key={kind} onClick={() => openEntry(kind)}><span className={`quick-icon ${meta.tone}`}><Icon name={meta.icon} /></span><span>{meta.label}</span></button>; })}
                <button className="quick-action" onClick={openLoans}><span className="quick-icon amber"><Icon name="bank" /></span><span>وام و اقساط</span></button>
                <button className="quick-action" onClick={openChecks}><span className="quick-icon violet"><Icon name="check" /></span><span>چک‌ها</span></button>
              </div>'''
new_quick = '''              <div className="section-title"><h2>ثبت سریع</h2></div>
              <div className="quick-grid quick-scroll" aria-label="ثبت‌های سریع">
                {quickEntryKinds.map((kind) => { const meta = entryMeta[kind]; return <button className="quick-action" key={kind} onClick={() => openEntry(kind)}><span className={`quick-icon ${meta.tone}`}><Icon name={meta.icon} /></span><span>{meta.label}</span></button>; })}
                <button className="quick-action" onClick={openLoans}><span className="quick-icon amber"><Icon name="bank" /></span><span>وام و اقساط</span></button>
                <button className="quick-action" onClick={() => openCheckForm()}><span className="quick-icon violet"><Icon name="check" /></span><span>چک</span></button>
                <button className="quick-action" onClick={() => data.groups.length ? openExpense() : beginGroup()}><span className="quick-icon blue"><Icon name="users" /></span><span>{data.groups.length ? "خرید دُنگی" : "گروه دُنگی"}</span></button>
                <button className="quick-action" onClick={() => setSheet("person")}><span className="quick-icon sand"><Icon name="user-plus" /></span><span>شخص جدید</span></button>
              </div>'''
assert old_quick in app, "quick action block not found"
app = app.replace(old_quick, new_quick, 1)

old_nav = '''      <nav className="bottom-nav" aria-label="منوی اصلی">
        <NavButton active={tab === "home"} icon="home" label="خانه" onClick={() => setTab("home")} />
        <NavButton active={tab === "ledger"} icon="book" label="دفتر" onClick={() => setTab("ledger")} />
        <button className="nav-add" aria-label="ثبت جدید" onClick={() => setSheet("actions")}>+</button>
        <NavButton active={tab === "groups"} icon="users" label="دُنگ‌ها" onClick={() => setTab("groups")} />
        <NavButton active={tab === "checks"} icon="check" label="چک‌ها" onClick={openChecks} />
        <NavButton active={tab === "calendar"} icon="calendar" label="سررسید" onClick={() => setTab("calendar")} />
      </nav>'''
new_nav = '''      <nav className="bottom-nav" aria-label="منوی اصلی">
        <NavButton active={tab === "ledger"} icon="book" label="دفتر" onClick={() => setTab("ledger")} />
        <NavButton active={tab === "groups"} icon="users" label="دُنگ‌ها" onClick={() => setTab("groups")} />
        <NavButton active={tab === "home"} icon="home" label="خانه" onClick={() => setTab("home")} />
        <NavButton active={tab === "checks"} icon="check" label="چک‌ها" onClick={openChecks} />
        <NavButton active={tab === "calendar"} icon="calendar" label="سررسید" onClick={() => setTab("calendar")} />
      </nav>'''
assert old_nav in app, "bottom navigation block not found"
app = app.replace(old_nav, new_nav, 1)
app_path.write_text(app, encoding="utf-8")

css_path = Path("app/globals.css")
css = css_path.read_text(encoding="utf-8")
assert "grid-template-columns: repeat(6, 1fr);" in css, "six-column navigation rule not found"
css = css.replace("grid-template-columns: repeat(6, 1fr);", "grid-template-columns: repeat(5, 1fr);", 1)
css += '''

/* v12 — centered home navigation and scrollable quick actions */
.quick-scroll {
  display: flex;
  gap: 9px;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  scroll-snap-type: x proximity;
  scrollbar-width: none;
  margin-inline: -18px;
  padding: 2px 18px 8px;
}
.quick-scroll::-webkit-scrollbar { display: none; }
.quick-scroll .quick-action {
  flex: 0 0 92px;
  min-width: 92px;
  scroll-snap-align: start;
}
'''
css_path.write_text(css, encoding="utf-8")

sw_path = Path("public/sw.js")
sw = sw_path.read_text(encoding="utf-8")
assert "daftar-hesab-offline-v9" in sw, "expected v9 service-worker cache not found"
sw_path.write_text(sw.replace("daftar-hesab-offline-v9", "daftar-hesab-offline-v10", 1), encoding="utf-8")

test_path = Path("tests/rendered-html.test.mjs")
tests = test_path.read_text(encoding="utf-8")
tests = tests.replace("daftar-hesab-offline-v9", "daftar-hesab-offline-v10", 1)
old_test = '''test("keeps cheque management directly accessible from the main navigation", async () => {
  const [app, css] = await Promise.all([
    readFile(new URL("app/FinanceApp.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(app, /active=\\{tab === "checks"\\} icon="check" label="چک‌ها" onClick=\\{openChecks\\}/);
  assert.match(css, /grid-template-columns: repeat\\(6, 1fr\\)/);
});'''
new_test = '''test("keeps cheque management directly accessible and centers home in the five-item navigation", async () => {
  const [app, css] = await Promise.all([
    readFile(new URL("app/FinanceApp.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(app, /active=\\{tab === "checks"\\} icon="check" label="چک‌ها" onClick=\\{openChecks\\}/);
  assert.match(app, /label="دُنگ‌ها"[\\s\\S]*label="خانه"[\\s\\S]*label="چک‌ها"/);
  assert.doesNotMatch(app, /className="nav-add"/);
  assert.match(css, /grid-template-columns: repeat\\(5, 1fr\\)/);
});

test("shows every quick action in a horizontally scrollable home strip", async () => {
  const [app, css] = await Promise.all([
    readFile(new URL("app/FinanceApp.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(app, /className="quick-grid quick-scroll"/);
  assert.match(app, /quickEntryKinds\\.map/);
  assert.match(app, /<span>وام و اقساط<\\/span>/);
  assert.match(app, /<span>چک<\\/span>/);
  assert.match(app, /خرید دُنگی/);
  assert.match(app, /شخص جدید/);
  assert.doesNotMatch(app, /ثبت سریع<\\/h2><button[^>]*>همه موارد/);
  assert.match(css, /\\.quick-scroll \\{/);
  assert.match(css, /overflow-x: auto/);
  assert.match(css, /flex: 0 0 92px/);
});'''
assert old_test in tests, "navigation regression test not found"
tests = tests.replace(old_test, new_test, 1)
test_path.write_text(tests, encoding="utf-8")
