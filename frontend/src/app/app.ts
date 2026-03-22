import { Component, computed, effect, inject, signal } from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { WasmService, DEFAULT_SEED, DEFAULT_MIN, DEFAULT_MAX, DEFAULT_ITERS, TABLE_SIZE, type Character } from './services/wasm.service';
import { DEFAULT_CHARACTER, CharacterPanel } from './components/character-panel/character-panel';
import { ControlsPanel } from './components/controls-panel/controls-panel';
import { ValuesTable } from './components/values-table/values-table';


@Component({
  selector: 'tza-root',
  imports: [MatDividerModule, CharacterPanel, ControlsPanel, ValuesTable],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly wasm = inject(WasmService);

  readonly character = signal<Character>(DEFAULT_CHARACTER);
  readonly browseSeed = signal(DEFAULT_SEED);
  readonly initialHeals = this.parseHeals();

  private readonly lastSearchCount = signal(0);

  readonly highlightRange = computed(() => {
    if (this.wasm.searchStatus() !== 'found') return null;
    const count = this.lastSearchCount();
    const vals = this.wasm.values();
    if (count === 0 || vals.length < count) return null;
    return { start: vals[0].position, end: vals[count - 1].position };
  });

  constructor() {
    effect(() => {
      if (!this.wasm.isReady()) return;
      this.wasm.createHelper(DEFAULT_SEED, this.character(), TABLE_SIZE);
      if (this.initialHeals.length) {
        this.lastSearchCount.set(this.initialHeals.length);
        this.wasm.findSeed(this.character(), this.initialHeals, DEFAULT_MIN, DEFAULT_MAX, DEFAULT_ITERS);
      }
    });
    effect(() => {
      if (this.wasm.searchStatus() !== 'found') return;
      this.browseSeed.set(this.wasm.seed() ?? DEFAULT_SEED);
    });
  }

  onCharacterChange(c: Character): void {
    this.character.set(c);
    this.wasm.applyCharacter(c);
  }

  onFindSeed({ values }: { values: number[] }): void {
    this.lastSearchCount.set(values.length);
    this.wasm.findSeed(this.character(), values, DEFAULT_MIN, DEFAULT_MAX, DEFAULT_ITERS);
  }

  onFindPosition({ values }: { values: number[] }): void {
    this.lastSearchCount.set(values.length);
    this.wasm.createHelper(this.browseSeed(), this.character(), 2 * TABLE_SIZE + values.length);
    this.wasm.findCasts(this.character(), values, DEFAULT_ITERS);
  }

  private parseHeals(): number[] {
    const raw = new URLSearchParams(window.location.search).get('heals') ?? '';
    return raw ? raw.split(',').map(Number).filter(n => !isNaN(n)) : [];
  }
}
