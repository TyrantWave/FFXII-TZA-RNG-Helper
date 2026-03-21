
pub mod character;
pub mod rng_helper;
pub mod rng;
pub mod spell;

#[cfg(test)]
mod tests {
    use crate::*;

    // ── rng ──────────────────────────────────────────────────────────────────

    #[test]
    fn rng_known_values_seed_0() {
        let mut r = rng::RNG::from(0);
        let got: Vec<u32> = (0..10).map(|_| r.gen_rand()).collect();
        let expected = [
            2357136044, 2546248239, 3071714933, 3626093760, 2588848963,
            3684848379, 2340255427, 3638918503, 1819583497, 2678185683,
        ];
        assert_eq!(got, expected);
    }

    #[test]
    fn rng_known_values_default_seed() {
        let mut r = rng::RNG::from(rng::RNG::DEFAULT_SEED);
        let got: Vec<u32> = (0..10).map(|_| r.gen_rand()).collect();
        let expected = [
            1288459236, 2139177191, 74803024, 3048110697, 1213569425,
            644319261, 488134196, 4290382401, 1747158433, 2782448644,
        ];
        assert_eq!(got, expected);
    }

    #[test]
    fn rng_position_increments() {
        let mut r = rng::RNG::from(0);
        assert_eq!(r.position, 0);
        r.gen_rand();
        assert_eq!(r.position, 1);
        r.gen_rand();
        assert_eq!(r.position, 2);
    }

    // ── spell ─────────────────────────────────────────────────────────────────

    #[test]
    fn spell_power_values() {
        use spell::Spell;
        assert_eq!(Spell::Cure.power(),   20);
        assert_eq!(Spell::Cura.power(),   46);
        assert_eq!(Spell::Curaga.power(), 86);
        assert_eq!(Spell::Curaja.power(), 120);
    }

    #[test]
    fn spell_from_str_round_trip() {
        use spell::Spell;
        use std::str::FromStr;
        for name in ["Cure", "Cura", "Curaga", "Curaja"] {
            let s = Spell::from_str(name).unwrap();
            assert_eq!(s.name(), name);
        }
        assert!(Spell::from_str("unknown").is_err());
    }

    // ── character ─────────────────────────────────────────────────────────────

    #[test]
    fn character_cast_table() {
        // default: level=70, magic=99, Cure, serenity=true
        let c = character::Character::default();
        let cases: &[(u32, i32)] = &[
            (0,   2020),
            (1,   2021),
            (50,  2071),
            (100, 2121),
            (249, 2272),
        ];
        for &(rng_val, expected) in cases {
            assert_eq!(c.cast(rng_val), expected, "rng_val={rng_val}");
        }
    }

    // ── rng_helper ────────────────────────────────────────────────────────────

    #[test]
    fn rng_helper_push_spell_values() {
        let c = character::Character::default();
        let h = rng_helper::RNGHelper::new(Some(0), &c, 3);
        let spells: Vec<i32> = h.values.iter().map(|v| v.spell).collect();
        assert_eq!(spells, vec![2065, 2262, 2205]);
    }

    #[test]
    fn rng_helper_push_increments_position() {
        let c = character::Character::default();
        let h = rng_helper::RNGHelper::new(Some(0), &c, 5);
        assert_eq!(h.values.len(), 5);
        assert_eq!(h.rng.position, 5);
        for (i, v) in h.values.iter().enumerate() {
            assert_eq!(v.position as usize, i + 1);
        }
    }

    #[test]
    fn rng_helper_next_slides_window() {
        let c = character::Character::default();
        let mut h = rng_helper::RNGHelper::new(Some(0), &c, 3);
        let second_spell = h.values[1].spell;
        h.next(&c);
        // old [1] is now [0]
        assert_eq!(h.values[0].spell, second_spell);
        assert_eq!(h.values.len(), 3);
    }

    #[test]
    fn rng_helper_apply_character_recalcs() {
        let c = character::Character::default();
        let c2 = character::Character::new(50, 50, spell::Spell::Cura, false);
        let mut h = rng_helper::RNGHelper::new(Some(0), &c, 3);
        h.apply_character(&c2);
        let spells: Vec<i32> = h.values.iter().map(|v| v.spell).collect();
        assert_eq!(spells, vec![994, 1090, 1105]);
    }

    #[test]
    fn rng_helper_find_seed() {
        let character = character::Character::default();
        let values: Vec<i32> = vec![2255, 2063, 2029, 2211, 2195];
        let h = rng_helper::RNGHelper::find_seed(&character, &values, 6_000_000, 6_500_000, 1_000).unwrap();
        assert_eq!(h.rng.seed, 6_357_987);
    }
}
