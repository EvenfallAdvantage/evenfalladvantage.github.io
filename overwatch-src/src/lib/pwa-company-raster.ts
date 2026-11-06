import { COMPANY_ICON_FILES, approvedLogoUrl, companyIconPath } from "@/lib/pwa-company-install";

/**
 * Draw the company's existing public logo onto opaque PNG icons.
 * Fails closed: the caller falls back to the Overwatch icons.
 */
export async function rasterizeCompanyIcons(companyId: string, logoUrl: string, background: string): Promise<{ path: string; blob: Blob }[]> {
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
      const blob = await drawIcon(bitmap, size, background, icon.purpose === "maskable");
      out.push({ path: companyIconPath(companyId, icon.file), blob });
    }
    return out;
  } finally {
    bitmap.close();
  }
}

function drawIcon(bitmap: ImageBitmap, size: number, background: string, maskable: boolean): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("canvas"));
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, size, size);
  const pad = maskable ? size * 0.2 : size * 0.08;
  const side = size - pad * 2;
  const scale = Math.min(side / bitmap.width, side / bitmap.height);
  const width = bitmap.width * scale;
  const height = bitmap.height * scale;
  ctx.drawImage(bitmap, (size - width) / 2, (size - height) / 2, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("png"))), "image/png");
  });
}
