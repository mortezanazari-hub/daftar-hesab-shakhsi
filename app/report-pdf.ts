import { persianDate } from "./jalali";
import type { Group, PersonAccount } from "./local-db";

const faNumber = new Intl.NumberFormat("fa-IR");
const PAGE_WIDTH = 1240;
const PAGE_HEIGHT = 1754;
const PAGE_RIGHT = 1160;
const PAGE_LEFT = 80;
const CONTENT_WIDTH = PAGE_RIGHT - PAGE_LEFT;
const PDF_WIDTH = 595.28;
const PDF_HEIGHT = 841.89;

const money = (value: number) => `${faNumber.format(Math.round(value))} تومان`;
const signedMoney = (value: number) => `${value >= 0 ? "+" : "−"}${money(Math.abs(value))}`;
const reportDate = () => persianDate(new Date().toISOString().slice(0, 10), true);

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 80) || "گزارش";
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 3) {
  const words = String(text || "—").split(/\s+/).filter(Boolean);
  if (!words.length) return ["—"];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    } else {
      line = candidate;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

function drawLines(ctx: CanvasRenderingContext2D, lines: string[], x: number, y: number, lineHeight: number) {
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
}

class ReportPainter {
  readonly pages: HTMLCanvasElement[] = [];
  private ctx!: CanvasRenderingContext2D;
  private y = 0;
  private pageNumber = 0;

  constructor(private readonly title: string) {
    this.newPage();
  }

  private newPage() {
    const canvas = document.createElement("canvas");
    canvas.width = PAGE_WIDTH;
    canvas.height = PAGE_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("ساخت صفحه PDF در این مرورگر ممکن نیست.");
    this.pages.push(canvas);
    this.ctx = ctx;
    this.pageNumber += 1;
    ctx.direction = "rtl";
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#f5f2ea";
    ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    ctx.fillStyle = "#315d4c";
    ctx.font = "800 28px 'Vazirmatn Variable', Vazirmatn, Tahoma, sans-serif";
    ctx.fillText("دفتر حساب شخصی", PAGE_RIGHT, 72);
    ctx.fillStyle = "#1d2a25";
    ctx.font = "800 36px 'Vazirmatn Variable', Vazirmatn, Tahoma, sans-serif";
    ctx.fillText(this.title, PAGE_RIGHT, 122);
    ctx.textAlign = "left";
    ctx.fillStyle = "#8a867f";
    ctx.font = "600 20px 'Vazirmatn Variable', Vazirmatn, Tahoma, sans-serif";
    ctx.fillText(`صفحه ${faNumber.format(this.pageNumber)}`, PAGE_LEFT, 118);
    ctx.textAlign = "right";
    ctx.strokeStyle = "#ddd7cc";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAGE_LEFT, 150);
    ctx.lineTo(PAGE_RIGHT, 150);
    ctx.stroke();
    this.y = 190;
  }

  private ensure(height: number) {
    if (this.y + height > PAGE_HEIGHT - 120) this.newPage();
  }

  hero(label: string, value: string, tone: "positive" | "negative" | "neutral" = "neutral") {
    this.ensure(190);
    roundedRect(this.ctx, PAGE_LEFT, this.y, CONTENT_WIDTH, 160, 30);
    this.ctx.fillStyle = tone === "positive" ? "#dce9e2" : tone === "negative" ? "#f4ded8" : "#ffffff";
    this.ctx.fill();
    this.ctx.fillStyle = "#777d78";
    this.ctx.font = "700 22px 'Vazirmatn Variable', Vazirmatn, Tahoma, sans-serif";
    this.ctx.fillText(label, PAGE_RIGHT - 36, this.y + 50);
    this.ctx.fillStyle = tone === "positive" ? "#315d4c" : tone === "negative" ? "#9b4f40" : "#1d2a25";
    this.ctx.font = "900 48px 'Vazirmatn Variable', Vazirmatn, Tahoma, sans-serif";
    this.ctx.fillText(value, PAGE_RIGHT - 36, this.y + 112);
    this.y += 184;
  }

  stats(items: Array<{ label: string; value: string; tone?: "positive" | "negative" | "neutral" }>) {
    const gap = 16;
    const cardWidth = (CONTENT_WIDTH - gap) / 2;
    const rows = Math.ceil(items.length / 2);
    this.ensure(rows * 108 + 20);
    items.forEach((item, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = column === 0 ? PAGE_RIGHT - cardWidth : PAGE_LEFT;
      const y = this.y + row * 108;
      roundedRect(this.ctx, x, y, cardWidth, 92, 20);
      this.ctx.fillStyle = "#fffdf8";
      this.ctx.fill();
      this.ctx.strokeStyle = "#e3ddd2";
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
      this.ctx.fillStyle = "#8a867f";
      this.ctx.font = "600 19px 'Vazirmatn Variable', Vazirmatn, Tahoma, sans-serif";
      this.ctx.fillText(item.label, x + cardWidth - 24, y + 34);
      this.ctx.fillStyle = item.tone === "positive" ? "#315d4c" : item.tone === "negative" ? "#b85d4a" : "#1d2a25";
      this.ctx.font = "800 24px 'Vazirmatn Variable', Vazirmatn, Tahoma, sans-serif";
      this.ctx.fillText(item.value, x + cardWidth - 24, y + 70);
    });
    this.y += rows * 108 + 12;
  }

  section(title: string, caption = "") {
    this.ensure(78);
    this.ctx.fillStyle = "#1d2a25";
    this.ctx.font = "900 28px 'Vazirmatn Variable', Vazirmatn, Tahoma, sans-serif";
    this.ctx.fillText(title, PAGE_RIGHT, this.y + 36);
    if (caption) {
      this.ctx.textAlign = "left";
      this.ctx.fillStyle = "#8a867f";
      this.ctx.font = "600 18px 'Vazirmatn Variable', Vazirmatn, Tahoma, sans-serif";
      this.ctx.fillText(caption, PAGE_LEFT, this.y + 34);
      this.ctx.textAlign = "right";
    }
    this.y += 62;
  }

  row(title: string, detail: string, value: string, tone: "positive" | "negative" | "neutral" = "neutral") {
    this.ctx.font = "800 25px 'Vazirmatn Variable', Vazirmatn, Tahoma, sans-serif";
    const titleLines = wrapLines(this.ctx, title, 700, 2);
    this.ctx.font = "600 19px 'Vazirmatn Variable', Vazirmatn, Tahoma, sans-serif";
    const detailLines = wrapLines(this.ctx, detail, 700, 3);
    const height = 54 + titleLines.length * 34 + detailLines.length * 27;
    this.ensure(height + 14);
    roundedRect(this.ctx, PAGE_LEFT, this.y, CONTENT_WIDTH, height, 20);
    this.ctx.fillStyle = "#fffdf8";
    this.ctx.fill();
    this.ctx.strokeStyle = "#e5e0d5";
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    this.ctx.fillStyle = "#1d2a25";
    this.ctx.font = "800 25px 'Vazirmatn Variable', Vazirmatn, Tahoma, sans-serif";
    drawLines(this.ctx, titleLines, PAGE_RIGHT - 26, this.y + 44, 34);
    const detailY = this.y + 50 + titleLines.length * 34;
    this.ctx.fillStyle = "#7d817c";
    this.ctx.font = "600 19px 'Vazirmatn Variable', Vazirmatn, Tahoma, sans-serif";
    drawLines(this.ctx, detailLines, PAGE_RIGHT - 26, detailY, 27);
    this.ctx.textAlign = "left";
    this.ctx.fillStyle = tone === "positive" ? "#315d4c" : tone === "negative" ? "#b85d4a" : "#1d2a25";
    this.ctx.font = "900 24px 'Vazirmatn Variable', Vazirmatn, Tahoma, sans-serif";
    this.ctx.fillText(value, PAGE_LEFT + 26, this.y + 48);
    this.ctx.textAlign = "right";
    this.y += height + 14;
  }

  meta(label: string, value: string) {
    this.ensure(58);
    this.ctx.fillStyle = "#7f847f";
    this.ctx.font = "600 18px 'Vazirmatn Variable', Vazirmatn, Tahoma, sans-serif";
    this.ctx.fillText(label, PAGE_RIGHT - 48, this.y + 28);
    this.ctx.textAlign = "left";
    this.ctx.fillStyle = "#315d4c";
    this.ctx.font = "800 19px 'Vazirmatn Variable', Vazirmatn, Tahoma, sans-serif";
    this.ctx.fillText(value, PAGE_LEFT + 48, this.y + 28);
    this.ctx.textAlign = "right";
    this.ctx.strokeStyle = "#e6e0d7";
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(PAGE_LEFT + 36, this.y + 48);
    this.ctx.lineTo(PAGE_RIGHT - 36, this.y + 48);
    this.ctx.stroke();
    this.y += 56;
  }

  note(text: string) {
    this.ctx.font = "600 19px 'Vazirmatn Variable', Vazirmatn, Tahoma, sans-serif";
    const lines = wrapLines(this.ctx, text, CONTENT_WIDTH - 60, 5);
    const height = 46 + lines.length * 28;
    this.ensure(height + 12);
    roundedRect(this.ctx, PAGE_LEFT, this.y, CONTENT_WIDTH, height, 18);
    this.ctx.fillStyle = "#eee8db";
    this.ctx.fill();
    this.ctx.fillStyle = "#5f645f";
    drawLines(this.ctx, lines, PAGE_RIGHT - 28, this.y + 42, 28);
    this.y += height + 12;
  }

  finalize() {
    const date = reportDate();
    for (const canvas of this.pages) {
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      ctx.direction = "rtl";
      ctx.textAlign = "right";
      ctx.fillStyle = "#8d8982";
      ctx.font = "500 17px 'Vazirmatn Variable', Vazirmatn, Tahoma, sans-serif";
      ctx.fillText(`گزارش تولیدشده از داده‌های محلی برنامه • ${date}`, PAGE_RIGHT, PAGE_HEIGHT - 48);
    }
    return this.pages;
  }
}

