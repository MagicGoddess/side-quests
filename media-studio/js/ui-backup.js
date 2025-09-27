import { getCameraStream, stopStream, attachToVideo, capturePhoto } from './camera.js';
import { createRecorder } from './recorder.js';
import { downloadBlob, timestampedFilename } from './download.js';
import { $, setStatus, setAspect, createGalleryItem } from './utils.js';
import { getMediaDevices, populateDeviceSelects } from './devices.js';
import { AudioMeter, createMeterElement, updateMeter, RecordingTimer } from './metering.js';
import { saveGalleryItem, loadGalleryItems, deleteGalleryItem, clearGallery, getStorageStats } from './storage.js';

let previewStream = null;
let videoRecorderCtl = null;
let audioRecorderCtl = null;
let audioMeter = null;
let videoTimer = new RecordingTimer();
let audioTimer = new RecordingTimer();
let meterAnimationId = null;
let audioMeterElements = null;

const els = {
  video: $('#preview'),
  container: $('#previewContainer'),
  aspect: $('#aspectSelect'),
  resolution: $('#resolutionSelect'),
  fps: $('#fpsSelect'),
  audioCheckbox: $('#includeAudio'),
  videoDeviceSelect: $('#videoDeviceSelect'),
  audioDeviceSelect: $('#audioDeviceSelect'),
  meteringContainer: $('#meteringContainer'),
  recordingTimer: $('#recordingTimer'),\n  aspectIndicator: $('#aspectIndicator'),\n  actualAspect: $('#actualAspect'),
  btnStartPreview: $('#btnStartPreview'),
  btnStopPreview: $('#btnStopPreview'),
  btnPhoto: $('#btnPhoto'),
  btnStartVideo: $('#btnStartVideo'),
  btnStopVideo: $('#btnStopVideo'),
  btnStartAudio: $('#btnStartAudio'),
  btnStopAudio: $('#btnStopAudio'),
  btnClear: $('#btnClear'),
  gallery: $('#gallery'),
  storageStats: $('#storageStats'),
};

function getConstraints() {
  const [width, height] = (els.resolution?.value || '1920,1080').split(',').map(Number);
  const fps = parseInt(els.fps?.value || '30');
  const aspect = els.aspect?.value || 'native';
  const withAudio = !!els.audioCheckbox?.checked;
  const videoDeviceId = els.videoDeviceSelect?.value || '';
  const audioDeviceId = els.audioDeviceSelect?.value || '';
  
  return { withAudio, width, height, fps, aspect, videoDeviceId, audioDeviceId };
}

function updateAspect() {
  setAspect(els.container, els.aspect?.value || 'native');
}

async function initializeDevices() {
  try {
    // Request initial permissions to get device labels
    const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    stopStream(tempStream);
    
    const devices = await getMediaDevices();
    populateDeviceSelects(els.videoDeviceSelect, els.audioDeviceSelect, devices);
  } catch (err) {
    console.warn('Could not enumerate devices:', err);
  }
}

function setupAudioMetering(stream) {
  if (audioMeter) {
    audioMeter.disconnect();
    audioMeter = null;
  }
  
  const hasAudio = stream.getAudioTracks().length > 0;
  if (!hasAudio) {
    els.meteringContainer.classList.add('hidden');
    return;
  }
  
  audioMeter = new AudioMeter(stream);
  if (audioMeter.isActive) {
    if (!audioMeterElements) {
      audioMeterElements = createMeterElement('Audio Level');
      els.meteringContainer.innerHTML = '';
      els.meteringContainer.appendChild(audioMeterElements.element);
    }
    els.meteringContainer.classList.remove('hidden');
    startMeterAnimation();
  }
}

function startMeterAnimation() {
  if (meterAnimationId) cancelAnimationFrame(meterAnimationId);
  
  const animate = () => {
    if (audioMeter && audioMeter.isActive && audioMeterElements) {
      const level = audioMeter.getLevel();
      updateMeter(audioMeterElements, level);
    }
    meterAnimationId = requestAnimationFrame(animate);
  };
  animate();
}

function stopMeterAnimation() {
  if (meterAnimationId) {
    cancelAnimationFrame(meterAnimationId);
    meterAnimationId = null;
  }
  if (audioMeter) {
    audioMeter.disconnect();
    audioMeter = null;
  }
  els.meteringContainer.classList.add('hidden');
}

