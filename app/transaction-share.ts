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

async function attachmentToFile(attachment: ReceiptAttachment) {
  const blob = await (await fetch(attachment.dataUrl)).blob();
  return new File([blob], attachment.fileName || "attachment", { type: attachment.mimeType });
}

export async function shareAttachment(attachment: ReceiptAttachment, title = "پیوست تراکنش") {
  try {
    const file = await attachmentToFile(attachment);
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

function receiptText(data: TransactionReceiptData, attachment?: ReceiptAttachment | null) {
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
  if (attachment) lines.push(`مدرک پیوست‌شده: ${attachment.fileName}`);
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

function drawPill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, background: string, foreground: string) {
  ctx.font = "700 23px Vazirmatn, sans-serif";
  const width = Math.ceil(ctx.measureText(text).width) + 42;
  roundedRect(ctx, x - width, y, width, 50, 25);
  ctx.fillStyle = background;
  ctx.fill();
  ctx.fillStyle = foreground;
  ctx.fillText(text, x - 20, y + 33);
  return width;
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("نمایش تصویر پیوست‌شده در رسید ممکن نشد."));
    image.src = dataUrl;
  });
}

function drawCoverImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number, radius: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = Math.max(0, (image.naturalWidth - sourceWidth) / 2);
  const sourceY = Math.max(0, (image.naturalHeight - sourceHeight) / 2);
  ctx.save();
  roundedRect(ctx, x, y, width, height, radius);
  ctx.clip();
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
  ctx.restore();
}

