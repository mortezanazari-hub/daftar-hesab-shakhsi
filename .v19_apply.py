from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"Expected text not found in {path}: {old[:180]!r}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


# FinanceApp: browser-history snapshots for real in-app Back navigation.
p = Path("app/FinanceApp.tsx")
text = p.read_text(encoding="utf-8")

old = '''  | { kind: "loan-payment"; loanId: number; installmentId: number; paymentId: number };\ntype DueItem ='''
new = '''  | { kind: "loan-payment"; loanId: number; installmentId: number; paymentId: number };\n\ntype AppHistorySnapshot = {\n  tab: Tab;\n  sheet: Sheet;\n  entryKind: string;\n  editingEntryId: number | null;\n  settlingEntryId: number | null;\n  editingExpenseId: number | null;\n  editingGroupId: number | null;\n  editingLoanId: number | null;\n  editingCheckId: number | null;\n  transferCheckId: number | null;\n  paymentLoanId: number | null;\n  paymentInstallmentId: number | null;\n  selectedPersonId: number | null;\n  expenseGroupId: number | null;\n  settlementDraft: SettlementDraft | null;\n  detailTarget: TransactionDetailTarget | null;\n};\n\ntype AppBrowserHistoryState = { __daftarApp: true; snapshot: AppHistorySnapshot };\n\ntype DueItem ='''
if old not in text:
    raise SystemExit("History type insertion point not found")
text = text.replace(old, new, 1)

old = '''  const [dueRange, setDueRange] = useState<"overdue" | "current" | "next" | "all">("current");\n  const [hideCompletedDue, setHideCompletedDue] = useState(false);\n\n  const load = useCallback(async () => {'''
new = '''  const [dueRange, setDueRange] = useState<"overdue" | "current" | "next" | "all">("current");\n  const [hideCompletedDue, setHideCompletedDue] = useState(false);\n  const historyReadyRef = useRef(false);\n  const restoringHistoryRef = useRef(false);\n  const lastHistoryKeyRef = useRef("");\n\n  const appHistorySnapshot = useMemo<AppHistorySnapshot>(() => ({\n    tab, sheet, entryKind, editingEntryId, settlingEntryId, editingExpenseId, editingGroupId, editingLoanId, editingCheckId,\n    transferCheckId, paymentLoanId, paymentInstallmentId, selectedPersonId, expenseGroupId, settlementDraft, detailTarget,\n  }), [tab, sheet, entryKind, editingEntryId, settlingEntryId, editingExpenseId, editingGroupId, editingLoanId, editingCheckId, transferCheckId, paymentLoanId, paymentInstallmentId, selectedPersonId, expenseGroupId, settlementDraft, detailTarget]);\n  const appHistoryKey = useMemo(() => JSON.stringify(appHistorySnapshot), [appHistorySnapshot]);\n\n  const load = useCallback(async () => {'''
if old not in text:
    raise SystemExit("History state insertion point not found")
text = text.replace(old, new, 1)

old = '''  useEffect(() => { void load(); }, [load]);\n  useEffect(() => {\n    if (location.hostname !== "localhost" && "serviceWorker" in navigator) void navigator.serviceWorker.register("./sw.js");\n  }, []);\n\n  const people ='''
new = '''  useEffect(() => { void load(); }, [load]);\n  useEffect(() => {\n    if (location.hostname !== "localhost" && "serviceWorker" in navigator) void navigator.serviceWorker.register("./sw.js");\n  }, []);\n\n  useEffect(() => {\n    const handlePopState = (event: PopStateEvent) => {\n      const state = event.state as AppBrowserHistoryState | null;\n      if (!state?.__daftarApp || !state.snapshot) return;\n      const snapshot = state.snapshot;\n      restoringHistoryRef.current = true;\n      setTab(snapshot.tab);\n      setSheet(snapshot.sheet);\n      setEntryKind(snapshot.entryKind);\n      setEditingEntryId(snapshot.editingEntryId);\n      setSettlingEntryId(snapshot.settlingEntryId);\n      setEditingExpenseId(snapshot.editingExpenseId);\n      setEditingGroupId(snapshot.editingGroupId);\n      setEditingLoanId(snapshot.editingLoanId);\n      setEditingCheckId(snapshot.editingCheckId);\n      setTransferCheckId(snapshot.transferCheckId);\n      setPaymentLoanId(snapshot.paymentLoanId);\n      setPaymentInstallmentId(snapshot.paymentInstallmentId);\n      setSelectedPersonId(snapshot.selectedPersonId);\n      setExpenseGroupId(snapshot.expenseGroupId);\n      setSettlementDraft(snapshot.settlementDraft);\n      setDetailTarget(snapshot.detailTarget);\n    };\n    window.addEventListener("popstate", handlePopState);\n    return () => window.removeEventListener("popstate", handlePopState);\n  }, []);\n\n  useEffect(() => {\n    if (!data) return;\n    if (!historyReadyRef.current) {\n      const currentState = typeof window.history.state === "object" && window.history.state ? window.history.state : {};\n      window.history.replaceState({ ...currentState, __daftarApp: true, snapshot: appHistorySnapshot } satisfies AppBrowserHistoryState, "");\n      historyReadyRef.current = true;\n      lastHistoryKeyRef.current = appHistoryKey;\n      return;\n    }\n    if (restoringHistoryRef.current) {\n      restoringHistoryRef.current = false;\n      lastHistoryKeyRef.current = appHistoryKey;\n      return;\n    }\n    if (lastHistoryKeyRef.current === appHistoryKey) return;\n    window.history.pushState({ __daftarApp: true, snapshot: appHistorySnapshot } satisfies AppBrowserHistoryState, "");\n    lastHistoryKeyRef.current = appHistoryKey;\n  }, [data, appHistoryKey, appHistorySnapshot]);\n\n  const people ='''
if old not in text:
    raise SystemExit("History effect insertion point not found")
