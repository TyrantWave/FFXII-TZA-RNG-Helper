use rayon::prelude::*;
use serde_derive::{Deserialize, Serialize};

use crate::{character, rng};

#[derive(Serialize, Deserialize, Debug)]
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
#[derive(Serialize, Deserialize, Debug)]
pub struct RNGHelper {
    pub values: Vec<ValueLens>,
    pub rng: rng::RNG,
}

impl<'a> RNGHelper {
    const LIMIT: usize = 100_000; // How many iterations to test

    /// Generates a new RNG list, with `iters` iterations filled
    pub fn new(seed: Option<u32>, character: &character::Character, iters: usize) -> RNGHelper {
        let mut _rng = match seed {
            Some(s) => rng::RNG::from(s),
            _ => rng::RNG::new(),
        };
        let values = Vec::new();
        let mut helper = RNGHelper { values, rng: _rng };
        for _ in 0..iters {
            helper.push(character);
        }

        helper
    }

    /// Removes the first entry from the value lists
    fn pop(&mut self) {
        self.values.remove(0);
    }

    /// Adds new entries to the end of the value lists
    pub fn push(&mut self, character: &character::Character) {
        let next_rng = self.rng.gen_rand();
        self.values.push(ValueLens {
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
        values: &Vec<i32>,
        limit: Option<usize>,
    ) -> bool {
        let loop_limit = if limit.is_some() {
            limit.unwrap()
        } else {
            RNGHelper::LIMIT
        };
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
    /// This may be super slow
    pub fn find_seed(
        character: &character::Character,
        values: &Vec<i32>,
        min: u32,
        max: u32,
        iters: usize,
    ) -> Option<RNGHelper> {
        let seeds = min..max;
        let len = values.len();
        println!("Character: {:#?}", character);
        println!("Values: {:#?}", values);
        seeds
            .into_iter() // into_par_iter
            .flat_map(|seed| {
                println!("Checking seed: {}", seed);
                let mut helper = RNGHelper::new(Some(seed), character, len);
                if helper.find_casts(character, values, Some(iters)) {
                    return Some(helper);
                };
                None
            })
            .find(|_| true) // find_any
    }
}

impl Default for RNGHelper {
    fn default() -> Self {
        let character = character::Character::default();
        RNGHelper::new(Some(rng::RNG::DEFAULT_SEED), &character, 500)
    }
}
