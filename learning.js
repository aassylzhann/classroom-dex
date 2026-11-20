import {ME,getWord,matches,newId,purposes,reading,sentence} from './data.js';
import {updateCard} from './storage.js';
import {makeRecorder,mediaProblem,openMedia,stopTracks} from './media.js';
import {scoreReading} from './services.js';
import {audioRow,back,badge,button,celebration,esc,icon,link,mode,photo,playExample,scorePanel,setStatus} from './ui.js';

const colors = ['blue','green','pink','red','white','yellow'];
const shapes = ['cylindrical','flat','rectangular','round','square','cylinder-shaped','rectangle-shaped'];
const blank = (name,options,label) => `<select name="${name}" aria-label="${label}" required><option value="">…</option>${options.map(v => `<option>${v}</option>`).join('')}</select>`;
const pick = (name,options,legend) => `<fieldset><legend>${legend}</legend><div class="chips">${options.map(([value,text]) =>
  `<label class="choice"><input type="radio" name="${name}" value="${value}" required><span>${text}</span></label>`).join('')}</div></fieldset>`;

// Constructivist B→A task: predict, compare two examples with sentence frames,
// explain why both fit the same word, then reflect on whether the idea changed.
function compare(ctx,card) {
  const word = getWord(card), noun = word.name.toLowerCase(), other = card.examples[0];
  const frame = (n,item) => `<div class="compare-item panel">
      <div class="compare-photo">${item}</div>
      <p class="frame">${word.name} ${n} is ${blank('color'+n,colors,'Color of '+noun+' '+n)} and ${blank('shape'+n,shapes,'Shape of '+noun+' '+n)}.</p></div>`;
  ctx.show(`<section class="wrap page-pad">
    ${back(['card',card.key],'Card')}
    <div class="page-heading"><h1>Compare two ${esc(noun)}s</h1><p>Describe both, then explain why they are both ${esc(noun)}s.</p></div>
    <form class="compare-form" id="quiz-form">
      <div class="panel compare-step"><span class="step-no">1</span>${pick('prediction',[['yes','Yes'],['no','No'],['unsure','Not sure']],`Think first: do all ${esc(noun)}s have the same shape?`)}</div>
      <div class="compare-pair"><span class="step-no">2</span>
        ${frame(1,photoTag(ctx,card))}${frame(2,photoTag(ctx,other))}</div>
      <div class="panel compare-step"><span class="step-no">3</span>
        <p class="frame big">They look different, but we use both to ${blank('purpose',purposes,'What we use them for')}.</p>
        <p class="muted">So they are both <strong>${esc(noun)}s</strong>.</p></div>
      <div class="panel compare-step"><span class="step-no">4</span>${pick('reflection',[['same','My idea stayed the same'],['changed','My idea changed']],'Look back at your answer in step 1.')}</div>
      <p id="quiz-status" class="feedback" role="status" hidden></p>
      <button id="check" type="submit" class="btn primary">${icon('check')}Check answers</button>
    </form></section>`);
  const form = ctx.$('quiz-form'), check = ctx.$('check'), status = ctx.$('quiz-status');
  form.onsubmit = async event => {
    event.preventDefault();
    check.disabled = true;
    const data = new FormData(form), get = key => data.get(key);
    const items = [card.reference, other];
    const wrong = [];
    items.forEach((ref,i) => {
      if (!matches(get('color'+(i+1)),ref.color)) wrong.push(`the color of ${noun} ${i+1}`);
      if (!matches(get('shape'+(i+1)),ref.shape)) wrong.push(`the shape of ${noun} ${i+1}`);
    });
    if (get('purpose') !== word.purpose) wrong.push('what we use them for');
    const answers = {color:get('color1'),shape:get('shape1'),correct:!wrong.length,
      compare:{prediction:get('prediction'),reflection:get('reflection'),purpose:get('purpose'),
        second:{color:get('color2'),shape:get('shape2')}}};
    try {
      const updated = await updateCard(ME,card.key,stored => {
        if (!ctx.active() || stored.id !== card.id) return false;
        if (stored.grade !== 'B') return true;
        stored.answers = answers;
        if (!wrong.length) { stored.grade = 'A'; clearRetry(stored); }
      });
      if (!ctx.active()) return;
      if (updated.grade !== 'B') ctx.go(['card',card.key],{earned:'A'});
      else setStatus(status,'Look again at '+wrong.join(', ')+'.',true);
    } catch { if (ctx.active()) setStatus(status,'Could not save. Try again.',true); }
    finally { check.disabled = false; }
  };
}
const photoTag = (ctx,item) => item.image ? `<img src="${esc(ctx.url(item.image))}" alt="Example photo">` : '';
function choices(name,options,last) {
  return `<fieldset><legend>${name === 'color' ? 'What color is it?' : 'What shape is it?'}</legend>
    <div class="chips">${options.map(value => `<label class="choice">
      <input type="radio" name="${name}" value="${value}" required ${value === last ? 'checked' : ''}><span>${value}</span></label>`).join('')}</div></fieldset>`;
}
function clearRetry(card) {
  if (card.review.at(-1)?.action === 'retry')
    card.review.push({action:'resubmitted',by:'Finch 07',at:Date.now()});
}
export function quiz(ctx,card) {
  if (card.examples?.length) { compare(ctx,card); return; }
  const word = getWord(card);
  ctx.show(`<section class="wrap page-pad">
    ${back(['card',card.key],'Card')}
    <div class="page-heading"><h1>Describe the ${esc(word.name.toLowerCase())}</h1><p>Pick one color and one shape to earn A.</p></div>
    <div class="lesson-grid">
      <figure class="panel original"><div class="original-image">${photo(ctx,card,'original')}</div><figcaption>Original photo</figcaption></figure>
      <form class="panel quiz" id="quiz-form">
        ${choices('color',colors,card.answers?.color)}${choices('shape',shapes,card.answers?.shape)}
        <p class="lesson-use">${icon('book')} <strong>Use</strong> ${esc(word.use)}</p>
        <p id="quiz-status" class="feedback" role="status" hidden></p>
        <button id="check" type="submit" class="btn primary">${icon('check')}Check answers</button>
      </form>
    </div></section>`);
  const form = ctx.$('quiz-form'), check = ctx.$('check'), status = ctx.$('quiz-status');
  form.onsubmit = async event => {
    event.preventDefault();
    check.disabled = true;
    const data = new FormData(form), color = data.get('color'), shape = data.get('shape');
    const colorOK = matches(color,card.reference.color), shapeOK = matches(shape,card.reference.shape);
    try {
      const updated = await updateCard(ME,card.key,stored => {
        if (!ctx.active() || stored.id !== card.id) return false;
        if (stored.grade !== 'B') return true;
        stored.answers = {color,shape,correct:colorOK && shapeOK};
        if (colorOK && shapeOK) { stored.grade = 'A'; clearRetry(stored); }
      });
      if (!ctx.active()) return;
      if (updated.grade !== 'B') ctx.go(['card',card.key],{earned:'A'});
      else setStatus(status,colorOK ? 'Good color! Try another shape.'
        : shapeOK ? 'Good shape! Try another color.' : 'Look at the photo and try both again.',true);
    } catch { if (ctx.active()) setStatus(status,'Could not save. Try again.',true); }
    finally { check.disabled = false; }
  };
}

