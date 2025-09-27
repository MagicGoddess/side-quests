// MediaRecorder helpers for video+audio and audio-only

/**
 * Create a MediaRecorder for a given stream. Chooses best mimeType supported.
 * @param {MediaStream} stream
 * @param {Object} [options]
 * @param {number} [options.timeslice] - timeslice in ms for dataavailable events
 * @returns {{ recorder: MediaRecorder, chunks: Blob[], start: Function, stop: Function, ondata: Function, mimeType: string }}
 */
export function createRecorder(stream, options = {}) {
  const mimeType = pickMimeType(stream);
  const chunks = [];
  const mrOptions = mimeType
    ? {
        mimeType,
        videoBitsPerSecond: options.videoBitsPerSecond ?? 5_000_000,
        audioBitsPerSecond: options.audioBitsPerSecond ?? 128_000,
      }
    : undefined;
  const recorder = new MediaRecorder(stream, mrOptions);

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const ondata = (cb) => {
    recorder.addEventListener('dataavailable', (e) => {
      if (e.data && e.data.size > 0) cb(e.data);
    });
  };

  // Use a small timeslice to ensure regular dataavailable events and avoid empty blobs on quick stops
  const start = () => recorder.start(options.timeslice ?? 250);
  const stop = () => new Promise((resolve) => {
    const finalize = () => resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || 'application/octet-stream' }));
    const onStop = () => {
      clearTimeout(timeoutId);
      recorder.removeEventListener('stop', onStop);
      // Allow a beat for any final dataavailable to flush
      setTimeout(finalize, 50);
    };
    const timeoutId = setTimeout(() => {
      recorder.removeEventListener('stop', onStop);
      finalize();
    }, 4000);
    recorder.addEventListener('stop', onStop, { once: true });
    // Give the UA a brief moment to emit the last dataavailable before stopping
    try { recorder.requestData(); } catch {}
    setTimeout(() => {
      try { recorder.stop(); } catch { onStop(); }
    }, 100);
  });

  return { recorder, chunks, start, stop, ondata, mimeType: recorder.mimeType || mimeType };
}

export function pickMimeType(stream) {
  const hasVideo = !!stream.getVideoTracks?.().length;
  const hasAudio = !!stream.getAudioTracks?.().length;

  // Prefer widely supported VP8; include Opus only when audio track is present
  const videoCandidates = hasAudio
    ? [
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8',
        'video/webm;codecs=vp9',
        'video/webm',
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4',
      ]
    : [
        'video/webm;codecs=vp8',
        'video/webm;codecs=vp9',
        'video/webm',
        'video/mp4;codecs=avc1.42E01E',
        'video/mp4',
      ];
  const audioCandidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
  ];

  const candidates = hasVideo ? videoCandidates : audioCandidates;
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) {
      console.log('Selected MIME type:', type);
      return type;
    }
  }
  console.warn('No supported MIME types found');
  return '';
}
