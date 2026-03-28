import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { MatDividerModule } from '@angular/material/divider';
import {
  WasmService,
  DEFAULT_SEED,
  DEFAULT_MIN,
  DEFAULT_MAX,
  DEFAULT_ITERS,
  TABLE_SIZE,
  type Character,
} from './services/wasm.service';
import { DEFAULT_CHARACTER, CharacterPanel } from './components/character-panel/character-panel';
import { ControlsPanel } from './components/controls-panel/controls-panel';
import { ValuesTable } from './components/values-table/values-table';

@Component({
  selector: 'tza-root',
  imports: [MatDividerModule, CharacterPanel, ControlsPanel, ValuesTable],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  readonly wasm = inject(WasmService);
  private readonly _document = inject(DOCUMENT);

  readonly character = signal<Character>(DEFAULT_CHARACTER);
  readonly browseSeed = signal(DEFAULT_SEED);
  readonly initialHeals = this.parseHeals();

  private readonly lastSearchCount = signal(0);
  readonly pivotPosition = signal<number | null>(null);

  readonly highlightRange = computed(
    () => {
      if (this.wasm.searchStatus() !== 'found') return null;
      const count = this.lastSearchCount();
      const vals = this.wasm.values();
      if (count === 0 || vals.length < count) return null;
      return { start: vals[0].position, end: vals[count - 1].position };
    },
    {
      // Pushing rows extends the buffer but never changes start/end of the match window.
      // Without this, every push creates a new object, re-fires the search-found effect,
      // and resets pivotPosition back to the initial post-search value.
      equal: (a, b) =>
        a === b || (a !== null && b !== null && a.start === b.start && a.end === b.end),
    },
  );

  constructor() {
    effect(() => {
      if (!this.wasm.isReady()) return;
      this.wasm.createHelper(DEFAULT_SEED, untracked(this.character), TABLE_SIZE);
      if (this.initialHeals.length) {
        this.lastSearchCount.set(this.initialHeals.length);
        this.wasm.findSeed(
          untracked(this.character),
          this.initialHeals,
          DEFAULT_MIN,
          DEFAULT_MAX,
          DEFAULT_ITERS,
        );
      }
    });
    effect(() => {
      if (this.wasm.searchStatus() !== 'found') return;
      this.browseSeed.set(this.wasm.seed() ?? DEFAULT_SEED);
      const r = this.highlightRange();
      if (r) this.pivotPosition.set(r.end + 1);
    });
    effect(() => {
      if (!this.wasm.isReady()) return;
      this.wasm.applyCharacter(this.character());
    });
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

  onRowClick(pos: number): void {
    const newPivot = pos + 1;
    this.pivotPosition.set(newPivot);
    const vals = this.wasm.values();
    const rowsAfter = vals.filter((v) => v.position >= newPivot).length;
    const needed = Math.max(0, TABLE_SIZE - rowsAfter);
    for (let i = 0; i < needed; i++) {
      this.wasm.push(this.character());
    }
  }

  private parseHeals(): number[] {
    const raw =
      new URLSearchParams(this._document.defaultView?.location.search ?? '').get('heals') ?? '';
    return raw
      ? raw
          .split(',')
          .map(Number)
          .filter((n) => !isNaN(n))
      : [];
  }
}
