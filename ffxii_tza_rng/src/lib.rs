pub mod character;
pub mod rng;
pub mod rng_helper;
pub mod spell;

#[cfg(test)]
mod tests {
    use crate::{character, rng, rng_helper, spell};
    use spell::Spell;

    // ── helpers ───────────────────────────────────────────────────────────────

    fn default_char() -> character::Character {
        character::Character::default() // lvl 70, mag 99, Cure, serenity=true
    }

    // ── rng ──────────────────────────────────────────────────────────────────

    #[test]
    fn rng_known_sequence_seed_0() {
        let mut r = rng::RNG::from(0);
        let got: Vec<u32> = (0..10).map(|_| r.gen_rand()).collect();
        assert_eq!(
            got,
            [
                2357136044, 2546248239, 3071714933, 3626093760, 2588848963, 3684848379, 2340255427,
                3638918503, 1819583497, 2678185683,
            ]
        );
    }

    #[test]
    fn rng_known_sequence_default_seed() {
        let mut r = rng::RNG::from(rng::RNG::DEFAULT_SEED);
        let got: Vec<u32> = (0..10).map(|_| r.gen_rand()).collect();
        assert_eq!(
            got,
            [
                1288459236, 2139177191, 74803024, 3048110697, 1213569425, 644319261, 488134196,
                4290382401, 1747158433, 2782448644,
            ]
        );
    }

    #[test]
    fn rng_position_increments_per_call() {
        let mut r = rng::RNG::from(0);
        for expected_pos in 1..=5u32 {
            r.gen_rand();
            assert_eq!(r.position, expected_pos);
        }
    }

    #[test]
    fn rng_same_seed_gives_same_sequence() {
        let seq = |seed| {
            let mut r = rng::RNG::from(seed);
            (0..5).map(|_| r.gen_rand()).collect::<Vec<_>>()
        };
        assert_eq!(seq(12345), seq(12345));
        assert_ne!(seq(12345), seq(12346));
    }

    // ── spell ─────────────────────────────────────────────────────────────────

    #[test]
    fn spell_power_values() {
        let cases = [
            (Spell::Cure, 20u8),
            (Spell::Cura, 46),
            (Spell::Curaga, 86),
            (Spell::Curaja, 120),
        ];
        for (spell, expected) in cases {
            assert_eq!(spell.power(), expected, "{}", spell.name());
        }
    }

    #[test]
    fn spell_from_str_round_trips() {
        use std::str::FromStr;
        for name in ["Cure", "Cura", "Curaga", "Curaja"] {
            let s = Spell::from_str(name).unwrap();
            assert_eq!(s.name(), name);
        }
    }

    #[test]
    fn spell_from_str_invalid_errors() {
        use std::str::FromStr;
        for bad in ["cure", "CURE", "", "Curaga2", "Heal"] {
            assert!(Spell::from_str(bad).is_err(), "should fail: {bad}");
        }
    }

    // ── character / cast formula ───────────────────────────────────────────────
    //
    // Formula recap:
    //   base_multiplier = (2 + magic * (level + magic) / 256) * (1.5 if serenity else 1.0)
    //   bonus           = (rng_val % floor(spell_power * 12.5)) / 100
    //   heal            = floor((spell_power + bonus) * base_multiplier)

    #[test]
    fn cast_default_char_cure_bonus_range() {
        // lvl 70, mag 99, Cure (power 20), serenity → multiplier ≈ 101.033
        // Cure bonus range: rng % 250, so 0..=249 / 100 → 0.00..=2.49
        let c = default_char();
        let cases: &[(u32, i32)] = &[
            (0, 2020),   // min bonus (0)
            (1, 2021),   // bonus = 0.01
            (50, 2071),  // bonus = 0.50
            (100, 2121), // bonus = 1.00
            (249, 2272), // max bonus (2.49)
            (250, 2020), // wraps back to 0
            (500, 2020), // wraps again
        ];
        for &(rng_val, expected) in cases {
            assert_eq!(c.cast(rng_val), expected, "rng_val={rng_val}");
        }
    }

    #[test]
    fn cast_serenity_off_halves_heal() {
        // With serenity off the multiplier is exactly 2/3 of serenity-on
        let with = character::Character::new(70, 99, Spell::Cure, true);
        let without = character::Character::new(70, 99, Spell::Cure, false);
        let cases: &[(u32, i32)] = &[
            (0, 1347),   // floor(20 * 67.355)
            (249, 1514), // floor(22.49 * 67.355)
        ];
        for &(rng_val, expected) in cases {
            assert_eq!(without.cast(rng_val), expected, "rng_val={rng_val}");
            // serenity version should be strictly higher
            assert!(with.cast(rng_val) > without.cast(rng_val));
        }
    }

