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
];

@Component({
  template: `<tza-values-table
    [values]="values()"
    [highlightRange]="highlightRange()"
    [scrollToPosition]="scrollToPosition()"
  />`,
  imports: [ValuesTable],
})
class TestHost {
  values = signal<ValueLens[]>([]);
  highlightRange = signal<{ start: number; end: number } | null>(null);
  scrollToPosition = signal<number | null>(null);
}

describe('ValuesTable', () => {
  let host: TestHost;
  let el: HTMLElement;
  let fixture: ReturnType<typeof TestBed.createComponent<TestHost>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHost] }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  // ── rendering ─────────────────────────────────────────────────────────────

  it('renders no rows when values is empty', () => {
    expect(el.querySelectorAll('[data-testid="values-row"]').length).toBe(0);
  });

  it('renders a row for each value', async () => {
    host.values.set(SAMPLE_VALUES);
    await new Promise(r => setTimeout(r, 50));
    expect(el.querySelectorAll('[data-testid="values-row"]').length).toBe(3);
  });

  it('displays position, spell, and chest in each row', async () => {
    host.values.set(SAMPLE_VALUES);
    await new Promise(r => setTimeout(r, 50));
    const row = el.querySelector('[data-testid="values-row"]') as HTMLElement;
    expect(row.textContent).toContain('1');    // position
    expect(row.textContent).toContain('2065'); // spell
    expect(row.textContent).toContain('36');   // chest
  });

  it('shows column headers', () => {
    expect(el.textContent).toContain('Position');
    expect(el.textContent).toContain('Spell');
    expect(el.textContent).toContain('Chest %');
  });

  // ── highlight ─────────────────────────────────────────────────────────────

  it('applies no highlighted class when highlightRange is null', async () => {
    host.values.set(SAMPLE_VALUES);
    await new Promise(r => setTimeout(r, 50));
    const rows = el.querySelectorAll('[data-testid="values-row"]');
    rows.forEach(r => expect(r.classList.contains('highlighted')).toBe(false));
  });

  it('applies highlighted class to rows within the range', async () => {
    host.values.set(SAMPLE_VALUES);
    host.highlightRange.set({ start: 1, end: 2 });
    fixture.detectChanges();
    await new Promise(r => setTimeout(r, 50));
    const rows = el.querySelectorAll('[data-testid="values-row"]');
    expect(rows[0].classList.contains('highlighted')).toBe(true);  // pos 1
    expect(rows[1].classList.contains('highlighted')).toBe(true);  // pos 2
    expect(rows[2].classList.contains('highlighted')).toBe(false); // pos 3
  });

  it('does not highlight rows outside the range', async () => {
    host.values.set(SAMPLE_VALUES);
    host.highlightRange.set({ start: 3, end: 3 });
    fixture.detectChanges();
    await new Promise(r => setTimeout(r, 50));
    const rows = el.querySelectorAll('[data-testid="values-row"]');
    expect(rows[0].classList.contains('highlighted')).toBe(false);
    expect(rows[1].classList.contains('highlighted')).toBe(false);
    expect(rows[2].classList.contains('highlighted')).toBe(true);
  });

  // ── scroll ────────────────────────────────────────────────────────────────

  it('calls scrollToIndex with the correct index when scrollToPosition changes', async () => {
    host.values.set(SAMPLE_VALUES);
    await new Promise(r => setTimeout(r, 50));
    const viewport = fixture.debugElement.query(By.directive(CdkVirtualScrollViewport)).componentInstance as CdkVirtualScrollViewport;
    const spy = vi.spyOn(viewport, 'scrollToIndex').mockImplementation(() => {});
    host.scrollToPosition.set(2);
    fixture.detectChanges();
    await new Promise(r => setTimeout(r, 50));
    expect(spy).toHaveBeenCalledWith(1, 'smooth'); // position 2 is at index 1
  });

  it('does not scroll when scrollToPosition is null', async () => {
    host.values.set(SAMPLE_VALUES);
    await new Promise(r => setTimeout(r, 50));
    const viewport = fixture.debugElement.query(By.directive(CdkVirtualScrollViewport)).componentInstance as CdkVirtualScrollViewport;
    const spy = vi.spyOn(viewport, 'scrollToIndex').mockImplementation(() => {});
    host.scrollToPosition.set(null);
    fixture.detectChanges();
    await new Promise(r => setTimeout(r, 50));
    expect(spy).not.toHaveBeenCalled();
  });
});
