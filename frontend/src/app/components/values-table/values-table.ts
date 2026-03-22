import { Component, effect, input, output, untracked, viewChild } from '@angular/core';
import { NgClass } from '@angular/common';
import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import type { ValueLens } from '../../services/wasm.service';

@Component({
  selector: 'tza-values-table',
  imports: [ScrollingModule, NgClass],
  templateUrl: './values-table.html',
  styleUrl: './values-table.scss',
})
export class ValuesTable {
  readonly values = input<ValueLens[]>([]);
  readonly highlightRange = input<{ start: number; end: number } | null>(null);
  readonly pivotPosition = input<number | null>(null);
  readonly rowClick = output<number>();

  private readonly viewport = viewChild(CdkVirtualScrollViewport);

  constructor() {
    effect(() => {
      const pivot = this.pivotPosition();
      if (pivot === null) return;
      // Scroll anchor is the clicked row (pivot - 1), which is always present in values.
      // pivot itself may not exist yet if new rows are still being pushed.
      // max(0, anchorIdx - 9) === max(0, pivotIdx - 10) once pivot is rendered.
      // Anchor = pivot - 1 (clicked row), always present in values.
      // Scroll so anchor is at visual index 2 → pivot lands at index 3 (3 past rows visible above it).
      const anchorIdx = untracked(this.values).findIndex(v => v.position === pivot - 1);
      this.viewport()?.scrollToIndex(Math.max(0, anchorIdx < 0 ? 0 : anchorIdx - 2), 'smooth');
    });
  }

  rowClasses(pos: number): Record<string, boolean> {
    const pivot = this.pivotPosition();
    const r = this.highlightRange();
    return {
      past: pivot !== null && pos < pivot,
      next: pivot !== null && pos === pivot,
      highlighted: r !== null && pos >= r.start && pos <= r.end,
    };
  }
}