async function startPreview() {
  try {
    setStatus('Requesting camera…');
    const constraints = getConstraints();
    let stream = null;
    
    try {
      // Try with exact constraints first
      stream = await getCameraStream(constraints);
    } catch (err) {
      // If exact constraints fail (common with aspect ratio), try with ideal
      console.warn('Exact constraints failed, trying with ideal:', err);
      const fallbackConstraints = { ...constraints };
      if (fallbackConstraints.aspect && fallbackConstraints.aspect !== 'native') {
        // Convert exact aspect to ideal for fallback
        const [w, h] = fallbackConstraints.aspect.split(':').map(Number);
        if (w && h) {
          const aspectRatio = w / h;
          const video = {
            ...fallbackConstraints,
            width: { ideal: fallbackConstraints.width || 1920 },
            height: { ideal: fallbackConstraints.height || 1080 },
            aspectRatio: { ideal: aspectRatio }
          };
          delete video.aspect; // Remove our custom aspect property
          
          const audio = fallbackConstraints.withAudio ? {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: { ideal: 2 },
            sampleRate: { ideal: 48000 }
          } : false;
          
          if (audio && fallbackConstraints.audioDeviceId) {
            audio.deviceId = { exact: fallbackConstraints.audioDeviceId };
          }
          
          const fallbackUserMediaConstraints = { video, audio };
          stream = await navigator.mediaDevices.getUserMedia(fallbackUserMediaConstraints);
        }
      } else {
        throw err; // Re-throw if not aspect ratio related
      }
    }
    
    if (previewStream) {
      stopStream(previewStream);
      stopMeterAnimation();
    }
    
    previewStream = stream;
    await attachToVideo(els.video, previewStream);
    setupAudioMetering(previewStream);
    
    const audioStr = constraints.withAudio ? ' + mic' : '';
    const resStr = `${constraints.width || 1920}x${constraints.height || 1080}@${constraints.fps}fps`;
    setStatus(`Camera ready (${resStr})${audioStr}`);
  } catch (err) {
    console.error(err);
    setStatus('Failed to start camera');
    alert('Unable to access camera/microphone. Check permissions and device selection.');
  }
}

function stopPreview() {
  stopStream(previewStream);
  previewStream = null;
  stopMeterAnimation();
  attachToVideo(els.video, null);
  setStatus('Camera stopped');
}

async function takePhoto() {
  if (!els.video?.srcObject) return alert('Start camera first.');
  setStatus('Capturing photo…');
  
  try {
    const blob = await capturePhoto(els.video);
    const mime = blob.type || 'image/png';
    const id = await saveGalleryItem(blob, mime, { source: 'camera' });
    
    const { element, downloadButton, deleteButton } = createGalleryItem({ 
      type: mime, blob, id, timestamp: Date.now() 
    });
    
    els.gallery.prepend(element);
    
    const ext = mime.includes('jpeg') ? 'jpg' : mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'img';
    downloadButton.addEventListener('click', () => downloadBlob(blob, timestampedFilename('photo', ext)));
    deleteButton.addEventListener('click', () => deleteGalleryItem(id).then(() => {
      element.remove();
      updateStorageStats();
    }));
    
    setStatus('Photo captured');
    updateStorageStats();
  } catch (err) {
    console.error('Photo capture failed:', err);
    setStatus('Photo capture failed');
  }
}

async function startVideoRecording() {
  if (!previewStream) return alert('Start camera first.');
  setStatus('Recording video…');
  
  videoRecorderCtl = createRecorder(previewStream);
  videoRecorderCtl.start();
  
  els.recordingTimer.classList.remove('hidden');
  videoTimer.start((timeStr) => {
    els.recordingTimer.textContent = `🔴 ${timeStr}`;
  });
}

async function stopVideoRecording() {
  if (!videoRecorderCtl) return;
  setStatus('Finalizing video…');
  
  videoTimer.stop();
  els.recordingTimer.classList.add('hidden');
  
  try {
    const blob = await videoRecorderCtl.stop();
    const mime = blob.type || 'video/webm';
    const duration = videoTimer.getElapsed();
    const id = await saveGalleryItem(blob, mime, { source: 'video_recording', duration });
    
    const { element, downloadButton, deleteButton } = createGalleryItem({ 
      type: mime, blob, id, timestamp: Date.now() 
    });
    
    els.gallery.prepend(element);
    
    const ext = mime.includes('webm') ? 'webm' : 'mp4';
    downloadButton.addEventListener('click', () => downloadBlob(blob, timestampedFilename('video', ext)));
    deleteButton.addEventListener('click', () => deleteGalleryItem(id).then(() => {
      element.remove();
      updateStorageStats();
    }));
    
    setStatus('Video saved');
    updateStorageStats();
  } catch (err) {
    console.error('Video recording failed:', err);
    setStatus('Video recording failed');
  }
  
  videoRecorderCtl = null;
}

async function startAudioRecording() {
  try {
    setStatus('Recording audio…');
    const audioDeviceId = els.audioDeviceSelect?.value || '';
    const constraints = { 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: { ideal: 2 },
        sampleRate: { ideal: 48000 }
      }, 
      video: false 
    };
    
    if (audioDeviceId) {
      constraints.audio.deviceId = { exact: audioDeviceId };
    }
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    audioRecorderCtl = createRecorder(stream);
    audioRecorderCtl.start();
    
    // Setup audio metering for voice recording
    if (audioMeter) audioMeter.disconnect();
    audioMeter = new AudioMeter(stream);
    if (audioMeter.isActive) {
      if (!audioMeterElements) {
        audioMeterElements = createMeterElement('Voice Level');
        els.meteringContainer.innerHTML = '';
        els.meteringContainer.appendChild(audioMeterElements.element);
      }
      els.meteringContainer.classList.remove('hidden');
      startMeterAnimation();
    }
    
    els.recordingTimer.classList.remove('hidden');
    audioTimer.start((timeStr) => {
      els.recordingTimer.textContent = `🎙️ ${timeStr}`;
    });
    
  } catch (err) {
    console.error('Audio recording failed:', err);
    setStatus('Audio recording failed');
    alert('Unable to access microphone. Check permissions and device selection.');
  }
}

