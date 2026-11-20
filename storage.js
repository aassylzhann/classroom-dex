import { ARCHIVE, ME, SAMPLE_STUDENT, categoryKey, seeds } from './data.js';
let database, sessionCards;
const table = 'fieldGuideCards';
const sessionKey = (owner,key) => JSON.stringify([owner,categoryKey(key)]);
const restricted = new Set(['SecurityError','NotAllowedError','InvalidStateError','UnknownError','NotSupportedError']);
export function temporaryStorage() { return Boolean(sessionCards); }
function seedSession() {
  for (const card of seeds()) sessionCards.set(sessionKey(card.owner,card.key),card);
}

// Keep the original prototype's database and its v1 cards store intact.
function connectStorage() {
  database ??= new Promise((resolve,reject) => {
    const factory = globalThis.indexedDB;
    if (!factory) { reject(new DOMException('Storage is unavailable.','NotSupportedError')); return; }
    const request = factory.open('classroom-dex', 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('cards')) db.createObjectStore('cards', {keyPath:'id'});
      if (!db.objectStoreNames.contains(table)) {
        const cards = db.createObjectStore(table,{keyPath:['owner','key']});
        cards.createIndex('owner','owner');
        for (const card of seeds()) cards.add(card);
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); database = undefined; };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close older Classroom Dex tabs, then reload.'));
  }).catch(error => {
    if (restricted.has(error?.name)) {
      sessionCards = new Map();
      seedSession();
      return null;
    }
    database = undefined;
    throw error;
  });
  return database;
}
function result(request) {
  return new Promise((resolve,reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function legacyCard(row) {
  const key = categoryKey(row.name);
  const audio = (blob, id) => blob ? {audio:blob, id, source:'recorded', score:null} : null;
  return {owner:ARCHIVE, key:String(row.id), category:key, name:row.name,
    grade: row.speakingComplete ? 'S' : row.details ? 'A' : 'B',
    original:row.original, image:row.pixel ?? row.original, source:'archive', createdAt:row.createdAt,
    answers:row.details ? {color:row.details.colour, shape:row.details.shape} : null,
    reference:null, first:audio(row.firstRecording,'original'), latest:audio(row.revisedRecording,'revised'), review:[]};
}
export async function readCards(owner = ME) {
  const db = await connectStorage();
  if (!db) return [...sessionCards.values()].filter(card => card.owner === owner)
    .sort((a,b) => b.createdAt-a.createdAt).map(card => structuredClone(card));
  const rows = owner === ARCHIVE
    ? (await result(db.transaction('cards').objectStore('cards').getAll())).map(legacyCard)
    : await result(db.transaction(table).objectStore(table).index('owner').getAll(owner));
  return rows.sort((a,b) => b.createdAt - a.createdAt);
}
export async function readCard(owner, key) {
  const db = await connectStorage();
  if (!db) return structuredClone(sessionCards.get(sessionKey(owner,key)));
  if (owner === ARCHIVE) return (await readCards(owner)).find(row => row.key === key);
  return result(db.transaction(table).objectStore(table).get([owner,categoryKey(key)]));
}
// Both the uniqueness decision and the insert happen in the same write transaction.
export async function collect(card, active) {
  card = {...card,key:categoryKey(card.key)};
  const db = await connectStorage();
  if (!db) {
    if (!active()) throw new Error('Capture cancelled.');
    const key = sessionKey(card.owner,card.key);
    const saved = sessionCards.get(key);
    if (saved) return {card:structuredClone(saved),created:false};
    sessionCards.set(key,structuredClone(card));
    return {card,created:true};
  }
  return new Promise((resolve,reject) => {
    const tx = db.transaction(table,'readwrite'), store = tx.objectStore(table);
    let created = false;
    let saved;
    const request = store.get([card.owner,card.key]);
    request.onsuccess = () => {
      if (!active()) { tx.abort(); return; }
      saved = request.result ?? card;
      if (!request.result) { store.add(card); created = true; }
    };
    tx.oncomplete = () => resolve({card:saved,created});
    tx.onabort = () => reject(tx.error ?? new Error('Capture cancelled.'));
  });
}
export async function updateCard(owner, key, edit) {
  const db = await connectStorage();
  if (!db) {
    const address = sessionKey(owner,key);
    const updated = structuredClone(sessionCards.get(address));
    if (!updated || edit(updated) === false) throw new Error('The card changed. Open it again.');
    sessionCards.set(address,structuredClone(updated));
    return updated;
  }
  return new Promise((resolve,reject) => {
    const tx = db.transaction(table,'readwrite'), store = tx.objectStore(table);
    const request = store.get([owner,key]);
    let updated;
    request.onsuccess = () => {
      updated = request.result;
      if (!updated || edit(updated) === false) { tx.abort(); return; }
      store.put(updated);
    };
    tx.oncomplete = () => resolve(updated);
    tx.onabort = () => reject(tx.error ?? new Error('The card changed. Open it again.'));
  });
}
export async function resetRehearsal() {
  const db = await connectStorage();
  if (!db) {
    for (const [key,card] of sessionCards) {
      if (card.owner === ME || card.owner === SAMPLE_STUDENT) sessionCards.delete(key);
    }
    seedSession();
    return;
  }
  return new Promise((resolve,reject) => {
    const tx = db.transaction(table,'readwrite'), store = tx.objectStore(table);
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        if (cursor.value.owner === ME || cursor.value.owner === SAMPLE_STUDENT) cursor.delete();
        cursor.continue();
      } else { for (const card of seeds()) store.add(card); }
    };
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
  });
}
