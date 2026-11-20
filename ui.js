import {icon} from './icons.js';
import {getWord,sourceLabel} from './data.js';
export {icon};
export const esc = value => String(value ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const href = (...parts) => '#/' + parts.map(encodeURIComponent).join('/');
export function link(path,label,look = 'quiet',symbol = '',attrs = '') {
  return `<a class="btn ${look}" href="${href(...path)}" ${attrs}>${symbol ? icon(symbol) : ''}${esc(label)}</a>`;
}
export function button(id,label,look = 'quiet',symbol = '',attrs = '') {
  return `<button class="btn ${look}" type="button" id="${id}" ${attrs}>${symbol ? icon(symbol) : ''}${esc(label)}</button>`;
}
export function badge(grade) {
  return `<span class="grade" data-grade="${esc(grade)}" aria-label="Grade ${esc(grade)}">${esc(grade)}</span>`;
}
export function mode() { return '<span class="mode"><i></i>Mock</span>'; }
export function back(path,label) { return `<div class="back-row">${link(path,label,'text-link','back')}</div>`; }
export function photo(ctx, card, variant = 'image') {
  const asset = card[variant];
  const alt = card.name ? getWord(card).name : 'Example photo';
  return asset ? `<img src="${esc(ctx.url(asset))}" alt="${esc(alt)}" decoding="async">` : '';
}
export function face(ctx,card) {
  return `<div class="face-top"><span>${icon('guide')} Word card</span>${badge(card.grade)}</div>
    <div class="card-art">${photo(ctx,card)}</div>
    <div class="face-bottom"><strong>${esc(getWord(card).name)}</strong><span>${sourceLabel[card.source]}</span></div>`;
}
export function tile(ctx,card,selected = false) {
  return `<a class="word-tile card-paper ${selected ? 'located' : ''}" data-key="${esc(card.key)}" data-grade="${card.grade}" href="${href('card',card.key)}">${face(ctx,card)}</a>`;
}
export function audioRow(ctx, take,label) {
  if (!take) return '';
  const source = take.source === 'sample' ? 'Sample audio' : 'Live recording';
  return `<div class="audio-row"><div class="audio-caption"><strong>${label}</strong><span>${source}</span></div>
    <audio controls preload="metadata" aria-label="${label} · ${source}" src="${esc(ctx.url(take.audio))}"></audio>
    <p class="audio-error feedback error" role="status" hidden>This audio could not play in this browser.</p></div>`;
}
export function scorePanel(score) {
  if (!score) return '';
  const status = pass => `<span class="result ${pass?'pass':'try'}">${pass ? 'Pass' : 'Try again'}</span>`;
  return `<div class="assessment"><div class="assessment-title"><strong>${score.mode === 'Mock' ? 'Sample assessment' : 'Assessment'}</strong>${score.mode === 'Mock' ? mode() : ''}</div>
    <dl><div><dt>Content</dt><dd>${status(score.content)}</dd></div>
    <div><dt>Pronunciation</dt><dd>${status(score.pronunciation)}</dd></div></dl>
    <p class="transcript"><span>${score.mode === 'Mock'?'Sample transcript':'Transcript'}</span>${esc(score.transcript)}</p></div>`;
}
export function setStatus(node,message,error = false) {
  node.textContent = message; node.hidden = !message; node.classList.toggle('error',error);
}
export function playExample(ctx,path,button) {
  const audio = new Audio(ctx.url(path));
  function pause() {
    audio.pause();
    button.lastChild.textContent = 'Listen to example';
  }
  ctx.signal.addEventListener('abort',pause,{once:true});
  audio.onended = pause;
  button.onclick = async () => {
    if (!audio.paused) {pause(); return;}
    try { await audio.play(); button.lastChild.textContent = 'Pause example'; }
    catch { ctx.say('The example could not play. Try again.'); }
  };
  return pause;
}
export function celebration(node) {
  node.classList.add('earned');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#397e80','#c58f49','#8068ad','#98bfc0'];
  const burst = document.createElement('div');
  burst.className = 'burst'; burst.setAttribute('aria-hidden','true');
  for (let i=0;i<18;i++) {
    const bit = document.createElement('i');
    const angle = i/18*Math.PI*2, radius = 58 + (i%4)*33;
    bit.style.cssText = `--x:${Math.cos(angle)*radius}px;--y:${Math.sin(angle)*radius}px;--c:${colors[i%4]};--r:${i*47}deg`;
    burst.append(bit);
  }
  node.append(burst); setTimeout(() => burst.remove(),680);
}
export function cardGesture(stage,flipButton) {
  const card = stage.querySelector('.big-card');
  const front = stage.querySelector('.card-front'), back = stage.querySelector('.card-back');
  let flipped = false, drag;
  function flip() {
    flipped = !flipped;
    card.classList.toggle('flipped',flipped);
    flipButton.setAttribute('aria-pressed',String(flipped));
    front.setAttribute('aria-hidden',String(flipped));
    back.setAttribute('aria-hidden',String(!flipped));
  }
  function release(event,allowFlip) {
    if (!drag || (event && event.pointerId !== drag.id)) return;
    const ended = drag; drag = undefined;
    const dy = event ? event.clientY-ended.y : 0, dx = event ? event.clientX-ended.x : 0;
    stage.classList.remove('dragging');
    stage.style.setProperty('--tilt-x','0deg'); stage.style.setProperty('--tilt-y','0deg');
    if (stage.hasPointerCapture(ended.id)) stage.releasePointerCapture(ended.id);
    if (allowFlip && Math.abs(dy) > Math.max(58,ended.height*.16) && Math.abs(dy)>Math.abs(dx)*1.25) flip();
  }
  flipButton.onclick = flip;
  stage.onpointerdown = event => {
    if (drag || !event.isPrimary || event.button !== 0) return;
    const {width,height} = stage.getBoundingClientRect();
    drag = {id:event.pointerId,x:event.clientX,y:event.clientY,width,height};
    stage.setPointerCapture(event.pointerId);
    stage.classList.add('dragging');
  };
  stage.onpointermove = event => {
    if (!drag || drag.id !== event.pointerId) return;
    const clamp = val => Math.max(-17,Math.min(17,val));
    stage.style.setProperty('--tilt-y',clamp((event.clientX-drag.x)/drag.width*54)+'deg');
    stage.style.setProperty('--tilt-x',clamp((drag.y-event.clientY)/drag.height*54)+'deg');
  };
  stage.onpointerup = event => release(event,true);
  stage.onpointercancel = stage.onlostpointercapture = event => release(event,false);
  const observer = new ResizeObserver(() => release(null,false));
  observer.observe(stage);
  return () => { release(null,false); observer.disconnect(); };
}
