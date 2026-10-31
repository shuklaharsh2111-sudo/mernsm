// Shrink an uploaded logo to a small data URL (keeps transparency, no cropping).
// Tries PNG at decreasing sizes, then JPEG, until it fits the server's size limit.
const MAX_CHARS = 140000;

export const toLogoDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const draw = (size, background) => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (background) {
          ctx.fillStyle = background;
          ctx.fillRect(0, 0, size, size);
        }
        const scale = Math.min(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        return canvas;
      };
      for (const size of [256, 192, 128]) {
        const png = draw(size).toDataURL('image/png');
        if (png.length <= MAX_CHARS) return resolve(png);
      }
      for (const size of [192, 128]) {
        const jpg = draw(size, '#ffffff').toDataURL('image/jpeg', 0.85);
        if (jpg.length <= MAX_CHARS) return resolve(jpg);
      }
      reject(new Error('That logo is too detailed. Try a simpler image.'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image'));
    };
    img.src = url;
  });
