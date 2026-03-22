# Optimisation Notes

A record of every performance change made to the seed finder, why each was done, and what it measured.

---

## Benchmark reference

All Rust benchmarks use Criterion and are in `ffxii_tza_rng/benches/rng.rs`.
The headline number throughout is **`rng_helper/find_seed/10k_seeds_no_match`** — 10 000 seeds searched with an impossible target (forces full 500-iteration scan of every seed, worst case).

| Checkpoint | 10k no-match | ∆ vs baseline |
|---|---|---|
| Baseline (before any optimisation) | 81 ms | — |
| Stage 5: stack MT state + stack probe | 77 ms | −5% |
| A: release profile tuning | ~79 ms | −2% |
| B: branchless MAG_01 | ~72 ms | −11% |
| C: precomputed character constants | ~60 ms | −26% |
| D: cold twist path | — | (folded with E) |
| E: integer cast filter | **~46 ms** | **−43%** |
| Parallel (16 threads), same window | **~5.9 ms** | — |

Extrapolated full 10 M Switch seed range, parallel: **~6 s** (was ~12 s).

---

## Stage 5 — Foundation (before the benchmark-driven pass)

### `Vec<u32>` → `[u32; N]` for MT state

**File:** `ffxii_tza_rng/src/rng.rs`

**What:** Changed `mt: Vec<u32>` to `mt: [u32; 624]` (stack-allocated fixed-size array).

**Why:** `Vec` stores its data on the heap — every access involves a pointer dereference plus a bounds check. The MT state is exactly 624 × 4 = 2 496 bytes: small enough to live on the stack and fit comfortably in L1 cache. Stack allocation removes the heap indirection and lets the compiler reason about the array size at compile time, enabling better loop unrolling and alias analysis.

**Measured:** ~6% faster seed search; eliminated a heap allocation per RNG instance.

---

### Stack-only probe (`check_seed`)

**File:** `ffxii_tza_rng/src/rng_helper.rs`

**What:** Replaced the heap-allocating `RNGHelper::new` + `find_casts` path for seed screening with a lightweight free function that uses only stack variables (`[i32; 16]` window, local `RNG`).

**Why:** The seed search tests ~10 M seeds. For each rejected seed the old path allocated a `VecDeque` on the heap, pushed values, then dropped it. The heap allocator round-trip (alloc + dealloc) was the dominant cost for rejected seeds — not the actual computation. `check_seed` does the same logical work with no heap involvement.

**Measured:** Combined with the MT stack change: −30% on `find_seed/10k_no_match`.

---

## A — Release profile tuning

**Files:** `Cargo.toml` (workspace), `.cargo/config.toml`

**What:**
```toml
[profile.release]
lto = "thin"
codegen-units = 1
```

**Why:**
- `codegen-units = 1` forces the entire crate to be compiled as a single translation unit. This lets LLVM see across all function boundaries when inlining and optimising, instead of being limited to what crosses crate boundaries after independent codegen.
- `lto = "thin"` enables link-time optimisation across crates (e.g. the library → binary boundary). Thin LTO is fast enough to use routinely and typically gives 5–15% on compute-heavy code by inlining across crate boundaries.

**Note:** `target-cpu=native` was tested and **regressed** by ~5% on this workload. The ARM LLVM backend auto-vectorised the MT19937 twist loop in a way that was counterproductive — the data-dependency chain inside the twist prevents effective SIMD, and the vectorised code was slower than the scalar version. Documented in `.cargo/config.toml` as a comment so future experiments can reference this.

**Measured:** ~2.5% improvement on its own (modest, but free).

---

## B — Branchless MAG_01

**File:** `ffxii_tza_rng/src/rng.rs`

**What:** The MT19937 twist loop previously used a table lookup to select between 0 and `MATRIX_A`:

```rust
// Before
const MAG_01: [u32; 2] = [0, RNG::MATRIX_A];
// ...used three times in the twist:
self.mt[kk] = self.mt[kk + M] ^ (y >> 1) ^ RNG::MAG_01[y as usize & 1];
```

Replaced with a branchless arithmetic expression:

```rust
// After
#[inline(always)]
fn mag(y: u32) -> u32 {
    (y & 1).wrapping_neg() & RNG::MATRIX_A
}
// ...
self.mt[kk] = self.mt[kk + M] ^ (y >> 1) ^ RNG::mag(y);
```

