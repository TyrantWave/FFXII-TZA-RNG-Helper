# FFXII TZA RNG Helper — v2 Plan

## Status

| Stage | Description | Status |
|-------|-------------|--------|
| 1 | Library modernisation & tests | ✅ Done |
| 2 | WASM bindings | ✅ Done |
| 3 | Angular frontend | ✅ Done |
| 4 | Real-game validation & test coverage | 🔲 Not started |
| 5 | Optimisation | 🔲 Not started |

---

## Key Decisions

| Topic | Decision |
|-------|----------|
| Parallelism | `wasm-bindgen-rayon` — SharedArrayBuffer + Atomics, full Rayon in browser |
| Hosting | Self-hosted, Nginx reverse proxy with COOP/COEP headers |
| Frontend | Angular 21, Angular Material, zoneless, signals throughout (old Yew crates removed) |
| Damage formula | Verified correct vs Nintendo Switch — test-locked as-is |

Required headers for SharedArrayBuffer:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

---

## Target Structure

```
/
├── ffxii_tza_rng/           # Core Rust library
├── ffxii_tza_rng_wasm/      # wasm-bindgen + wasm-bindgen-rayon wrapper
└── frontend/                # Angular 19 app
    └── src/
        ├── app/
        │   ├── services/    # WASM service, worker bridge
        │   └── components/  # UI panels
        └── workers/         # Web Worker for seed-finding
```

---

## Stage 1 — Library Modernisation & Tests ✅

- [x] Rust 2021 edition
- [x] Deps updated (rayon 1.10, serde 1.0)
- [x] Workspace resolver = "2"
- [x] Tests: MT19937 known-value (`rng.rs`)
- [x] Tests: spell power values and `from_str` round-trip (`spell.rs`)
- [x] Tests: damage formula table-driven (`character.rs`)
- [x] Tests: `push`, `next`, `apply_character`, `find_casts`, `find_seed` (`rng_helper.rs`)
- [x] `cargo test` clean
- [x] `cargo clippy` clean

---

## Stage 2 — WASM Bindings ✅

New crate `ffxii_tza_rng_wasm`:

- [x] Add crate to workspace
- [x] Dependencies: `wasm-bindgen`, `wasm-bindgen-rayon`, `serde-wasm-bindgen`
- [x] JS-friendly API:
  - `Character` passed as JS object (deserialized via `serde-wasm-bindgen`)
  - `RNGHelper`: `new`, `push`, `next`, `apply_character`, `find_casts`, `find_seed`
  - `find_seed` returns `RNGHelper | undefined`
  - `values()` returns JS array of `{ position, value, spell, chest }` objects
  - `initThreadPool(n)` for Rayon parallelism
- [x] `pkg/` generated with `.js`, `.d.ts`, `.wasm` and `package.json`

### Build command

wasm-pack cannot be used directly (it auto-installs the wasm32 sysroot which
conflicts with `build-std`). Build manually from `ffxii_tza_rng_wasm/`:

```bash
# First time only — ensure no pre-installed wasm32 target for nightly
rustup target remove wasm32-unknown-unknown --toolchain nightly

# Compile
cargo +nightly build --target wasm32-unknown-unknown --release

# Generate JS/TS bindings
wasm-bindgen --target web --out-dir pkg \
  ../target/wasm32-unknown-unknown/release/ffxii_tza_rng_wasm.wasm
```

> Note: `.cargo/config.toml` in this crate sets the required atomics rustflags
> and `build-std = ["std", "panic_abort"]`. Do not run these commands from the
> workspace root or the config won't apply.

---

## Stage 3 — Angular Frontend ✅

- [x] Angular 21 project, Angular Material, zoneless by default
- [x] WASM service (`WasmService`) with `resource()` async init, signals for values/seed/position
- [x] Unit tests for WasmService (35 passing, Vitest + jsdom)
- [x] Web Worker for `find_seed` (Rayon thread pool runs inside worker)
- [x] `findCasts` exposed on `WasmService` for Find Position mode
- [x] UI components (all TDD, 65 tests total):
  - `CharacterPanel` — level, magic, spell dropdown, serenity toggle; `linkedSignal` for input sync
  - `ControlsPanel` — Browse / Find Seed / Find Position mode toggle with per-mode inputs and search status
  - `ValuesTable` — CDK virtual scroll, 100 rows, position / spell / chest % columns
- [x] `AppComponent` — two-column layout, initialises with seed 4537 on WASM ready
- [x] `ng serve` works end-to-end

### Component selector prefix
`tza-` — short, tied to the game abbreviation (e.g. `tza-values-table`, `tza-character-panel`).

### Test approach
- **Unit tests** (Vitest + jsdom): `WasmService` mocked at component level; WASM module mocked in service tests
- **Integration tests**: real WASM load in browser — deferred, still pending

---

## Stage 4 — Real-Game Validation & Test Coverage 🔲

Test the tool against a live copy of FFXII TZA to verify seed finding and RNG prediction accuracy.
Once real-game accuracy is confirmed, harden the test suite using observed data.

- [ ] Test seed finding and cast prediction against the running game
- [ ] Capture known-good seed → heal value sequences from real gameplay
- [ ] Add these as test cases in the Rust core (table-driven, covering spell tiers, serenity on/off, boundary levels)
- [ ] Ensure `find_seed` and `find_casts` reproduce real observations exactly
- [ ] Checkpoint: all real-game observations reproducible via `cargo test`

---

## Stage 5 — Optimisation 🔲

Only after Stages 1–4 are solid.

- [ ] Profile under WASM constraints
- [ ] Candidates: tighter inner loop, SIMD via `wide` crate, smarter search bounds

---

## Ideas Backlog

> Future ideas go here before they're promoted to a stage.

