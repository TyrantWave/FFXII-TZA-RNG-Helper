import { TestBed } from '@angular/core/testing';
import { expect, describe, it, beforeEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ControlsPanel } from './controls-panel';
import type { SearchStatus } from '../../services/wasm.service';

@Component({
  template: `<tza-controls-panel
    [searchStatus]="searchStatus()"
    [(browseSeed)]="seed"
    (findSeed)="findSeedEmit = $event"
    (findPosition)="findPositionEmit = $event"
  />`,
  imports: [ControlsPanel],
})
class TestHost {
  searchStatus = signal<SearchStatus>('idle');
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

  // ── status label ──────────────────────────────────────────────────────────

  it('hides status label when idle', () => {
    expect(el.querySelector('[data-testid="search-status"]')).toBeFalsy();
  });

  const statusCases: [SearchStatus, string][] = [
    ['searching', 'Searching'],
    ['found', 'Found'],
    ['notfound', 'Not found'],
  ];

  for (const [status, expected] of statusCases) {
    it(`shows "${expected}" when status is ${status}`, async () => {
      host.searchStatus.set(status);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(el.querySelector('[data-testid="search-status"]')?.textContent).toContain(expected);
    });
  }

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
