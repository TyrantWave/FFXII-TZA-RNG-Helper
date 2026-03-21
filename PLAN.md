# FFXII TZA RNG Helper — v2 Plan

## Status

| Stage | Description | Status |
|-------|-------------|--------|
| 1 | Library modernisation & tests | ✅ Done |
| 2 | WASM bindings | ✅ Done |
| 3 | Angular frontend | 🔲 Not started |
| 4 | Optimisation | 🔲 Not started |

---

## Key Decisions

| Topic | Decision |
|-------|----------|
| Parallelism | `wasm-bindgen-rayon` — SharedArrayBuffer + Atomics, full Rayon in browser |
| Hosting | Self-hosted, Nginx reverse proxy with COOP/COEP headers |
| Frontend | Angular 19+ with Angular Material (old Yew crates removed) |
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

## Stage 3 — Angular Frontend 🔲

- [ ] Angular 19 project, Angular Material
- [ ] WASM loaded as Angular service (lazy, async)
- [ ] Seed-finding via Web Worker (Rayon thread pool runs inside worker)
- [ ] UI panels:
  - Character (level, magic, spell dropdown, serenity toggle)
  - Observed heal value entry (up to 5 values)
  - Seed controls (manual seed, find seed with min/max/iters, progress indicator)
  - Results table (position, raw RNG value, computed spell value, chest %)
- [ ] `ng serve` works end-to-end

---

## Stage 4 — Optimisation 🔲

Only after Stages 1–3 are solid.

- [ ] Profile under WASM constraints
- [ ] Candidates: tighter inner loop, SIMD via `wide` crate, smarter search bounds

---

## Ideas Backlog

> Future ideas go here before they're promoted to a stage.

