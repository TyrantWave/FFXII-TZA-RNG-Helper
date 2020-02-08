use std::str::FromStr;

use log::*;
use serde_derive::{Deserialize, Serialize};
use yew::{html, Component, ComponentLink, Href, Html, InputData, Renderable, ShouldRender, Bridge, Bridged};
use yew::services::ConsoleService;
use yew::virtual_dom::VNode;

use ffxii_tza_rng::{character::Character, rng_helper::RNGHelper, rng::RNG, spell::Spell};
use ffxii_tza_rng::rng_helper::ValueLens;

use crate::worker;

#[derive(Default)]
struct FFXIIApp {
    character: Character,
    rng_helper: RNGHelper,
    cure_values: [Option<i32>; 5],
    seed_min: Option<u32>,
    seed_max: Option<u32>,
    seed_iters: Option<usize>,
    finding: bool,
}

pub struct App {
    state: FFXIIApp,
    link: ComponentLink<Self>,
    console: ConsoleService,
    worker: Box<dyn Bridge<worker::Worker>>,
}

pub enum Msg {
    StatChange(String, String),
    SetSpell(String),
    SetCure(usize, String),
    ToggleSerenity,
    FindNext,
    SeedChange(String),
    SeedParamChange(String, String),
    FindSeed,
    FindResult(Option<RNGHelper>),
}

impl Component for App {
    type Message = Msg;
    type Properties = ();

    fn create(_: Self::Properties, link: ComponentLink<Self>) -> Self {
        let callback = link.callback(|helper| Msg::FindResult(helper));
        let worker = worker::Worker::bridge(callback);
        App {
            state: FFXIIApp {
                seed_min: Some(5_500_000u32),
                seed_max: Some(7_500_000u32),
                seed_iters: Some(1000),
                finding: false,
                ..Default::default()
            },
            link,
            console: ConsoleService::new(),
            worker,
        }
    }

    fn update(&mut self, msg: Self::Message) -> ShouldRender {
        match msg {
            Msg::StatChange(attr, raw) => {
                let mut value = match raw.parse::<u8>() {
                    Ok(value) => value,
                    _ => 1,
                };
                if value > 99 {
                    value = 99;
                }
                match attr.as_str() {
                    "level" => self.state.character.level = value,
                    "magic" => self.state.character.magic = value,
                    _ => return false,
                }
                self.state.rng_helper.apply_character(&self.state.character);
            }
            Msg::ToggleSerenity => {
                self.state.character.serenity = !self.state.character.serenity;
                self.state.rng_helper.apply_character(&self.state.character);
            }
            Msg::SetSpell(spell) => {
                self.state.character.spell = Spell::from_str(spell.as_str()).unwrap_or(Spell::Cure);
                self.state.rng_helper.apply_character(&self.state.character);
            }
            Msg::SetCure(idx, val) => {
                self.state.cure_values[idx] = match val.parse::<i32>() {
                    Ok(value) => Some(value),
                    _ => None,
                };
            }
            Msg::FindNext => {
                let values = &self.get_cure_values();
                self.console.log(&"Searching for next pos");
                if self
                    .state
                    .rng_helper
                    .find_casts(&self.state.character, &values, None)
                {
                    return true;
                }
                return false;
            }
            Msg::SeedChange(val) => {
                let seed = val.parse::<u32>().unwrap_or(RNG::DEFAULT_SEED);
                self.state.rng_helper = RNGHelper::new(Some(seed), &self.state.character, 500);
            }
            Msg::SeedParamChange(param, raw) => match param.as_str() {
                "min" => {
                    self.state.seed_min = match raw.parse::<u32>() {
                        Ok(v) => Some(v),
                        _ => None,
                    };
                }
                "max" => {
                    self.state.seed_max = match raw.parse::<u32>() {
                        Ok(v) => Some(v),
                        _ => None,
                    };
                }
                "iters" => {
                    self.state.seed_iters = match raw.parse::<usize>() {
                        Ok(v) => Some(v),
                        _ => None,
                    };
                }
                _ => return false,
            },
            Msg::FindSeed => {
                let values = self.get_cure_values();
                if values.is_empty() {
                    return false;
                }
                let min = match &self.state.seed_min {
                    Some(v) => *v,
                    None => 1,
                };
                let max = match &self.state.seed_max {
                    Some(v) => *v,
                    None => 0xffff_ffff,
                };
                let iters = match &self.state.seed_iters {
                    Some(v) => *v,
                    None => 5_000,
                };
                self.worker.send(worker::Request::FindSeed(worker::Params {
                    character: self.state.character.clone(),
                    cure_values: values,
                    min,
                    max,
                    iters,
                }));
                self.state.finding = true;
                //                match RNGHelper::find_seed(&self.state.character, &values, min, max, iters) {
                //                    Some(helper) => {
                //                        self.state.rng_helper = helper;
                //                        // Fill to 500
                //                        while self.state.rng_helper.values.len() < 500 {
                //                            self.state.rng_helper.push(&self.state.character);
                //                        }
                //                    }
                //                    None => {
                //                        self.console.log(&"Couldn:t find a seed :(");
                //                        return false;
                //                    }
                //                }
            }
            Msg::FindResult(helper) => {
                self.state.finding = false;
                match helper {
                    Some(h) => self.state.rng_helper = h,
                    None => {
                        self.console.log(&"No seed found :(");
                        return false;
                    }
                }
            }
        }
        true
    }
    
