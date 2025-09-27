// Camera utilities: manage camera stream with optional audio, aspect ratio, and preview

/**
 * Request camera stream with optional microphone.
 * @param {Object} opts
 * @param {boolean} opts.withAudio - include audio track
 * @param {number} [opts.width] - ideal width
 * @param {number} [opts.height] - ideal height
 * @param {number} [opts.fps] - ideal frame rate
 * @param {string} [opts.aspect] - like "16:9" | "9:16" | "4:3" | "1:1" | "native"
 * @param {string} [opts.videoDeviceId] - specific camera device ID
 * @param {string} [opts.audioDeviceId] - specific microphone device ID
 * @returns {Promise<MediaStream>}
 */
export async function getCameraStream({ withAudio, width, height, fps, aspect = 'native', videoDeviceId, audioDeviceId } = {}) {
  const constraints = buildConstraints({ withAudio, width, height, fps, aspect, videoDeviceId, audioDeviceId });
  return navigator.mediaDevices.getUserMedia(constraints);
}

/**
 * Stop all tracks of a MediaStream.
 */
export function stopStream(stream) {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try { track.stop(); } catch {}
  }
}

/**
 * Apply stream to a video element for preview.
 */
export async function attachToVideo(videoEl, stream) {
  if (!videoEl) return;
  videoEl.srcObject = stream || null;
  if (stream) {
    await videoEl.play().catch(() => {});
  }
}

/**
 * Capture a still photo from a video element. Uses ImageCapture when available, falls back to canvas.
 * @param {HTMLVideoElement} video
 * @returns {Promise<Blob>} image/png
 */
export async function capturePhoto(video) {
  const track = video?.srcObject instanceof MediaStream ? video.srcObject.getVideoTracks()[0] : null;
  if (track && 'ImageCapture' in window) {
    try {
      const ic = new window.ImageCapture(track);
      if (ic.takePhoto) {
        // Best quality path when supported
        return await ic.takePhoto();
      }
      // Fallback to a high-quality frame grab
      const bitmap = await ic.grabFrame();
      return bitmapToPngBlob(bitmap);
    } catch (_) {
      // fallback to canvas below
    }
  }
  return canvasGrab(video);
}

/**
 * Build getUserMedia constraints for camera and optional audio.
 */
export function buildConstraints({ withAudio = false, width, height, fps, aspect = 'native', videoDeviceId, audioDeviceId } = {}) {
  const video = { facingMode: 'user' };
  // Prefer high quality defaults (1080p @ 30fps) but allow device to adapt
  const idealW = width || 1920;
  const idealH = height || 1080;
  const idealFps = fps || 30;
  video.width = { ideal: idealW };
  video.height = { ideal: idealH };
  video.frameRate = { ideal: idealFps };
  
  if (videoDeviceId) {
    video.deviceId = { exact: videoDeviceId };
    delete video.facingMode; // Remove facingMode when using specific device
  }
  
  if (aspect && aspect !== 'native') {
    const [w, h] = aspect.split(':').map(Number);
    if (w && h) video.aspectRatio = { ideal: w / h };
  }
  
  const audio = withAudio ? {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: { ideal: 2 },
    sampleRate: { ideal: 48000 }
  } : false;
  
  if (audio && audioDeviceId) {
    audio.deviceId = { exact: audioDeviceId };
  }
  
  return { video, audio };
}

async function canvasGrab(video) {
  const canvas = document.createElement('canvas');
  const ratio = video.videoWidth / video.videoHeight || 16 / 9;
  canvas.width = video.videoWidth || Math.round(1280);
  canvas.height = Math.round(canvas.width / ratio);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

async function bitmapToPngBlob(bitmap) {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}
