import { COMPANY_ICON_FILES, approvedLogoUrl, companyIconSrc } from "@/lib/pwa-company-install";

/**
 * Snapshot the company logo into install PNGs.
 * The any-purpose icons keep the file's own alpha: this canvas does not paint
 * a plate behind them. Maskable icons are a separate opaque safe-area image
 * because Android crops those and transparent corners become a black or
 * system plate. Logo pixels are drawn on top, so brand colors in the file stay.
 * Fails closed: the caller falls back to the Overwatch icons.
 */
export async function rasterizeCompanyIcons(companyId: string, logoUrl: string, maskablePlate: string): Promise<{ path: string; blob: Blob }[]> {
  const approved = approvedLogoUrl(companyId, logoUrl);
  if (!approved) throw new Error("logo-not-approved");
  const response = await fetch(approved, { mode: "cors", credentials: "omit", referrerPolicy: "no-referrer" });
  if (!response.ok) throw new Error("logo-fetch");
  const type = response.headers.get("content-type") || "";
  if (!type.startsWith("image/") || type.includes("svg")) throw new Error("logo-type");
  const bitmap = await createImageBitmap(await response.blob());
  try {
    const out: { path: string; blob: Blob }[] = [];
    for (const icon of COMPANY_ICON_FILES) {
      const size = icon.sizes.startsWith("512") ? 512 : 192;
      const maskable = icon.purpose === "maskable";
      const blob = await drawIcon(bitmap, size, maskable ? maskablePlate : null, maskable ? 0.2 : 0.08);
      out.push({ path: companyIconSrc(companyId, icon.file), blob });
    }
    return out;
  } finally {
    bitmap.close();
  }
}

function drawIcon(bitmap: ImageBitmap, size: number, plate: string | null, padRatio: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return Promise.reject(new Error("canvas"));
  ctx.clearRect(0, 0, size, size);
  if (plate) {
    ctx.fillStyle = plate;
    ctx.fillRect(0, 0, size, size);
  }
  const pad = size * padRatio;
  const side = size - pad * 2;
  const scale = Math.min(side / bitmap.width, side / bitmap.height);
  const width = bitmap.width * scale;
  const height = bitmap.height * scale;
  ctx.drawImage(bitmap, (size - width) / 2, (size - height) / 2, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("png"))), "image/png");
  });
}
