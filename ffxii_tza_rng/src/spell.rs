use serde::{Deserialize, Serialize};
use std::str::FromStr;

#[derive(Serialize, Deserialize, Debug, Copy, Clone)]
pub enum Spell {
    Cure,
    Cura,
    Curaga,
    Curaja,
}

impl Spell {
    pub fn name(&self) -> &str {
        match *self {
            Spell::Cure => "Cure",
            Spell::Cura => "Cura",
            Spell::Curaga => "Curaga",
            Spell::Curaja => "Curaja",
        }
    }

    pub fn power(&self) -> u8 {
        match *self {
            Spell::Cure => 20,
            Spell::Cura => 46,
            Spell::Curaga => 86,
            Spell::Curaja => 120,
        }
    }
}

#[derive(Debug)]
pub struct ParseSpellError;

impl std::fmt::Display for ParseSpellError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("unknown spell: expected Cure, Cura, Curaga, or Curaja")
    }
}

impl std::error::Error for ParseSpellError {}

impl FromStr for Spell {
    type Err = ParseSpellError;

    fn from_str(s: &str) -> Result<Self, ParseSpellError> {
        match s {
            "Cure" => Ok(Spell::Cure),
            "Cura" => Ok(Spell::Cura),
            "Curaga" => Ok(Spell::Curaga),
            "Curaja" => Ok(Spell::Curaja),
            _ => Err(ParseSpellError),
        }
    }
}
