import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { expect, describe, it, beforeEach, afterEach } from 'vitest';
import { Component } from '@angular/core';
import { MapBrowser } from './map-browser';
import type { AreaEntry, MapData } from '../../services/map.service';

const SAMPLE_INDEX: AreaEntry[] = [
  {
    slug: 'barheim-passage',
    name: 'Barheim Passage',
    sub_areas: [
      { slug: 'east-west-bypass', name: 'East-West Bypass' },
      { slug: 'op-sector-36', name: 'Op Sector 36' },
    ],
  },
  {
    slug: 'lhusu-mines',
    name: 'Lhusu Mines',
    sub_areas: [{ slug: 'site-1', name: 'Site 1' }],
  },
];

const SAMPLE_MAP_DATA: MapData = {
  area: 'Barheim Passage',
  sub_area: 'East-West Bypass',
  image: 'east-west-bypass.jpg',
  chests: [
    {
      id: 46,
      respawn: true,
      spawn_pct: 90,
      gil_pct: 50,
      gil_max: 360,
      items: ['Bio Mote', 'Gladius'],
      items_da: ['Knot of Rust', 'Meteorite (A)'],
    },
    {
      id: 47,
      respawn: false,
      spawn_pct: 100,
      gil_pct: 100,
      gil_max: 250,
      items: ['Antidote'],
    },
  ],
};

const MAP_DATA_NO_DA: MapData = {
  ...SAMPLE_MAP_DATA,
  chests: SAMPLE_MAP_DATA.chests.map(({ items_da: _, ...c }) => c),
};

const MAP_DATA_WITH_POSITIONS: MapData = {
  ...SAMPLE_MAP_DATA,
  chests: [
    { ...SAMPLE_MAP_DATA.chests[0], position: { x: 25, y: 40 } },
    { ...SAMPLE_MAP_DATA.chests[1], position: { x: 60, y: 75 } },
  ],
};

const MAP_DATA_PARTIAL_POSITIONS: MapData = {
  ...SAMPLE_MAP_DATA,
  chests: [
    { ...SAMPLE_MAP_DATA.chests[0], position: { x: 25, y: 40 } },
    { ...SAMPLE_MAP_DATA.chests[1] },
  ],
};

@Component({
  template: `<tza-map-browser />`,
  imports: [MapBrowser],
})
class TestHost {}

async function settle(ms = 50): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

