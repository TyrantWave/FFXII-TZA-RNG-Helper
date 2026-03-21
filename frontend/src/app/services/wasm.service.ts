import { Injectable, computed, resource, signal } from '@angular/core';
import init, { RNGHelper } from 'ffxii-tza-rng-wasm';

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

  private helper: RNGHelper | null = null;

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

  private refresh(): void {
    if (!this.helper) return;
    this._values.set(this.helper.values() as ValueLens[]);
    this._seed.set(this.helper.seed());
    this._position.set(this.helper.position());
  }
}
