use ffxii_tza_rng::{character, rng_helper, spell};
use serde::Deserialize;
use std::str::FromStr;
use wasm_bindgen::prelude::*;

#[derive(Deserialize)]
struct CharacterInput {
    level: u8,
    magic: u8,
    spell: String,
    serenity: bool,
}

fn js_to_character(val: JsValue) -> Result<character::Character, JsValue> {
    let input: CharacterInput = serde_wasm_bindgen::from_value(val)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    let sp = spell::Spell::from_str(&input.spell)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    Ok(character::Character::new(input.level, input.magic, sp, input.serenity))
}

#[wasm_bindgen]
pub struct RNGHelper {
    inner: rng_helper::RNGHelper,
}

#[wasm_bindgen]
impl RNGHelper {
    #[wasm_bindgen(constructor)]
    pub fn new(seed: Option<u32>, character: JsValue, iters: usize) -> Result<RNGHelper, JsValue> {
        Ok(RNGHelper {
            inner: rng_helper::RNGHelper::new(seed, &js_to_character(character)?, iters),
        })
    }

    pub fn push(&mut self, character: JsValue) -> Result<(), JsValue> {
        self.inner.push(&js_to_character(character)?);
        Ok(())
    }

    pub fn next(&mut self, character: JsValue) -> Result<(), JsValue> {
        self.inner.next(&js_to_character(character)?);
        Ok(())
    }

    pub fn apply_character(&mut self, character: JsValue) -> Result<(), JsValue> {
        self.inner.apply_character(&js_to_character(character)?);
        Ok(())
    }

    pub fn find_casts(
        &mut self,
        character: JsValue,
        values: JsValue,
        limit: Option<usize>,
    ) -> Result<bool, JsValue> {
        let vals: Vec<i32> = serde_wasm_bindgen::from_value(values)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        Ok(self.inner.find_casts(&js_to_character(character)?, &vals, limit))
    }

    pub fn values(&self) -> Result<JsValue, JsValue> {
        serde_wasm_bindgen::to_value(&self.inner.values)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    pub fn seed(&self) -> u32 {
        self.inner.rng.seed
    }

    pub fn position(&self) -> u32 {
        self.inner.rng.position
    }

    pub fn find_seed(
        character: JsValue,
        values: JsValue,
        min: u32,
        max: u32,
        iters: usize,
    ) -> Result<Option<RNGHelper>, JsValue> {
        let vals: Vec<i32> = serde_wasm_bindgen::from_value(values)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        Ok(
            rng_helper::RNGHelper::find_seed(&js_to_character(character)?, &vals, min, max, iters)
                .map(|inner| RNGHelper { inner }),
        )
    }
}
