export async function compressImage(file: File, maxWidth = 800, maxQuality = 0.6): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject('No canvas context');
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      // "squishes it"
      const resultBase64 = canvas.toDataURL('image/jpeg', maxQuality);
      URL.revokeObjectURL(objectUrl);
      resolve(resultBase64);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject('Image load error');
    };
    img.src = objectUrl;
  });
}