    fn view(&self) -> Html {
        html! {
        <section class="section" style="height: 100vh;">
            <div class="container" style="height: 100%;">
                <div class="columns" style="height: 100%;">
                    <div class="column">
                        { self.view_character() }
                        { self.view_seed() }
                    </div>
                    <div class="column">
                        { self.view_cure() }
                    </div>
                    <div class="column is-half" style="height: 100%;">
                        { self.view_results() }
                    </div>
                </div>
            </div>
        </section>
        }
    }
}


impl App {
    fn get_cure_values(&self) -> Vec<i32> {
        // First gather the cure values
        let mut values = vec![];
        for opt in &self.state.cure_values {
            match opt {
                Some(val) => values.push(*val),
                None => break,
            }
        }
        values
    }

    fn spell_opts(&self) -> Html {
        let spell = self.state.character.spell.name();
        html! {
        <>
            <option onclick=self.link.callback(|_| Msg::SetSpell("Cure".to_string()))
                    selected={spell == "Cure"}>
                { "Cure" }
            </option>
            <option onclick=self.link.callback(|_| Msg::SetSpell("Cura".to_string()))
                    selected={spell == "Cura"}>
                { "Cura" }
            </option>
            <option onclick=self.link.callback(|_| Msg::SetSpell("Curaga".to_string()))
                    selected={spell == "Curaga"}>
                { "Curaga" }
            </option>
            <option onclick=self.link.callback(|_| Msg::SetSpell("Curaja".to_string()))
                    selected={spell == "Curaja"}>
                { "Curaja" }
            </option>
        </>
        }
    }

    fn view_character(&self) -> Html {
        html! {
        <div class="box">
            <h2 class="subtitle has-text-centered">{"Character"}</h2>
            <div class="field is-horizontal">
                <div class="field-label is-normal">
                    <label class="label">{"Level"}</label>
                </div>
                <div class="field-body">
                    <div class="field">
                        <div class="control is-expanded">
                            <input class="input"
                                   oninput=self.link.callback(
                                        |val: InputData| Msg::StatChange("level".to_string(), val.value)
                                    )
                                   value=&self.state.character.level>
                            </input>
                        </div>
                    </div>
                </div>
            </div>
            <div class="field is-horizontal">
                <div class="field-label is-normal">
                    <label class="label">{"Magic"}</label>
                </div>
                <div class="field-body">
                    <div class="field">
                        <div class="control is-expanded">
                            <input class="input"
                                   oninput=self.link.callback(
                                        |val: InputData| Msg::StatChange("magic".to_string(), val.value)
                                    )
                                   value=&self.state.character.magic>
                            </input>
                        </div>
                    </div>
                </div>
            </div>
            <div class="field is-horizontal">
                <div class="field-label is-normal">
                    <label class="label">{"Spell"}</label>
                </div>
                <div class="field-body">
                    <div class="field">
                        <div class="control is-expanded">
                            <div class="select is-fullwidth">
                              <select>
                                { self.spell_opts() }
                              </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="field is-horizontal">
                <div class="field-label">
                    <label class="label is-normal">{"Serenity"}</label>
                </div>
                <div class="field-body">
                    <div class="field" style="display: flex; align-items: center;">
                        <div class="control" style="display: flex; align-items: center;">
                            <input checked=self.state.character.serenity
                                   onclick=self.link.callback(|_| Msg::ToggleSerenity)
                                   type="checkbox">
                            </input>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        }
    }

