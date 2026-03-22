# FFXII TZA RNG Helper

A tool for tracking and predicting the RNG state in *Final Fantasy XII: The Zodiac Age*. Enter observed cure values to find your current seed and position in the RNG sequence, then see upcoming values to plan your actions.

---

## How it works

FFXII TZA uses a Mersenne Twister (MT19937) RNG. Every heal, chest roll, and many other game events draw from this shared sequence. Because the algorithm is deterministic, knowing your current seed and position lets you predict all future draws.

### Heal formula

```
base  = (2 + magic × (level + magic) / 256) × (1.5 if Serenity else 1.0)
bonus = (rng_value % floor(spell_power × 12.5)) / 100
heal  = floor((spell_power + bonus) × base)
```

Spell power values: Cure = 20, Cura = 46, Curaga = 86, Curaja = 120.

### Finding your seed

On **PS4**, the game always starts from the static seed `4537` — you already know the seed and only need to find your position using **Find Position**.

On **Switch**, the seed is randomised at boot. The tool searches `6,000,000–16,777,216` by default, which covers the observed Switch seed range. For each candidate seed it simulates up to 500 RNG draws and checks whether the observed heal values appear consecutively.

---

## Usage

### Web app

Enter your character stats in the left panel (level, magic, spell, serenity), then enter observed heal values and click **Find Seed** or **Find Position**.

- **Find Seed** — searches the seed space using your observed heals, then automatically finds your position and loads the table to that point.
- **Find Position** — if you already know the seed, finds where your observed heals appear within it and loads the table to that point.

The values table shows the next 100 RNG draws as heal amounts and chest percentages, so you can plan ahead.

> **For best results:** cast in an area with no NPCs loaded, and with no active status effects that trigger automatically (Regen, Poison, etc.). NPC movement consumes RNG draws; player movement does not. Multiple party members are fine — Cura and Curaja heal the whole party, giving more numbers per cast — but note the order the individual heals appear on screen and enter them in that order.

### CLI

A command-line tool is included for quick testing and verification.

```bash
cargo build -p ffxii_tza_rng --release

# Usage: ffxii_tza_rng <level> <magic> <heal1> [heal2 ...]
./target/release/ffxii_tza_rng 70 99 2255 2063 2029 2211 2195
```

Output:
```
Seed:     6357987
Position: 7

Matched + next 5 values:
  pos    3  cure=2255
  pos    4  cure=2063
  pos    5  cure=2029
  pos    6  cure=2211
  pos    7  cure=2195
  pos    8  cure=2131
  pos    9  cure=2233
  pos   10  cure=2079
  pos   11  cure=2264
  pos   12  cure=2177
```

The CLI assumes Cure and Serenity on. For other spell/stat configurations use the web app.

---

## Project structure

```
/
├── ffxii_tza_rng/          # Core Rust library — RNG, formula, seed search
├── ffxii_tza_rng_wasm/     # wasm-bindgen wrapper exposing the library to JS
└── frontend/               # Angular app
    └── src/
        ├── app/
        │   ├── services/   # WasmService — WASM lifecycle and worker bridge
        │   └── components/ # CharacterPanel, ControlsPanel, ValuesTable
        └── workers/        # Web Worker for non-blocking seed search
```

### Tech stack

| Layer | Technology |
|-------|-----------|
| Core library | Rust 2021 |
| WASM bindings | wasm-bindgen, wasm-pack |
| Frontend | Angular 21, Angular Material |
| Reactivity | Angular signals (zoneless) |
| Seed search | Web Worker (non-blocking) |
| Tests | `cargo test` (Rust), Vitest via `ng test` (Angular) |

---

## Development

### Prerequisites

- Rust (stable)
- [wasm-pack](https://rustwasm.github.io/wasm-pack/)
- Node.js + npm
- Angular CLI (`npm i -g @angular/cli`)

### Build the WASM package

```bash
cd ffxii_tza_rng_wasm
wasm-pack build --target web --out-dir pkg
```

The `frontend/public/wasm/` directory and `frontend/node_modules/ffxii-tza-rng-wasm` are both symlinked to `pkg/`, so a rebuild is picked up immediately with no copy step.

### Run the app

```bash
cd frontend
npm install
ng serve
```

### Run tests

```bash
# Rust core
cargo test -p ffxii_tza_rng

# Angular
cd frontend && ng test --no-watch
```

---

## Verified seeds

These seed + value combinations have been confirmed against real gameplay on Nintendo Switch:

| Seed | Character | Values (consecutive Cure heals) |
|------|-----------|----------------------------------|
| 6,357,987 | lvl 70, mag 99, Cure, Serenity | 2255, 2063, 2029, 2211, 2195 |
| 6,541,629 | lvl 70, mag 99, Cure, Serenity | 2071, 2134, 2220, 2062, 2086 |
