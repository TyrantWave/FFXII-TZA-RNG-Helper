use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion};
use ffxii_tza_rng::{character, rng, rng_helper, spell};

// ── shared fixtures ───────────────────────────────────────────────────────────

fn default_char() -> character::Character {
    character::Character::default() // lvl 70, mag 99, Cure, serenity
}

// Real verified seed — match found at position ~5, shallow in the sequence
const KNOWN_SEED: u32 = 6_357_987;
const KNOWN_VALUES: &[i32] = &[2255, 2063, 2029, 2211, 2195];

// ── 1. Raw RNG throughput ─────────────────────────────────────────────────────
//
// Isolates the MT19937 generator. Everything else builds on top of this.

fn bench_rng_gen(c: &mut Criterion) {
    let mut group = c.benchmark_group("rng/gen_rand");

    for n in [100u64, 1_000, 10_000, 100_000] {
        group.bench_with_input(BenchmarkId::from_parameter(n), &n, |b, &n| {
            b.iter(|| {
                let mut r = rng::RNG::from(black_box(KNOWN_SEED));
                for _ in 0..n {
                    black_box(r.gen_rand());
                }
            });
        });
    }

    group.finish();
}

// ── 2. Cast formula throughput ────────────────────────────────────────────────
//
// The heal formula runs once per RNG draw during find_seed.
// Benchmarks the hot arithmetic path in isolation.

fn bench_cast(c: &mut Criterion) {
    let mut group = c.benchmark_group("character/cast");
    let c_default = default_char();
    let c_no_serenity = character::Character::new(70, 99, spell::Spell::Cure, false);
    let c_curaja = character::Character::new(70, 99, spell::Spell::Curaja, true);

    let rng_val = black_box(2357136044u32);

    group.bench_function("cure_serenity", |b| {
        b.iter(|| black_box(c_default.cast(rng_val)))
    });
    group.bench_function("cure_no_serenity", |b| {
        b.iter(|| black_box(c_no_serenity.cast(rng_val)))
    });
    group.bench_function("curaja_serenity", |b| {
        b.iter(|| black_box(c_curaja.cast(rng_val)))
    });

    group.finish();
}

// ── 3. RNGHelper construction ─────────────────────────────────────────────────
//
// Measures the cost of seeding + filling N values.
// find_seed creates one of these per candidate seed.

fn bench_helper_new(c: &mut Criterion) {
    let mut group = c.benchmark_group("rng_helper/new");
    let ch = default_char();

    for iters in [5usize, 100, 500] {
        group.bench_with_input(BenchmarkId::from_parameter(iters), &iters, |b, &iters| {
            b.iter(|| {
                black_box(rng_helper::RNGHelper::new(
                    Some(black_box(KNOWN_SEED)),
                    &ch,
                    iters,
                ))
            });
        });
    }

    group.finish();
}

// ── 4. find_casts ─────────────────────────────────────────────────────────────
//
// The inner loop of find_seed: given a seeded helper, slide the window
// until values match. Benchmarks shallow vs deep matches to show how
// match position affects cost.

fn bench_find_casts(c: &mut Criterion) {
    let mut group = c.benchmark_group("rng_helper/find_casts");
    let ch = default_char();

    // Shallow: known values appear at position ~5 for this seed
    group.bench_function("shallow_match", |b| {
        b.iter(|| {
            let mut h = rng_helper::RNGHelper::new(Some(KNOWN_SEED), &ch, KNOWN_VALUES.len());
            black_box(h.find_casts(&ch, black_box(KNOWN_VALUES), Some(500)))
        });
    });

    // No match: forces the full limit to be exhausted — worst case per seed
    group.bench_function("no_match_limit_500", |b| {
        let impossible: Vec<i32> = vec![9999, 9999, 9999];
        b.iter(|| {
            let mut h = rng_helper::RNGHelper::new(Some(KNOWN_SEED), &ch, 3);
            black_box(h.find_casts(&ch, black_box(&impossible), Some(500)))
        });
    });

    // Deep match: values appear near the limit — measures cost scaling with depth
    group.bench_function("deep_match_limit_500", |b| {
        // Build a helper at KNOWN_SEED, advance 490 steps, capture the values there
        let mut setup = rng_helper::RNGHelper::new(Some(KNOWN_SEED), &ch, KNOWN_VALUES.len());
        for _ in 0..490 {
            setup.next(&ch);
        }
        let deep_values: Vec<i32> = setup.values.iter().map(|v| v.spell).collect();

        b.iter(|| {
            let mut h = rng_helper::RNGHelper::new(Some(KNOWN_SEED), &ch, deep_values.len());
            black_box(h.find_casts(&ch, black_box(&deep_values), Some(500)))
        });
    });

    group.finish();
}

