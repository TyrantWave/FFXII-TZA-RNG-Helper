# FFXII TZA RNG Helper — v2 Plan

## Status

| Stage | Description | Status |
|-------|-------------|--------|
| 1 | Library modernisation & tests | ✅ Done |
| 2 | WASM bindings | ✅ Done |
| 3 | Angular frontend | ✅ Done |
| 4 | Real-game validation & test coverage | ✅ Done |
| 5 | Optimisation | 🔲 Not started |

---

## Key Decisions

| Topic | Decision |
|-------|----------|
| Parallelism | Single-threaded WASM in a Web Worker — rayon/SharedArrayBuffer dropped due to Vite bundler incompatibility; multi-worker chunking planned for Stage 5 |
| Hosting | Self-hosted, Nginx reverse proxy |
| Frontend | Angular 21, Angular Material, zoneless, signals throughout (old Yew crates removed) |
| Damage formula | Verified correct vs Nintendo Switch — test-locked as-is |
| Seed range | Switch: `6,000,000–16,777,216`; PS4: static seed `4537` (Find Position only) |

---

## Structure

```
/
├── ffxii_tza_rng/          # Core Rust library
├── ffxii_tza_rng_wasm/     # wasm-bindgen wrapper (no rayon)
└── frontend/               # Angular 21 app
    └── src/
        ├── app/
        │   ├── services/   # WasmService, worker bridge
        │   └── components/ # UI panels
        └── workers/        # Web Worker for seed-finding
```

---

## Stage 1 — Library Modernisation & Tests ✅

- [x] Rust 2021 edition
- [x] Workspace resolver = "2"
- [x] Tests: MT19937 known-value (`rng.rs`)
- [x] Tests: spell power values and `from_str` round-trip (`spell.rs`)
- [x] Tests: damage formula table-driven (`character.rs`)
- [x] Tests: `push`, `next`, `apply_character`, `find_casts`, `find_seed` (`rng_helper.rs`)
- [x] `cargo test` clean (25 tests, ~1.2s)
- [x] `cargo clippy` clean

---

## Stage 2 — WASM Bindings ✅

New crate `ffxii_tza_rng_wasm`:

- [x] Add crate to workspace
- [x] Dependencies: `wasm-bindgen`, `serde-wasm-bindgen`
- [x] JS-friendly API:
  - `Character` passed as JS object (deserialized via `serde-wasm-bindgen`)
  - `RNGHelper`: `new`, `push`, `next`, `apply_character`, `find_casts`, `find_seed`
  - `find_seed` returns `RNGHelper | undefined`
  - `values()` returns JS array of `{ position, value, spell, chest }` objects
- [x] `pkg/` generated with `.js`, `.d.ts`, `.wasm` and `package.json`
- [x] `frontend/public/wasm/` and `node_modules/ffxii-tza-rng-wasm` symlinked to `pkg/`

### Build command

```bash
cd ffxii_tza_rng_wasm
wasm-pack build --target web --out-dir pkg
```

---

## Stage 3 — Angular Frontend ✅

- [x] Angular 21 project, Angular Material, zoneless by default
- [x] WASM service (`WasmService`) with `resource()` async init, signals for values/seed/position
- [x] Web Worker for `find_seed` (non-blocking; single-threaded WASM)
- [x] `findCasts` exposed on `WasmService`; called automatically after `find_seed` to position the table
- [x] UI components (TDD, 59 tests total):
  - `CharacterPanel` — level, magic, spell dropdown, serenity toggle
  - `ControlsPanel` — seed input, 5 heal value inputs, Find Seed / Find Position buttons, search status
  - `ValuesTable` — CDK virtual scroll, 100 rows, position / spell / chest % columns
- [x] `AppComponent` — two-column layout, initialises with seed 4537 on WASM ready; auto-populates seed field and positions table after Find Seed
- [x] `ng serve` works end-to-end
- [x] CLI binary (`ffxii_tza_rng`) for quick validation with progress output

### Component selector prefix
`tza-` (e.g. `tza-values-table`, `tza-character-panel`)

### Test runner
`ng test --no-watch` — Angular builder wraps Vitest with proper TestBed initialisation.
Do not use `npx vitest run` directly.

---

## Stage 4 — Real-Game Validation & Test Coverage ✅

Validated against live Nintendo Switch gameplay. Formula and seed search confirmed correct.

- [x] CLI tool used to find seeds from real observed heal values
- [x] Next predicted heal value confirmed in-game after each seed find
- [x] Multiple character configs verified (lvl/mag combinations, Cure/Cura, serenity on/off)
- [x] Real-game seed/value pairs added as table-driven integration tests in `ffxii_tza_rng/src/lib.rs`
- [x] Root causes of initial "not found" failures documented: Regen consuming draws, NPC movement, multi-party heal ordering
- [x] Confirmed: player movement does NOT consume RNG draws; NPC movement does

### Verified seeds (Nintendo Switch)

| Seed | Character | Values (consecutive heals) |
|------|-----------|--------------------------|
| 6,357,987 | lvl 70, mag 99, Cure, Serenity | 2255, 2063, 2029, 2211, 2195 |
| 6,541,629 | lvl 70, mag 99, Cure, Serenity | 2071, 2134, 2220, 2062, 2086 |
| 8,018,931 | lvl 70, mag 54, Curaja, no Serenity | 3794, 3582, 3622, 3628, 3648 |
| 7,849,347 | lvl 45, mag 68, Cura, Serenity | 2243, 2339, 2462, 2286, 2362 |

---

## Stage 5 — Optimisation 🔲

Only after Stages 1–4 are solid.

- [ ] JS-layer parallelism: split `min..max` into N chunks, spawn N workers, first match wins
- [ ] Profile single-threaded WASM throughput and identify bottlenecks
- [ ] Candidates: tighter inner loop, SIMD via `wide` crate, smarter search bounds

---

## Ideas Backlog

> Future ideas go here before they're promoted to a stage.

- Auto-advance table on next cast (track position with a button)
- Chest % highlighting for target values
- Export/share current seed + position as a URL