    #[test]
    fn cast_higher_magic_gives_higher_heal() {
        let low = character::Character::new(70, 50, Spell::Cure, true);
        let high = character::Character::new(70, 99, Spell::Cure, true);
        for rng_val in [0u32, 100, 249] {
            assert!(high.cast(rng_val) > low.cast(rng_val), "rng_val={rng_val}");
        }
    }

    #[test]
    fn cast_curaja_produces_much_higher_heal() {
        // Curaja power=120 vs Cure power=20 — same char
        let c_cure = character::Character::new(70, 99, Spell::Cure, true);
        let c_curaja = character::Character::new(70, 99, Spell::Curaja, true);
        // rng=0: Curaja heal = floor(120 * 101.033) = 12123
        assert_eq!(c_curaja.cast(0), 12123);
        assert!(c_curaja.cast(0) > c_cure.cast(0) * 5);
    }

    #[test]
    fn cast_low_stats_minimum_heal() {
        // lvl 1, mag 1, no serenity: multiplier ≈ 2.008
        let c = character::Character::new(1, 1, Spell::Cure, false);
        assert_eq!(c.cast(0), 40); // floor(20 * 2.0078) = 40
    }

    // ── rng_helper ────────────────────────────────────────────────────────────

    #[test]
    fn helper_new_fills_exact_iters() {
        let c = default_char();
        for iters in [1usize, 5, 10, 100] {
            let h = rng_helper::RNGHelper::new(Some(0), &c, iters);
            assert_eq!(h.values.len(), iters, "iters={iters}");
            assert_eq!(h.rng.position, iters as u32);
        }
    }

    #[test]
    fn helper_positions_are_sequential_from_one() {
        let c = default_char();
        let h = rng_helper::RNGHelper::new(Some(0), &c, 5);
        for (i, v) in h.values.iter().enumerate() {
            assert_eq!(v.position as usize, i + 1);
        }
    }

    #[test]
    fn helper_spell_values_match_formula() {
        // Seed 0 → rng vals 2357136044, 2546248239, 3071714933
        // Default char cast values verified against formula
        let c = default_char();
        let h = rng_helper::RNGHelper::new(Some(0), &c, 3);
        let spells: Vec<i32> = h.values.iter().map(|v| v.spell).collect();
        assert_eq!(spells, [2065, 2262, 2205]);
    }

    #[test]
    fn helper_chest_is_rng_mod_100() {
        let c = default_char();
        let h = rng_helper::RNGHelper::new(Some(0), &c, 5);
        // rng vals from seed 0: 2357136044, 2546248239, 3071714933, 3626093760, 2588848963
        let expected_chests = [
            2357136044u32 % 100,
            2546248239u32 % 100,
            3071714933u32 % 100,
            3626093760u32 % 100,
            2588848963u32 % 100,
        ];
        for (v, &expected) in h.values.iter().zip(expected_chests.iter()) {
            assert_eq!(v.chest as u32, expected, "pos={}", v.position);
        }
    }

    #[test]
    fn helper_next_slides_window_and_keeps_size() {
        let c = default_char();
        let mut h = rng_helper::RNGHelper::new(Some(0), &c, 3);
        let original_len = h.values.len();
        let second = h.values[1].spell;
        let third = h.values[2].spell;
        h.next(&c);
        assert_eq!(h.values.len(), original_len);
        assert_eq!(h.values[0].spell, second);
        assert_eq!(h.values[1].spell, third);
    }

    #[test]
    fn helper_next_advances_position() {
        let c = default_char();
        let mut h = rng_helper::RNGHelper::new(Some(0), &c, 3);
        let pos_before = h.rng.position;
        h.next(&c);
        assert_eq!(h.rng.position, pos_before + 1);
    }

    #[test]
    fn helper_apply_character_recalculates_spells_not_positions() {
        let c = default_char();
        let c2 = character::Character::new(50, 50, Spell::Cura, false);
        let mut h = rng_helper::RNGHelper::new(Some(0), &c, 3);
        let positions_before: Vec<u32> = h.values.iter().map(|v| v.position).collect();
        let raw_vals: Vec<u32> = h.values.iter().map(|v| v.value).collect();
        h.apply_character(&c2);
        // Positions and raw RNG values unchanged
        for (v, (&pos, &raw)) in h
            .values
            .iter()
            .zip(positions_before.iter().zip(raw_vals.iter()))
        {
            assert_eq!(v.position, pos);
            assert_eq!(v.value, raw);
        }
        // Spell values recomputed for new character
        let spells: Vec<i32> = h.values.iter().map(|v| v.spell).collect();
        assert_eq!(spells, [994, 1090, 1105]);
    }