// ── 5. find_seed over a range ─────────────────────────────────────────────────
//
// End-to-end brute-force search. The main number users care about.
// Uses tight windows so benchmarks complete in reasonable time, while still
// exercising the real code path.

fn bench_find_seed(c: &mut Criterion) {
    let mut group = c.benchmark_group("rng_helper/find_seed");
    let ch = default_char();

    // 1k seeds, match near start of range — best-case throughput
    group.bench_function("1k_seeds_match_at_start", |b| {
        b.iter(|| {
            black_box(rng_helper::RNGHelper::find_seed(
                &ch,
                black_box(KNOWN_VALUES),
                black_box(KNOWN_SEED - 10),
                black_box(KNOWN_SEED + 1000),
                500,
            ))
        });
    });

    // 1k seeds, no match — measures pure throughput with no early exit
    group.bench_function("1k_seeds_no_match", |b| {
        let impossible: Vec<i32> = vec![9999, 9999, 9999];
        b.iter(|| {
            black_box(rng_helper::RNGHelper::find_seed(
                &ch,
                black_box(&impossible),
                black_box(0),
                black_box(1_000),
                500,
            ))
        });
    });

    // 10k seeds, no match — scales the above to show linear cost
    group.bench_function("10k_seeds_no_match", |b| {
        let impossible: Vec<i32> = vec![9999, 9999, 9999];
        b.iter(|| {
            black_box(rng_helper::RNGHelper::find_seed(
                &ch,
                black_box(&impossible),
                black_box(0),
                black_box(10_000),
                500,
            ))
        });
    });

    group.finish();
}

// ── 6. find_seed_parallel ─────────────────────────────────────────────────────
//
// Same windows as bench_find_seed so results are directly comparable.
// Thread spawn + join overhead is included in each measurement.

fn bench_find_seed_parallel(c: &mut Criterion) {
    let mut group = c.benchmark_group("rng_helper/find_seed_parallel");
    let ch = default_char();

    group.bench_function("1k_seeds_match_at_start", |b| {
        b.iter(|| {
            black_box(rng_helper::RNGHelper::find_seed_parallel(
                &ch,
                black_box(KNOWN_VALUES),
                black_box(KNOWN_SEED - 10),
                black_box(KNOWN_SEED + 1000),
                500,
            ))
        });
    });

    group.bench_function("1k_seeds_no_match", |b| {
        let impossible: Vec<i32> = vec![9999, 9999, 9999];
        b.iter(|| {
            black_box(rng_helper::RNGHelper::find_seed_parallel(
                &ch,
                black_box(&impossible),
                black_box(0),
                black_box(1_000),
                500,
            ))
        });
    });

    group.bench_function("10k_seeds_no_match", |b| {
        let impossible: Vec<i32> = vec![9999, 9999, 9999];
        b.iter(|| {
            black_box(rng_helper::RNGHelper::find_seed_parallel(
                &ch,
                black_box(&impossible),
                black_box(0),
                black_box(10_000),
                500,
            ))
        });
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_rng_gen,
    bench_cast,
    bench_helper_new,
    bench_find_casts,
    bench_find_seed,
    bench_find_seed_parallel,
);
criterion_main!(benches);
