import { Injectable, computed, resource, signal } from '@angular/core';
import init, { RNGHelper } from 'ffxii-tza-rng-wasm';

export const DEFAULT_SEED = 4537;
export const TABLE_SIZE = 100;
export const DEFAULT_MIN = 6_000_000;
export const DEFAULT_MAX = 16_777_216;
export const DEFAULT_ITERS = 500;

export type SearchStatus = 'idle' | 'searching' | 'found' | 'notfound';

export interface Character {
  level: number;
  magic: number;
  spell: 'Cure' | 'Cura' | 'Curaga' | 'Curaja';
  serenity: boolean;
}

export interface ValueLens {
  position: number;
  value: number;
  spell: number;
  chest: number;
}

@Injectable({ providedIn: 'root' })
export class WasmService {
  private readonly initResource = resource({
    loader: () => init('/wasm/ffxii_tza_rng_wasm_bg.wasm'),
  });

  readonly status = computed(() => this.initResource.status());
  readonly isReady = computed(() => this.initResource.status() === 'resolved');

  readonly searchStatus = signal<SearchStatus>('idle');
  readonly elapsedSeconds = signal(0);

  private helper: RNGHelper | null = null;
  private workers: Worker[] = [];
  private elapsedTimer: ReturnType<typeof setInterval> | null = null;
  private searchStart = 0;

  private readonly _values = signal<ValueLens[]>([]);
  private readonly _seed = signal<number | null>(null);
  private readonly _position = signal<number>(0);

  readonly values = this._values.asReadonly();
  readonly seed = this._seed.asReadonly();
  readonly position = this._position.asReadonly();

  createHelper(seed: number | null, character: Character, iters: number): void {
    this.helper?.free();
    this.helper = new RNGHelper(seed ?? undefined, character, iters);
    this.refresh();
  }

  push(character: Character): void {
    this.helper?.push(character);
    this.refresh();
  }

  next(character: Character): void {
    this.helper?.next(character);
    this.refresh();
  }

  applyCharacter(character: Character): void {
    this.helper?.apply_character(character);
    this.refresh();
  }

  findCasts(character: Character, values: number[], limit?: number): boolean {
    if (!this.helper) return false;
    const found = this.helper.find_casts(character, values, limit ?? null);
    if (found) this.refresh();
    return found;
  }

  findSeed(character: Character, values: number[], min: number, max: number, iters: number): void {
    this.workers.forEach((w) => w.terminate());
    this.workers = [];
    if (this.elapsedTimer) clearInterval(this.elapsedTimer);
    this.elapsedSeconds.set(0);
    this.searchStart = Date.now();
    this.elapsedTimer = setInterval(() => {
      this.elapsedSeconds.set(Math.floor((Date.now() - this.searchStart) / 1000));
    }, 1000);
    this.searchStatus.set('searching');

    const n = navigator.hardwareConcurrency ?? 4;
    const chunk = Math.ceil((max - min) / n);
    let pending = n;
    let won = false;

    for (let i = 0; i < n; i++) {
      const wMin = min + i * chunk;
      const wMax = Math.min(wMin + chunk, max);
      const w = new Worker(new URL('../../workers/rng.worker', import.meta.url), {
        type: 'module',
      });
      this.workers.push(w);
      w.onmessage = ({ data }) => {
        if (won) return;
        pending--;
        if (data.seed !== null) {
          won = true;
          this.workers.forEach((w) => w.terminate());
          this.workers = [];
          clearInterval(this.elapsedTimer!);
          this.elapsedTimer = null;
          this.createHelper(data.seed, character, 2 * TABLE_SIZE + values.length);
          this.findCasts(character, values, DEFAULT_ITERS);
          this.searchStatus.set('found');
        } else if (pending === 0) {
          clearInterval(this.elapsedTimer!);
          this.elapsedTimer = null;
          this.searchStatus.set('notfound');
        }
      };
      w.postMessage({ type: 'findSeed', character, values, min: wMin, max: wMax, iters });
    }
  }

  private refresh(): void {
    if (!this.helper) return;
    this._values.set(this.helper.values() as ValueLens[]);
    this._seed.set(this.helper.seed());
    this._position.set(this.helper.position());
  }
}
