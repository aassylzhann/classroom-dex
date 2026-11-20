import {ARCHIVE,ME,SAMPLE_STUDENT,firstName,getWord} from './data.js';
import {readCard,readCards,updateCard} from './storage.js';
import {audioRow,back,badge,button,esc,href,icon,link,photo,scorePanel,setStatus} from './ui.js';

export async function teacher(ctx,owner,key) {
  const [current,sample,early] = await Promise.all([readCards(ME),readCards(SAMPLE_STUDENT),readCards(ARCHIVE)]);
  const pupils = [[ME,current],[SAMPLE_STUDENT,sample],...(early.length ? [[ARCHIVE,early]] : [])];
  const selected = pupils.find(pupil => pupil[0] === owner)?.[1];
  const detail = key && selected ? await readCard(owner,key) : null;
  if (!ctx.active()) return;
  if (owner && !selected) {ctx.go(['teacher']); return;}
  const nav = pupils.map(([id,cards]) => `<a class="pupil ${id===owner?'active':''}" href="${href('teacher',id)}" ${id===owner?'aria-current="page"':''}>
    <span class="avatar ${id===ME?'finch':'wren'}">${id===ARCHIVE?icon('cards'):id===ME?'F7':'W12'}</span>
    <span><strong>${firstName(id)}</strong><small>${cards.length} ${cards.length===1?'card':'cards'}${id===ME?' · This browser':''}</small></span>${icon('next','pupil-next')}</a>`).join('');
  const lists = selected ? `<div class="panel teacher-cards"><div class="section-top"><h2>${firstName(owner)}</h2><span class="count">${selected.length} cards</span></div>
    <div class="review-list">${selected.map(card => `<a href="${href('teacher',owner,card.key)}" class="review-item">
      <div class="review-thumb">${photo(ctx,card)}</div><span><strong>${esc(getWord(card).name)}</strong><small>${card.first?'Recording saved':'Word card'}</small></span>
      ${badge(card.grade)}${icon('next','pupil-next')}</a>`).join('') || '<p>No cards saved.</p>'}</div></div>`
    : `<div class="panel teacher-intro"><div class="feature-icon">${icon('sound')}</div><h2>Listen and review</h2>
      <p>Choose a student to see cards, answers and recordings.</p>${link(['teacher',SAMPLE_STUDENT,'water-bottle'],'Open sample record','outline','play')}</div>`;
  ctx.show(`<section class="wrap page-pad teacher-page">
    ${detail ? back(['teacher',owner],'Student cards') : ''}
    <div class="page-heading"><h1>${detail ? esc(getWord(detail).name) : 'Teacher review'}</h1>
      <p>${detail ? firstName(owner)+' · Teacher review' : 'Review saved cards and listen to readings.'}</p></div>
    <div class="teacher-layout"><aside class="panel pupils" aria-label="Students"><h2>Students</h2>${nav}</aside>
      ${detail ? reviewDetail(ctx,detail) : lists}</div></section>`);
  if (!detail || owner === ARCHIVE) return;
  const review = ctx.$('review'), retry = ctx.$('retry'), status = ctx.$('review-status');
  async function mark(action) {
    review.disabled = retry.disabled = true;
    try {
      const saved = await updateCard(owner,key,stored => {
        if (!ctx.active() || stored.id !== detail.id) return false;
        stored.review.push({action,by:'Owl T1',at:Date.now()});
        if (action === 'retry' && stored.grade === 'S') stored.grade = 'A';
      });
      if (!ctx.active()) return;
      ctx.$('teacher-grade').innerHTML = badge(saved.grade);
      ctx.$('current-review').textContent = reviewText(saved.review.at(-1));
      setStatus(status,action === 'retry' ? 'Retry requested.' : 'Review saved.');
    } catch { if (ctx.active()) setStatus(status,'Could not save review. Try again.',true); }
    finally { review.disabled = retry.disabled = false; }
  }
  review.onclick = () => mark('reviewed');
  retry.onclick = () => mark('retry');
}
function reviewText(review) {
  if (!review) return 'Awaiting review';
  const labels = {reviewed:'Reviewed',retry:'Retry requested',resubmitted:'Resubmitted'};
  return labels[review.action]+' · '+review.by;
}
function reviewDetail(ctx,card) {
  const answer = card.answers;
  const score = (card.latest ?? card.first)?.score;
  const firstScore = card.latest && card.first?.score;
  return `<article class="detail-record">
    <div class="panel record-summary">
      <figure class="original compact"><div class="original-image">${photo(ctx,card,'original')}</div><figcaption>Original photo</figcaption></figure>
      <div class="answers">
        <div class="answer-top"><h2>Student answers</h2><span id="teacher-grade">${badge(card.grade)}</span></div>
        <dl><div><dt>Color</dt><dd>${esc(answer?.color ?? '—')}</dd></div><div><dt>Shape</dt><dd>${esc(answer?.shape ?? '—')}</dd></div></dl>
        ${answer?.compare ? `<div class="teacher-compare"><strong>Comparison · ${1+(card.examples?.length??0)} examples</strong>
          <p>Example 2 is ${esc(answer.compare.second.color)} and ${esc(answer.compare.second.shape)}. “We use both to ${esc(answer.compare.purpose)}.”</p>
          <p class="muted">Prediction: ${esc({yes:'all the same shape',no:'shapes can differ',unsure:'not sure'}[answer.compare.prediction] ?? '—')} · Idea ${esc(answer.compare.reflection === 'changed' ? 'changed' : 'stayed the same')}</p></div>` : ''}
        <p class="review-state" id="current-review">${esc(reviewText(card.review.at(-1)))}</p>
      </div>
    </div>
    <div class="panel listen-review">
      <h2>Listen to the reading</h2>${audioRow(ctx,card.first,'First take')}${audioRow(ctx,card.latest,'Latest take')}
      ${card.first ? '' : '<p class="muted">No recording yet.</p>'}${scorePanel(score)}
      ${firstScore ? `<details class="earlier-score"><summary>First take assessment</summary>${scorePanel(firstScore)}</details>` : ''}
      ${card.owner === ARCHIVE ? '' : `<div class="actions review-actions">${button('review','Mark reviewed','primary','check')}${button('retry','Request retry','outline','flag')}</div><p class="feedback" id="review-status" role="status" hidden></p>`}
    </div>
  </article>`;
}
