import {ME,art,reading,getWord,sourceLabel,classRows,rankRows,boards,studentStats} from './data.js';
import {readCards,readCard,resetRehearsal,temporaryStorage} from './storage.js';
import {measureSince} from './media.js';
import {scan} from './capture.js';
import {quiz,readAloud} from './learning.js';
import {teacher} from './teacher.js';
import {back,badge,button,cardGesture,celebration,esc,face,href,icon,link,mode,photo,playExample,tile} from './ui.js';

const $ = id => document.getElementById(id);
const main = $('main'), dialog = $('dialog');
let scope, transition, toastTimer;
const offlineAssets = new Map();
const navigation = [
  ['home','Field guide','guide'],['collection','Collection','cards'],
  ['leaderboard','Leaderboard','trophy'],['teacher','Teacher','teacher'],
];
const fromHash = () => location.hash.startsWith('#/') ? location.hash.slice(2).split('/').map(decodePart) : ['home'];
function decodePart(value) { try {return decodeURIComponent(value);} catch {return '';} }
function go(parts,extras = {}) {
  const target = href(...parts);
  transition = {target,extras};
  if (location.hash === target) render();
  else location.hash = target;
}
function say(message) {
  const notice = $('notice');
  clearTimeout(toastTimer);
  notice.innerHTML = icon('check')+'<span>'+esc(message)+'</span>';
  notice.classList.add('visible');
  toastTimer = setTimeout(() => notice.classList.remove('visible'),3400);
}
function showDialog(title,content) {
  $('dialog-content').innerHTML = `<div class="dialog-heading"><h2 id="dialog-title">${esc(title)}</h2>
    ${button('close-dialog','','outline icon-btn','close','aria-label="Close"')}</div><div class="dialog-body">${content}</div>`;
  $('close-dialog').onclick = () => dialog.close();
  $('dialog-content').onclick = event => {
    if (event.target.closest('[data-close-dialog]')) dialog.close();
  };
  if (!dialog.open) dialog.showModal();
}
function pageContext(route,extras) {
  scope?.abort();
  scope = new AbortController();
  const signal = scope.signal;
  const urls = new Map();
  signal.addEventListener('abort',() => {for (const url of urls.values()) URL.revokeObjectURL(url);},{once:true});
  const asset = path => offlineAssets.get(path) ?? path;
  let ready = false;
  return { $, route, extras, signal, asset, go, say, dialog:showDialog,
    active:() => !signal.aborted && route === location.hash,
    url(input) {
      if (!(input instanceof Blob)) return asset(input);
      if (!urls.has(input)) urls.set(input,URL.createObjectURL(input));
      return urls.get(input);
    },
    show(html) {
      if (signal.aborted) return;
      main.innerHTML = html;
      $('temporary-notice').hidden = !temporaryStorage();
      main.removeAttribute('aria-busy');
      if (!ready) { main.focus({preventScroll:true}); ready = true; }
    },
  };
}
function header(active) {
  $('masthead').innerHTML = `<div class="mast wrap">
    <a class="brand" href="#/home"><img src="./assets/mark.svg" alt=""><span>Classroom <b>Dex</b></span></a>
    <nav aria-label="Main">${navigation.map(([key,name,symbol]) => `<a class="nav-item" href="${href(key)}" ${key===active?'aria-current="page"':''}>${icon(symbol)}<span>${name}</span></a>`).join('')}</nav>
    <div class="profile">${mode()}<span class="profile-name"><span class="avatar finch" aria-hidden="true">F7</span><span>Finch 07</span></span></div>
  </div>`;
}
$('footer').innerHTML = `<div class="wrap footer-inner"><span>${icon('guide')} Classroom Dex</span><div class="footer-actions">
  <span id="offline-state" class="offline-state" hidden>${icon('offline')} Offline ready</span>
  ${button('reset-rehearsal','Reset rehearsal','text-link','reset')}</div></div>`;
