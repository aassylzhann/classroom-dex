import { categoryKey, words, assessMock } from './data.js';
import { centerBox, cropPhoto, encode } from './media.js';
function checkAbort(signal) {
  if (signal?.aborted) throw signal.reason ?? new DOMException('Capture cancelled.','AbortError');
}

// There is deliberately no configured provider or browser-side secret.
// An optional same-origin backend adapter must supply de-duplicated eligible
// foreground instances in source-canvas pixels, then classify one crop.
export async function recognize(source, {signal, provider, timeoutMs = 5000} = {}) {
  const started = performance.now();
  if (!provider) {
    checkAbort(signal);
    return {key:'water-bottle', box:centerBox(source), mode:'Mock', latencyMs:performance.now()-started};
  }
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  signal?.addEventListener('abort',abort,{once:true});
  const timeout = setTimeout(() => controller.abort(new Error('Recognition timed out.')), timeoutMs);
  const aborted = new Promise((_,reject) => {
    const fail = () => reject(controller.signal.reason ?? new Error('Capture cancelled.'));
    if (controller.signal.aborted) fail();
    else controller.signal.addEventListener('abort',fail,{once:true});
  });
  const run = async () => {
    checkAbort(controller.signal);
    const instances = await provider.detect(await encode(source),{signal:controller.signal});
    checkAbort(controller.signal);
    if (!Array.isArray(instances) || instances.length !== 1) throw new Error('Frame one object and try again.');
    const box = instances[0].box;
    const crop = await encode(cropPhoto(source,box));
    checkAbort(controller.signal);
    const prediction = await provider.classify(crop,{signal:controller.signal});
    checkAbort(controller.signal);
    const key = categoryKey(prediction?.label), score = prediction?.providerProbability;
    if (!Object.hasOwn(words,key) || !Number.isFinite(score) || score <= .90 || score > 1)
      throw new Error('No confident word match. Take another photo.');
    return {key,box,mode:'Live',probability:score,latencyMs:performance.now()-started};
  };
  try { return await Promise.race([run(),aborted]); }
  catch (error) { error.latencyMs = performance.now()-started; throw error; }
  finally { clearTimeout(timeout); signal?.removeEventListener('abort',abort); }
}

export async function scoreReading(reference, take, {example = 'pass', provider, signal} = {}) {
  if (!provider) return assessMock(reference,example);
  // Backend verifies affirmative colour and shape from ASR independently
  // of the specialist pronunciation service. Both return explicit booleans.
  const [content,speech] = await Promise.all([
    provider.checkContent(take.audio,reference,{signal}),
    provider.checkPronunciation(take.audio,reference,{signal}),
  ]);
  checkAbort(signal);
  return {mode:'Live',transcript:content.transcript,content:content.pass === true,
    pronunciation:speech.pass === true,time:Date.now(),takeId:take.id};
}