text = text.replace(old, new, 1)

old = '''      await applyFinanceOperation(payload);\n      if (close) setSheet(null);\n      await load();'''
new = '''      await applyFinanceOperation(payload);\n      if (close) dismissSheet();\n      await load();'''
if old not in text:
    raise SystemExit("post close replacement point not found")
text = text.replace(old, new, 1)

old = '''  function openEntry(kind: string, entry?: Entry) {\n    setEditingEntryId(entry?.id ?? null);'''
new = '''  function dismissSheet() {\n    if (!sheet) return;\n    const state = window.history.state as AppBrowserHistoryState | null;\n    if (state?.__daftarApp && state.snapshot?.sheet === sheet) {\n      window.history.back();\n      return;\n    }\n    setSheet(null);\n  }\n\n  function openEntry(kind: string, entry?: Entry) {\n    setEditingEntryId(entry?.id ?? null);'''
if old not in text:
    raise SystemExit("dismissSheet insertion point not found")
text = text.replace(old, new, 1)

old = '''      {sheet && <div className={`sheet-backdrop ${sheet === "transaction-detail" ? "detail-backdrop" : ""}`} onMouseDown={(event) => { if (event.currentTarget === event.target) setSheet(null); }}>\n        <section className={`bottom-sheet ${sheet === "transaction-detail" ? "transaction-detail-sheet" : ""}`} role="dialog" aria-modal="true">\n          <div className="sheet-handle" />\n          <button className="sheet-close" onClick={() => setSheet(null)} aria-label="بستن">×</button>'''
new = '''      {sheet && <div className={`sheet-backdrop ${sheet === "transaction-detail" ? "detail-backdrop" : ""}`} onMouseDown={(event) => { if (event.currentTarget === event.target) dismissSheet(); }}>\n        <section className={`bottom-sheet ${sheet === "transaction-detail" ? "transaction-detail-sheet" : ""}`} role="dialog" aria-modal="true">\n          <div className="sheet-handle" />\n          <button className="sheet-close" onClick={dismissSheet} aria-label="بستن">×</button>'''
if old not in text:
    raise SystemExit("sheet close replacement point not found")
text = text.replace(old, new, 1)

p.write_text(text, encoding="utf-8")

# Bump the offline cache so installed PWAs pick up Back navigation immediately.
for path in ["public/sw.js", "tests/rendered-html.test.mjs"]:
    p = Path(path)
    content = p.read_text(encoding="utf-8")
    if "daftar-hesab-offline-v15" not in content:
        raise SystemExit(f"Expected v15 cache marker not found in {path}")
    p.write_text(content.replace("daftar-hesab-offline-v15", "daftar-hesab-offline-v16"), encoding="utf-8")

# Add regression coverage for native/Android browser Back behavior.
p = Path("tests/rendered-html.test.mjs")
tests = p.read_text(encoding="utf-8")
tests += r'''\n\ntest("uses browser history so the phone Back button moves one screen back before leaving the app", async () => {\n  const [app, serviceWorker] = await Promise.all([\n    readFile(new URL("app/FinanceApp.tsx", root), "utf8"),\n    readFile(new URL("public/sw.js", root), "utf8"),\n  ]);\n  assert.match(app, /type AppHistorySnapshot/);\n  assert.match(app, /type AppBrowserHistoryState/);\n  assert.match(app, /window\.history\.replaceState/);\n  assert.match(app, /window\.history\.pushState/);\n  assert.match(app, /window\.addEventListener\("popstate", handlePopState\)/);\n  assert.match(app, /if \(!state\?\.__daftarApp \|\| !state\.snapshot\) return/);\n  assert.match(app, /function dismissSheet\(\)/);\n  assert.match(app, /window\.history\.back\(\)/);\n  assert.match(app, /onClick=\{dismissSheet\}/);\n  assert.match(app, /if \(close\) dismissSheet\(\)/);\n  assert.match(serviceWorker, /daftar-hesab-offline-v16/);\n});\n'''
p.write_text(tests, encoding="utf-8")
