from pathlib import Path

path = Path("tests/rendered-html.test.mjs")
text = path.read_text(encoding="utf-8")
old = '  assert.match(app, /useState<"current" \\| "next" \\| "all">\\("current"\\)/);'
new = '  assert.match(app, /useState<"overdue" \\| "current" \\| "next" \\| "all">\\("current"\\)/);'
if old not in text:
    raise SystemExit("old due filter assertion not found")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
