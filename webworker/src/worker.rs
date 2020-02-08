use std::time::Duration;

use log::info;
use serde_derive::{Deserialize, Serialize};
use yew::services::fetch::FetchService;
use yew::services::interval::IntervalService;
use yew::services::Task;
use yew::worker::*;

use ffxii_tza_rng::character;
use ffxii_tza_rng::rng_helper;

#[derive(Serialize, Deserialize, Debug)]
pub struct Params {
    pub character: character::Character,
    pub cure_values: Vec<i32>,
    pub min: u32,
    pub max: u32,
    pub iters: usize,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Request {
    FindSeed(Params),
}


#[derive(Serialize, Deserialize, Debug)]
pub enum Msg {
    Updating,
}

pub struct Worker {
    link: AgentLink<Worker>,
}

impl Agent for Worker {
    type Reach = Public;
    type Message = Msg;
    type Input = Request;
    type Output = Option<rng_helper::RNGHelper>;

    fn create(link: AgentLink<Self>) -> Self {
        Worker {
            link,
        }
    }

    fn update(&mut self, msg: Self::Message) {
        info!("Update hit");
    }

    fn handle_input(&mut self, msg: Self::Input, who: HandlerId) {
        info!("Request: {:?}", msg);
        match msg {
            Request::FindSeed(params) => {
                self.link.respond(
                    who,
                    rng_helper::RNGHelper::find_seed(
                        &params.character,
                        &params.cure_values,
                        params.min,
                        params.max,
                        params.iters,
                    ),
                );
            }
        }
    }

    fn name_of_resource() -> &'static str {
        "webworker.js"
    }
}
