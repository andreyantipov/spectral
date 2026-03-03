import { copyFileSync, mkdirSync } from "fs";
import { SolidPlugin } from "@dschz/bun-plugin-solid";

mkdirSync("build/main-ui", { recursive: true });

const result = await Bun.build({
  entrypoints: ["src/main-ui/index.ts"],
  outdir: "build/main-ui",
  target: "browser",
  plugins: [
    SolidPlugin({
      generate: "dom",
      hydratable: false,
    }),
  ],
});

if (!result.success) {
  console.error("Build failed:");
  for (const msg of result.logs) {
    console.error(msg);
  }
  process.exit(1);
}

copyFileSync("../../libs/core.ui/build/styles.css", "build/main-ui/styles.css");
console.log("View built successfully");
