import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
