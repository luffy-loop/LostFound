const DAY_MS = 86400000;
const STOP_WORDS = new Set(["the","and","for","with","from","this","that","was","are","has","have","item","lost","found"]);
export function archiveStaleItems(items, options = {}) {
  const now = options.now instanceof Date ? options.now.getTime() : Number(options.now ?? Date.now());
  const days = Number.isFinite(options.days) && options.days >= 1 ? options.days : 90;
  const cutoff = now - days * DAY_MS;
  return items.map(item => {
    if (item.archived || item.status === "Returned") return item;
    const created = Date.parse(item.createdAt || "");
    if (!Number.isFinite(created) || created > cutoff) return item;
    return { ...item, archived: true, archivedAt: new Date(now).toISOString() };
  });
}
function tokens(value) {
  return new Set(String(value || "").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(word => word.length > 2 && !STOP_WORDS.has(word)));
}
export function scoreMatch(item, other) {
  if (!item || !other || item.type === other.type) return 0;
  let score = 0;
  if (item.category && item.category === other.category) score += 3;
  const normalize = value => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (normalize(item.location) && normalize(item.location) === normalize(other.location)) score += 3;
  const a = tokens([item.itemName, item.description].join(" "));
  const b = tokens([other.itemName, other.description].join(" "));
  for (const word of a) if (b.has(word)) score += 2;
  const dateA = Date.parse(item.occurredAt || item.createdAt || "");
  const dateB = Date.parse(other.occurredAt || other.createdAt || "");
  if (Number.isFinite(dateA) && Number.isFinite(dateB)) {
    const daysApart = Math.abs(dateA - dateB) / DAY_MS;
    if (daysApart < 1) score += 3;
    else if (daysApart <= 7) score += 1;
  }
  return score;
}
export async function createQrCode(container, value) {
  if (!container || !value) throw new Error("A container and URL are required.");
  const imported = await import("https://esm.sh/qrcode@1.5.4");
  const qr = imported.default || imported;
  const canvas = document.createElement("canvas");
  await qr.toCanvas(canvas, value, { width: 190, margin: 2, errorCorrectionLevel: "M" });
  canvas.setAttribute("aria-label", "QR code for the shareable item report link");
  container.replaceChildren(canvas);
  return canvas;
}
