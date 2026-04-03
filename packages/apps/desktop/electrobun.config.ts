import type { ElectrobunConfig } from "electrobun";
import rootPkg from "../../../package.json";

const isDev = process.argv[2] === "dev";

export default {
  app: {
    name: isDev ? "Spectral-dev" : "Spectral",
    identifier: "spectral.ctrl.page",
    version: rootPkg.version,
  },
  runtime: {
    exitOnLastWindowClosed: true,
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
      "../../libs/core.impl.db/src/migrations": "bun/migrations",
    },
    watch: ["build/main-ui"],
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
