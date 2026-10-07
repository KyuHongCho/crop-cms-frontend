import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const src = process.env.OPENAPI_SRC || "http://127.0.0.1:8000/openapi.json";
const out = join(mkdtempSync(join(tmpdir(), "check-api-")), "schema.d.ts");
execFileSync("npx", ["openapi-typescript", src, "-o", out], { stdio: "inherit" });

if (readFileSync(out, "utf8") !== readFileSync("src/api/schema.d.ts", "utf8")) {
  console.error("src/api/schema.d.ts is stale: run `npm run gen:api` and commit it.");
  process.exit(1);
}
console.log("src/api/schema.d.ts is up to date.");
