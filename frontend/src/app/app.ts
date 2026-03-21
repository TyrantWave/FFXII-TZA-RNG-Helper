import { Component, effect, inject, signal } from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { WasmService, DEFAULT_SEED, TABLE_SIZE, type Character } from './services/wasm.service';
import { DEFAULT_CHARACTER, CharacterPanel } from './components/character-panel/character-panel';
import { ControlsPanel, type Mode } from './components/controls-panel/controls-panel';
import { ValuesTable } from './components/values-table/values-table';

@Component({
  selector: 'app-root',
  imports: [MatDividerModule, CharacterPanel, ControlsPanel, ValuesTable],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly wasm = inject(WasmService);

  readonly character = signal<Character>(DEFAULT_CHARACTER);
  readonly mode = signal<Mode>('browse');

  constructor() {
    effect(() => {
      if (!this.wasm.isReady()) return;
      this.wasm.createHelper(DEFAULT_SEED, this.character(), TABLE_SIZE);
    });
  }

  onCharacterChange(c: Character): void {
    this.character.set(c);
    this.wasm.applyCharacter(c);
  }

  onBrowse(event: { seed: number }): void {
    this.wasm.createHelper(event.seed, this.character(), TABLE_SIZE);
  }

  onFindSeed(event: { values: number[]; min: number; max: number; iters: number }): void {
    this.wasm.findSeed(this.character(), event.values, event.min, event.max, event.iters);
  }

  onFindPosition(event: { seed: number; values: number[] }): void {
    this.wasm.createHelper(event.seed, this.character(), TABLE_SIZE);
    this.wasm.findCasts(this.character(), event.values);
  }
}
