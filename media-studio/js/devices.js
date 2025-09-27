// Device selection utilities

/**
 * Get available media devices (cameras, microphones)
 * @returns {Promise<{videoInputs: MediaDeviceInfo[], audioInputs: MediaDeviceInfo[]}>}
 */
export async function getMediaDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter(d => d.kind === 'videoinput');
    const audioInputs = devices.filter(d => d.kind === 'audioinput');
    return { videoInputs, audioInputs };
  } catch (err) {
    console.warn('Failed to enumerate devices:', err);
    return { videoInputs: [], audioInputs: [] };
  }
}

/**
 * Populate select elements with device options
 */
export function populateDeviceSelects(videoSelect, audioSelect, devices) {
  if (videoSelect && devices.videoInputs) {
    videoSelect.innerHTML = '<option value="">Default Camera</option>';
    devices.videoInputs.forEach(device => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Camera ${device.deviceId.substring(0, 8)}`;
      videoSelect.appendChild(option);
    });
  }

  if (audioSelect && devices.audioInputs) {
    audioSelect.innerHTML = '<option value="">Default Microphone</option>';
    devices.audioInputs.forEach(device => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Microphone ${device.deviceId.substring(0, 8)}`;
      audioSelect.appendChild(option);
    });
  }
}

/**
 * Add device constraints to getUserMedia constraints
 */
export function addDeviceConstraints(constraints, videoDeviceId, audioDeviceId) {
  if (videoDeviceId && constraints.video) {
    if (typeof constraints.video === 'object') {
      constraints.video.deviceId = { exact: videoDeviceId };
    }
  }
  
  if (audioDeviceId && constraints.audio) {
    if (typeof constraints.audio === 'object') {
      constraints.audio.deviceId = { exact: audioDeviceId };
    }
  }
  
  return constraints;
}