    fn view_find_seed(&self) -> Html {
        html! {
        <div class="control">
            {
                if self.state.finding {
                    html! {
                        <button class="button is-error">
                            {"Searching..."}
                        </button>
                    }
                } else {
                    html! {
                        <button onclick=self.link.callback(|_| Msg::FindSeed)
                                class="button is-primary">
                            {"Search"}
                        </button>
                    }
                }
            }
        </div>
        }
    }

    fn view_seed(&self) -> Html {
        html! {
        <div class="box">
            <h2 class="subtitle has-text-centered">{"Seed"}</h2>
            <div class="field has-addons">
                { self.view_find_seed() }
                <div class="control is-expanded">
                    <input class="input"
                           oninput=self.link.callback(
                                |val: InputData| Msg::SeedChange(val.value)
                            )
                           value=&self.state.rng_helper.rng.seed>
                    </input>
                </div>
            </div>
            <div class="field is-horizontal">
                <div class="field-label is-normal">
                    <label class="label">{"Min"}</label>
                </div>
                <div class="field-body">
                    <div class="field">
                        <div class="control is-expanded">
                            <input class="input"
                                   oninput=self.link.callback(
                                        |val: InputData| Msg::SeedParamChange("min".to_string(),val.value)
                                    )
                                    value=match self.state.seed_min {
                                        Some(v) => v.to_string(),
                                        None => "".to_string()
                                    }
                                   >
                            </input>
                        </div>
                    </div>
                </div>
            </div>
            <div class="field is-horizontal">
                <div class="field-label is-normal">
                    <label class="label">{"Max"}</label>
                </div>
                <div class="field-body">
                    <div class="field">
                        <div class="control is-expanded">
                            <input class="input"
                                   oninput=self.link.callback(
                                        |val: InputData| Msg::SeedParamChange("max".to_string(),val.value)
                                    )
                                   value=match self.state.seed_max {
                                        Some(v) => v.to_string(),
                                        None => "".to_string()
                                    }
                                   >
                            </input>
                        </div>
                    </div>
                </div>
            </div>
            <div class="field is-horizontal">
                <div class="field-label is-normal">
                    <label class="label">{"Iters"}</label>
                </div>
                <div class="field-body">
                    <div class="field">
                        <div class="control is-expanded">
                            <input class="input"
                                   oninput=self.link.callback(
                                        |val: InputData| Msg::SeedParamChange("iters".to_string(),val.value)
                                    )
                                   value=match self.state.seed_iters {
                                        Some(v) => v.to_string(),
                                        None => "".to_string()
                                    }
                                   >
                            </input>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        }
    }

    fn cure_input(&self, idx: usize) -> Html {
        html! {
        <div class="field">
            {
            match self.state.cure_values[idx] {
                Some(v) => {
                    html! {
                        <input class="input" value=&v
                               oninput=self.link.callback(move |val: InputData| Msg::SetCure(idx, val.value)) />
                    }
                }
                _ => {
                    html! {
                        <input class="input"
                               oninput=self.link.callback(move |val: InputData| Msg::SetCure(idx, val.value)) />
                    }
                }
            }
            }
        </div>
        }
    }

    fn view_cure(&self) -> Html {
        html! {
        <div class="box">
            <h2 class="subtitle has-text-centered">{"Cure Entry"}</h2>
            { for (0..5).map(|idx| self.cure_input(idx)) }
            <button class="button is-primary" style="width: 100%;"
                    onclick=self.link.callback(|_| Msg::FindNext)>{"Find Next"}</button>
        </div>
        }
    }

    fn view_results(&self) -> Html {
        html! {
        <div class="box" style="height: 100%; display: flex; flex-direction: column; max-height: 100%;">
            <h2 class="subtitle has-text-centered">{"Result"}</h2>
            <div style="display: block; flex: 1; width: 100%; max-height: 100%; overflow: auto;">
                <table class="table is-hoverable is-fullwidth" style="height: 100%; width: 100%;">
                    <thead style="position: sticky; top: 0; background: white;">
                    <tr>
                        <th>{"Pos"}</th>
                        <th>{"Value"}</th>
                        <th>{"Cure"}</th>
                        <th>{"Chance"}</th>
                    </tr>
                    </thead>
                    <tbody class="is-fullwidth">
                        { for self.state.rng_helper.values.iter().map(|v| self.result_row(v))}
                    </tbody>
                </table>
            </div>
        </div>
        }
    }

    fn result_row(&self, value: &ValueLens) -> Html {
        html! {
        <tr>
            <td>{value.position}</td>
            <td>{value.value}</td>
            <td>{value.spell}</td>
            <td>{value.chest}</td>
        </tr>
        }
    }
}