describe('MapBrowser', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<TestHost>>;
  let el: HTMLElement;
  let httpMock: HttpTestingController;

  async function setup(flushIndex = true): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [TestHost],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TestHost);
    el = fixture.nativeElement;
    fixture.detectChanges();

    if (flushIndex) {
      httpMock.expectOne('/assets/maps/index.json').flush(SAMPLE_INDEX);
      fixture.detectChanges();
      await settle();
    }
  }

  afterEach(() => {
    httpMock.verify();
  });

  // ── area loading ─────────────────────────────────────────────────────────

  it('populates area select after index loads', async () => {
    await setup();
    const options = el.querySelectorAll('[data-testid="area-select"] option');
    // First option is placeholder "— select —"
    expect(options.length).toBe(3);
    expect(options[1].textContent?.trim()).toBe('Barheim Passage');
    expect(options[2].textContent?.trim()).toBe('Lhusu Mines');
  });

  it('shows no sub-areas before an area is selected', async () => {
    await setup();
    const options = el.querySelectorAll('[data-testid="sub-area-select"] option');
    expect(options.length).toBe(1); // placeholder only
  });

  // ── sub-area switching ───────────────────────────────────────────────────

  it('populates sub-area select when area is chosen', async () => {
    await setup();
    const areaSelect = el.querySelector<HTMLSelectElement>('[data-testid="area-select"]')!;
    areaSelect.value = 'barheim-passage';
    areaSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await settle();

    const options = el.querySelectorAll('[data-testid="sub-area-select"] option');
    expect(options.length).toBe(3); // placeholder + 2 sub-areas
    expect(options[1].textContent?.trim()).toBe('East-West Bypass');
    expect(options[2].textContent?.trim()).toBe('Op Sector 36');
  });

  it('resets sub-area when area changes', async () => {
    await setup();
    const areaSelect = el.querySelector<HTMLSelectElement>('[data-testid="area-select"]')!;

    areaSelect.value = 'barheim-passage';
    areaSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const subSelect = el.querySelector<HTMLSelectElement>('[data-testid="sub-area-select"]')!;
    subSelect.value = 'east-west-bypass';
    subSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    // Change area — params() returns undefined, resource goes idle; in-flight request cancelled
    areaSelect.value = 'lhusu-mines';
    areaSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await settle();

    // Consume the cancelled request so httpMock.verify() doesn't complain
    httpMock.match('/assets/maps/barheim-passage/east-west-bypass.json').forEach((r) => {
      if (!r.cancelled) r.flush(null);
    });

    const subOptions = el.querySelectorAll('[data-testid="sub-area-select"] option');
    expect(subOptions.length).toBe(2); // placeholder + site-1
  });

  // ── empty state ──────────────────────────────────────────────────────────

  it('shows empty state when no sub-area is selected', async () => {
    await setup();
    expect(el.querySelector('[data-testid="empty-state"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="chest-table"]')).toBeNull();
  });

  // ── chest table ──────────────────────────────────────────────────────────

  async function loadSubArea(mapData = SAMPLE_MAP_DATA): Promise<void> {
    const areaSelect = el.querySelector<HTMLSelectElement>('[data-testid="area-select"]')!;
    areaSelect.value = 'barheim-passage';
    areaSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const subSelect = el.querySelector<HTMLSelectElement>('[data-testid="sub-area-select"]')!;
    subSelect.value = 'east-west-bypass';
    subSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    httpMock
      .expectOne('/assets/maps/barheim-passage/east-west-bypass.json')
      .flush(mapData);
    fixture.detectChanges();
    await settle();
  }

  it('renders a row per chest after sub-area loads', async () => {
    await setup();
    await loadSubArea();
    const rows = el.querySelectorAll('[data-testid="chest-row"]');
    expect(rows.length).toBe(2);
  });

  it('shows correct chest id and spawn percentage', async () => {
    await setup();
    await loadSubArea();
    const rows = el.querySelectorAll('[data-testid="chest-row"]');
    expect(rows[0].textContent).toContain('46');
    expect(rows[0].textContent).toContain('90%');
  });

  it('shows items in rows', async () => {
    await setup();
    await loadSubArea();
    const rows = el.querySelectorAll('[data-testid="chest-row"]');
    expect(rows[0].textContent).toContain('Bio Mote');
    expect(rows[0].textContent).toContain('Gladius');
  });

  // ── map image ────────────────────────────────────────────────────────────

  it('renders map image with correct src when image field is set', async () => {
    await setup();
    await loadSubArea();
    const img = el.querySelector<HTMLImageElement>('[data-testid="map-image"]');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe(
      '/assets/maps/barheim-passage/east-west-bypass.jpg',
    );
  });

  it('does not render map image container when image field is absent', async () => {
    await setup();
    const noImageData: MapData = { ...SAMPLE_MAP_DATA, image: '' };
    await loadSubArea(noImageData);
    expect(el.querySelector('[data-testid="map-image-container"]')).toBeNull();
  });

  // ── SVG chest markers ─────────────────────────────────────────────────────

  it('renders a marker for each chest with a position', async () => {
    await setup();
    await loadSubArea(MAP_DATA_WITH_POSITIONS);
    const markers = el.querySelectorAll('[data-testid="chest-marker"]');
    expect(markers.length).toBe(2);
  });

  it('omits markers for chests without a position', async () => {
    await setup();
    await loadSubArea(MAP_DATA_PARTIAL_POSITIONS);
    const markers = el.querySelectorAll('[data-testid="chest-marker"]');
    expect(markers.length).toBe(1);
  });

  it('renders no markers and does not crash when no chests have positions', async () => {
    await setup();
    await loadSubArea(SAMPLE_MAP_DATA);
    const markers = el.querySelectorAll('[data-testid="chest-marker"]');
    expect(markers.length).toBe(0);
  });

  it('applies correct transform for marker position', async () => {
    await setup();
    await loadSubArea(MAP_DATA_WITH_POSITIONS);
    const markers = el.querySelectorAll('[data-testid="chest-marker"]');
    expect(markers[0].getAttribute('transform')).toBe('translate(25%,40%)');
    expect(markers[1].getAttribute('transform')).toBe('translate(60%,75%)');
  });

  // ── DA column conditional ────────────────────────────────────────────────

  it('shows DA column when at least one chest has items_da', async () => {
    await setup();
    await loadSubArea(SAMPLE_MAP_DATA);
    expect(el.textContent).toContain('DA Items');
    expect(el.textContent).toContain('Knot of Rust');
  });

  it('hides DA column when no chests have items_da', async () => {
    await setup();
    await loadSubArea(MAP_DATA_NO_DA);
    expect(el.textContent).not.toContain('DA Items');
  });
});
