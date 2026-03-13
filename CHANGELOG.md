# 1.0.0 (2026-03-13)


### Bug Fixes

* auto-fix and manually resolve all Biome lint and formatting issues ([92173c2](https://github.com/andreyantipov/ctrl.page/commit/92173c211c8260df39366d1f1dcb9d40e13cb72b))
* **ci:** chain build and check in same container layer ([ed34cc8](https://github.com/andreyantipov/ctrl.page/commit/ed34cc84555db346bec1534de337722934274aa9))
* **ci:** checkout main branch and pass --branches to semantic-release ([68f390c](https://github.com/andreyantipov/ctrl.page/commit/68f390ce0853c5ee821496a573d213540fb3c6f6))
* **ci:** disable grit in containers, build before typecheck ([0fd23f0](https://github.com/andreyantipov/ctrl.page/commit/0fd23f0ac6c53db2a9f569df4fff287e649bb058))
* **ci:** install git in dagger base container ([fe38e53](https://github.com/andreyantipov/ctrl.page/commit/fe38e5332190e857f9a3ba012c423f56b56541ed))
* **ci:** install Node 22 LTS for semantic-release compatibility ([f800955](https://github.com/andreyantipov/ctrl.page/commit/f8009555acdbb7a688bf89f2dd78699181fb6830))
* **ci:** run bun install with scripts to generate styled-system ([074c59b](https://github.com/andreyantipov/ctrl.page/commit/074c59b94e84e1faa0d32fd6fac5d5809d175838))
* **ci:** run panda codegen explicitly after install ([2c3fefe](https://github.com/andreyantipov/ctrl.page/commit/2c3fefeaeb473b5b8cac7e8f4c260af8e47d94b6))
* **ci:** run semantic-release on runner instead of Dagger container ([b3c32c3](https://github.com/andreyantipov/ctrl.page/commit/b3c32c3a0d59f84582c1b10e40d1c0362db720f2))
* **ci:** run semantic-release through Dagger, not directly on runner ([2d36761](https://github.com/andreyantipov/ctrl.page/commit/2d36761d4db4982047e4c871c763020696064c70))
* **ci:** set CI env vars for semantic-release to create actual releases ([1b7864b](https://github.com/andreyantipov/ctrl.page/commit/1b7864b96433ca64e5ff0400183fbadb4aeace8e))
* correct noConsole rule to warn on console.log, allow warn/error ([dd62272](https://github.com/andreyantipov/ctrl.page/commit/dd6227240d879aa7dc413986ee02393cd39e4825))
* ensure build/ directory exists before panda cssgen ([3fd5f97](https://github.com/andreyantipov/ctrl.page/commit/3fd5f971b7c2c0e6d3073680707957c34d07337b))
* exclude dagger sdk from biome/grit, split lint steps for CI ([d437a73](https://github.com/andreyantipov/ctrl.page/commit/d437a73fe30cf9a564c585751f71b3c9f046e927))
* resolve type errors and re-enable typecheck in pre-commit ([72de4aa](https://github.com/andreyantipov/ctrl.page/commit/72de4aa71960b51072822f3bb513859f270f29bd))


### Features

* add base container helper for Dagger CI ([20f9d84](https://github.com/andreyantipov/ctrl.page/commit/20f9d84fee6937f24dd054bf22b38079b8fd1a07))
* add build workflow for Dagger CI ([95241d4](https://github.com/andreyantipov/ctrl.page/commit/95241d446a693560f35c7455a13999dff3871f35))
* add Dagger CI entry point with lint, typecheck, build functions ([00d3b69](https://github.com/andreyantipov/ctrl.page/commit/00d3b695f4de6b35eb3e2ea5e26ff219a1134850))
* add lint and typecheck workflows for Dagger CI ([d51dcb0](https://github.com/andreyantipov/ctrl.page/commit/d51dcb04e3c49f03ccf84d8ad3d55c22cb4925d1))
* initialize Dagger CI module ([2fe7e33](https://github.com/andreyantipov/ctrl.page/commit/2fe7e33ba2a30b26d20228840057cdfb7c4530de))
