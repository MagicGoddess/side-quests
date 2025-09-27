import { getCameraStream, stopStream, attachToVideo, capturePhoto } from './camera.js';
import { createRecorder } from './recorder.js';
import { downloadBlob, timestampedFilename } from './download.js';
import { $, setStatus, setAspect, createGalleryItem } from './utils.js';
import { getMediaDevices, populateDeviceSelects } from './devices.js';
import { AudioMeter, createMeterElement, updateMeter, RecordingTimer } from './metering.js';
import { saveGalleryItem, loadGalleryItems, deleteGalleryItem, clearGallery, getStorageStats } from './storage.js';
import { VideoProcessor, processPhoto } from './video-processor.js';

let previewStream = null;
let processedStream = null;
let videoProcessor = null;
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
  fitMode: $('#fitModeSelect'),
  resolution: $('#resolutionSelect'),
  fps: $('#fpsSelect'),
  audioCheckbox: $('#includeAudio'),
  videoDeviceSelect: $('#videoDeviceSelect'),
  audioDeviceSelect: $('#audioDeviceSelect'),
  meteringContainer: $('#meteringContainer'),
  recordingTimer: $('#recordingTimer'),
  btnPhoto: $('#btnPhoto'),
  btnStartVideo: $('#btnStartVideo'),
  btnStopVideo: $('#btnStopVideo'),
  btnStartAudio: $('#btnStartAudio'),
  btnStopAudio: $('#btnStopAudio'),
  btnClear: $('#btnClear'),
  gallery: $('#gallery'),
  storageStats: $('#storageStats'),
  timerSelect: $('#timerSelect'),
  countdownBadge: $('#countdownBadge'),
};

function toggleVideoButtons(isRecording) {
  if (!els.btnStartVideo || !els.btnStopVideo) return;
  if (isRecording) {
    els.btnStartVideo.classList.add('hidden');
    els.btnStopVideo.classList.remove('hidden');
  } else {
    els.btnStartVideo.classList.remove('hidden');
    els.btnStopVideo.classList.add('hidden');
  }
}

function toggleAudioButtons(isRecording) {
  if (!els.btnStartAudio || !els.btnStopAudio) return;
  if (isRecording) {
    els.btnStartAudio.classList.add('hidden');
    els.btnStopAudio.classList.remove('hidden');
  } else {
    els.btnStartAudio.classList.remove('hidden');
    els.btnStopAudio.classList.add('hidden');
  }
}

async function runCountdownIfNeeded() {
  const seconds = parseInt(els.timerSelect?.value || '0', 10);
  if (!seconds || seconds <= 0) return true;
  const badge = els.countdownBadge;
  if (!badge) return true;

  badge.classList.remove('hidden');
  for (let s = seconds; s > 0; s--) {
    badge.textContent = `${s}`;
    await new Promise((r) => setTimeout(r, 1000));
  }
  badge.classList.add('hidden');
  return true;
}

function getConstraints() {
  const [width, height] = (els.resolution?.value || '1920,1080').split(',').map(Number);
  const fps = parseInt(els.fps?.value || '30');
  const aspect = els.aspect?.value || 'native';
  const withAudio = !!els.audioCheckbox?.checked;
  const videoDeviceId = els.videoDeviceSelect?.value || '';
  const audioDeviceId = els.audioDeviceSelect?.value || '';
  
  return { withAudio, width, height, fps, aspect, videoDeviceId, audioDeviceId };
}

function getOutputDimensions() {
  const aspect = els.aspect?.value || 'native';
  const [baseWidth, baseHeight] = (els.resolution?.value || '1920,1080').split(',').map(Number);
  
  if (aspect === 'native') {
    return { width: baseWidth, height: baseHeight };
  }
  
  const [aspectW, aspectH] = aspect.split(':').map(Number);
  const aspectRatio = aspectW / aspectH;
  
  // Calculate output dimensions maintaining the selected aspect ratio
  // Use the base resolution as a reference for quality
  let width, height;
  if (aspectRatio > (baseWidth / baseHeight)) {
    // Aspect is wider than base - use base width
    width = baseWidth;
    height = Math.round(baseWidth / aspectRatio);
  } else {
    // Aspect is taller than base - use base height
    height = baseHeight;
    width = Math.round(baseHeight * aspectRatio);
  }
  
  return { width, height };
}

