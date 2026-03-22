import { Component, effect, inject, signal } from '@angular/core';
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

  constructor() {
    effect(() => {
      if (!this.wasm.isReady()) return;
      this.wasm.createHelper(DEFAULT_SEED, this.character(), TABLE_SIZE);
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
    this.wasm.findSeed(this.character(), values, DEFAULT_MIN, DEFAULT_MAX, DEFAULT_ITERS);
  }

  onFindPosition({ values }: { values: number[] }): void {
    this.wasm.createHelper(this.browseSeed(), this.character(), TABLE_SIZE);
    this.wasm.findCasts(this.character(), values, DEFAULT_ITERS);
  }
}
