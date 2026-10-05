// Browsers use the document title as the suggested Save as PDF filename.
export function printDocument(parts: string[], onFinish?: () => void) {
  const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok' }).format(new Date());
  const name = parts.join('_').normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ').replace(/[. ]+$/g, '').trim().slice(0, 120);
  const originalTitle = document.title;
  const finish = () => {
    document.title = originalTitle;
    window.removeEventListener('afterprint', finish);
    onFinish?.();
  };
  document.title = `${name || 'เอกสารข้อสอบ'}_${date}.pdf`;
  window.addEventListener('afterprint', finish, { once: true });
  try { window.print(); } catch (error) { finish(); throw error; }
}
