use serde_derive::{Deserialize, Serialize};
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

impl FromStr for Spell {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, ()> {
        match s {
            "Cure" => Ok(Spell::Cure),
            "Cura" => Ok(Spell::Cura),
            "Curaga" => Ok(Spell::Curaga),
            "Curaja" => Ok(Spell::Curaja),
            _ => Err(()),
        }
    }
}
