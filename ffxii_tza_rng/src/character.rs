use crate::spell;

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Copy, Clone)]
pub struct Character {
    pub level: u8,
    pub magic: u8,
    pub spell: spell::Spell,
    pub serenity: bool,
    // Precomputed constants derived from the fields above — avoids recomputing on every cast().
    modulus: u32, // (spell.power() * 12.5).floor() — the bonus range
    base: f64,    // spell.power() * base_multiplier — the constant heal component
    scale: f64,   // base_multiplier / 100.0 — converts bonus remainder to heal contribution
}

impl Character {
    pub fn new(level: u8, magic: u8, spell: spell::Spell, serenity: bool) -> Character {
        let base_multiplier = (2.0 + magic as f64 * (level as u16 + magic as u16) as f64 / 256.0)
            * if serenity { 1.5 } else { 1.0 };
        let power = spell.power() as f64;
        Character {
            level,
            magic,
            spell,
            serenity,
            modulus: (power * 12.5).floor() as u32,
            base: power * base_multiplier,
            scale: base_multiplier / 100.0,
        }
    }

    pub fn cast(&self, rng_val: u32) -> i32 {
        (self.base + (rng_val % self.modulus) as f64 * self.scale) as i32
    }
}

impl Default for Character {
    fn default() -> Self {
        Character::new(70, 99, spell::Spell::Cure, true)
    }
}
