// Generic emote controller: one shared playback framework for every emote.
// Emotes are pure data (catalog `emotes[].anim`: start/frames/fps/loop plus
// icon/sfx/fx/preview fields). The controller reads that data and drives any
// Animator consistently: play / stop / restart / loop / one-shot / switch /
// fallback, with a single logical emote per controller token at a time.
import { store } from './store.js';
import { ANIMS } from './anim.js';

const state = { current: null, token: 0 };

export const emoteKey = (id) => 'e_' + String(id).replace('emote_', '');

export function emoteData(id) {
  const list = (store.catalog && store.catalog.emotes) || [];
  return list.find((e) => e.id === id) || null;
}
export function hasEmote(id) { return !!ANIMS[emoteKey(id)]; }

/** Play an emote on `anim`. Returns true when the asset exists.
 *  Loop emotes run until stop/switch; one-shots return to idle on end. */
export function playEmote(anim, id, opts = {}) {
  if (!anim) return false;
  const key = emoteKey(id);
  const A = ANIMS[key];
  state.current = id;
  state.token++;
  if (!A) { // missing asset fallback: never show a broken sprite
    anim.setAnim('idle');
    return false;
  }
  const oneShot = A.loop === false;
  anim.setAnim(key, oneShot ? () => {
    if (state.current === id) {
      state.current = null;
      anim.setAnim('idle');
      if (opts.onDone) opts.onDone();
    }
  } : undefined);
  if (opts.sfx !== false) {
    const d = emoteData(id);
    if (d && d.sfx && typeof window !== 'undefined' && window.__emoteSfx) window.__emoteSfx(d.sfx);
  }
  return true;
}

export function stopEmote(anim) {
  state.current = null;
  state.token++;
  if (anim) anim.setAnim('idle');
}

export function restartEmote(anim, id, opts) {
  stopEmote(anim);
  return playEmote(anim, id, opts);
}

export const currentEmote = () => state.current;
