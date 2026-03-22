import { TestBed } from '@angular/core/testing';
import { vi, expect, describe, it, beforeEach } from 'vitest';
import { WasmService, type Character, type ValueLens } from './wasm.service';

// vi.hoisted lets us reference these inside vi.mock (which is hoisted to the top of the file)
const { mockHelper, MockRNGHelper, mockInit } = vi.hoisted(() => {
  const mockHelper = {
    free: vi.fn(),
    push: vi.fn(),
    next: vi.fn(),
    apply_character: vi.fn(),
    find_casts: vi.fn(() => true),
    values: vi.fn((): ValueLens[] => [
      { position: 1, value: 1288459236, spell: 2065, chest: 36 },
      { position: 2, value: 2139177191, spell: 2262, chest: 91 },
      { position: 3, value: 74803024, spell: 2205, chest: 24 },
    ]),
    seed: vi.fn(() => 4537),
    position: vi.fn(() => 3),
  };
  return {
    mockHelper,
    // Must use a regular function (not arrow) to be usable as a constructor with `new`
    MockRNGHelper: vi.fn(function () {
      return mockHelper;
    }),
    mockInit: vi.fn().mockResolvedValue({}),
  };
});

vi.mock('ffxii-tza-rng-wasm', () => ({
  default: mockInit,
  RNGHelper: MockRNGHelper,
}));

const defaultCharacter: Character = {
  level: 70,
  magic: 99,
  spell: 'Cure',
  serenity: true,
};

