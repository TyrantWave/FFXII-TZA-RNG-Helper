import { TestBed } from '@angular/core/testing';
import { expect, describe, it, beforeEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ControlsPanel } from './controls-panel';
import type { SearchStatus } from '../../services/wasm.service';

@Component({
  template: `<tza-controls-panel
    [searchStatus]="searchStatus()"
    [elapsedSeconds]="elapsed()"
    [position]="position()"
    [(browseSeed)]="seed"
    (findSeed)="findSeedEmit = $event"
    (findPosition)="findPositionEmit = $event"
  />`,
  imports: [ControlsPanel],
})
class TestHost {
  searchStatus = signal<SearchStatus>('idle');
  elapsed = signal(0);
  position = signal(0);
  seed = signal(4537);
  findSeedEmit: { values: number[] } | null = null;
  findPositionEmit: { values: number[] } | null = null;
}

describe('ControlsPanel', () => {
  let host: TestHost;
  let el: HTMLElement;
  let fixture: ReturnType<typeof TestBed.createComponent<TestHost>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost, NoopAnimationsModule],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  // ── layout ────────────────────────────────────────────────────────────────

  it('renders seed input', () => {
    expect(el.querySelector('[data-testid="seed-input"]')).toBeTruthy();
  });

  it('renders 5 heal value inputs', () => {
    const inputs = el.querySelectorAll('[data-testid^="heal-"]');
    expect(inputs.length).toBe(5);
  });

  it('renders Find Seed and Find Position buttons', () => {
    expect(el.querySelector('[data-testid="find-seed-btn"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="find-position-btn"]')).toBeTruthy();
  });

  it('reflects browseSeed input in the seed field', () => {
    host.seed.set(9999);
    fixture.detectChanges();
    const input = el.querySelector<HTMLInputElement>('[data-testid="seed-input"]')!;
    expect(+input.value).toBe(9999);
  });

  // ── Find Seed button ──────────────────────────────────────────────────────

  describe('Find Seed', () => {
    it('emits only non-null values', async () => {
      enterHeal(0, '2065');
      enterHeal(2, '2205');
      fixture.detectChanges();
      click('find-seed-btn');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(host.findSeedEmit?.values).toEqual([2065, 2205]);
    });

    it('emits empty values when no heals entered', async () => {
      click('find-seed-btn');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(host.findSeedEmit?.values).toEqual([]);
    });
  });

  // ── Find Position button ──────────────────────────────────────────────────

  describe('Find Position', () => {
    it('emits non-null values', async () => {
      enterHeal(0, '2255');
      enterHeal(1, '2063');
      fixture.detectChanges();
      click('find-position-btn');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(host.findPositionEmit?.values).toEqual([2255, 2063]);
    });
  });

  // ── status card ───────────────────────────────────────────────────────────

  it('hides status card when idle', () => {
    expect(el.querySelector('[data-testid="status-card"]')).toBeFalsy();
  });

  it('shows status card when searching', async () => {
    host.searchStatus.set('searching');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelector('[data-testid="status-card"]')).toBeTruthy();
  });

  it('shows progress bar and elapsed while searching', async () => {
    host.searchStatus.set('searching');
    host.elapsed.set(4);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelector('mat-progress-bar')).toBeTruthy();
    expect(el.querySelector('[data-testid="status-card"]')?.textContent).toContain('4s');
  });

  it('shows found message with seed and position', async () => {
    host.searchStatus.set('found');
    host.elapsed.set(7);
    host.position.set(42);
    fixture.detectChanges();
    await fixture.whenStable();
    const card = el.querySelector('[data-testid="status-card"]')!;
    expect(card.textContent).toContain('Found');
    expect(card.textContent).toContain('42');
    expect(card.textContent).toContain('7s');
  });

  it('shows notfound message with elapsed', async () => {
    host.searchStatus.set('notfound');
    host.elapsed.set(12);
    fixture.detectChanges();
    await fixture.whenStable();
    const card = el.querySelector('[data-testid="status-card"]')!;
    expect(card.textContent).toContain('Not found');
    expect(card.textContent).toContain('12s');
  });

  // ── helpers ───────────────────────────────────────────────────────────────

  function enterHeal(index: number, value: string): void {
    const input = el.querySelector<HTMLInputElement>(`[data-testid="heal-${index}"]`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function click(testId: string): void {
    el.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)!.click();
  }
});
