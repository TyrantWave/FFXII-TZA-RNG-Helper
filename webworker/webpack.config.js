const path = require('path');
const WasmPackPlugin = require('@wasm-tool/wasm-pack-plugin');

const distPath = path.resolve(__dirname, "dist");
module.exports = (env, argv) => {
  return {
    entry: './webworker.js',
    output: {
      path: distPath,
      filename: "webworker.js",
      webassemblyModuleFilename: "webworker.wasm"
    },
    plugins: [
      new WasmPackPlugin({
        crateDirectory: ".",
        extraArgs: "--no-typescript",
      })
    ],
    watch: argv.mode !== 'production'
  };
};