    #[test]
    fn find_casts_finds_known_match() {
        let c = default_char();
        let target = vec![2262, 2205]; // positions 2-3 of seed 0
        let mut h = rng_helper::RNGHelper::new(Some(0), &c, 2);
        // Already at the right position after one next()
        let found = h.find_casts(&c, &target, Some(1));
        assert!(found);
    }

    #[test]
    fn find_casts_returns_false_when_no_match_in_limit() {
        let c = default_char();
        let impossible = vec![9999, 9999, 9999];
        let mut h = rng_helper::RNGHelper::new(Some(0), &c, 3);
        assert!(!h.find_casts(&c, &impossible, Some(1000)));
    }

    #[test]
    fn find_casts_partial_match_does_not_count() {
        let c = default_char();
        // First value of seed 0 is 2065 — but we ask for [2065, 9999]
        let partial = vec![2065, 9999];
        let mut h = rng_helper::RNGHelper::new(Some(0), &c, 2);
        assert!(!h.find_casts(&c, &partial, Some(500)));
    }

    // ── integration: find_seed ────────────────────────────────────────────────
    //
    // Each case uses a narrow range around the known seed so the test is fast.
    // All verified against the CLI with real game values.

    struct FindSeedCase {
        name: &'static str,
        level: u8,
        magic: u8,
        spell: Spell,
        serenity: bool,
        values: &'static [i32],
        expected_seed: u32,
        search_min: u32,
        search_max: u32,
    }

    #[test]
    fn find_seed_real_world_cases() {
        let cases = [
            FindSeedCase {
                name: "historical_default_char",
                level: 70,
                magic: 99,
                spell: Spell::Cure,
                serenity: true,
                values: &[2255, 2063, 2029, 2211, 2195],
                expected_seed: 6_357_987,
                search_min: 6_350_000,
                search_max: 6_360_000,
            },
            FindSeedCase {
                name: "high_mag_cure_serenity",
                level: 70,
                magic: 99,
                spell: Spell::Cure,
                serenity: true,
                values: &[2071, 2134, 2220, 2062, 2086],
                expected_seed: 6_541_629,
                search_min: 6_535_000,
                search_max: 6_545_000,
            },
            // Same seed as above, different values to find it
            FindSeedCase {
                name: "low_mag_curaja_1",
                level: 70,
                magic: 54,
                spell: Spell::Curaja,
                serenity: false,
                values: &[3474, 3800, 3495, 3629, 3430],
                expected_seed: 6_541_629,
                search_min: 6_540_000,
                search_max: 6_545_000,
            },
            FindSeedCase {
                name: "low_mag_curaja_2",
                level: 70,
                magic: 54,
                spell: Spell::Curaja,
                serenity: false,
                values: &[3794, 3582, 3622, 3628, 3648],
                expected_seed: 8_018_931,
                search_min: 8_000_000,
                search_max: 8_020_000,
            },
            FindSeedCase {
                name: "low_lvl_cura",
                level: 45,
                magic: 68,
                spell: Spell::Cura,
                serenity: true,
                values: &[2243, 2339, 2462, 2286, 2362],
                expected_seed: 7_849_347,
                search_min: 7_845_000,
                search_max: 7_850_000,
            },
        ];

        for case in &cases {
            let character =
                character::Character::new(case.level, case.magic, case.spell, case.serenity);
            let result = rng_helper::RNGHelper::find_seed(
                &character,
                case.values,
                case.search_min,
                case.search_max,
                500,
            );
            assert!(
                result.is_some(),
                "find_seed returned None for '{}'",
                case.name
            );
            assert_eq!(
                result.unwrap().rng.seed,
                case.expected_seed,
                "wrong seed for '{}'",
                case.name
            );
        }
    }

    #[test]
    fn find_seed_returns_none_when_not_in_range() {
        let c = default_char();
        // Seed 6357987 is real but we search a range that excludes it
        let values = &[2255, 2063, 2029, 2211, 2195];
        let result = rng_helper::RNGHelper::find_seed(&c, values, 0, 1000, 500);
        assert!(result.is_none());
    }

    #[test]
    fn find_seed_result_positions_values_at_head() {
        // After find_seed, the matched values should appear at the head of the window
        let c = default_char();
        let target: &[i32] = &[2255, 2063, 2029, 2211, 2195];
        let h = rng_helper::RNGHelper::find_seed(&c, target, 6_350_000, 6_360_000, 500).unwrap();
        let head: Vec<i32> = h
            .values
            .iter()
            .take(target.len())
            .map(|v| v.spell)
            .collect();
        assert_eq!(head, target);
    }
}
