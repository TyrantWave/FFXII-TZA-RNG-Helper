import { Component, effect, input, viewChild } from '@angular/core';
import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import type { ValueLens } from '../../services/wasm.service';

@Component({
  selector: 'tza-values-table',
  imports: [ScrollingModule],
  templateUrl: './values-table.html',
  styleUrl: './values-table.scss',
})
export class ValuesTable {
  readonly values = input<ValueLens[]>([]);
  readonly highlightRange = input<{ start: number; end: number } | null>(null);
  readonly scrollToPosition = input<number | null>(null);

  private readonly viewport = viewChild(CdkVirtualScrollViewport);

  constructor() {
    effect(() => {
      const pos = this.scrollToPosition();
      if (pos === null) return;
      const idx = this.values().findIndex(v => v.position === pos);
      if (idx >= 0) this.viewport()?.scrollToIndex(idx, 'smooth');
    });
  }

  isHighlighted(position: number): boolean {
    const r = this.highlightRange();
    return r !== null && position >= r.start && position <= r.end;
  }
}
