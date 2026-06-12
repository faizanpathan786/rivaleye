export const MAX_AVATAR_FILE_BYTES = 5 * 1024 * 1024;
const AVATAR_SIZE = 256;
const AVATAR_QUALITY = 0.85;

// A square crop fitted to `size`: scale so the shorter side fills the box,
// then center the longer side. Returns the source rect to draw from.
export function squareCropRect(
  width: number,
  height: number,
): { sx: number; sy: number; side: number } {
  const side = Math.min(width, height);
  return {
    sx: Math.round((width - side) / 2),
    sy: Math.round((height - side) / 2),
    side,
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image"));
    img.src = src;
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

// Reads an image file, center-crops it to a square, downscales to a small
// avatar, and returns a compact JPEG data URL safe to persist in users.image.
export async function fileToAvatarDataUrl(file: File): Promise<string> {
  const sourceUrl = await readAsDataUrl(file);
  const img = await loadImage(sourceUrl);
  const { sx, sy, side } = squareCropRect(img.naturalWidth, img.naturalHeight);

  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

  return canvas.toDataURL("image/jpeg", AVATAR_QUALITY);
}
