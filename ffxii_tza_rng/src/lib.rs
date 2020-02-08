
pub mod character;
pub mod rng_helper;
pub mod rng;
pub mod spell;

#[cfg(test)]
mod tests {
    use crate::*;
    #[test]
    fn find_seed() {
        let character = character::Character::default();
        let values: Vec<i32> = vec![2255, 2063, 2029, 2211, 2195];
        let rng_helper = rng_helper::RNGHelper::find_seed(&character, &values, 6_000_000, 6_500_000, 1_000).unwrap();
        assert_eq!(rng_helper.rng.seed, 6_357_987);
    }
}