**Why:** `(y & 1).wrapping_neg()` produces `0x00000000` when `y` is even and `0xFFFFFFFF` when `y` is odd — a branchless bitmask. ANDing with `MATRIX_A` then gives either 0 or `MATRIX_A` with no branch and no memory access.

The table lookup version requires:
1. A dependent load from `MAG_01[y & 1]` — introduces a load-use latency
2. An indirect memory reference that the CPU must treat as potentially aliased
3. Possible branch-predictor overhead if `y & 1` alternates irregularly

The arithmetic version is three instructions (`and`, `neg`, `and`) with no memory access and no branch, all of which the CPU can pipeline freely.

The twist runs once every 624 `gen_rand` calls. In the seed search each seed triggers exactly one twist (503 calls per seed, all within the first 624). Even though the twist is infrequent, it accounts for a significant fraction of wall time because it's 624 iterations of the inner loop.

**Measured:** −8.8% on `find_seed/10k_no_match`.

---

## C — Precomputed character constants

**File:** `ffxii_tza_rng/src/character.rs`

**What:** `cast()` used to recompute `base_multiplier()` and the spell power on every call:

```rust
// Before: recomputed on every call
fn base_multiplier(&self) -> f64 {
    (2.0 + self.magic as f64 * (self.level + self.magic) as f64 / 256.0)
        * (if self.serenity { 1.5 } else { 1.0 })
}
pub fn cast(&self, rng_val: u32) -> i32 {
    let bonus = (rng_val % (self.spell.power() as f64 * 12.5).floor() as u32) as f64 / 100.0;
    let total_power = self.spell.power() as f64 + bonus;
    (total_power * self.base_multiplier()) as i32
}
```

Three constants are derived from fields that never change after construction. They are now precomputed in `new()` and stored:

```rust
// After: computed once, stored in the struct
modulus: u32,  // (spell.power() * 12.5).floor()
base:    f64,  // spell.power() * base_multiplier
scale:   f64,  // base_multiplier / 100.0

pub fn cast(&self, rng_val: u32) -> i32 {
    (self.base + (rng_val % self.modulus) as f64 * self.scale) as i32
}
```

**Why:** `cast()` is called once per RNG value in `check_seed` — approximately 5 million times for a 10k-seed no-match run. Each of those calls previously did:
- Two `u8 → f64` conversions for `level` and `magic`
- Two `f64` multiplies and one add for `base_multiplier`
- A conditional branch for `serenity`
- A `u8 → f64` conversion for `spell.power()`
- A `f64 → u32` conversion for the modulus
- A `f64` divide by 100.0

The new `cast()` does: one `u32 % u32`, one `u32 → f64`, one `f64` multiply, one `f64` add. All of the eliminated work was constant for the duration of a search.

**Measured:** −15% on `find_seed/10k_no_match`; `character/cast` benchmark dropped to **~500 ps** (sub-nanosecond throughput).

---

## D — Cold twist path

**File:** `ffxii_tza_rng/src/rng.rs`

**What:** Extracted the 624-iteration MT twist loop from `gen_rand` into a separate function marked `#[cold] #[inline(never)]`:

```rust
#[cold]
#[inline(never)]
fn twist(&mut self) { /* the 624-iteration loop */ }

pub fn gen_rand(&mut self) -> u32 {
    if self.mti >= RNG::N {
        self.twist(); // cold branch
    }
    // hot path: 1 load + 4 XOR/shift/AND + 1 increment
    y = self.mt[self.mti];
    self.mti += 1;
    // tempering...
}
```

**Why:** The twist triggers once every 624 calls — a 99.84% branch-not-taken rate. When the twist was inlined into `gen_rand`, the compiler placed ~80 instructions of twist code inside the function body. Even though those instructions are rarely executed, their presence increases the size of `gen_rand`, which:
- Increases instruction cache pressure (the hot path shares a cache line with cold code)
- Prevents the CPU's instruction pre-fetcher from prefetching only the hot path

`#[cold]` tells LLVM to place the function far from the hot code, and `#[inline(never)]` ensures it stays there. The hot path of `gen_rand` collapses to: one load, four XOR/shift/AND tempering operations, one position increment — a tight sequence that fits in one or two cache lines.

**Measured:** The `rng/gen_rand/10000` benchmark dropped from ~52 µs to **~19 µs** (−63%). This is the clearest signal of cache-pressure relief.

---

## E — Integer cast filter in `check_seed`

**Files:** `ffxii_tza_rng/src/character.rs`, `ffxii_tza_rng/src/rng_helper.rs`

