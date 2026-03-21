import { TestBed } from '@angular/core/testing';
import { expect, describe, it, beforeEach, vi } from 'vitest';
import { Component, signal } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ControlsPanel, type Mode } from './controls-panel';
import type { SearchStatus } from '../../services/wasm.service';

type BrowseEvent = { seed: number };
type FindSeedEvent = { values: number[]; min: number; max: number; iters: number };
type FindPositionEvent = { seed: number; values: number[] };

@Component({
  template: `<app-controls-panel
    [mode]="mode()"
    [searchStatus]="searchStatus()"
    (modeChange)="mode.set($event)"
    (browse)="browseEmit = $event"
    (findSeed)="findSeedEmit = $event"
    (findPosition)="findPositionEmit = $event"
  />`,
  imports: [ControlsPanel],
})
class TestHost {
  mode = signal<Mode>('browse');
  searchStatus = signal<SearchStatus>('idle');
  browseEmit: BrowseEvent | null = null;
  findSeedEmit: FindSeedEvent | null = null;
  findPositionEmit: FindPositionEvent | null = null;
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

  // ── mode selector ──────────────────────────────────────────────────────────

  it('renders a mode selector', () => {
    expect(el.querySelector('[data-testid="mode-selector"]')).toBeTruthy();
  });

  it('shows Browse, Find Seed, and Find Position buttons', () => {
    const text = el.textContent!;
    expect(text).toContain('Browse');
    expect(text).toContain('Find Seed');
    expect(text).toContain('Find Position');
  });

  // ── browse mode ───────────────────────────────────────────────────────────

  describe('browse mode', () => {
    it('shows seed input', () => {
      expect(el.querySelector('[data-testid="browse-seed"]')).toBeTruthy();
    });

    it('shows Load button', () => {
      expect(el.querySelector('[data-testid="browse-load"]')).toBeTruthy();
    });

    it('emits browse event with seed on Load click', async () => {
      const input = el.querySelector<HTMLInputElement>('[data-testid="browse-seed"]')!;
      input.value = '4537';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      el.querySelector<HTMLButtonElement>('[data-testid="browse-load"]')!.click();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(host.browseEmit?.seed).toBe(4537);
    });
  });

  // ── find seed mode ─────────────────────────────────────────────────────────

  describe('find seed mode', () => {
    beforeEach(async () => {
      host.mode.set('findSeed');
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('shows at least one observed value input', () => {
      expect(el.querySelector('[data-testid="observed-value-0"]')).toBeTruthy();
    });

    it('shows up to 5 observed value inputs', () => {
      const inputs = el.querySelectorAll('[data-testid^="observed-value-"]');
      expect(inputs.length).toBe(5);
    });

    it('shows min, max, and iters inputs', () => {
      expect(el.querySelector('[data-testid="find-seed-min"]')).toBeTruthy();
      expect(el.querySelector('[data-testid="find-seed-max"]')).toBeTruthy();
      expect(el.querySelector('[data-testid="find-seed-iters"]')).toBeTruthy();
    });

    it('shows Find Seed button', () => {
      expect(el.querySelector('[data-testid="find-seed-submit"]')).toBeTruthy();
    });

    it('emits findSeed event with entered values on submit', async () => {
      const obs0 = el.querySelector<HTMLInputElement>('[data-testid="observed-value-0"]')!;
      obs0.value = '2065';
      obs0.dispatchEvent(new Event('input'));

      const minInput = el.querySelector<HTMLInputElement>('[data-testid="find-seed-min"]')!;
      minInput.value = '0';
      minInput.dispatchEvent(new Event('input'));

      const maxInput = el.querySelector<HTMLInputElement>('[data-testid="find-seed-max"]')!;
      maxInput.value = '16777216';
      maxInput.dispatchEvent(new Event('input'));

      const itersInput = el.querySelector<HTMLInputElement>('[data-testid="find-seed-iters"]')!;
      itersInput.value = '100';
      itersInput.dispatchEvent(new Event('input'));

      fixture.detectChanges();
      el.querySelector<HTMLButtonElement>('[data-testid="find-seed-submit"]')!.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(host.findSeedEmit?.values).toEqual([2065]);
      expect(host.findSeedEmit?.min).toBe(0);
      expect(host.findSeedEmit?.max).toBe(16777216);
      expect(host.findSeedEmit?.iters).toBe(100);
    });

    it('shows searching status when searchStatus is searching', async () => {
      host.searchStatus.set('searching');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(el.querySelector('[data-testid="search-status"]')?.textContent).toContain('Searching');
    });

    it('shows found status when searchStatus is found', async () => {
      host.searchStatus.set('found');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(el.querySelector('[data-testid="search-status"]')?.textContent).toContain('Found');
    });

    it('shows not found status when searchStatus is notfound', async () => {
      host.searchStatus.set('notfound');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(el.querySelector('[data-testid="search-status"]')?.textContent).toContain('Not found');
    });
  });

  // ── find position mode ─────────────────────────────────────────────────────

  describe('find position mode', () => {
    beforeEach(async () => {
      host.mode.set('findPosition');
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('shows seed input', () => {
      expect(el.querySelector('[data-testid="find-pos-seed"]')).toBeTruthy();
    });

    it('shows up to 5 observed value inputs', () => {
      expect(el.querySelectorAll('[data-testid^="find-pos-value-"]').length).toBe(5);
    });

    it('shows Find Position button', () => {
      expect(el.querySelector('[data-testid="find-pos-submit"]')).toBeTruthy();
    });

    it('emits findPosition event with seed and values on submit', async () => {
      const seedInput = el.querySelector<HTMLInputElement>('[data-testid="find-pos-seed"]')!;
      seedInput.value = '4537';
      seedInput.dispatchEvent(new Event('input'));

      const val0 = el.querySelector<HTMLInputElement>('[data-testid="find-pos-value-0"]')!;
      val0.value = '2065';
      val0.dispatchEvent(new Event('input'));

      fixture.detectChanges();
      el.querySelector<HTMLButtonElement>('[data-testid="find-pos-submit"]')!.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(host.findPositionEmit?.seed).toBe(4537);
      expect(host.findPositionEmit?.values).toEqual([2065]);
    });
  });
});
