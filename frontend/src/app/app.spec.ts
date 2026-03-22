import { TestBed } from '@angular/core/testing';
import { vi, expect, describe, it, beforeEach } from 'vitest';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { App } from './app';
import { WasmService } from './services/wasm.service';

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
};

describe('App', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [App, NoopAnimationsModule],
    })
      .overrideProvider(WasmService, { useValue: mockWasm })
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
});
