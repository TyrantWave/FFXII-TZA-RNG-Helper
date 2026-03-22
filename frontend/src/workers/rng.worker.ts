/// <reference lib="webworker" />

import init, { RNGHelper } from 'ffxii-tza-rng-wasm';
import type { Character, ValueLens } from '../app/services/wasm.service';

const WASM_URL = '/wasm/ffxii_tza_rng_wasm_bg.wasm';

async function setup(): Promise<void> {
  await init(WASM_URL);
}

const ready = setup();

addEventListener('message', async ({ data }) => {
  await ready;
  if (data.type !== 'findSeed') return;

  const { character, values, min, max, iters } = data as {
    type: 'findSeed';
    character: Character;
    values: number[];
    min: number;
    max: number;
    iters: number;
  };

  const result = RNGHelper.find_seed(character, values, min, max, iters);

  if (result) {
    postMessage({
      type: 'result',
      seed: result.seed(),
      values: result.values() as ValueLens[],
    });
    result.free();
  } else {
    postMessage({ type: 'result', seed: null, values: null });
  }
});