async function canvasJpeg(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("ساخت تصویر صفحه PDF انجام نشد.")), "image/jpeg", 0.92));
  return new Uint8Array(await blob.arrayBuffer());
}

function ascii(value: string) {
  return new TextEncoder().encode(value);
}

function concatBytes(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function buildPdf(images: Uint8Array[]) {
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (value: string | Uint8Array) => {
    const bytes = typeof value === "string" ? ascii(value) : value;
    parts.push(bytes);
    length += bytes.length;
  };
  const object = (id: number, body: Array<string | Uint8Array>) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
    body.forEach(push);
    push("\nendobj\n");
  };

  const objectCount = 2 + images.length * 3;
  push(ascii("%PDF-1.4\n%offline-report\n"));
  object(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
  const pageIds = images.map((_, index) => 3 + index * 3);
  object(2, [`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${images.length} >>`]);

  images.forEach((image, index) => {
    const pageId = 3 + index * 3;
    const imageId = pageId + 1;
    const contentId = pageId + 2;
    const imageName = `Im${index + 1}`;
    object(pageId, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_WIDTH} ${PDF_HEIGHT}] /Resources << /XObject << /${imageName} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`]);
    object(imageId, [`<< /Type /XObject /Subtype /Image /Width ${PAGE_WIDTH} /Height ${PAGE_HEIGHT} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`, image, "\nendstream"]);
    const content = ascii(`q\n${PDF_WIDTH} 0 0 ${PDF_HEIGHT} 0 0 cm\n/${imageName} Do\nQ\n`);
    object(contentId, [`<< /Length ${content.length} >>\nstream\n`, content, "\nendstream"]);
  });

  const xrefOffset = length;
  push(`xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`);
  for (let id = 1; id <= objectCount; id += 1) push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  return concatBytes(parts);
}

async function pagesToPdf(pages: HTMLCanvasElement[]) {
  const images: Uint8Array[] = [];
  for (const page of pages) images.push(await canvasJpeg(page));
  return new Blob([buildPdf(images)], { type: "application/pdf" });
}

async function sharePdf(blob: Blob, fileName: string, title: string) {
  const file = new File([blob], fileName, { type: "application/pdf" });
  try {
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title, files: [file] });
      return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    throw error;
  }
}

async function readyFonts() {
  if ("fonts" in document) await document.fonts.ready;
}

export async function sharePersonLedgerPdf(account: PersonAccount) {
  await readyFonts();
  const painter = new ReportPainter(`دفتر کامل ${account.name}`);
  painter.hero("مانده نهایی", account.finalBalance === 0 ? "تسویه" : `${money(Math.abs(account.finalBalance))} ${account.finalBalance > 0 ? "طلبکارم" : "بدهکارم"}`, account.finalBalance > 0 ? "positive" : account.finalBalance < 0 ? "negative" : "neutral");
  painter.stats([
    { label: "ثبت مستقیم", value: signedMoney(account.directBalance), tone: account.directBalance >= 0 ? "positive" : "negative" },
    { label: "چک‌ها", value: signedMoney(account.checkBalance), tone: account.checkBalance >= 0 ? "positive" : "negative" },
    { label: "اثر دُنگ‌ها", value: signedMoney(account.dongBalance), tone: account.dongBalance >= 0 ? "positive" : "negative" },
    { label: "تعداد تراکنش", value: `${faNumber.format(account.items.length)} مورد` },
  ]);
  if (account.groups.length) {
    painter.section("تفکیک دُنگ‌ها", `${faNumber.format(account.groups.length)} گروه`);
    account.groups.forEach((group) => painter.row(group.groupName, "اثر این گروه روی حساب من و این شخص", signedMoney(group.balance), group.balance >= 0 ? "positive" : "negative"));
  }
  painter.section("گردش کامل", `${faNumber.format(account.items.length)} تراکنش`);
  account.items.forEach((item) => {
    const status = item.status === "paid" ? "تسویه‌شده" : signedMoney(item.effect);
    painter.row(item.title, `${item.detail} • ${persianDate(item.date, true)}`, status, item.status === "paid" ? "neutral" : item.effect >= 0 ? "positive" : "negative");
  });
  if (!account.items.length) painter.note("هنوز تراکنشی برای این دفتر ثبت نشده است.");
  const pdf = await pagesToPdf(painter.finalize());
  await sharePdf(pdf, `${safeFileName(`دفتر-${account.name}`)}.pdf`, `دفتر کامل ${account.name}`);
}

export async function shareGroupPdf(group: Group) {
  await readyFonts();
  const painter = new ReportPainter(`گروه دُنگی ${group.name}`);
  painter.hero("جمع خریدهای مشترک", money(group.totalSpent), "neutral");
  painter.stats([
    { label: "اعضا", value: `${faNumber.format(group.members.length)} نفر` },
    { label: "خریدها", value: `${faNumber.format(group.expenses.length)} مورد` },
    { label: "تسویه‌ها", value: `${faNumber.format(group.settlements.length)} مورد` },
    { label: "کل تراکنش‌ها", value: `${faNumber.format(group.expenses.length + group.settlements.length)} مورد` },
  ]);

  painter.section("مانده اعضا", `${faNumber.format(group.balances.length)} نفر`);
  group.balances.forEach((balance) => painter.row(balance.name, `خرج کرده ${money(balance.paid)} • سهم ${money(balance.owed)}`, balance.balance === 0 ? "تسویه" : `${money(Math.abs(balance.balance))} ${balance.balance > 0 ? "بستانکار" : "بدهکار"}`, balance.balance > 0 ? "positive" : balance.balance < 0 ? "negative" : "neutral"));

  const activity = [
    ...group.expenses.map((expense) => ({ kind: "expense" as const, id: expense.id, date: expense.expenseDate, expense })),
    ...group.settlements.map((settlement) => ({ kind: "settlement" as const, id: settlement.id, date: settlement.settlementDate, settlement })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  painter.section("ریز تراکنش‌ها", `${faNumber.format(activity.length)} مورد`);
  activity.forEach((item) => {
    if (item.kind === "expense") {
      painter.row(item.expense.title, `خرید • پرداخت توسط ${item.expense.payerName} • ${persianDate(item.expense.expenseDate, true)}`, money(item.expense.amount), "neutral");
      item.expense.shares.forEach((share) => painter.meta(`سهم ${share.name} • وزن ${faNumber.format(share.weight)}`, money(share.amount)));
    } else {
      painter.row(`${item.settlement.fromName} به ${item.settlement.toName}`, `تسویه • ${persianDate(item.settlement.settlementDate, true)}${item.settlement.note ? ` • ${item.settlement.note}` : ""}`, money(item.settlement.amount), "positive");
    }
  });
  if (!activity.length) painter.note("هنوز خرید یا تسویه‌ای در این گروه ثبت نشده است.");

  if (group.suggestions.length) {
    painter.section("پیشنهاد تسویه فعلی", `${faNumber.format(group.suggestions.length)} پرداخت پیشنهادی`);
    group.suggestions.forEach((suggestion) => painter.row(`${suggestion.fromName} ← ${suggestion.toName}`, "پیشنهاد فعلی بر اساس مانده‌های ثبت‌شده", money(suggestion.amount), "neutral"));
  }

  const pdf = await pagesToPdf(painter.finalize());
  await sharePdf(pdf, `${safeFileName(`دنگ-${group.name}`)}.pdf`, `گزارش کامل گروه ${group.name}`);
}
