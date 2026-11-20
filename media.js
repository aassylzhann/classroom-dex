// Canvas scaling, JPEG encoding, photo decoding and stream cleanup are adapted
// from the supplied prototype. Both photo variants come from one capture.
export function canvasFor(width,height) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  return canvas;
}
export function renderImage(image,width,height) {
  if (!width || !height) throw new Error('This image has no pixels.');
  const scale = Math.min(1280/Math.max(width,height),1);
  const canvas = canvasFor(Math.max(1,Math.round(width*scale)),Math.max(1,Math.round(height*scale)));
  const context = canvas.getContext('2d');
  context.fillStyle = '#f8f7f2';
  context.fillRect(0,0,canvas.width,canvas.height);
  context.drawImage(image,0,0,canvas.width,canvas.height);
  return canvas;
}
export function encode(canvas,type = 'image/jpeg') {
  return new Promise((resolve,reject) => canvas.toBlob(
    blob => blob ? resolve(blob) : reject(new Error('Photo could not be saved.')), type, .9));
}
export function loadImage(url) {
  return new Promise((resolve,reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('This photo could not open.'));
    image.src = url;
  });
}
export async function imageFromFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    return renderImage(image,image.naturalWidth,image.naturalHeight);
  } finally { URL.revokeObjectURL(url); }
}
export function centerBox(canvas) {
  const size = Math.min(canvas.width,canvas.height);
  return {x:(canvas.width-size)/2, y:(canvas.height-size)/2, width:size, height:size};
}
// A rectangular detection fits in a square with paper at the edges.
export function cropPhoto(canvas, box) {
  if (![box?.x,box?.y,box?.width,box?.height].every(Number.isFinite) ||
      box.width <= 0 || box.height <= 0 || box.x < 0 || box.y < 0 ||
      box.x + box.width > canvas.width + .01 || box.y + box.height > canvas.height + .01)
    throw new Error('The object was outside the frame. Try again.');
  const side = Math.max(1,Math.min(800,Math.round(Math.max(box.width,box.height))));
  const out = canvasFor(side,side), ctx = out.getContext('2d');
  const scale = side/Math.max(box.width,box.height), w = box.width*scale, h = box.height*scale;
  ctx.fillStyle = '#f0eee6'; ctx.fillRect(0,0,side,side);
  ctx.drawImage(canvas,box.x,box.y,box.width,box.height,(side-w)/2,(side-h)/2,w,h);
  return out;
}
export const stopTracks = stream => stream?.getTracks().forEach(track => track.stop());
export function openMedia(constraints, {signal, timeoutMs = 9000} = {}) {
  return new Promise((resolve,reject) => {
    const devices = navigator.mediaDevices;
    if (!devices?.getUserMedia) {
      reject(new DOMException('Media capture is unavailable in this page.', 'NotSupportedError'));
      return;
    }
    let finished = false, timer;
    const abort = () => fail(new DOMException('Media request cancelled.', 'AbortError'));
    function cleanup() {
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort',abort);
    }
    function fail(error) {
      if (finished) return;
      cleanup();
      reject(error);
    }
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener('abort',abort,{once:true});
    timer = setTimeout(() => fail(new DOMException('Media request timed out.','TimeoutError')),timeoutMs);
    try {
      devices.getUserMedia(constraints).then(stream => {
        if (finished) { stopTracks(stream); return; }
        cleanup();
        resolve(stream);
      },fail);
    } catch (error) { fail(error); }
  });
}
export function mediaProblem(device, error) {
  const name = error?.name;
  const kind = device.toLowerCase();
  if (!window.isSecureContext || window.top !== window.self || !navigator.mediaDevices?.getUserMedia)
    return 'Open this page in Safari or Chrome over HTTPS to use the '+kind+'.';
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return device+' access is blocked. Allow it in your browser and device settings, then try again.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError')
    return 'No '+kind+' was found. Check your device and try again.';
  if (name === 'NotReadableError')
    return 'The '+kind+' could not start. Close other apps using it and try again.';
  if (name === 'TimeoutError') return 'The '+kind+' did not open. Check its permission or try again.';
  if (name === 'NotSupportedError') return 'This browser cannot use the '+kind+' here. Open Safari or Chrome.';
  return 'The '+kind+' could not start. Try again.';
}
export function makeRecorder(stream, Recorder = globalThis.MediaRecorder) {
  if (typeof Recorder !== 'function') throw new DOMException('Recording is unavailable.','NotSupportedError');
  // MP4/AAC is available on older Safari. Probe each browser before choosing.
  const formats = ['audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus'];
  for (const mimeType of formats) {
    if (!Recorder.isTypeSupported?.(mimeType)) continue;
    try { return new Recorder(stream,{mimeType}); }
    catch (error) { if (error.name !== 'NotSupportedError') throw error; }
  }
  return new Recorder(stream);
}
export function measureSince(name, started) {
  try { performance.measure(name,{start:started,end:performance.now()}); }
  catch { /* Some browser versions only support named marks. */ }
}
