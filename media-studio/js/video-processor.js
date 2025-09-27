// Video processing utilities for aspect ratio cropping and resizing

/**
 * Create a canvas-based video processor that can crop/resize video streams
 */
export class VideoProcessor {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.outputStream = null;
    this.inputVideo = null;
    this.animationId = null;
    this.isProcessing = false;
  }

  /**
   * Start processing a video stream with specified output dimensions
   * @param {MediaStream} inputStream - Source video stream
   * @param {Object} options - Processing options
   * @param {number} options.width - Output width
   * @param {number} options.height - Output height
   * @param {string} options.fitMode - How to fit: 'contain', 'cover', 'fill'
   * @param {number} options.fps - Output frame rate
   * @returns {MediaStream} Processed output stream
   */
  async startProcessing(inputStream, options = {}) {
    const { width = 1920, height = 1080, fitMode = 'cover', fps = 30 } = options;
    
    // Validate input stream has video tracks
    const videoTracks = inputStream.getVideoTracks();
    if (videoTracks.length === 0) {
      throw new Error('No video tracks in input stream');
    }
    
    // Set canvas dimensions to desired output size
    this.canvas.width = width;
    this.canvas.height = height;
    
    // Create video element for input
    this.inputVideo = document.createElement('video');
    this.inputVideo.srcObject = inputStream;
    this.inputVideo.muted = true;
    this.inputVideo.setAttribute('muted', '');
    this.inputVideo.playsInline = true;
    this.inputVideo.setAttribute('playsinline', '');

    // Wait for metadata to be ready before playing
    await new Promise((resolve, reject) => {
      if (this.inputVideo.readyState >= 1) return resolve();
      const timeout = setTimeout(() => {
        this.inputVideo.removeEventListener('loadedmetadata', onMeta);
        reject(new Error('Video metadata timeout'));
      }, 5000);
      const onMeta = () => {
        clearTimeout(timeout);
        this.inputVideo.removeEventListener('loadedmetadata', onMeta);
        resolve();
      };
      this.inputVideo.addEventListener('loadedmetadata', onMeta, { once: true });
    });

    try {
      await this.inputVideo.play();
    } catch (_) {
      // Retry once after a tick; some browsers need a microtask
      await new Promise((r) => setTimeout(r, 10));
      try { await this.inputVideo.play(); } catch (err) {
        console.warn('VideoProcessor: play() failed', err);
        throw err;
      }
    }
    // Give a short moment for frames to begin flowing
    await new Promise((r) => setTimeout(r, 50));
    
    // Wait for first frame to ensure video is actually playing
    await new Promise((resolve) => {
      const checkFrame = () => {
        if (this.inputVideo.videoWidth && this.inputVideo.videoHeight) {
          resolve();
        } else {
          setTimeout(checkFrame, 50);
        }
      };
      checkFrame();
    });
    
    // Create output stream from canvas with specific frame rate
    try {
      const safeFps = Math.min(Math.max(1, fps || 30), 60);
      this.outputStream = this.canvas.captureStream(safeFps);
    } catch (err) {
      throw new Error(`Failed to capture canvas stream: ${err.message}`);
    }
    
    // Add audio tracks from input if they exist
    const audioTracks = inputStream.getAudioTracks();
    if (audioTracks && audioTracks.length) {
      audioTracks.forEach(track => {
        try {
          const cloned = track.clone ? track.clone() : track;
          this.outputStream.addTrack(cloned);
        } catch (err) {
          console.warn('Failed to add audio track to processed stream:', err);
        }
      });
    }
    
    this.isProcessing = true;
    
    // Start the processing loop
    this.processFrame(fitMode);
    
    return this.outputStream;
  }

  processFrame(fitMode) {
    if (!this.isProcessing || !this.inputVideo) return;

    const video = this.inputVideo;
    const canvas = this.canvas;
    const ctx = this.ctx;

    if (video.videoWidth && video.videoHeight) {
      // Clear and fill background (avoid transparent areas becoming black differently across players)
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Calculate source and destination rectangles based on fit mode
      const { srcX, srcY, srcW, srcH, destX, destY, destW, destH } = 
        this.calculateCropResize(video.videoWidth, video.videoHeight, canvas.width, canvas.height, fitMode);
      
      // Draw the processed frame
      ctx.drawImage(video, srcX, srcY, srcW, srcH, destX, destY, destW, destH);
    }

    // Continue processing
    this.animationId = requestAnimationFrame(() => this.processFrame(fitMode));
  }

  /**
   * Calculate crop and resize parameters for different fit modes
   */
  calculateCropResize(inputW, inputH, outputW, outputH, fitMode) {
    const inputAspect = inputW / inputH;
    const outputAspect = outputW / outputH;

    let srcX = 0, srcY = 0, srcW = inputW, srcH = inputH;
    let destX = 0, destY = 0, destW = outputW, destH = outputH;

    switch (fitMode) {
      case 'contain':
        // Fit entire input, letterbox if needed
        if (inputAspect > outputAspect) {
          // Input is wider - fit to width
          destH = outputW / inputAspect;
          destY = (outputH - destH) / 2;
        } else {
          // Input is taller - fit to height
          destW = outputH * inputAspect;
          destX = (outputW - destW) / 2;
        }
        break;

      case 'cover':
        // Fill output, crop input if needed
        if (inputAspect > outputAspect) {
          // Input is wider - crop sides
          srcW = inputH * outputAspect;
          srcX = (inputW - srcW) / 2;
        } else {
          // Input is taller - crop top/bottom
          srcH = inputW / outputAspect;
          srcY = (inputH - srcH) / 2;
        }
        break;

      case 'fill':
        // Stretch to fill exactly - no cropping, may distort
        // Use default values (full source to full dest)
        break;
    }

    return { srcX, srcY, srcW, srcH, destX, destY, destW, destH };
  }

  stop() {
    this.isProcessing = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.inputVideo) {
      this.inputVideo.srcObject = null;
      this.inputVideo = null;
    }
    if (this.outputStream) {
      this.outputStream.getTracks().forEach(track => track.stop());
      this.outputStream = null;
    }
  }
}

/**
 * Process a photo with aspect ratio cropping
 * @param {HTMLVideoElement} video - Source video element
 * @param {Object} options - Processing options
 * @returns {Promise<Blob>} Processed image blob
 */
export async function processPhoto(video, options = {}) {
  const { width = 1920, height = 1080, fitMode = 'cover', quality = 0.95 } = options;
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = width;
  canvas.height = height;

  if (video.videoWidth && video.videoHeight) {
    // Create a temporary processor to calculate crop/resize
    const processor = new VideoProcessor();
    const { srcX, srcY, srcW, srcH, destX, destY, destW, destH } = 
      processor.calculateCropResize(video.videoWidth, video.videoHeight, width, height, fitMode);
    
    // Fill with black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    
    // Draw the cropped/resized frame
    ctx.drawImage(video, srcX, srcY, srcW, srcH, destX, destY, destW, destH);
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
  });
}