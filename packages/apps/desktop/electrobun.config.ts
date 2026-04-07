import type { ElectrobunConfig } from "electrobun";
import rootPkg from "../../../package.json";

const isDev = process.argv[2] === "dev";
const isE2E = process.env.ENABLE_E2E === "true";  // For CI builds

export default {
  app: {
    name: isDev ? "Spectral-dev" : "Spectral",
    identifier: "spectral.ctrl.page",
    version: rootPkg.version,
  },
  runtime: {
    exitOnLastWindowClosed: true,
    // Enable CDP for e2e testing in dev mode or CI
    ...((isDev && process.env.ENABLE_CDP === "true") || isE2E ? {
      cef: {
        remoteDebuggingPort: 9222,
        enableDevTools: isDev,  // DevTools only in dev, not CI
      }
    } : {}),
  },
  build: {
    bun: {
      entrypoint: "build/index.js",
      external: ["@libsql/client"],
    },
    views: {},
    copy: {
      "src/main-ui/index.html": "views/main-ui/index.html",
      "build/main-ui/index.js": "views/main-ui/index.js",
      "build/main-ui/styles.css": "views/main-ui/styles.css",
      "build/bun-deps/node_modules": "bun/node_modules",
      "../../libs/arch.impl.db/src/migrations": "bun/migrations",
    },
    watch: [
      "build/main-ui",
      "build/index.js",  // Watch main process changes
      "src/**/*.ts",     // Watch TypeScript source files
    ],
    watchIgnore: [
      "**/*.d.ts",
      "**/*.map",
      "**/node_modules/**",
    ],
    mac: {
      defaultRenderer: "native",
      icons: isDev ? "assets/icon-dev.iconset" : "assets/icon.iconset",
    },
    linux: {
      bundleCEF: true,
      defaultRenderer: "cef",
    },
  },
} satisfies ElectrobunConfig;
