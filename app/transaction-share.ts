import type { ReceiptAttachment } from "./local-db";

export type TransactionReceiptData = {
  reference: string;
  category: string;
  title: string;
  amount: number;
  date: string;
  status: string;
  direction?: "positive" | "negative" | "neutral";
  fields: Array<{ label: string; value: string }>;
  note?: string;
};

const number = new Intl.NumberFormat("fa-IR");
const money = (value: number) => `${number.format(value)} تومان`;

export async function attachmentFromFormData(form: FormData): Promise<ReceiptAttachment | null> {
  const value = form.get("receipt");
  if (!(value instanceof File) || value.size === 0) return null;
  if (!(value.type.startsWith("image/") || value.type === "application/pdf")) throw new Error("پیوست باید عکس یا فایل PDF باشد.");
  if (value.size > 5_000_000) throw new Error("حجم پیوست باید کمتر از ۵ مگابایت باشد.");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("خواندن فایل پیوست انجام نشد."));
    reader.readAsDataURL(value);
  });
  return { fileName: value.name || "attachment", mimeType: value.type, size: value.size, dataUrl };
}

export async function shareAttachment(attachment: ReceiptAttachment, title = "پیوست تراکنش") {
  try {
    const blob = await (await fetch(attachment.dataUrl)).blob();
    const file = new File([blob], attachment.fileName || "attachment", { type: attachment.mimeType });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title, files: [file] });
      return;
    }
    const anchor = document.createElement("a");
    anchor.href = attachment.dataUrl;
    anchor.download = attachment.fileName || "attachment";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    throw error;
  }
}

function receiptText(data: TransactionReceiptData) {
  const lines = [
    "دفتر حساب شخصی",
    `${data.category} • ${data.reference}`,
    data.title,
    `مبلغ: ${money(data.amount)}`,
    `تاریخ: ${data.date}`,
    `وضعیت: ${data.status}`,
    ...data.fields.filter((item) => item.value).map((item) => `${item.label}: ${item.value}`),
  ];
  if (data.note) lines.push(`یادداشت: ${data.note}`);
  lines.push("این رسید از اطلاعات ثبت‌شده در دفتر حساب شخصی ساخته شده و جایگزین رسید بانکی نیست.");
  return lines.join("\n");
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

function drawWrapped(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 2) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    } else {
      line = next;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  lines.forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}

async function buildReceiptImage(data: TransactionReceiptData) {
  if ("fonts" in document) await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("ساخت تصویر رسید در این مرورگر ممکن نیست.");
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.fillStyle = "#f3f0e8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  roundedRect(ctx, 70, 60, 940, 1230, 42);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  ctx.fillStyle = "#315d4c";
  ctx.font = "700 34px Vazirmatn, sans-serif";
  ctx.fillText("دفتر حساب شخصی", 930, 135);
  ctx.fillStyle = "#8a867f";
  ctx.font = "500 25px Vazirmatn, sans-serif";
  ctx.fillText(`رسید تراکنش • ${data.reference}`, 930, 180);

  ctx.fillStyle = "#1d2a25";
  ctx.font = "800 34px Vazirmatn, sans-serif";
  ctx.fillText(data.category, 930, 260);
  ctx.font = "800 48px Vazirmatn, sans-serif";
  let y = drawWrapped(ctx, data.title, 930, 330, 800, 62, 2) + 24;

  ctx.fillStyle = data.direction === "positive" ? "#2e725b" : data.direction === "negative" ? "#b85d4c" : "#1d2a25";
  ctx.font = "900 62px Vazirmatn, sans-serif";
  ctx.fillText(money(data.amount), 930, y);
  y += 78;

  ctx.fillStyle = "#f6f4ee";
  roundedRect(ctx, 120, y, 840, 94, 24);
  ctx.fill();
  ctx.fillStyle = "#6b6861";
  ctx.font = "600 25px Vazirmatn, sans-serif";
  ctx.fillText(data.date, 900, y + 58);
  ctx.textAlign = "left";
  ctx.fillStyle = "#315d4c";
  ctx.fillText(data.status, 180, y + 58);
  ctx.textAlign = "right";
  y += 130;

  ctx.font = "600 27px Vazirmatn, sans-serif";
  for (const field of data.fields.filter((item) => item.value).slice(0, 7)) {
    ctx.fillStyle = "#918d84";
    ctx.fillText(field.label, 930, y);
    ctx.fillStyle = "#252f2b";
    ctx.font = "700 29px Vazirmatn, sans-serif";
    y = drawWrapped(ctx, field.value, 930, y + 38, 760, 38, 2) + 30;
    ctx.font = "600 27px Vazirmatn, sans-serif";
    ctx.strokeStyle = "#ece8de";
    ctx.beginPath();
    ctx.moveTo(150, y - 12);
    ctx.lineTo(930, y - 12);
    ctx.stroke();
  }

  if (data.note && y < 1130) {
    ctx.fillStyle = "#918d84";
    ctx.font = "600 25px Vazirmatn, sans-serif";
    ctx.fillText("یادداشت", 930, y);
    ctx.fillStyle = "#4f514d";
    ctx.font = "600 26px Vazirmatn, sans-serif";
    drawWrapped(ctx, data.note, 930, y + 38, 760, 36, 2);
  }

  ctx.fillStyle = "#8b877f";
  ctx.font = "500 20px Vazirmatn, sans-serif";
  ctx.fillText("ساخته‌شده از اطلاعات ثبت‌شده در برنامه؛ جایگزین رسید بانکی نیست.", 930, 1235);
  ctx.fillText("daftar-hesab-shakhsi", 930, 1270);

  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("ساخت فایل رسید انجام نشد.")), "image/png", 0.94));
}

export async function shareTransactionReceipt(data: TransactionReceiptData) {
  const text = receiptText(data);
  try {
    const blob = await buildReceiptImage(data);
    const safeRef = data.reference.replace(/[^a-zA-Z0-9-_]/g, "-");
    const file = new File([blob], `daftar-receipt-${safeRef}.png`, { type: "image/png" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: `رسید ${data.category}`, text, files: [file] });
      return;
    }
    if (navigator.share) {
      await navigator.share({ title: `رسید ${data.category}`, text });
      return;
    }
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    throw error;
  }
}