async function stopAudioRecording() {
  if (!audioRecorderCtl) return;
  setStatus('Finalizing audio…');
  
  audioTimer.stop();
  els.recordingTimer.classList.add('hidden');
  stopMeterAnimation();
  
  try {
    const blob = await audioRecorderCtl.stop();
    const stream = audioRecorderCtl.recorder.stream;
    stopStream(stream);
    
    const mime = blob.type || 'audio/webm';
    const duration = audioTimer.getElapsed();
    const id = await saveGalleryItem(blob, mime, { source: 'voice_recording', duration });
    
    const { element, downloadButton, deleteButton } = createGalleryItem({ 
      type: mime, blob, id, timestamp: Date.now() 
    });
    
    els.gallery.prepend(element);
    
    const ext = mime.includes('webm') ? 'webm' : mime.includes('ogg') ? 'ogg' : 'wav';
    downloadButton.addEventListener('click', () => downloadBlob(blob, timestampedFilename('voice', ext)));
    deleteButton.addEventListener('click', () => deleteGalleryItem(id).then(() => {
      element.remove();
      updateStorageStats();
    }));
    
    setStatus('Audio saved');
    updateStorageStats();
  } catch (err) {
    console.error('Audio recording failed:', err);
    setStatus('Audio recording failed');
  }
  
  audioRecorderCtl = null;
}

async function clearAllGallery() {
  if (!confirm('Clear all gallery items? This cannot be undone.')) return;
  
  try {
    await clearGallery();
    els.gallery.innerHTML = '';
    updateStorageStats();
    setStatus('Gallery cleared');
  } catch (err) {
    console.error('Failed to clear gallery:', err);
    alert('Failed to clear gallery');
  }
}

async function loadGallery() {
  try {
    const items = await loadGalleryItems();
    els.gallery.innerHTML = '';
    
    for (const item of items) {
      const { element, downloadButton, deleteButton } = createGalleryItem({
        type: item.type,
        blob: item.blob,
        id: item.id,
        timestamp: item.timestamp
      });
      
      els.gallery.appendChild(element);
      
      const ext = getFileExtension(item.type);
      const prefix = item.type.startsWith('video/') ? 'video' : 
                    item.type.startsWith('audio/') ? 'voice' : 'photo';
      
      downloadButton.addEventListener('click', () => downloadBlob(item.blob, timestampedFilename(prefix, ext)));
      deleteButton.addEventListener('click', () => deleteGalleryItem(item.id).then(() => {
        element.remove();
        updateStorageStats();
      }));
    }
  } catch (err) {
    console.error('Failed to load gallery:', err);
  }
}

function getFileExtension(mimeType) {
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('jpeg')) return 'jpg';
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  return 'file';
}

async function updateStorageStats() {
  try {
    const stats = await getStorageStats();
    els.storageStats.innerHTML = `
      <div>${stats.totalItems} items • ${stats.totalSizeMB} MB used</div>
      <div>${stats.counts.video || 0} videos • ${stats.counts.image || 0} photos • ${stats.counts.audio || 0} audio</div>
    `;
  } catch (err) {
    els.storageStats.innerHTML = '<div>Storage stats unavailable</div>';
  }
}

function wireUI() {
  // Device and constraint changes
  els.aspect?.addEventListener('change', () => {
    updateAspect();
    if (previewStream) startPreview(); // Reacquire with new constraints
  });
  
  els.resolution?.addEventListener('change', () => {
    if (previewStream) startPreview();
  });
  
  els.fps?.addEventListener('change', () => {
    if (previewStream) startPreview();
  });
  
  els.audioCheckbox?.addEventListener('change', () => {
    if (previewStream) startPreview();
  });
  
  els.videoDeviceSelect?.addEventListener('change', () => {
    if (previewStream) startPreview();
  });
  
  els.audioDeviceSelect?.addEventListener('change', () => {
    if (previewStream) startPreview();
  });
  
  // Control buttons
  els.btnStartPreview?.addEventListener('click', startPreview);
  els.btnStopPreview?.addEventListener('click', stopPreview);
  els.btnPhoto?.addEventListener('click', takePhoto);
  els.btnStartVideo?.addEventListener('click', startVideoRecording);
  els.btnStopVideo?.addEventListener('click', stopVideoRecording);
  els.btnStartAudio?.addEventListener('click', startAudioRecording);
  els.btnStopAudio?.addEventListener('click', stopAudioRecording);
  els.btnClear?.addEventListener('click', clearAllGallery);
  
  // Initialize
  updateAspect();
}

async function initialize() {
  wireUI();
  await initializeDevices();
  await loadGallery();
  await updateStorageStats();
}

initialize();
