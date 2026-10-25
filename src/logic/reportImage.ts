/** Draw the weekly report as a PNG card, for sharing to LINE or saving to photos. */
export async function reportImage(title: string, subtitle: string, lines: string[]): Promise<Blob> {
  await document.fonts?.ready;
  const scale = 2;
  const w = 720;
  const lineH = 40;
  const h = 150 + lines.length * lineH + 40;
  const c = document.createElement('canvas');
  c.width = w * scale;
  c.height = h * scale;
  const g = c.getContext('2d')!;
  g.scale(scale, scale);
  g.fillStyle = '#f8fafc';
  g.fillRect(0, 0, w, h);
  const grad = g.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, '#4f46e5');
  grad.addColorStop(1, '#7c3aed');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, 110);
  g.fillStyle = '#fff';
  g.font = '700 30px Sarabun, sans-serif';
  g.fillText(title, 32, 52, w - 64);
  g.font = '400 20px Sarabun, sans-serif';
  g.fillText(`${subtitle} · ตะลุยโจทย์สอบเข้า ม.1`, 32, 86, w - 64);
  g.fillStyle = '#0f172a';
  lines.forEach((l, i) => {
    const heading = l.endsWith(':');
    g.font = `${heading ? 700 : 400} 24px Sarabun, sans-serif`;
    g.fillStyle = heading ? '#4f46e5' : '#0f172a';
    g.fillText(l, 32, 150 + i * lineH, w - 64); // maxWidth squeezes rather than clips long lines
  });
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('สร้างรูปไม่สำเร็จ'))), 'image/png'));
}
