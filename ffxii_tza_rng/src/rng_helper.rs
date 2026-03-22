use std::collections::VecDeque;

use serde::Serialize;

use crate::{character, rng};

#[derive(Serialize, Debug)]
pub struct ValueLens {
    pub position: u32,
    pub value: u32,
    pub spell: i32,
    pub chest: u8,
}

/// The RNG Helper struct holds a set of generated random numbers,
/// and can output them as `Spell` values or chest chances
///
/// Additionally, can locate the next set of matched `Spell` values in the given rng
#[derive(Debug)]
pub struct RNGHelper {
    pub values: VecDeque<ValueLens>,
    pub rng: rng::RNG,
}

/// Stack-only probe: returns true if `seed` produces `values` within `iters` steps.
fn check_seed(seed: u32, character: &character::Character, values: &[i32], iters: usize) -> bool {
    let len = values.len();
    const MAX_WINDOW: usize = 16;
    debug_assert!(len <= MAX_WINDOW);
    let mut window = [0i32; MAX_WINDOW];
    let mut rng = rng::RNG::from(seed);

    // Prime the window — mirrors RNGHelper::new(seed, character, len)
    for slot in window.iter_mut().take(len) {
        *slot = character.cast(rng.gen_rand());
    }

    // Advance then check — mirrors find_casts (next() before comparison)
    for _ in 0..iters {
        window.copy_within(1..len, 0);
        window[len - 1] = character.cast(rng.gen_rand());
        if window[..len] == values[..] {
            return true;
        }
    }
    false
}

impl RNGHelper {
    const LIMIT: usize = 100_000; // How many iterations to test

    /// Generates a new RNG list, with `iters` iterations filled
    pub fn new(seed: Option<u32>, character: &character::Character, iters: usize) -> RNGHelper {
        let mut _rng = match seed {
            Some(s) => rng::RNG::from(s),
            _ => rng::RNG::new(),
        };
        let values = VecDeque::with_capacity(iters);
        let mut helper = RNGHelper { values, rng: _rng };
        for _ in 0..iters {
            helper.push(character);
        }

        helper
    }

    /// Removes the first entry from the value lists
    fn pop(&mut self) {
        self.values.pop_front();
    }

    /// Adds new entries to the end of the value lists
    pub fn push(&mut self, character: &character::Character) {
        let next_rng = self.rng.gen_rand();
        self.values.push_back(ValueLens {
            position: self.rng.position,
            value: next_rng,
            spell: character.cast(next_rng),
            chest: (next_rng % 100) as u8,
        });
    }

    /// Cycles the rng list with a given character input
    pub fn next(&mut self, character: &character::Character) {
        self.pop();
        self.push(character);
    }

    /// If the character is changed, re-calc the spell outcomes
    pub fn apply_character(&mut self, character: &character::Character) {
        for value in &mut self.values {
            value.spell = character.cast(value.value);
        }
    }

    /// Given a list of spell values, cycle the rng until they're at the head, or `LIMIT` iterations has been passed
    pub fn find_casts(
        &mut self,
        character: &character::Character,
        values: &[i32],
        limit: Option<usize>,
    ) -> bool {
        let loop_limit = limit.unwrap_or(RNGHelper::LIMIT);
        for _ in 0..loop_limit {
            self.next(character);
            let mut matched = true;
            // Check the passed values against the spell_values - if any don't match, break and cycle again
            for (idx, val) in values.iter().enumerate() {
                if self.values[idx].spell != *val {
                    matched = false;
                    break;
                }
            }
            // If we get here, all values matched (or were None), so return true
            if matched {
                return true;
            }
        }
        // We got to the LIMIT iterations, nothing was found
        false
    }

    /// Given a character and set of cure values, try to find a seed that matches
    pub fn find_seed(
        character: &character::Character,
        values: &[i32],
        min: u32,
        max: u32,
        iters: usize,
    ) -> Option<RNGHelper> {
        let len = values.len();
        (min..max).find_map(|seed| {
            check_seed(seed, character, values, iters).then(|| {
                let mut helper = RNGHelper::new(Some(seed), character, len);
                helper.find_casts(character, values, Some(iters));
                helper
            })
        })
    }
}

impl Default for RNGHelper {
    fn default() -> Self {
        let character = character::Character::default();
        RNGHelper::new(Some(rng::RNG::DEFAULT_SEED), &character, 500)
    }
}