function getProcessingOptions() {
  const { width, height } = getOutputDimensions();
  const fps = parseInt(els.fps?.value || '30');
  const fitMode = els.fitMode?.value || 'cover';
  
  return { width, height, fps, fitMode };
}

function updateAspect() {
  const fitMode = els.fitMode?.value || 'cover';
  setAspect(els.container, els.aspect?.value || 'native', els.video, fitMode);
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
    const stream = await getCameraStream(constraints);
    
    if (previewStream) {
      stopStream(previewStream);
      stopMeterAnimation();
    }
    
    previewStream = stream;
    await attachToVideo(els.video, previewStream);
    // Wait until the video has dimensions
    await new Promise((resolve) => {
      if (els.video.readyState >= 2 && els.video.videoWidth) return resolve();
      const onCanPlay = () => {
        els.video.removeEventListener('loadeddata', onCanPlay);
        resolve();
      };
      els.video.addEventListener('loadeddata', onCanPlay, { once: true });
    });
      // Re-apply aspect and scaled sizing now that metadata is available
      updateAspect();
    setupAudioMetering(previewStream);
    
    const audioStr = constraints.withAudio ? ' + mic' : '';
    const resStr = `${constraints.width}x${constraints.height}@${constraints.fps}fps`;
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
  
  // Clean up video processor if active
  if (videoProcessor) {
    videoProcessor.stop();
    videoProcessor = null;
  }
  if (processedStream) {
    stopStream(processedStream);
    processedStream = null;
  }
  
  attachToVideo(els.video, null);
  setStatus('Camera stopped');
}

