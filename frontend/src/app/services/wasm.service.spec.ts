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
