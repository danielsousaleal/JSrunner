const fs = require("fs");
const path = require("path");

const src = path.join(
  __dirname,
  "../node_modules/@jitl/quickjs-ng-wasmfile-release-sync/dist/emscripten-module.wasm"
);
const dest = path.join(__dirname, "../public/wasm/quickjs.wasm");

if (!fs.existsSync(path.dirname(dest))) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
}

fs.copyFileSync(src, dest);
console.log("WASM copied to public/wasm/quickjs.wasm");
