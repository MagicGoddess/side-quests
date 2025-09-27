// Download helpers

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 200);
}

export function timestampedFilename(prefix, ext) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}-${ts}.${ext}`;
}
