pub mod worker;
mod utils;
use wasm_bindgen::prelude::*;
use yew::agent::Threaded;

//// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
//// allocator.
//#[cfg(feature = "wee_alloc")]
//#[global_allocator]
//static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;


#[wasm_bindgen]
pub fn run_worker() -> Result<(), JsValue> {
    utils::set_panic_hook();
    web_logger::init();
    yew::initialize();
    worker::Worker::register();
    yew::run_loop();
    Ok(())
}