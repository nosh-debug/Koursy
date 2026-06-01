export async function base64ToBlobUrl(base64: string): Promise<string> {
  if (!base64 || !base64.startsWith('data:')) return base64;
  
  try {
    const res = await fetch(base64);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error("Error converting base64 to blob URL", err);
    return base64; // Fallback
  }
}
