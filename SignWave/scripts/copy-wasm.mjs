// Copies the MediaPipe WASM runtime out of node_modules into public/ so the
// app works offline and does not depend on a CDN. Runs on install and build.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const to = join(root, "public", "mediapipe-wasm");

if (!existsSync(from)) {
  console.warn("[copy-wasm] node_modules/@mediapipe/tasks-vision/wasm not found - run npm install first.");
} else {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
  console.log("[copy-wasm] copied MediaPipe WASM to public/mediapipe-wasm");
}
