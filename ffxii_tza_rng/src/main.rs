use ffxii_tza_rng::{character, rng_helper, spell};
use std::io::Write;

const MIN: u32 = 6_000_000;
const MAX: u32 = 16_777_216;
const ITERS: usize = 500;
const PROGRESS_INTERVAL: u32 = 100_000;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 4 {
        eprintln!("Usage: {} <level> <magic> <val1> [val2 ...]", args[0]);
        std::process::exit(1);
    }

    let level: u8 = args[1].parse().expect("level must be u8");
    let magic: u8 = args[2].parse().expect("magic must be u8");
    let values: Vec<i32> = args[3..]
        .iter()
        .map(|s| s.parse().expect("values must be i32"))
        .collect();

    let character = character::Character::new(level, magic, spell::Spell::Cure, true);
    let len = values.len();

    eprintln!("Searching seeds {}..{} (iters={})...", MIN, MAX, ITERS);

    let mut result: Option<rng_helper::RNGHelper> = None;

    for seed in MIN..MAX {
        if seed % PROGRESS_INTERVAL == 0 && seed > 0 {
            let pct = seed * 100 / MAX;
            print!("\r  {:.1}%  ({}/{})", pct, seed, MAX);
            std::io::stdout().flush().unwrap();
        }

        let mut helper = rng_helper::RNGHelper::new(Some(seed), &character, len);
        if helper.find_casts(&character, &values, Some(ITERS)) {
            result = Some(helper);
            break;
        }
    }

    print!("\r");

    match result {
        None => eprintln!("No seed found in range {}..{}", MIN, MAX),
        Some(mut helper) => {
            println!("Seed:     {}", helper.rng.seed);
            println!("Position: {}", helper.rng.position);
            println!();
            println!("Matched + next 5 values:");
            for v in helper.values.iter() {
                println!("  pos {:>4}  cure={}", v.position, v.spell);
            }
            for _ in 0..5 {
                helper.push(&character);
                let v = helper.values.back().unwrap();
                println!("  pos {:>4}  cure={}", v.position, v.spell);
            }
        }
    }
}
