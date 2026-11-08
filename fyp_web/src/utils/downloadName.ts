const EXTENSION: Record<string, string> = {
  'image/png': '.png', 'image/jpeg': '.jpg', 'application/pdf': '.pdf', 'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};

/** A name safe to save under: no path pieces or characters a file system rejects, and an extension that matches the file's real type. */
export function safeDownloadName(name: string | null | undefined, type: string | null | undefined) {
  const cleaned = [...(name || '').replace(/[\\/:*?"<>|]/g, '_')].filter(char => char.charCodeAt(0) >= 32).join('').trim().slice(0, 120) || 'attachment';
  const extension = EXTENSION[type || ''];
  return !extension || /\.[A-Za-z0-9]{2,5}$/.test(cleaned) ? cleaned : cleaned + extension;
}

/** Saves a file the page already holds under the given name. The temporary address is handed back a moment later, once the browser has taken it. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
