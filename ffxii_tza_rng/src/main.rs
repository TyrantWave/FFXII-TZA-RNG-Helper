use ffxii_tza_rng::{character, rng_helper, spell};
use std::str::FromStr;

const MIN: u32 = 6_000_000;
const MAX: u32 = 16_777_216;
const ITERS: usize = 500;
const TRAILING: usize = 5;

fn usage(bin: &str) -> ! {
    eprintln!("Usage:");
    eprintln!("  {bin} find-seed     <level> <magic> <spell> [--no-serenity] <val1> [val2 ...]");
    eprintln!(
        "  {bin} find-position <seed> <level> <magic> <spell> [--no-serenity] <val1> [val2 ...]"
    );
    eprintln!();
    eprintln!("Spells: Cure, Cura, Curaga, Curaja");
    std::process::exit(1);
}

/// Splits a tail of args into (serenity, values), stripping --no-serenity.
fn parse_tail(tail: &[String]) -> (bool, Vec<i32>) {
    let serenity = !tail.iter().any(|a| a == "--no-serenity");
    let values = tail
        .iter()
        .filter(|a| *a != "--no-serenity")
        .map(|s| {
            s.parse::<i32>().unwrap_or_else(|_| {
                eprintln!("Error: expected heal value, got '{s}'");
                std::process::exit(1);
            })
        })
        .collect();
    (serenity, values)
}

fn print_results(
    helper: &mut rng_helper::RNGHelper,
    character: &character::Character,
    spell_label: &str,
) {
    println!("Seed:     {}", helper.rng.seed);
    println!("Position: {}", helper.rng.position);
    println!();
    println!("Matched + next {TRAILING} values:");
    for v in helper.values.iter() {
        println!(
            "  pos {:>5}  {spell_label}={:<6}  chest={:>2}%",
            v.position, v.spell, v.chest
        );
    }
    for _ in 0..TRAILING {
        helper.push(character);
        let v = helper.values.back().unwrap();
        println!(
            "  pos {:>5}  {spell_label}={:<6}  chest={:>2}%",
            v.position, v.spell, v.chest
        );
    }
}

fn cmd_find_seed(args: &[String]) {
    if args.len() < 3 {
        eprintln!("find-seed requires at least: <level> <magic> <spell> <val1>");
        std::process::exit(1);
    }
    let level: u8 = args[0].parse().unwrap_or_else(|_| {
        eprintln!("Error: level must be 1-99");
        std::process::exit(1);
    });
    let magic: u8 = args[1].parse().unwrap_or_else(|_| {
        eprintln!("Error: magic must be 1-99");
        std::process::exit(1);
    });
    let sp = spell::Spell::from_str(&args[2]).unwrap_or_else(|_| {
        eprintln!(
            "Error: unknown spell '{}'. Use Cure, Cura, Curaga or Curaja",
            args[2]
        );
        std::process::exit(1);
    });
    let (serenity, values) = parse_tail(&args[3..]);
    if values.is_empty() {
        eprintln!("Error: provide at least one heal value");
        std::process::exit(1);
    }

    let spell_label = sp.name().to_lowercase();
    let character = character::Character::new(level, magic, sp, serenity);
    let n = std::thread::available_parallelism()
        .map(|p| p.get())
        .unwrap_or(4);
    eprintln!(
        "Searching seeds {}..{} across {} threads (iters={})...",
        MIN, MAX, n, ITERS
    );

    match rng_helper::RNGHelper::find_seed_parallel(&character, &values, MIN, MAX, ITERS) {
        None => eprintln!("No seed found in range {}..{}", MIN, MAX),
        Some(mut helper) => print_results(&mut helper, &character, &spell_label),
    }
}

fn cmd_find_position(args: &[String]) {
    if args.len() < 4 {
        eprintln!("find-position requires at least: <seed> <level> <magic> <spell> <val1>");
        std::process::exit(1);
    }
    let seed: u32 = args[0].parse().unwrap_or_else(|_| {
        eprintln!("Error: seed must be a u32");
        std::process::exit(1);
    });
    let level: u8 = args[1].parse().unwrap_or_else(|_| {
        eprintln!("Error: level must be 1-99");
        std::process::exit(1);
    });
    let magic: u8 = args[2].parse().unwrap_or_else(|_| {
        eprintln!("Error: magic must be 1-99");
        std::process::exit(1);
    });
    let sp = spell::Spell::from_str(&args[3]).unwrap_or_else(|_| {
        eprintln!(
            "Error: unknown spell '{}'. Use Cure, Cura, Curaga or Curaja",
            args[3]
        );
        std::process::exit(1);
    });
    let (serenity, values) = parse_tail(&args[4..]);
    if values.is_empty() {
        eprintln!("Error: provide at least one heal value");
        std::process::exit(1);
    }

    let spell_label = sp.name().to_lowercase();
    let character = character::Character::new(level, magic, sp, serenity);
    let len = values.len();

    let mut helper = rng_helper::RNGHelper::new(Some(seed), &character, len);
    if helper.find_casts(&character, &values, None) {
        print_results(&mut helper, &character, &spell_label);
    } else {
        eprintln!("Position not found in seed {seed} within the search limit");
    }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        usage(&args[0]);
    }
    match args[1].as_str() {
        "find-seed" => cmd_find_seed(&args[2..]),
        "find-position" => cmd_find_position(&args[2..]),
        _ => usage(&args[0]),
    }
}
