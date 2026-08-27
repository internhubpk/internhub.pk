/**
 * Shared signature helpers (client-side).
 *
 * Used by the weekly-log review/sign dialogs to convert the SignaturePad's
 * output (a drawn PNG data URL OR a typed name) into a real File the
 * /api/.../weekly-logs/[id]/sign routes accept (multipart PNG/JPEG, max 1MB).
 */

/**
 * Render a typed name as a PNG data URL (italic script-style) so typed
 * signatures can be embedded in the Word report like drawn ones.
 */
export function typedNameToPngDataUrl(name: string): string {
  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 200;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#1a1a1a";
  ctx.font = "italic 52px 'Segoe Script', 'Brush Script MT', 'Lucida Handwriting', cursive";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name, canvas.width / 2, canvas.height / 2);
  return canvas.toDataURL("image/png");
}

/**
 * Convert a PNG data URL to a File.
 */
export async function dataUrlToFile(dataUrl: string, fileName: string): Promise<File | null> {
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    if (!blob || blob.size === 0) return null;
    return new File([blob], fileName, { type: "image/png" });
  } catch {
    return null;
  }
}

/**
 * Convert the SignaturePad's value (drawn data URL or typed name) into a
 * PNG File ready for upload. Returns null when no signature was provided
 * or conversion failed.
 */
export async function signatureToFile(
  signatureData: string | null | undefined,
  fileName: string
): Promise<File | null> {
  if (!signatureData) return null;
  const dataUrl = signatureData.startsWith("data:image")
    ? signatureData
    : typedNameToPngDataUrl(signatureData);
  if (!dataUrl) return null;
  return dataUrlToFile(dataUrl, fileName);
}