**What:** The slide loop in `check_seed` previously computed a full `cast()` per step and compared the resulting `i32` heal value. Even after optimisation C reduced `cast()` to three float operations, those operations still appeared on the latency-critical path (gen_rand output → f64 multiply → f64 add → f64→i32 → compare).

The key insight: for a fixed character configuration, `cast(rng_val) == target` is equivalent to `rng_val % modulus ∈ [lo, hi]` for a precomputed integer range `(lo, hi)`.

**Implementation:**

1. `Character::remainder_range(heal)` scans `0..modulus` (at most 1 500 values) once at search start, finding all remainders that map to `heal` after truncation:

```rust
pub fn remainder_range(&self, heal: i32) -> (u32, u32) {
    let (mut lo, mut hi) = (self.modulus, 0u32); // sentinel
    for r in 0..self.modulus {
        if (self.base + r as f64 * self.scale) as i32 == heal {
            if lo == self.modulus { lo = r; }
            hi = r;
        }
    }
    if lo == self.modulus { (self.modulus, 0) } else { (lo, hi) }
}
```

2. `find_seed` precomputes a `Vec<(u32, u32)>` of target ranges before the seed loop — done once, not per seed.

3. `check_seed` stores `rng_val % modulus` (u32) in the window instead of cast heals (i32), and compares with `window[i] < lo || window[i] > hi`:

```rust
// hot path — no floating point at all
window[len - 1] = rng.gen_rand() % modulus;
for (i, &(lo, hi)) in targets.iter().enumerate() {
    if window[i] < lo || window[i] > hi { matched = false; break; }
}
```

**Why the range is safe:** `cast` is monotonically increasing in `r = rng_val % modulus` (larger remainder → larger bonus → larger heal). The set of valid `r` values for any target heal is therefore a contiguous range `[lo, hi]`. For typical character stats (serenity, magic > 50), scale ≈ 1, so the range width is 1–2. For impossible target values (e.g. 9999), the range is empty: `(modulus, 0)`, which causes `window[i] < lo` to be always true (since `window[i] < modulus` is guaranteed), giving an immediate fast-reject.

**Correctness guarantee:** The real-game integration tests (`find_seed_real_world_cases` in `lib.rs`) use verified Nintendo Switch seed/heal pairs. All 25 tests pass with the integer filter — confirming the range computation is bit-identical to the float formula for all tested inputs.

**Measured:** −28% on `find_seed/10k_no_match` (on top of A+B+C+D); −43% total from baseline.

---

## Web / WASM layer

### JS-layer multi-worker parallelism

**File:** `frontend/src/app/services/wasm.service.ts`

**What:** The original implementation used a single Web Worker running WASM's `find_seed` over the full 6 M–16.77 M seed range. Replaced with N workers (where N = `navigator.hardwareConcurrency`, typically 8–16), each covering a non-overlapping chunk of the range. A `won` flag prevents double-updates; a `pending` counter triggers `notfound` only when all workers respond null.

**Why:** WASM runs single-threaded (SharedArrayBuffer + Atomics required for `rayon` are blocked by COOP/COEP headers in most hosting environments). The only way to use multiple cores from WASM is to spawn multiple Workers, each with its own WASM instance. Web Workers are true OS threads, so the work scales linearly with core count.

**Measured:** Wall time for a full Switch seed search: ~12 s → ~6 s on a 16-core host (after Rust optimisations applied).

---

### Rebuilding the WASM binary

After any Rust optimisation, the WASM package must be rebuilt to pick up the changes:

```bash
cd ffxii_tza_rng_wasm
wasm-pack build --target web --out-dir pkg
```

`wasm-pack` compiles with `--release`, respects `[profile.release]` from the workspace `Cargo.toml`, and runs `wasm-opt` (Binaryen) as a post-pass. The frontend's `node_modules/ffxii-tza-rng-wasm` symlink points to `pkg/`, so no further steps are needed.

---

## What was tried and abandoned

| Idea | Outcome |
|---|---|
| `target-cpu=native` | +5% regression — ARM LLVM auto-vectorised the MT twist counterproductively |
| Rayon for WASM parallelism | Requires `SharedArrayBuffer` with COOP/COEP headers; not viable for general hosting |
| Ring buffer for `check_seed` window | `copy_within` for 3–5 elements is ≤5 ns; ring buffer adds index arithmetic overhead that costs more than it saves |
| Integer-only cast (full Barrett reduction) | Not attempted — `check_seed` already avoids float via the remainder range; `cast()` is only called on confirmed matches and in the UI path where latency is irrelevant |
