import { Injectable, computed, resource, signal } from '@angular/core';
import init, { RNGHelper } from 'ffxii-tza-rng-wasm';

export const DEFAULT_SEED = 4537;
export const TABLE_SIZE = 100;

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

  private helper: RNGHelper | null = null;
  private worker: Worker | null = null;

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
    if (!this.worker) {
      this.worker = new Worker(new URL('../../workers/rng.worker', import.meta.url), { type: 'module' });
      this.worker.onmessage = ({ data }) => this.handleWorkerResult(data, character);
    }
    this.searchStatus.set('searching');
    this.worker.postMessage({ type: 'findSeed', character, values, min, max, iters });
  }

  private handleWorkerResult(data: { seed: number | null }, character: Character): void {
    if (data.seed !== null) {
      this.createHelper(data.seed, character, TABLE_SIZE);
      this.searchStatus.set('found');
    } else {
      this.searchStatus.set('notfound');
    }
  }

  private refresh(): void {
    if (!this.helper) return;
    this._values.set(this.helper.values() as ValueLens[]);
    this._seed.set(this.helper.seed());
    this._position.set(this.helper.position());
  }
}
