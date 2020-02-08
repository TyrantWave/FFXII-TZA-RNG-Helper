use crate::spell;

use serde_derive::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Copy, Clone)]
pub struct Character {
    pub level: u8,
    pub magic: u8,
    pub spell: spell::Spell,
    pub serenity: bool,
}

impl Character {
    pub fn new(level: u8, magic: u8, spell: spell::Spell, serenity: bool) -> Character {
        Character {
            level,
            magic,
            spell,
            serenity,
        }
    }

    fn base_multiplier(&self) -> f64 {
        (2.0 + self.magic as f64 * (self.level + self.magic) as f64 / 256.0)
            * (if self.serenity { 1.5 } else { 1.0 })
    }

    pub fn cast(&self, rng_val: u32) -> i32 {
        let bonus: f64 =
            (rng_val % (self.spell.power() as f64 * 12.5).floor() as u32) as f64 / 100.0;
        self.calculate_heal(bonus)
    }

    fn calculate_heal(&self, bonus: f64) -> i32 {
        let total_power = self.spell.power() as f64 + bonus;
        (total_power * self.base_multiplier()) as i32
    }
}

impl Default for Character {
    fn default() -> Self {
        Character::new(70, 99, spell::Spell::Cure, true)
    }
}