export function readAloud(ctx,card) {
  const word = getWord(card);
  ctx.show(`<section class="wrap page-pad">
    ${back(['card',card.key],'Card')}
    <div class="page-heading"><h1>Read aloud</h1><p>Say both sentences in one recording.</p></div>
    <div class="lesson-grid voice-grid">
      <aside class="panel speaking-prompt">
        <div class="prompt-top"><strong>${esc(word.name)}</strong><span id="voice-grade">${badge(card.grade)}</span></div>
        <blockquote>${esc(sentence(card.reference)).replace('. ','.<br>')}</blockquote>
        ${button('example','Listen to example','outline','sound')}
      </aside>
      <section class="panel voice-panel" aria-label="Recording and feedback">
        <h2>Your reading</h2>
        <div class="actions">${button('record','Record','primary','mic')}${button('sample-audio','Use sample audio','outline','sound')}</div>
        <p id="record-status" class="feedback" role="status" hidden></p>
        <div id="recover" hidden>${button('retry-mic','Try microphone again','text-link','refresh')}</div>
        <div id="takes"></div>
        <div class="score-area" id="score-controls" hidden>
          <label for="score-example">Sample outcome</label>
          <select id="score-example">
            <option value="pass">Both pass</option><option value="content">Content needs work</option>
            <option value="sound">Pronunciation needs work</option><option value="unclear">Both need work</option>
          </select>
          ${button('assess','Check reading','primary','check')}
        </div>
        <div id="score-result" aria-live="polite"></div>
      </section>
    </div>
  </section>`);
  const $ = ctx.$, record = $('record'), sample = $('sample-audio'), assess = $('assess');
  const status = $('record-status'), recover = $('recover');
  let stopRecording, micRequest;
  let working = false;
  ctx.signal.addEventListener('abort',() => {micRequest?.abort(); stopRecording?.(true);},{once:true});
  const pauseExample = playExample(ctx,reading(card.key),$('example'));
  function refresh() {
    const take = card.latest ?? card.first;
    $('takes').innerHTML = audioRow(ctx,card.first,'First take') + audioRow(ctx,card.latest,'Latest take');
    $('score-result').innerHTML = scorePanel(take?.score);
    $('voice-grade').innerHTML = badge(card.grade);
    $('score-controls').hidden = !take;
    record.innerHTML = icon('mic')+(card.first ? 'Record again' : 'Record');
  }
  function lock(locked) {
    working = locked; record.disabled = locked; sample.disabled = locked;
    assess.disabled = locked; $('retry-mic').disabled = locked;
  }
  async function persist(audio,source) {
    const take = {id:newId(),audio,source,score:null,capturedAt:Date.now()};
    const saved = await updateCard(ME,card.key,stored => {
      if (!ctx.active() || stored.id !== card.id || stored.grade === 'B') return false;
      if (stored.first) stored.latest = take;
      else stored.first = take;
    });
    if (!ctx.active()) return;
    card = saved; refresh();
    setStatus(status,source === 'sample' ? 'Sample audio ready.' : 'Recording saved. You can play it back.');
  }
  async function startRecording() {
    if (stopRecording) { stopRecording(); return; }
    if (working) return;
    const request = new AbortController();
    micRequest = request;
    lock(true); recover.hidden = true; sample.disabled = false;
    setStatus(status,'Opening microphone…');
    pauseExample();
    document.querySelectorAll('audio').forEach(a => a.pause());
    let stream;
    try {
      if (typeof MediaRecorder !== 'function') throw new DOMException('Recording is unavailable.','NotSupportedError');
      stream = await openMedia({audio:true},{signal:request.signal});
      if (!ctx.active() || micRequest !== request) { stopTracks(stream); return; }
      sample.disabled = true;
      const recorder = makeRecorder(stream), chunks = [];
      let discard = false, timer;
      const start = Date.now();
      function stop(cancel = false) {
        discard = discard || cancel;
        clearInterval(timer);
        if (recorder.state !== 'inactive') recorder.stop();
        if (discard) stopTracks(stream);
        else { record.disabled = true; setStatus(status,'Saving recording…'); }
      }
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => {
        stop(true); stopRecording = undefined;
        if (ctx.active()) {
          record.classList.remove('recording');
          refresh(); lock(false); setStatus(status,'Recording failed. Try again.',true);
        }
      };
      recorder.onstop = async () => {
        clearInterval(timer); stopTracks(stream);
        if (discard || !ctx.active()) return;
        stopRecording = undefined;
        record.classList.remove('recording');
        try {
          const blob = new Blob(chunks,{type:chunks.find(chunk => chunk.type)?.type || recorder.mimeType});
          if (!blob.size) throw new Error('No audio');
          await persist(blob,'recorded');
        } catch { if (ctx.active()) setStatus(status,'Recording could not save. Try again.',true); }
        finally { if (ctx.active()) { refresh(); lock(false); } }
      };
      recorder.start();
      micRequest = undefined;
      stopRecording = stop;
      timer = setInterval(() => {
        const seconds = Math.floor((Date.now()-start)/1000);
        if (seconds >= 45) stop();
        else setStatus(status,'Recording… 0:'+String(seconds).padStart(2,'0'));
      },250);
      record.disabled = false; record.classList.add('recording');
      record.innerHTML = icon('mic')+'Stop recording';
      setStatus(status,'Recording… 0:00');
    } catch (error) {
      stopTracks(stream);
      if (ctx.active() && micRequest === request) {
        micRequest = undefined;
        lock(false); recover.hidden = false;
        setStatus(status,mediaProblem('Microphone',error),true);
      }
    }
  }
  record.onclick = $('retry-mic').onclick = startRecording;
  sample.onclick = async () => {
    micRequest?.abort(); micRequest = undefined;
    lock(true);
    try { await persist(reading(card.key),'sample'); }
    catch { if (ctx.active()) setStatus(status,'Could not load sample audio. Try again.',true); }
    finally { if (ctx.active()) lock(false); }
  };
  assess.onclick = async () => {
    const take = card.latest ?? card.first;
    if (!take || working) return;
    const previousGrade = card.grade;
    lock(true);
    try {
      const score = await scoreReading(card.reference,take,{example:$('score-example').value,signal:ctx.signal});
      const saved = await updateCard(ME,card.key,stored => {
        const current = stored.latest ?? stored.first;
        if (!ctx.active() || current?.id !== take.id || stored.id !== card.id) return false;
        current.score = score; stored.score = score;
        if (score.content && score.pronunciation) { stored.grade = 'S'; clearRetry(stored); }
      });
      if (!ctx.active()) return;
      card = saved; refresh();
      if (card.grade === 'S' && previousGrade !== 'S') {
        celebration($('voice-grade')); setStatus(status,'Grade S earned!');
      } else setStatus(status,score.content && score.pronunciation ? 'Both checks passed.' : 'Try the two sentences again.');
    } catch { if (ctx.active()) setStatus(status,'Could not check this reading. Try again.',true); }
    finally { if (ctx.active()) lock(false); }
  };
  refresh();
}
