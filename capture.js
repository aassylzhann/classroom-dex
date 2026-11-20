import {ME,art,makeCard,makeExample,getWord,secondSample,sourceLabel,words} from './data.js';
import {collect,readCard,updateCard} from './storage.js';
import {cropPhoto,encode,imageFromFile,loadImage,measureSince,mediaProblem,openMedia,renderImage,stopTracks} from './media.js';
import {recognize} from './services.js';
import {back,button,esc,icon,link,setStatus} from './ui.js';

export function scan(ctx) {
  ctx.show(`<section class="narrow page-pad">
    ${back(['home'],'Field guide')}
    <div class="page-heading"><h1>Scan a water bottle</h1><p>Any water bottle works. Already have one? A different bottle becomes a new example to compare.</p></div>
    <div class="scan-panel panel">
      <div id="finder" class="finder">
        <video id="feed" muted autoplay playsinline hidden></video><img id="preview" alt="Your photo preview" hidden>
        <div id="camera-idle" class="camera-idle">${icon('camera')}<span>Open the camera or choose a photo</span></div>
        <div id="crop-guide" class="crop-guide" aria-hidden="true" hidden><i></i><i></i><i></i><i></i></div>
        <span id="capture-source" class="photo-chip" hidden></span>
      </div>
      <p id="capture-status" class="feedback" role="status">Opening camera…</p>
      <div id="capture-actions" class="actions scan-actions">
        ${button('take','Take photo','primary','camera','hidden')}
        ${button('device-camera','Use device camera','outline','camera')}
        ${button('choose','Choose photo','outline','image')}
        ${button('sample','Use sample photo','text-link')}
        ${button('open-live','Try live camera','text-link','refresh','hidden')}
      </div>
      <div id="confirm-actions" class="actions scan-actions" hidden>
        ${button('confirm','Use photo','primary','check')}${button('retake','Retake','outline','refresh')}
      </div>
      <input type="file" accept="image/*" id="photo-file" hidden>
      <input type="file" accept="image/*" capture="environment" id="camera-file" hidden>
    </div>
  </section>`);
  const $ = ctx.$, video = $('feed'), preview = $('preview'), finder = $('finder'), crop = $('crop-guide');
  const idle = $('camera-idle'), take = $('take'), status = $('capture-status'), live = $('open-live');
  let stream, photo, revision = 0, busy = false, cameraRequest, previewUrl;
  const stop = () => {
    cameraRequest?.abort(); cameraRequest = undefined;
    stopTracks(stream); stream = undefined; video.srcObject = null;
  };
  ctx.signal.addEventListener('abort',() => {stop(); if (previewUrl) URL.revokeObjectURL(previewUrl);},{once:true});
  function fitGuide(width,height) {
    if (!width || !height) { crop.hidden = true; return; }
    const side = Math.min(width,height);
    const scale = Math.min(finder.clientWidth/width,finder.clientHeight/height);
    crop.style.width = crop.style.height = side*scale + 'px';
    crop.hidden = false;
  }
  function resizeGuide() {
    if (photo) fitGuide(photo.canvas.width,photo.canvas.height);
    else if (!video.hidden) fitGuide(video.videoWidth,video.videoHeight);
  }
  const observer = new ResizeObserver(resizeGuide);
  observer.observe(finder);
  ctx.signal.addEventListener('abort',() => observer.disconnect(),{once:true});
  video.onloadedmetadata = video.onresize = resizeGuide;
  function idleCamera() {
    video.hidden = true; crop.hidden = true; idle.hidden = false;
    take.hidden = true; live.hidden = !navigator.mediaDevices?.getUserMedia;
  }
  async function startCamera() {
    const version = ++revision;
    stop(); idleCamera(); live.hidden = true;
    cameraRequest = new AbortController();
    setStatus(status,'Opening camera…');
    try {
      const opened = await openMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:960}},audio:false},
        {signal:cameraRequest.signal});
      if (!ctx.active() || version !== revision || photo) { stopTracks(opened); return; }
      stream = opened; video.srcObject = stream;
      video.muted = true; video.playsInline = true; video.hidden = false; idle.hidden = true;
      await video.play();
      if (!ctx.active() || version !== revision || photo) return;
      take.hidden = false;
      setStatus(status,'Center the blue bottle.');
      resizeGuide();
    } catch (error) {
      if (ctx.active() && version === revision && !photo) {
        stop(); idleCamera(); setStatus(status,mediaProblem('Camera',error),true);
      }
    }
  }
  async function prepare(canvas,source,ref) {
    const version = ++revision;
    try {
      const original = await encode(canvas);
      if (!ctx.active() || version !== revision) return;
      photo = {canvas,source,original,ref};
      stop(); video.hidden = true; idle.hidden = true;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(original);
      preview.src = previewUrl;
      preview.hidden = false;
      $('capture-source').textContent = sourceLabel[source];
      $('capture-source').hidden = false;
      $('capture-actions').hidden = true; $('confirm-actions').hidden = false;
      setStatus(status,'Use this photo to make your card.');
      resizeGuide();
      $('confirm').focus({preventScroll:true});
    } catch { if (ctx.active()) setStatus(status,'This photo could not open. Try again.',true); }
  }
  async function fileChosen(input,source) {
    const file = input.files[0]; input.value = '';
    if (!file || busy) return;
    const pending = ++revision;
    stop(); idleCamera();
    try {
      setStatus(status,'Opening photo…');
      const canvas = await imageFromFile(file);
      if (ctx.active() && revision === pending) await prepare(canvas,source);
    } catch { if (ctx.active() && revision === pending) {
      setStatus(status,'This photo could not open. Choose a JPEG or PNG.',true);
    } }
  }
  take.onclick = () => {
    if (video.readyState >= 2 && video.videoWidth && !video.hidden) {
      prepare(renderImage(video,video.videoWidth,video.videoHeight),'camera');
    } else setStatus(status,'The preview is loading. You can also use the device camera.');
  };
  live.onclick = startCamera;
  $('device-camera').onclick = () => {
    revision++; stop(); idleCamera();
    setStatus(status,'Take a photo or choose one on your device.');
    $('camera-file').click();
  };
  $('camera-file').onchange = () => fileChosen($('camera-file'),'device');
  $('photo-file').onchange = () => fileChosen($('photo-file'),'upload');
  $('choose').onclick = () => $('photo-file').click();
  $('sample').onclick = async () => {
    const version = ++revision;
    stop(); idleCamera();
    try {
      // The second time, offer a different bottle so the comparison task can be rehearsed.
      const have = await readCard(ME,'water-bottle');
      const img = await loadImage(ctx.asset(have ? secondSample.path : art('water-bottle')));
      if (ctx.active() && version === revision)
        await prepare(renderImage(img,img.naturalWidth||627,img.naturalHeight||627),'sample',have ? secondSample : undefined);
    } catch { if (ctx.active() && version === revision) setStatus(status,'Sample photo could not load. Try again.',true); }
  };
  $('retake').onclick = () => {
    photo = undefined; preview.hidden = true; $('capture-source').hidden = true;
    $('capture-actions').hidden = false; $('confirm-actions').hidden = true;
    startCamera();
  };
  $('confirm').onclick = async () => {
    if (!photo || busy) return;
    busy = true; const confirm = $('confirm'), retake = $('retake');
    confirm.disabled = true; retake.disabled = true;
    setStatus(status,'Making your card…');
    const started = performance.now();
    try {
      const detection = await recognize(photo.canvas,{signal:ctx.signal});
      const image = await encode(cropPhoto(photo.canvas,detection.box));
      if (!ctx.active()) return;
      const card = makeCard(ME,detection.key,photo.source,photo.original,image);
      card.recognition = detection.mode; card.recognitionMs = detection.latencyMs;
      const saved = await collect(card,ctx.active);
      if (!ctx.active()) return;
      if (saved.created) {
        measureSince('dex-confirm-to-save',started);
        ctx.go(['card',card.key],{earned:'collected',started});
      } else {
        const name = getWord(saved.card).name, count = 1 + (saved.card.examples?.length ?? 0);
        ctx.dialog('Already collected',`<p>You’ve already collected ${esc(name)}. Open Collection to view your card.</p>
          <p class="example-ask">${icon('spark')}<span>Is this a <strong>different</strong> ${esc(name.toLowerCase())}? Add it as example ${count+1} and compare them.</span></p>
          <div class="actions">${button('add-example','Add as new example','primary','plus')}${link(['collection',saved.card.key],'Open Collection','outline','cards','data-close-dialog')}</div>`);
        setStatus(status,'This card is in your collection.');
        const ref = photo.ref ?? words[saved.card.key];
        ctx.$('add-example').onclick = async () => {
          try {
            await updateCard(ME,saved.card.key,stored => {
              stored.examples ??= [];
              stored.examples.push(makeExample(card.source,card.original,card.image,ref));
            });
            ctx.go(['card',saved.card.key],{earned:'example'});
          } catch { setStatus(status,'Could not add this example. Try again.',true); }
        };
      }
    } catch { if (ctx.active()) setStatus(status,'Could not make a card. Use this photo again or retake it.',true); }
    finally { busy = false; confirm.disabled = false; retake.disabled = false; }
  };
  startCamera();
}
