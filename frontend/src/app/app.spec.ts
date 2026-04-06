import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { computed, signal } from '@angular/core';
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { vi, expect, describe, it, beforeEach } from 'vitest';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { App } from './app';
import { WasmService, type ValueLens, type SearchStatus } from './services/wasm.service';
import { MapService } from './services/map.service';

const mockMapService = {
  indexResource: { status: signal('idle' as const), value: signal(undefined), error: signal(undefined), isLoading: computed(() => false) },
  areas: signal([]),
};

const mockWasm = {
  isReady: vi.fn(() => false),
  status: vi.fn(() => 'loading'),
  searchStatus: vi.fn(() => 'idle' as const),
  elapsedSeconds: vi.fn(() => 0),
  values: vi.fn(() => []),
  seed: vi.fn(() => null),
  position: vi.fn(() => 0),
  createHelper: vi.fn(),
  applyCharacter: vi.fn(),
  findSeed: vi.fn(),
  findCasts: vi.fn(() => false),
  push: vi.fn(),
};

describe('App', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [App, NoopAnimationsModule],
    })
      .overrideProvider(WasmService, { useValue: mockWasm })
      .overrideProvider(MapService, { useValue: mockMapService })
      .compileComponents();
  });

  it('creates the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders controls column', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.controls-column')).toBeTruthy();
  });

  it('renders table column', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.table-column')).toBeTruthy();
  });

  it('calls createHelper with default seed when WASM becomes ready', async () => {
    mockWasm.isReady.mockReturnValue(true);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(mockWasm.createHelper).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({ level: 70, magic: 99 }),
      expect.any(Number),
    );
  });

  it('onRowClick sets pivotPosition to pos + 1', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.onRowClick(5);
    expect(app.pivotPosition()).toBe(6);
  });

  it('onRowClick calls push until 100 rows follow the new pivot', () => {
    // 2 rows exist at positions >= newPivot (5,6); need 98 more
    const twoRows: ValueLens[] = [
      { position: 5, value: 0, spell: 0, chest: 0 },
      { position: 6, value: 0, spell: 0, chest: 0 },
    ];
    (mockWasm.values as ReturnType<typeof vi.fn>).mockReturnValue(twoRows);
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.onRowClick(4); // newPivot = 5
    expect(mockWasm.push).toHaveBeenCalledTimes(98);
  });
});

// ── Reactive pivot stability ──────────────────────────────────────────────────
// Uses real Angular signals so the highlightRange computed and search-found effect
// can be exercised. The plain vi.fn() mock above cannot trigger Angular's reactive graph.

describe('App — pivotPosition is not reset by push() after a row click', () => {
  let valuesSignal: ReturnType<typeof signal<ValueLens[]>>;
  let searchStatusSignal: ReturnType<typeof signal<SearchStatus>>;

  beforeEach(async () => {
    valuesSignal = signal<ValueLens[]>([]);
    searchStatusSignal = signal<SearchStatus>('idle');

    await TestBed.configureTestingModule({
      imports: [App, NoopAnimationsModule],
    })
      .overrideProvider(MapService, { useValue: mockMapService })
      .overrideProvider(WasmService, {
        useValue: {
          isReady: signal(false),
          status: signal('loading'),
          searchStatus: searchStatusSignal,
          elapsedSeconds: signal(0),
          values: valuesSignal,
          seed: signal(null),
          position: signal(0),
          createHelper: vi.fn(),
          applyCharacter: vi.fn(),
          findSeed: vi.fn(),
          findCasts: vi.fn(() => false),
          push: vi.fn(),
        },
      })
      .compileComponents();
  });

  it('highlightRange equal keeps pivot stable when the values array grows', async () => {
    const matchRows: ValueLens[] = [
      { position: 1, value: 0, spell: 100, chest: 0 },
      { position: 2, value: 0, spell: 100, chest: 0 },
    ];
    valuesSignal.set(matchRows);

    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    // Suppress JSDOM's missing scrollTo — ValuesTable scroll effect fires during this test
    fixture.detectChanges();
    const viewport = fixture.debugElement.query(By.directive(CdkVirtualScrollViewport))
      ?.componentInstance as CdkVirtualScrollViewport | undefined;
    if (viewport) vi.spyOn(viewport, 'scrollToIndex').mockReturnValue(undefined);

    // Simulate lastSearchCount = 2 (private signal, accessed for test only)
    (app as unknown as { lastSearchCount: ReturnType<typeof signal<number>> })[
      'lastSearchCount'
    ].set(2);

    // Trigger the search-found effect
    searchStatusSignal.set('found');
    fixture.detectChanges();
    await fixture.whenStable();

    // Effect fires: pivot = vals[1].position + 1 = 3
    expect(app.pivotPosition()).toBe(3);

    // User clicks row 10
    app.onRowClick(10);
    expect(app.pivotPosition()).toBe(11);

    // Simulate push: new rows appended — start/end of the match window unchanged
    valuesSignal.set([...matchRows, { position: 3, value: 0, spell: 100, chest: 0 }]);
    fixture.detectChanges();
    await fixture.whenStable();

    // Without the equal function, highlightRange would produce a new {start:1, end:2}
    // object, re-fire the effect, and reset pivotPosition to 3.
    expect(app.pivotPosition()).toBe(11);
  });
});
