export const ME = 'finch-07';
export const SAMPLE_STUDENT = 'wren-12';
export const ARCHIVE = 'earlier';
export const pupils = { [ME]: 'Finch 07', [SAMPLE_STUDENT]: 'Wren 12', [ARCHIVE]: 'Earlier cards' };
const assets = './assets/';
export const words = {
  'water-bottle': { name: 'Water Bottle', image: 'bottle', color: 'blue', shape: 'cylindrical', use: 'It holds water.', purpose: 'carry water' },
  book: { name: 'Book', image: 'book', color: 'green', shape: 'rectangular', use: 'We read it.', purpose: 'read' },
  pencil: { name: 'Pencil', image: 'pencil', color: 'yellow', shape: 'cylindrical', use: 'We write with it.', purpose: 'write' },
  eraser: { name: 'Eraser', image: 'eraser', color: 'pink', shape: 'rectangular', use: 'It rubs out pencil marks.', purpose: 'rub out mistakes' },
};
// A second sample object of the same word, so the comparison task can be rehearsed.
export const secondSample = { key: 'water-bottle', path: assets + 'bottle-flat.svg', color: 'white', shape: 'flat' };
export const purposes = ['carry water', 'read', 'write', 'rub out mistakes'];
export function makeExample(source, original, image, ref) {
  return { id: newId(), source, original, image, color: ref.color, shape: ref.shape, addedAt: Date.now() };
}
// Points reward language use (A, S) and exploring new examples more than collecting.
export const gradePoints = { B: 1, A: 3, S: 5 };
export const EXAMPLE_POINTS = 2;
export function studentStats(cards) {
  let points = 0, improved = 0, examples = 0;
  for (const card of cards) {
    const extra = card.examples?.length ?? 0;
    points += gradePoints[card.grade] + extra * EXAMPLE_POINTS;
    improved += {B:0, A:1, S:2}[card.grade];
    examples += 1 + extra;
  }
  return { points, improved, examples };
}
const categoryAliases = { bottle: 'water-bottle', 'water bottle': 'water-bottle', 'water-bottle': 'water-bottle' };
const equivalent = { 'flat-shaped': 'flat', 'cylinder-shaped': 'cylindrical', 'cylinder shaped': 'cylindrical', cylinder: 'cylindrical',
  'rectangle-shaped': 'rectangular', 'rectangle shaped': 'rectangular', rectangle: 'rectangular' };
export function categoryKey(label) {
  const value = String(label ?? '').trim().toLowerCase();
  return Object.hasOwn(categoryAliases, value) ? categoryAliases[value] : value;
}
export function matches(answer, expected) {
  const normalized = String(answer ?? '').trim().toLowerCase();
  return Boolean(expected && (equivalent[normalized] ?? normalized) === expected);
}
export function getWord(card) { return words[card.key] ?? {name: card.name || 'Word card', ...card.reference}; }
export const art = key => assets + words[key].image + '.jpg';
export const reading = key => assets + 'reading-' + words[key].image + '.wav';
export const sentence = ref => 'It’s ' + ref.color + '. It’s ' + ref.shape + '.';
export const sourceLabel = { camera: 'Camera photo', device: 'Device photo', upload: 'Selected photo', sample: 'Sample photo', archive: 'Earlier photo' };
export function newId() {
  const api = globalThis.crypto;
  if (api?.randomUUID) return api.randomUUID();
  if (api?.getRandomValues) return Array.from(api.getRandomValues(new Uint32Array(4)),
    number => number.toString(16).padStart(8,'0')).join('');
  return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
}
export const firstName = owner => pupils[owner] || 'Student';
// Classmates this week: points, upgrades earned (improved), photos explored.
export const classRows = [
  {name:'Robin 03', points:24, improved:5, examples:9}, {name:'Heron 09', points:27, improved:7, examples:8},
  {name:'Swift 11', points:19, improved:6, examples:11}, {name:'Wren 12', points:24, improved:4, examples:7},
  {name:'Lark 05', points:15, improved:8, examples:6}, {name:'Jay 02', points:6, improved:2, examples:4},
  {name:'Kite 14', points:11, improved:3, examples:10}, {name:'Owl 08', points:9, improved:5, examples:3},
];
export const boards = {
  points: {label:'Points', unit:'pts', note:'B 1 · A 3 · S 5 · new example +2'},
  improved: {label:'Most improved', unit:'upgrades', note:'Every B→A or A→S upgrade this week'},
  examples: {label:'Explorer', unit:'photos', note:'Different objects photographed this week'},
};
export function rankRows(rows, by = 'points') {
  const sorted = [...rows].sort((a,b) => b[by]-a[by] || a.name.localeCompare(b.name));
  let rank = 0;
  return sorted.map((row,i) => {
    if (!i || row[by] !== sorted[i-1][by]) rank = i+1;
    return {...row, value: row[by], rank};
  });
}
export function assessMock(ref, example) {
  const content = example !== 'content' && example !== 'unclear';
  const pronunciation = example !== 'sound' && example !== 'unclear';
  return { mode: 'Mock', transcript: content ? sentence(ref) : 'It’s ' + ref.color + '.',
    content, pronunciation, time: Date.now(), example };
}
export function makeCard(owner, key, source, original, image, createdAt = Date.now()) {
  key = categoryKey(key);
  const {color,shape} = words[key];
  return {owner, key, id:newId(), name: words[key].name, grade:'B', source, original, image, createdAt,
    reference:{color,shape}, recognition:'Mock', answers:null, examples:[], first:null, latest:null, review:[], score:null};
}
function seedTake(key, first) {
  const ref = words[key];
  return {id: 'seed-' + key + (first ? '-first' : '-latest'), source:'sample',
    audio: first && key === 'water-bottle' ? assets + 'reading-bottle-first.wav' : reading(key),
    score: assessMock(ref, first && key === 'water-bottle' ? 'sound' : 'pass')};
}
export function seeds() {
  const rows = [[ME,'book','S',3],[ME,'pencil','A',2],[ME,'eraser','B',1],[SAMPLE_STUDENT,'water-bottle','S',2]];
  return rows.map(([owner,key,grade,order]) => {
    const card = makeCard(owner,key,'sample',art(key),art(key),order);
    card.grade = grade;
    if (grade !== 'B') card.answers = {...card.reference, correct:true};
    if (grade === 'S') {
      card.first = seedTake(key, true);
      if (owner === SAMPLE_STUDENT) card.latest = seedTake(key, false);
      card.score = (card.latest ?? card.first).score;
    }
    return card;
  });
}
