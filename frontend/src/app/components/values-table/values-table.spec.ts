import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { expect, describe, it, beforeEach, vi } from 'vitest';
import { Component, signal } from '@angular/core';
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { ValuesTable } from './values-table';
import type { ValueLens } from '../../services/wasm.service';

const SAMPLE_VALUES: ValueLens[] = [
  { position: 1, value: 1288459236, spell: 2065, chest: 36 },
  { position: 2, value: 2139177191, spell: 2262, chest: 91 },
  { position: 3, value: 74803024, spell: 2205, chest: 24 },
  { position: 4, value: 999999999, spell: 2100, chest: 50 },
  { position: 5, value: 888888888, spell: 2150, chest: 75 },
];

@Component({
  template: `<tza-values-table
    [values]="values()"
    [highlightRange]="highlightRange()"
    [pivotPosition]="pivotPosition()"
    (rowClick)="lastClick = $event"
  />`,
  imports: [ValuesTable],
})
class TestHost {
  values = signal<ValueLens[]>([]);
  highlightRange = signal<{ start: number; end: number } | null>(null);
  pivotPosition = signal<number | null>(null);
  lastClick: number | null = null;
}

describe('ValuesTable', () => {
  let host: TestHost;
  let el: HTMLElement;
  let fixture: ReturnType<typeof TestBed.createComponent<TestHost>>;
  let scrollSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHost] }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
    await new Promise(r => setTimeout(r, 50));
    // Suppress JSDOM el.scrollTo errors for all tests; scroll tests read this spy.
    const viewport = fixture.debugElement.query(By.directive(CdkVirtualScrollViewport))
      ?.componentInstance as CdkVirtualScrollViewport;
    if (viewport) {
      scrollSpy = vi.spyOn(viewport, 'scrollToIndex').mockImplementation(() => {});
    }
  });

  // ── rendering ─────────────────────────────────────────────────────────────

  it('renders no rows when values is empty', () => {
    expect(el.querySelectorAll('[data-testid="values-row"]').length).toBe(0);
  });

  it('renders a row for each value', async () => {
    host.values.set(SAMPLE_VALUES);
    await new Promise(r => setTimeout(r, 50));
    expect(el.querySelectorAll('[data-testid="values-row"]').length).toBe(5);
  });

  it('displays position, heal, and chest in each row', async () => {
    host.values.set(SAMPLE_VALUES);
    await new Promise(r => setTimeout(r, 50));
    const row = el.querySelector('[data-testid="values-row"]') as HTMLElement;
    expect(row.textContent).toContain('1');    // position
    expect(row.textContent).toContain('2065'); // heal
    expect(row.textContent).toContain('36');   // chest
  });

  it('shows column headers including Heal', () => {
    expect(el.textContent).toContain('Position');
    expect(el.textContent).toContain('Heal');
    expect(el.textContent).toContain('Chest %');
  });

  // ── pivot: next ───────────────────────────────────────────────────────────

  it('applies no next/past class when pivotPosition is null', async () => {
    host.values.set(SAMPLE_VALUES);
    await new Promise(r => setTimeout(r, 50));
    const rows = el.querySelectorAll('[data-testid="values-row"]');
    rows.forEach(r => {
      expect(r.classList.contains('next')).toBe(false);
      expect(r.classList.contains('past')).toBe(false);
    });
  });

  it('applies next class only to the pivot row', async () => {
    host.values.set(SAMPLE_VALUES);
    host.pivotPosition.set(3);
    fixture.detectChanges();
    await new Promise(r => setTimeout(r, 50));
    const rows = el.querySelectorAll('[data-testid="values-row"]');
    expect(rows[0].classList.contains('next')).toBe(false); // pos 1
    expect(rows[1].classList.contains('next')).toBe(false); // pos 2
    expect(rows[2].classList.contains('next')).toBe(true);  // pos 3 — pivot
    expect(rows[3].classList.contains('next')).toBe(false); // pos 4
  });

  it('applies past class to all rows before the pivot', async () => {
    host.values.set(SAMPLE_VALUES);
    host.pivotPosition.set(3);
    fixture.detectChanges();
    await new Promise(r => setTimeout(r, 50));
    const rows = el.querySelectorAll('[data-testid="values-row"]');
    expect(rows[0].classList.contains('past')).toBe(true);  // pos 1
    expect(rows[1].classList.contains('past')).toBe(true);  // pos 2
    expect(rows[2].classList.contains('past')).toBe(false); // pos 3 — pivot
    expect(rows[3].classList.contains('past')).toBe(false); // pos 4
    expect(rows[4].classList.contains('past')).toBe(false); // pos 5
  });

  // ── highlight ─────────────────────────────────────────────────────────────

  it('applies highlighted class to rows within the highlightRange', async () => {
    host.values.set(SAMPLE_VALUES);
    host.highlightRange.set({ start: 1, end: 2 });
    fixture.detectChanges();
    await new Promise(r => setTimeout(r, 50));
    const rows = el.querySelectorAll('[data-testid="values-row"]');
    expect(rows[0].classList.contains('highlighted')).toBe(true);  // pos 1
    expect(rows[1].classList.contains('highlighted')).toBe(true);  // pos 2
    expect(rows[2].classList.contains('highlighted')).toBe(false);  // pos 3
  });

  it('combines past and highlighted on matched rows before pivot', async () => {
    host.values.set(SAMPLE_VALUES);
    host.highlightRange.set({ start: 1, end: 2 });
    host.pivotPosition.set(4); // rows 1-2 are past AND highlighted
    fixture.detectChanges();
    await new Promise(r => setTimeout(r, 50));
    const rows = el.querySelectorAll('[data-testid="values-row"]');
    expect(rows[0].classList.contains('past')).toBe(true);
    expect(rows[0].classList.contains('highlighted')).toBe(true);
    expect(rows[1].classList.contains('past')).toBe(true);
    expect(rows[1].classList.contains('highlighted')).toBe(true);
    expect(rows[2].classList.contains('past')).toBe(true);       // pos 3 — past, not highlighted
    expect(rows[2].classList.contains('highlighted')).toBe(false);
  });

  // ── rowClick ──────────────────────────────────────────────────────────────

  it('emits rowClick with the row position when a row is clicked', async () => {
    host.values.set(SAMPLE_VALUES);
    await new Promise(r => setTimeout(r, 50));
    const rows = el.querySelectorAll('[data-testid="values-row"]');
    (rows[1] as HTMLElement).click();
    expect(host.lastClick).toBe(2); // position of second row
  });

  it('emits rowClick for past rows too', async () => {
    host.values.set(SAMPLE_VALUES);
    host.pivotPosition.set(4);
    fixture.detectChanges();
    await new Promise(r => setTimeout(r, 50));
    const rows = el.querySelectorAll('[data-testid="values-row"]');
    (rows[0] as HTMLElement).click();
    expect(host.lastClick).toBe(1);
  });

  // ── scroll ────────────────────────────────────────────────────────────────

  it('positions pivot at visual index 3 (3 past rows above it)', async () => {
    const manyValues: ValueLens[] = Array.from({ length: 15 }, (_, i) => ({
      position: i + 1, value: i, spell: 2000 + i, chest: i,
    }));
    host.values.set(manyValues);
    await new Promise(r => setTimeout(r, 50));
    scrollSpy.mockClear();
    // pivot=12 → anchor=11 at idx=10 → scroll to max(0, 10-2)=8
    // viewport row 8 is at top; pivot(12) lands at visual index 3
    host.pivotPosition.set(12);
    fixture.detectChanges();
    await new Promise(r => setTimeout(r, 50));
    expect(scrollSpy).toHaveBeenCalledWith(8, 'smooth');
  });

  it('scrolls to index 0 when pivot is within first 3 rows', async () => {
    host.values.set(SAMPLE_VALUES);
    await new Promise(r => setTimeout(r, 50));
    scrollSpy.mockClear();
    host.pivotPosition.set(2); // anchor=1, idx=0 → max(0, 0-2) = 0
    fixture.detectChanges();
    await new Promise(r => setTimeout(r, 50));
    expect(scrollSpy).toHaveBeenCalledWith(0, 'smooth');
  });

  it('does not scroll when pivotPosition is null', async () => {
    host.values.set(SAMPLE_VALUES);
    await new Promise(r => setTimeout(r, 50));
    scrollSpy.mockClear();
    host.pivotPosition.set(null);
    fixture.detectChanges();
    await new Promise(r => setTimeout(r, 50));
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it('scrolls using the clicked row as anchor when pivot is not yet in values', async () => {
    // Regression: clicking the last buffered row sets pivot = lastPos + 1, which does
    // not exist in values yet (pushed asynchronously). Scroll must still fire using
    // the anchor (pivot - 1 = clicked row), which IS always present.
    host.values.set(SAMPLE_VALUES); // positions 1-5
    await new Promise(r => setTimeout(r, 50));
    scrollSpy.mockClear();
    host.pivotPosition.set(6); // pivot beyond values; anchor = 5 (idx 4, scroll to max(0,4-2)=2)
    fixture.detectChanges();
    await new Promise(r => setTimeout(r, 50));
    expect(scrollSpy).toHaveBeenCalledWith(2, 'smooth');
  });
});