describe('WasmService', () => {
  let service: WasmService;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockInit.mockResolvedValue({});

    await TestBed.configureTestingModule({}).compileComponents();
    service = TestBed.inject(WasmService);
  });

  // ── init ──────────────────────────────────────────────────────────────────

  describe('init', () => {
    it('begins in a loading state', () => {
      expect(service.isReady()).toBe(false);
      expect(service.status()).toBe('loading');
    });

    it('becomes ready after WASM init resolves', async () => {
      await vi.waitUntil(() => service.isReady(), { timeout: 2000 });
      expect(service.isReady()).toBe(true);
      expect(service.status()).toBe('resolved');
    });

    it('calls init with the explicit wasm asset URL', async () => {
      await vi.waitUntil(() => service.isReady(), { timeout: 2000 });
      expect(mockInit).toHaveBeenCalledWith('/wasm/ffxii_tza_rng_wasm_bg.wasm');
    });
  });

  // ── initial signal state ──────────────────────────────────────────────────

  describe('initial state', () => {
    it('values is empty', () => {
      expect(service.values()).toEqual([]);
    });

    it('seed is null', () => {
      expect(service.seed()).toBeNull();
    });

    it('position is 0', () => {
      expect(service.position()).toBe(0);
    });
  });

  // ── createHelper ──────────────────────────────────────────────────────────

  describe('createHelper', () => {
    it('constructs RNGHelper with correct args', () => {
      service.createHelper(4537, defaultCharacter, 10);
      expect(MockRNGHelper).toHaveBeenCalledWith(4537, defaultCharacter, 10);
    });

    it('passes undefined (not null) for seed when null provided', () => {
      service.createHelper(null, defaultCharacter, 10);
      expect(MockRNGHelper).toHaveBeenCalledWith(undefined, defaultCharacter, 10);
    });

    it('populates values signal from helper', () => {
      service.createHelper(4537, defaultCharacter, 10);
      expect(service.values()).toHaveLength(3);
      expect(service.values()[0]).toEqual({ position: 1, value: 1288459236, spell: 2065, chest: 36 });
    });

    it('populates seed signal', () => {
      service.createHelper(4537, defaultCharacter, 10);
      expect(service.seed()).toBe(4537);
    });

    it('populates position signal', () => {
      service.createHelper(4537, defaultCharacter, 10);
      expect(service.position()).toBe(3);
    });

    it('frees previous helper when called again', () => {
      service.createHelper(4537, defaultCharacter, 10);
      service.createHelper(1234, defaultCharacter, 5);
      expect(mockHelper.free).toHaveBeenCalledTimes(1);
    });
  });

  // ── push ──────────────────────────────────────────────────────────────────

  describe('push', () => {
    beforeEach(() => service.createHelper(4537, defaultCharacter, 10));

    it('calls push on the helper with the character', () => {
      service.push(defaultCharacter);
      expect(mockHelper.push).toHaveBeenCalledWith(defaultCharacter);
    });

    it('refreshes signals after push', () => {
      const newValues: ValueLens[] = [{ position: 4, value: 99, spell: 2100, chest: 50 }];
      mockHelper.values.mockReturnValueOnce(newValues);
      mockHelper.seed.mockReturnValueOnce(4537);
      mockHelper.position.mockReturnValueOnce(4);
      service.push(defaultCharacter);
      expect(service.values()).toEqual(newValues);
      expect(service.position()).toBe(4);
    });

    it('is a no-op when no helper exists', () => {
      const fresh = TestBed.inject(WasmService);
      expect(() => fresh.push(defaultCharacter)).not.toThrow();
    });
  });

  // ── next ──────────────────────────────────────────────────────────────────

  describe('next', () => {
    beforeEach(() => service.createHelper(4537, defaultCharacter, 10));

    it('calls next on the helper with the character', () => {
      service.next(defaultCharacter);
      expect(mockHelper.next).toHaveBeenCalledWith(defaultCharacter);
    });

    it('refreshes signals after next', () => {
      service.next(defaultCharacter);
      expect(mockHelper.values).toHaveBeenCalled();
    });
  });

  // ── findSeed ──────────────────────────────────────────────────────────────

  describe('findSeed', () => {
    type MockWorker = { postMessage: ReturnType<typeof vi.fn>; onmessage: ((e: { data: any }) => void) | null; terminate: ReturnType<typeof vi.fn> };
    let mockWorkers: MockWorker[];

    beforeEach(() => {
      mockWorkers = [];
      vi.stubGlobal('Worker', vi.fn(function () {
        const w: MockWorker = { postMessage: vi.fn(), onmessage: null, terminate: vi.fn() };
        mockWorkers.push(w);
        return w;
      }));
      // Fix hardwareConcurrency so tests are deterministic regardless of host machine
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: 4, configurable: true });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('starts in idle state', () => {
      expect(service.searchStatus()).toBe('idle');
    });

    it('sets searchStatus to searching when called', () => {
      service.findSeed(defaultCharacter, [2255, 2063], 0, 1000, 10);
      expect(service.searchStatus()).toBe('searching');
    });

    it('spawns one worker per logical CPU', () => {
      service.findSeed(defaultCharacter, [2255], 0, 1000, 10);
      expect(Worker).toHaveBeenCalledTimes(4);
    });

    it('partitions the range evenly across workers', () => {
      service.findSeed(defaultCharacter, [2255], 0, 1000, 10);
      const msgs = mockWorkers.map(w => w.postMessage.mock.calls[0][0]);
      expect(msgs[0]).toMatchObject({ min: 0, max: 250 });
      expect(msgs[1]).toMatchObject({ min: 250, max: 500 });
      expect(msgs[2]).toMatchObject({ min: 500, max: 750 });
      expect(msgs[3]).toMatchObject({ min: 750, max: 1000 });
    });

    it('includes character, values and iters in each worker message', () => {
      service.findSeed(defaultCharacter, [2255, 2063], 0, 1000, 42);
      mockWorkers.forEach(w => {
        expect(w.postMessage).toHaveBeenCalledWith(expect.objectContaining({
          type: 'findSeed',
          character: defaultCharacter,
          values: [2255, 2063],
          iters: 42,
        }));
      });
    });

    it('sets searchStatus to found when any worker returns a seed', () => {
      service.findSeed(defaultCharacter, [2255, 2063], 0, 1000, 10);
      mockWorkers[1].onmessage!({ data: { type: 'result', seed: 6_357_987, values: [] } });
      expect(service.searchStatus()).toBe('found');
    });

    it('populates helper with the found seed', () => {
      service.findSeed(defaultCharacter, [2255, 2063], 0, 1000, 10);
      mockWorkers[2].onmessage!({ data: { type: 'result', seed: 6_357_987, values: [] } });
      expect(MockRNGHelper).toHaveBeenCalledWith(6_357_987, defaultCharacter, expect.any(Number));
      expect(service.seed()).toBe(4537); // from mockHelper.seed()
    });

    it('terminates all workers when any worker finds a result', () => {
      service.findSeed(defaultCharacter, [2255], 0, 1000, 10);
      mockWorkers[1].onmessage!({ data: { type: 'result', seed: 42, values: [] } });
      mockWorkers.forEach(w => expect(w.terminate).toHaveBeenCalled());
    });

    it('stays searching until all workers have responded', () => {
      service.findSeed(defaultCharacter, [2255], 0, 1000, 10);
      mockWorkers.slice(0, 3).forEach(w => w.onmessage!({ data: { type: 'result', seed: null, values: null } }));
      expect(service.searchStatus()).toBe('searching');
    });

    it('sets searchStatus to notfound only when all workers return null', () => {
      service.findSeed(defaultCharacter, [2255], 0, 1000, 10);
      mockWorkers.forEach(w => w.onmessage!({ data: { type: 'result', seed: null, values: null } }));
      expect(service.searchStatus()).toBe('notfound');
    });

    it('terminates previous workers when a new search starts', () => {
      service.findSeed(defaultCharacter, [2255], 0, 1000, 10);
      const firstBatch = [...mockWorkers];
      service.findSeed(defaultCharacter, [2255], 0, 1000, 10);
      firstBatch.forEach(w => expect(w.terminate).toHaveBeenCalled());
    });

    it('spawns a fresh set of workers for each search', () => {
      service.findSeed(defaultCharacter, [2255], 0, 1000, 10);
      service.findSeed(defaultCharacter, [2255], 0, 1000, 10);
      expect(Worker).toHaveBeenCalledTimes(8); // 4 per call
    });
  });

  // ── elapsedSeconds ────────────────────────────────────────────────────────

  describe('elapsedSeconds', () => {
    type MockWorker = { postMessage: ReturnType<typeof vi.fn>; onmessage: ((e: { data: any }) => void) | null; terminate: ReturnType<typeof vi.fn> };
    let mockWorkers: MockWorker[];

    beforeEach(() => {
      vi.useFakeTimers();
      mockWorkers = [];
      vi.stubGlobal('Worker', vi.fn(function () {
        const w: MockWorker = { postMessage: vi.fn(), onmessage: null, terminate: vi.fn() };
        mockWorkers.push(w);
        return w;
      }));
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: 4, configurable: true });
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    it('starts at 0', () => {
      expect(service.elapsedSeconds()).toBe(0);
    });

    it('increments each second while searching', () => {
      service.findSeed(defaultCharacter, [2255], 0, 1000, 10);
      vi.advanceTimersByTime(3000);
      expect(service.elapsedSeconds()).toBe(3);
    });

    it('freezes when a seed is found', () => {
      service.findSeed(defaultCharacter, [2255], 0, 1000, 10);
      vi.advanceTimersByTime(2000);
      mockWorkers[0].onmessage!({ data: { seed: 42 } });
      vi.advanceTimersByTime(2000);
      expect(service.elapsedSeconds()).toBe(2);
    });

    it('freezes when all workers return notfound', () => {
      service.findSeed(defaultCharacter, [2255], 0, 1000, 10);
      vi.advanceTimersByTime(2000);
      mockWorkers.forEach(w => w.onmessage!({ data: { seed: null } }));
      vi.advanceTimersByTime(2000);
      expect(service.elapsedSeconds()).toBe(2);
    });

    it('resets to 0 when a new search starts', () => {
      service.findSeed(defaultCharacter, [2255], 0, 1000, 10);
      vi.advanceTimersByTime(3000);
      service.findSeed(defaultCharacter, [2255], 0, 1000, 10);
      expect(service.elapsedSeconds()).toBe(0);
    });
  });

  // ── findCasts ─────────────────────────────────────────────────────────────

  describe('findCasts', () => {
    beforeEach(() => service.createHelper(4537, defaultCharacter, 10));

    it('calls find_casts on the helper with character and values', () => {
      service.findCasts(defaultCharacter, [2065, 2262]);
      expect(mockHelper.find_casts).toHaveBeenCalledWith(defaultCharacter, [2065, 2262], null);
    });

    it('passes limit when provided', () => {
      service.findCasts(defaultCharacter, [2065], 5);
      expect(mockHelper.find_casts).toHaveBeenCalledWith(defaultCharacter, [2065], 5);
    });

    it('returns true when find_casts succeeds', () => {
      mockHelper.find_casts.mockReturnValueOnce(true);
      expect(service.findCasts(defaultCharacter, [2065])).toBe(true);
    });

    it('returns false when find_casts fails', () => {
      mockHelper.find_casts.mockReturnValueOnce(false);
      expect(service.findCasts(defaultCharacter, [9999])).toBe(false);
    });

    it('refreshes signals when find_casts succeeds', () => {
      const updated: ValueLens[] = [{ position: 5, value: 99, spell: 2065, chest: 50 }];
      mockHelper.find_casts.mockReturnValueOnce(true);
      mockHelper.values.mockReturnValueOnce(updated);
      service.findCasts(defaultCharacter, [2065]);
      expect(service.values()).toEqual(updated);
    });

    it('does not refresh signals when find_casts returns false', () => {
      service.createHelper(4537, defaultCharacter, 10);
      const before = service.values();
      mockHelper.find_casts.mockReturnValueOnce(false);
      service.findCasts(defaultCharacter, [9999]);
      expect(service.values()).toEqual(before);
    });

  });

  describe('findCasts (no helper)', () => {
    it('returns false when no helper exists', () => {
      expect(service.findCasts(defaultCharacter, [2065])).toBe(false);
    });
  });

  // ── applyCharacter ────────────────────────────────────────────────────────

  describe('applyCharacter', () => {
    beforeEach(() => service.createHelper(4537, defaultCharacter, 10));

    it('calls apply_character on the helper', () => {
      const newChar: Character = { ...defaultCharacter, serenity: false };
      service.applyCharacter(newChar);
      expect(mockHelper.apply_character).toHaveBeenCalledWith(newChar);
    });

    it('refreshes signals after apply', () => {
      const updatedValues: ValueLens[] = [{ position: 1, value: 1288459236, spell: 1900, chest: 36 }];
      mockHelper.values.mockReturnValueOnce(updatedValues);
      service.applyCharacter({ ...defaultCharacter, magic: 50 });
      expect(service.values()[0].spell).toBe(1900);
    });
  });
});
