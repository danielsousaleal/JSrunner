const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "../node_modules/monaco-editor/min/vs");
const dest = path.join(__dirname, "../public/monaco/vs");

function copyDir(from, to) {
  if (!fs.existsSync(to)) {
    fs.mkdirSync(to, { recursive: true });
  }
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const srcPath = path.join(from, entry.name);
    const destPath = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDir(src, dest);
console.log("Monaco assets copied to public/monaco/vs");
