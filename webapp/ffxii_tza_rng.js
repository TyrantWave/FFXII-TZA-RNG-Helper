import("./pkg").then(module => {
  module.run_app();
  module.run_worker();
});