async function buildReceiptImage(data: TransactionReceiptData, attachment?: ReceiptAttachment | null) {
  if ("fonts" in document) await document.fonts.ready;
  const hasAttachment = Boolean(attachment);
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = hasAttachment ? 1780 : 1480;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("ساخت تصویر رسید در این مرورگر ممکن نیست.");

  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.fillStyle = "#f5f2eb";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  roundedRect(ctx, 58, 48, 964, canvas.height - 96, 48);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  roundedRect(ctx, 58, 48, 964, 12, 6);
  ctx.fillStyle = data.direction === "positive" ? "#315d4c" : data.direction === "negative" ? "#b65b4a" : "#6b6f68";
  ctx.fill();

  ctx.fillStyle = "#315d4c";
  ctx.font = "800 31px Vazirmatn, sans-serif";
  ctx.fillText("دفتر حساب شخصی", 930, 126);
  ctx.fillStyle = "#8d887f";
  ctx.font = "500 21px Vazirmatn, sans-serif";
  ctx.fillText("رسید ثبت مالی", 930, 162);
  drawPill(ctx, data.reference, 930, 190, "#f1eee7", "#6f6b64");

  ctx.fillStyle = "#77736c";
  ctx.font = "700 23px Vazirmatn, sans-serif";
  ctx.fillText(data.category, 930, 292);
  ctx.fillStyle = "#1d2824";
  ctx.font = "850 42px Vazirmatn, sans-serif";
  let y = drawWrapped(ctx, data.title, 930, 350, 800, 55, 2) + 42;

  ctx.fillStyle = data.direction === "positive" ? "#2f705a" : data.direction === "negative" ? "#b65b4a" : "#26312c";
  ctx.font = "900 65px Vazirmatn, sans-serif";
  ctx.fillText(money(data.amount), 930, y);
  y += 92;

  roundedRect(ctx, 120, y, 840, 100, 28);
  ctx.fillStyle = "#faf8f3";
  ctx.fill();
  ctx.fillStyle = "#8a867e";
  ctx.font = "600 20px Vazirmatn, sans-serif";
  ctx.fillText("تاریخ", 900, y + 35);
  ctx.fillStyle = "#333b37";
  ctx.font = "750 25px Vazirmatn, sans-serif";
  ctx.fillText(data.date, 900, y + 72);
  ctx.textAlign = "left";
  ctx.fillStyle = "#8a867e";
  ctx.font = "600 20px Vazirmatn, sans-serif";
  ctx.fillText("وضعیت", 180, y + 35);
  ctx.fillStyle = data.direction === "negative" ? "#9e5548" : "#315d4c";
  ctx.font = "750 25px Vazirmatn, sans-serif";
  ctx.fillText(data.status, 180, y + 72);
  ctx.textAlign = "right";
  y += 150;

  ctx.fillStyle = "#8c877f";
  ctx.font = "700 21px Vazirmatn, sans-serif";
  ctx.fillText("جزئیات", 930, y);
  y += 35;

  ctx.font = "600 23px Vazirmatn, sans-serif";
  for (const field of data.fields.filter((item) => item.value).slice(0, 7)) {
    ctx.fillStyle = "#9b968e";
    ctx.fillText(field.label, 930, y);
    ctx.fillStyle = "#29322e";
    ctx.font = "750 26px Vazirmatn, sans-serif";
    y = drawWrapped(ctx, field.value, 930, y + 34, 760, 36, 2) + 20;
    ctx.strokeStyle = "#eeeae2";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(150, y);
    ctx.lineTo(930, y);
    ctx.stroke();
    y += 23;
    ctx.font = "600 23px Vazirmatn, sans-serif";
  }

  if (data.note && y < (hasAttachment ? 1180 : 1280)) {
    roundedRect(ctx, 120, y + 2, 840, 112, 24);
    ctx.fillStyle = "#faf8f3";
    ctx.fill();
    ctx.fillStyle = "#948f86";
    ctx.font = "650 20px Vazirmatn, sans-serif";
    ctx.fillText("یادداشت", 920, y + 38);
    ctx.fillStyle = "#484e4a";
    ctx.font = "600 23px Vazirmatn, sans-serif";
    drawWrapped(ctx, data.note, 920, y + 72, 760, 32, 2);
    y += 142;
  }

  if (attachment) {
    const evidenceTop = Math.max(y + 18, 1260);
    ctx.fillStyle = "#8c877f";
    ctx.font = "700 21px Vazirmatn, sans-serif";
    ctx.fillText("مدرک پیوست‌شده", 930, evidenceTop);
    const boxY = evidenceTop + 28;
    roundedRect(ctx, 120, boxY, 840, 310, 26);
    ctx.fillStyle = "#f8f6f1";
    ctx.fill();

    if (attachment.mimeType.startsWith("image/")) {
      try {
        const image = await loadImage(attachment.dataUrl);
        drawCoverImage(ctx, image, 145, boxY + 24, 300, 262, 20);
        ctx.fillStyle = "#2e3733";
        ctx.font = "750 25px Vazirmatn, sans-serif";
        drawWrapped(ctx, attachment.fileName, 920, boxY + 82, 410, 34, 2);
        ctx.fillStyle = "#8c877f";
        ctx.font = "600 21px Vazirmatn, sans-serif";
        ctx.fillText("تصویر مدرک همراه این رسید ارسال می‌شود", 920, boxY + 178);
      } catch {
        ctx.fillStyle = "#2e3733";
        ctx.font = "750 25px Vazirmatn, sans-serif";
        ctx.fillText(attachment.fileName, 920, boxY + 96);
        ctx.fillStyle = "#8c877f";
        ctx.font = "600 21px Vazirmatn, sans-serif";
        ctx.fillText("تصویر پیوست‌شده", 920, boxY + 142);
      }
    } else {
      roundedRect(ctx, 145, boxY + 50, 150, 190, 28);
      ctx.fillStyle = "#efece5";
      ctx.fill();
      ctx.fillStyle = "#b65b4a";
      ctx.font = "900 34px Vazirmatn, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("PDF", 220, boxY + 158);
      ctx.textAlign = "right";
      ctx.fillStyle = "#2e3733";
      ctx.font = "750 25px Vazirmatn, sans-serif";
      drawWrapped(ctx, attachment.fileName, 920, boxY + 92, 520, 34, 2);
      ctx.fillStyle = "#8c877f";
      ctx.font = "600 21px Vazirmatn, sans-serif";
      ctx.fillText("فایل PDF اصلی همراه این رسید ارسال می‌شود", 920, boxY + 190);
    }
  }

  const footerY = canvas.height - 118;
  ctx.strokeStyle = "#eee9e1";
  ctx.beginPath();
  ctx.moveTo(120, footerY - 35);
  ctx.lineTo(960, footerY - 35);
  ctx.stroke();
  ctx.fillStyle = "#979289";
  ctx.font = "500 18px Vazirmatn, sans-serif";
  ctx.fillText("ساخته‌شده از اطلاعات ثبت‌شده در برنامه؛ جایگزین رسید بانکی نیست.", 930, footerY);
  ctx.fillText("daftar-hesab-shakhsi", 930, footerY + 34);

  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("ساخت فایل رسید انجام نشد.")), "image/png", 0.95));
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function shareTransactionReceipt(data: TransactionReceiptData, attachment?: ReceiptAttachment | null) {
  const text = receiptText(data, attachment);
  try {
    const blob = await buildReceiptImage(data, attachment);
    const safeRef = data.reference.replace(/[^a-zA-Z0-9-_]/g, "-");
    const receiptFile = new File([blob], `daftar-receipt-${safeRef}.png`, { type: "image/png" });
    const attachmentFile = attachment ? await attachmentToFile(attachment) : null;
    const completeFiles = attachmentFile ? [receiptFile, attachmentFile] : [receiptFile];

    if (navigator.share && navigator.canShare?.({ files: completeFiles })) {
      await navigator.share({ title: `رسید ${data.category}`, text, files: completeFiles });
      return;
    }
    if (!attachmentFile && navigator.share && navigator.canShare?.({ files: [receiptFile] })) {
      await navigator.share({ title: `رسید ${data.category}`, text, files: [receiptFile] });
      return;
    }
    if (!attachmentFile && navigator.share) {
      await navigator.share({ title: `رسید ${data.category}`, text });
      return;
    }

    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    downloadFile(receiptFile);
    if (attachmentFile) window.setTimeout(() => downloadFile(attachmentFile), 350);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    throw error;
  }
}
