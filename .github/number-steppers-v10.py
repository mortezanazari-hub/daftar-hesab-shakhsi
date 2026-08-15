from pathlib import Path

app_path = Path("app/FinanceApp.tsx")
app = app_path.read_text()

marker = '''function ShareStepper({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) {'''
insert = '''function CountStepper({ name, value, onChange, label, min = 1, max = 99, required = false }: { name: string; value: number; onChange: (value: number) => void; label: string; min?: number; max?: number; required?: boolean }) {
  const safeValue = Math.max(min, Math.min(max, Number(value) || min));
  return <div className="share-stepper number-stepper">
    <button type="button" onClick={() => onChange(Math.max(min, safeValue - 1))} disabled={safeValue <= min} aria-label={`کم کردن ${label}`}>−</button>
    <input name={name} aria-label={label} type="number" min={min} max={max} required={required} value={safeValue} onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || min)))} />
    <button type="button" onClick={() => onChange(Math.min(max, safeValue + 1))} disabled={safeValue >= max} aria-label={`زیاد کردن ${label}`}>+</button>
  </div>;
}

'''
if marker not in app:
    raise SystemExit("ShareStepper marker not found")
app = app.replace(marker, insert + marker, 1)

old_count = '''      <label>چند قسط؟<input name="installmentCount" type="number" min="1" max="600" required value={installmentCount} onChange={(event) => setInstallmentCount(Math.max(1, Number(event.target.value) || 1))} /></label>'''
new_count = '''      <label>چند قسط؟<CountStepper name="installmentCount" label="تعداد اقساط" min={1} max={600} required value={installmentCount} onChange={setInstallmentCount} /></label>'''
if old_count not in app:
    raise SystemExit("installment count input not found")
app = app.replace(old_count, new_count, 1)

old_interval = '''        <label>هر چند ماه یک‌بار؟<input name="intervalMonths" type="number" min="1" max="24" required value={intervalMonths} onChange={(event) => setIntervalMonths(Math.max(1, Number(event.target.value) || 1))} /></label>'''
new_interval = '''        <label>هر چند ماه یک‌بار؟<CountStepper name="intervalMonths" label="فاصله اقساط به ماه" min={1} max={24} required value={intervalMonths} onChange={setIntervalMonths} /></label>'''
if old_interval not in app:
    raise SystemExit("interval input not found")
app = app.replace(old_interval, new_interval, 1)
app_path.write_text(app)

sw_path = Path("public/sw.js")
sw = sw_path.read_text()
if "daftar-hesab-offline-v7" not in sw:
    raise SystemExit("service worker v7 marker not found")
sw_path.write_text(sw.replace("daftar-hesab-offline-v7", "daftar-hesab-offline-v8"))

test_path = Path("tests/rendered-html.test.mjs")
tests = test_path.read_text()
tests = tests.replace("assert.match(serviceWorker, /daftar-hesab-offline-v7/);", "assert.match(serviceWorker, /daftar-hesab-offline-v8/);")
tests += '''

test("uses plus and minus steppers for small counting fields", async () => {
  const app = await readFile(new URL("app/FinanceApp.tsx", root), "utf8");
  assert.match(app, /function CountStepper/);
  assert.match(app, /name="installmentCount" label="تعداد اقساط" min=\{1\} max=\{600\}/);
  assert.match(app, /name="intervalMonths" label="فاصله اقساط به ماه" min=\{1\} max=\{24\}/);
  assert.match(app, /className="share-stepper number-stepper"/);
});
'''
test_path.write_text(tests)
