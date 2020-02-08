#![recursion_limit = "512"]

mod app;
mod utils;
mod worker;
use wasm_bindgen::prelude::*;
use yew::Threaded;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

// This is the entry point for the web app
#[wasm_bindgen]
pub fn run_app() -> Result<(), JsValue> {
    utils::set_panic_hook();
    web_logger::init();
//    yew::initialize();
//    worker::Worker::register();
//
//    yew::App::<app::App>::new().mount_to_body();
//    yew::run_loop();
    yew::start_app::<app::App>();
    Ok(())
}

#[wasm_bindgen]
pub fn run_worker() -> Result<(), JsValue> {
    worker::Worker::register();
    yew::run_loop();
    Ok(())
}