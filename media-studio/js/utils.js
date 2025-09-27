// Misc utilities

export const $ = (sel, scope = document) => scope.querySelector(sel);
export const $$ = (sel, scope = document) => Array.from(scope.querySelectorAll(sel));

export function setStatus(text) {
  const el = document.getElementById('status');
  if (el) el.textContent = text;
}

export function setAspect(container, aspect, videoElement, fitMode = 'contain') {
  if (!container) return;

  const MAX_PREVIEW_HEIGHT = 512;

  // Determine desired aspect ratio
  let ratio = null;
  if (!aspect || aspect === 'native') {
    if (videoElement?.videoWidth && videoElement?.videoHeight) {
      ratio = videoElement.videoWidth / videoElement.videoHeight;
    } else {
      ratio = 16 / 9; // sensible default until metadata is available
    }
  } else {
    const [w, h] = aspect.split(':').map(Number);
    if (w && h) ratio = w / h;
  }

  // Apply object-fit on the video
  if (videoElement) {
    videoElement.style.objectFit = fitMode || 'contain';
    videoElement.style.width = '100%';
    videoElement.style.height = '100%';
  }

  if (!ratio) return;

  // Compute container size: cap height at MAX_PREVIEW_HEIGHT while respecting available width
  const parent = container.parentElement;
  const availableWidth = parent ? parent.clientWidth : window.innerWidth;
  const widthFromMaxH = Math.round(MAX_PREVIEW_HEIGHT * ratio);
  const width = Math.min(availableWidth, widthFromMaxH);
  const height = Math.min(MAX_PREVIEW_HEIGHT, Math.round(width / ratio));

  // Explicit sizes override aspect-ratio for predictable scaling
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;
}

export function createGalleryItem({ type, blob, poster, id, timestamp }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'rounded-xl overflow-hidden border border-white/10 bg-black/40';
  wrapper.dataset.itemId = id;

  if (type.startsWith('image/')) {
    const img = document.createElement('img');
    img.className = 'w-full h-auto block';
    img.src = URL.createObjectURL(blob);
    wrapper.appendChild(img);
  } else if (type.startsWith('video/')) {
    const video = document.createElement('video');
    video.className = 'w-full h-auto block';
    video.controls = true;
    if (poster) video.poster = poster;
    video.src = URL.createObjectURL(blob);
    wrapper.appendChild(video);
  } else if (type.startsWith('audio/')) {
    const audio = document.createElement('audio');
    audio.className = 'w-full';
    audio.controls = true;
    audio.src = URL.createObjectURL(blob);
    wrapper.appendChild(audio);
  }

  const bar = document.createElement('div');
  bar.className = 'flex items-center justify-between gap-2 p-2 bg-white/5 border-t border-white/10';
  
  // Metadata section
  const metadata = document.createElement('div');
  metadata.className = 'text-xs text-slate-400 space-y-1';
  const sizeStr = formatFileSize(blob.size);
  const timeStr = timestamp ? formatTimestamp(timestamp) : '';
  metadata.innerHTML = `<div>${sizeStr}</div><div>${timeStr}</div>`;
  
  // Button section
  const buttons = document.createElement('div');
  buttons.className = 'flex gap-2';
  
  const downloadBtn = document.createElement('button');
  downloadBtn.className = 'text-xs px-3 py-1.5 rounded-md bg-gradient-to-r from-magenta-600 to-violet-600 hover:from-magenta-500 hover:to-violet-500';
  downloadBtn.textContent = 'Download';
  
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'text-xs px-3 py-1.5 rounded-md bg-red-600/80 hover:bg-red-500 border border-red-500/50';
  deleteBtn.textContent = 'Delete';
  
  buttons.appendChild(downloadBtn);
  buttons.appendChild(deleteBtn);
  bar.appendChild(metadata);
  bar.appendChild(buttons);
  wrapper.appendChild(bar);

  return { element: wrapper, downloadButton: downloadBtn, deleteButton: deleteBtn };
}

export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