async function takePhoto() {
  if (!els.video?.srcObject) return alert('Start camera first.');
  setStatus('Capturing photo…');
  
  try {
    const aspect = els.aspect?.value || 'native';
    let blob;
    
    if (aspect === 'native') {
      // Use original photo capture for native aspect
      blob = await capturePhoto(els.video);
    } else {
      // Use processed photo for custom aspect ratios
      const options = getProcessingOptions();
      blob = await processPhoto(els.video, options);
    }
    
    const mime = blob.type || 'image/jpeg';
    const id = await saveGalleryItem(blob, mime, { source: 'camera', aspect });
    
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
  const hasVideo = previewStream.getVideoTracks().length > 0;
  if (!hasVideo) {
    alert('No video track available. Please start the camera.');
    return;
  }
  setStatus('Recording video…');
  
  try {
    const aspect = els.aspect?.value || 'native';
    let recordingStream = previewStream;
    
    if (aspect !== 'native') {
      try {
        // Create processed stream for custom aspect ratios
        const options = getProcessingOptions();
        setStatus('Processing video for recording…');
        videoProcessor = new VideoProcessor();
        processedStream = await videoProcessor.startProcessing(previewStream, options);
        const vTracks = processedStream.getVideoTracks();
        if (!vTracks || vTracks.length === 0) {
          throw new Error('Processed stream has no video track');
        }
        recordingStream = processedStream;
        setStatus('Recording processed video…');
      } catch (err) {
        console.warn('Video processing failed, falling back to native recording:', err);
        setStatus('Processing failed, recording native video…');
        recordingStream = previewStream;
        // Clean up failed processor
        if (videoProcessor) {
          try { videoProcessor.stop(); } catch {}
          videoProcessor = null;
        }
      }
    }
    
    videoRecorderCtl = createRecorder(recordingStream, { timeslice: 250 });
    // If we're on a processed canvas stream, give it a brief warm-up to render frames
    if (recordingStream === processedStream) {
      await new Promise((r) => setTimeout(r, 200));
    }
  videoRecorderCtl.start();
    // Wait one timeslice to ensure the first dataavailable arrives on slower UAs
    await new Promise((r) => setTimeout(r, 260));
    
    els.recordingTimer.classList.remove('hidden');
    videoTimer.start((timeStr) => {
      els.recordingTimer.textContent = `🔴 ${timeStr}`;
    });
    
    toggleVideoButtons(true);
    setStatus('Recording video…');
  } catch (err) {
    console.error('Video recording start failed:', err);
    setStatus('Failed to start recording');
    if (videoProcessor) {
      try { videoProcessor.stop(); } catch {}
      videoProcessor = null;
    }
    if (processedStream) {
      try { stopStream(processedStream); } catch {}
      processedStream = null;
    }
    alert('Failed to start video recording. Please try again.');
    toggleVideoButtons(false);
  }
}

async function stopVideoRecording() {
  if (!videoRecorderCtl) return;
  setStatus('Finalizing video…');
  
  videoTimer.stop();
  els.recordingTimer.classList.add('hidden');
  
  try {
    // Try to flush any pending data
    try { videoRecorderCtl.recorder.requestData(); } catch {}
  let blob = await videoRecorderCtl.stop();
    
    // Validate the blob
    if (!blob || blob.size === 0) {
      // Try one more flush cycle just in case last chunk is late
      try { videoRecorderCtl.recorder.requestData(); } catch {}
      await new Promise((r) => setTimeout(r, 200));
      const retryBlob = new Blob(videoRecorderCtl.chunks || [], { type: videoRecorderCtl.recorder.mimeType || 'application/octet-stream' });
      if (retryBlob && retryBlob.size > 0) {
        blob = retryBlob;
      } else {
        throw new Error('Recording produced empty or invalid data');
      }
    }
    
    console.log('Video blob size:', blob.size, 'type:', blob.type);
    
    // Clean up video processor if it was used
    if (videoProcessor) {
      videoProcessor.stop();
      videoProcessor = null;
    }
    if (processedStream) {
      stopStream(processedStream);
      processedStream = null;
    }
    
    const aspect = els.aspect?.value || 'native';
    const mime = blob.type || 'video/webm';
    const duration = videoTimer.getElapsed();
    const { width, height } = getOutputDimensions();
    const id = await saveGalleryItem(blob, mime, { 
      source: 'video_recording', 
      duration, 
      aspect,
      resolution: `${width}x${height}`
    });
    
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
    toggleVideoButtons(false);
    updateStorageStats();
  } catch (err) {
    console.error('Video recording failed:', err);
    setStatus('Video recording failed');
    alert(`Video recording failed: ${err.message}`);
    
    // Clean up on error
    if (videoProcessor) {
      try { videoProcessor.stop(); } catch {}
      videoProcessor = null;
    }
    if (processedStream) {
      try { stopStream(processedStream); } catch {}
      processedStream = null;
    }
    toggleVideoButtons(false);
  }
  
  videoRecorderCtl = null;
}async function startAudioRecording() {
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
    
    toggleAudioButtons(true);
    
  } catch (err) {
    console.error('Audio recording failed:', err);
    setStatus('Audio recording failed');
    toggleAudioButtons(false);
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
    toggleAudioButtons(false);
    updateStorageStats();
  } catch (err) {
    console.error('Audio recording failed:', err);
    setStatus('Audio recording failed');
    toggleAudioButtons(false);
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
  
  els.fitMode?.addEventListener('change', () => {
    updateAspect(); // Only update display, no need to reacquire stream
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
  // Camera auto-starts on load; no manual start/stop buttons
  els.btnPhoto?.addEventListener('click', async () => {
    const ok = await runCountdownIfNeeded();
    if (ok) takePhoto();
  });
  els.btnStartVideo?.addEventListener('click', async () => {
    const ok = await runCountdownIfNeeded();
    if (ok) startVideoRecording();
  });
  els.btnStopVideo?.addEventListener('click', stopVideoRecording);
  els.btnStartAudio?.addEventListener('click', async () => {
    const ok = await runCountdownIfNeeded();
    if (ok) startAudioRecording();
  });
  els.btnStopAudio?.addEventListener('click', stopAudioRecording);
  els.btnClear?.addEventListener('click', clearAllGallery);
  
  // Initialize
  updateAspect();

  // Keep preview scaled on window resize
  window.addEventListener('resize', () => updateAspect());
}

async function initialize() {
  wireUI();
  await initializeDevices();
  // Auto-start camera on page load
  await startPreview();
  await loadGallery();
  await updateStorageStats();
}

initialize();
