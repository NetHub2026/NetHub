/** Remove only near-white background connected to an image edge, preserving enclosed rooms. */
export function clearPlanMargins(pixels: Uint8ClampedArray, width: number, height: number) {
  const seen = new Uint8Array(width * height);
  const queue = new Uint32Array(width * height);
  let head = 0, tail = 0;
  const visit = (index: number) => {
    if (seen[index]) return;
    seen[index] = 1;
    const offset = index * 4;
    if (pixels[offset + 3] === 0 || (pixels[offset]! >= 245 && pixels[offset + 1]! >= 245 && pixels[offset + 2]! >= 245)) {
      queue[tail++] = index;
      pixels[offset + 3] = 0;
    }
  };
  for (let x = 0; x < width; x++) { visit(x); visit((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { visit(y * width); visit(y * width + width - 1); }
  while (head < tail) {
    const index = queue[head++]!, x = index % width, y = Math.floor(index / width);
    if (x > 0) visit(index - 1);
    if (x + 1 < width) visit(index + 1);
    if (y > 0) visit(index - width);
    if (y + 1 < height) visit(index + width);
  }
}

export async function transparentPlanImage(source: string): Promise<string> {
  const image = new Image();
  image.src = source;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) return source;
  context.drawImage(image, 0, 0);
  const frame = context.getImageData(0, 0, canvas.width, canvas.height);
  clearPlanMargins(frame.data, canvas.width, canvas.height);
  context.putImageData(frame, 0, 0);
  return canvas.toDataURL("image/png");
}