$('reset-rehearsal').onclick = () => {
  showDialog('Reset rehearsal?',`<p>Clear this demo’s photos, answers and recordings. Restore the three starter cards and the teacher sample.</p>
    <div class="actions">${button('confirm-reset','Reset demo','primary','reset')}${button('cancel-reset','Cancel','outline')}</div>
    <p id="reset-status" class="feedback" role="status" hidden></p>`);
  $('cancel-reset').onclick = () => dialog.close();
  $('confirm-reset').onclick = async event => {
    const control = event.currentTarget;
    scope?.abort();
    control.disabled = true;
    try { await resetRehearsal(); dialog.close(); go(['home']); say('Ready for a fresh rehearsal.'); }
    catch {
      const status = $('reset-status');
      if (status) {status.hidden = false; status.textContent = 'Could not reset. Try again.';}
      control.disabled = false;
    }
  };
};

async function home(ctx) {
  const cards = await readCards();
  if (!ctx.active()) return;
  ctx.show(`<div class="wrap home-page">
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">${icon('lens')} PHOTO CHALLENGE</p>
        <h1>Find the blue<br><em>water bottle.</em></h1>
        <p class="hero-lede">Take a photo to turn it into an English word card.</p>
        <div class="actions hero-actions">${link(['scan'],'Scan','primary','camera')}${link(['collection'],'Collection','outline','cards')}</div>
      </div>
      <div class="hero-art">
        <div class="art-ring" aria-hidden="true"></div><div class="art-mark one" aria-hidden="true">${icon('spark')}</div><div class="art-mark two" aria-hidden="true">${icon('spark')}</div>
        <div class="guide-corner tl"></div><div class="guide-corner br"></div>
        <figure class="specimen"><span class="tape" aria-hidden="true"></span>
          <img src="${ctx.asset(art('water-bottle'))}" alt="Blue water bottle, sample photo">
          <figcaption><span>Sample photo</span>${icon('lens')}</figcaption></figure>
      </div>
    </section>
    <section class="home-collection" aria-labelledby="my-collection">
      <div class="section-top"><div><h2 id="my-collection">My collection</h2><span class="count">${cards.length} cards</span></div>
      ${link(['collection'],'View collection','text-link')}</div>
      <div class="word-grid">${cards.slice(0,4).map(card=>tile(ctx,card)).join('')}${cards.length < 4 ? emptyTile() : ''}</div>
    </section>
  </div>`);
}
function emptyTile() {
  return `<a href="${href('scan')}" class="empty-tile"><span class="tile-plus">${icon('plus')}</span><strong>Add a card</strong><small>Scan the blue bottle</small></a>`;
}
async function collection(ctx,key) {
  const cards = await readCards();
  if (!ctx.active()) return;
  const found = cards.find(card => card.key === key);
  ctx.show(`<section class="wrap page-pad">
    <div class="page-heading board-heading"><div><h1>My collection</h1><p>${cards.length} word cards · Finch 07</p></div>${link(['scan'],'Scan','primary','camera')}</div>
    ${found ? `<p class="located-message">${icon('check')} ${esc(getWord(found).name)} is in your collection.</p>` : ''}
    <div class="word-grid collection-grid">${cards.map(card=>tile(ctx,card,card===found)).join('')}${cards.length < 4 ? emptyTile() : ''}</div>
  </section>`);
  if (found) {
    const target = main.querySelector('.located');
    target?.scrollIntoView({block:'nearest'});
    target?.focus({preventScroll:true});
  }
}
function cardBack(card) {
  if (card.grade === 'B') return `<div class="back-face-content"><span class="lock-stamp">${icon('lock')}</span>
    <h2>Word notes</h2><p>Earn A to reveal the color and shape.</p></div>`;
  return `<div class="back-face-content"><span class="lock-stamp">${icon('guide')}</span>
    <h2>Word notes</h2><dl><div><dt>Color</dt><dd>${esc(card.reference.color)}</dd></div>
    <div><dt>Shape</dt><dd>${esc(card.reference.shape)}</dd></div></dl><p>${esc(getWord(card).use)}</p></div>`;
}
function detail(ctx,card) {
  const earned = ctx.extras.earned;
  const heading = {collected:'Card collected!',A:'Grade A earned!',example:'New example added!'}[earned] ?? 'Explore your card';
  const examples = card.examples ?? [];
  const step = card.grade === 'B' ? (examples.length ? 'Compare your two examples. Why are they both '+getWord(card).name.toLowerCase()+'s?' : 'Look at the photo. Choose a color and a shape. Or scan a different one to compare.') :
    card.grade === 'A' ? 'Listen to the example, then read both sentences aloud.' : 'Listen to your reading or practise again.';
  const retry = card.review.at(-1)?.action === 'retry';
  ctx.show(`<section class="wrap page-pad detail-page">
    ${back(['collection'],'Collection')}
    <div class="detail-grid">
      <div class="card-display">
        <div class="card-scene" id="card-scene" aria-label="Drag the card to tilt. Swipe up or down to flip.">
          <div class="big-card" data-grade="${card.grade}">
            <div class="card-paper card-front" data-grade="${card.grade}">${face(ctx,card)}</div>
            <div class="card-paper card-back" data-grade="${card.grade}" aria-hidden="true">
              <div class="face-top"><span>${icon('guide')} ${esc(getWord(card).name)}</span>${badge(card.grade)}</div>${cardBack(card)}</div>
          </div>
        </div>
        <div class="card-controls">${button('flip','Flip','outline','flip','aria-pressed="false"')}${button('original','Original photo','text-link','image')}</div>
        <p class="gesture-note">${icon('hand')} Drag to tilt · Swipe up or down to flip</p>
        <div class="example-strip" aria-label="Examples of this word">
          <span class="example-label">${icon('gallery')} ${1+examples.length} ${examples.length ? 'examples' : 'example'}</span>
          <div class="example-thumbs"><span class="example-thumb">${photo(ctx,card)}<b>1</b></span>
          ${examples.map((ex,i) => `<span class="example-thumb">${photo(ctx,ex)}<b>${i+2}</b></span>`).join('')}
          ${link(['scan'],'','example-add','plus','aria-label="Add a different example"')}</div>
        </div>
      </div>
      <div class="card-info">
        <div class="card-meta">${earned ? icon('check') : icon('cards')}<span>${sourceLabel[card.source]} · Grade ${card.grade}</span></div>
        <h1>${heading}</h1>
        <ol class="steps" aria-label="Grades">
          ${[['B','Collect'],['A','Describe'],['S','Speak']].map(([grade,label]) =>
            `<li data-step="${grade}" ${grade===card.grade?'aria-current="step"':''}>${badge(grade)}<span>${label}</span></li>`).join('')}
        </ol>
        <p>${step}</p>
        ${retry ? '<p class="located-message">Your teacher asked you to try again.</p>' : ''}
        <div class="actions">
          ${card.grade === 'B' ? link(['describe',card.key],'Earn A','primary','plus') : link(['speak',card.key],card.grade==='S'?'Open recordings':'Read aloud','primary','mic')}
          ${card.grade === 'B' ? link(['collection'],'Open Collection','outline','cards') : button('listen','Listen to example','outline','sound')}
        </div>
      </div>
    </div>
  </section>`);
  const stage = $('card-scene'), stopGesture = cardGesture(stage,$('flip'));
  ctx.signal.addEventListener('abort',stopGesture,{once:true});
  $('original').onclick = () => showDialog('Original photo',`<div class="original-dialog-image">${photo(ctx,card,'original')}</div><p>${sourceLabel[card.source]}</p>`);
  if (card.grade !== 'B') playExample(ctx,reading(card.key),$('listen'));
  if (earned) celebration(stage);
  if (ctx.extras.started != null) {
    Promise.resolve(stage.querySelector('img')?.decode?.()).catch(() => {}).then(() => requestAnimationFrame(() => requestAnimationFrame(() => {
      if (ctx.active()) measureSince('dex-confirm-to-card',ctx.extras.started);
    })));
  }
}
async function leaderboard(ctx) {
  const mine = studentStats(await readCards());
  if (!ctx.active()) return;
  const rows = [...classRows,{name:'Finch 07',...mine,me:true}];
  ctx.show(`<section class="wrap page-pad leaderboard">
    <div class="page-heading"><h1>Class Leaderboard</h1><p class="heading-badges">This week · resets Monday ${mode()}</p></div>
    <div class="board-tabs" role="tablist">${Object.entries(boards).map(([key,board],i) =>
      `<button type="button" role="tab" class="board-tab" id="tab-${key}" data-board="${key}" aria-selected="${i===0}">${board.label}</button>`).join('')}</div>
    <div class="panel board-table" id="board"></div>
  </section>`);
  const draw = by => {
    const ranked = rankRows(rows,by), me = ranked.find(row => row.me);
    const shown = ranked.slice(0,5), extra = me.rank > 5 ? [me] : [];
    const line = row => `<tr class="${row.me?'me-row':''}"><td><span class="rank" data-rank="${row.rank}">${row.rank<=3?icon('medal'):''}${row.rank}</span></td>
      <th scope="row">${esc(row.name)}${row.me?' <small>(you)</small>':''}</th><td><strong>${row.value}</strong> <small>${boards[by].unit}</small></td></tr>`;
    ctx.$('board').innerHTML = `<p class="board-note">${icon('spark')} ${boards[by].note}</p>
      <table aria-label="Class Leaderboard · ${boards[by].label}"><tbody>${shown.map(line).join('')}
      ${extra.length ? '<tr class="gap"><td colspan="3">…</td></tr>'+extra.map(line).join('') : ''}</tbody></table>`;
    for (const tab of main.querySelectorAll?.('.board-tab') ?? []) tab.setAttribute('aria-selected',String(tab.dataset.board===by));
  };
  for (const key of Object.keys(boards)) { const tab = ctx.$('tab-'+key); if (tab) tab.onclick = () => draw(key); }
  draw('points');
}
async function render() {
  const [page,key,subKey] = fromHash();
  const extras = transition?.target === location.hash ? transition.extras : {};
  transition = undefined;
  if (dialog.open) dialog.close();
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  const ctx = pageContext(location.hash,extras);
  window.scrollTo(0,0);
  const active = ['describe','speak','card'].includes(page) ? 'collection' : page==='scan'?'home':page;
  header(active);
  document.title = 'Classroom Dex · ' + (navigation.find(nav => nav[0]===active)?.[1] ?? 'Field guide');
  main.setAttribute('aria-busy','true');
  try {
    if (page === 'scan') scan(ctx);
    else if (page === 'collection') await collection(ctx,key);
    else if (page === 'leaderboard') await leaderboard(ctx);
    else if (page === 'teacher') await teacher(ctx,key,subKey);
    else if (['describe','speak','card'].includes(page)) {
      const card = await readCard(ME,key);
      if (!ctx.active()) return;
      if (!card) {go(['collection']); return;}
      if (page==='describe' && card.grade==='B') quiz(ctx,card);
      else if (page==='speak' && card.grade!=='B') readAloud(ctx,card);
      else detail(ctx,card);
    } else await home(ctx);
  } catch (error) {
    if (ctx.active()) ctx.show(`<section class="wrap page-pad"><h1>Could not open Classroom Dex</h1><p>${esc(error.message || 'Reload and try again.')}</p></section>`);
  }
}
window.addEventListener('hashchange',render);
window.addEventListener('pagehide',() => scope?.abort());
window.addEventListener('pageshow',event => {if (event.persisted) render();});
main.addEventListener('error',event => {
  if (event.target.tagName !== 'AUDIO') return;
  const message = event.target.closest('.audio-row')?.querySelector('.audio-error');
  if (message) message.hidden = false;
},true);
$('skip').onclick = event => {event.preventDefault(); main.focus();};
render();

// Keep the assets in memory as well, so a loaded tab works if the browser
// does not offer Service Workers or the cache is still initializing.
const keys = ['water-bottle','book','pencil','eraser'];
const files = [...keys.flatMap(key => [art(key),reading(key)]),'./assets/reading-bottle-first.wav','./assets/bottle-flat.svg'];
const embeddedMedia = files.map(async file => {
  const response = await fetch(file);
  if (!response.ok) throw Error('Asset unavailable');
  offlineAssets.set(file,URL.createObjectURL(await response.blob()));
});
Promise.all([...embeddedMedia,document.fonts?.load('italic 600 30px Fraunces')])
  .then(() => { $('offline-state').hidden = false; }).catch(() => {});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
