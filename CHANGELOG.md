# [0.5.0](https://github.com/andreyantipov/ctrl.page/compare/v0.4.0...v0.5.0) (2026-03-15)


### Bug Fixes

* address PR review — dedup helpers, pin versions, fix empty session, update docs ([2f9e181](https://github.com/andreyantipov/ctrl.page/commit/2f9e1813b1d06f6e128e9f8ac1ffd862fe4b0e80))
* address PR review — ordering, transactions, error handling, activation ([b85e354](https://github.com/andreyantipov/ctrl.page/commit/b85e35495f3ff0cd6aeaa68baeb2a0b2a72bef26))
* align mock sessions with production, add RPC error handling, fix scope lifecycle ([066fa8a](https://github.com/andreyantipov/ctrl.page/commit/066fa8a0de6e80e8c395e73f9126a0d9ce45d179))
* remove node:path/url imports from ensure-schema, strengthen no-raw-sql GritQL rule ([abb4199](https://github.com/andreyantipov/ctrl.page/commit/abb4199dfda2c657005d5d5693fda3771042ae83))
* remove node:url import — use decodeURIComponent(URL.pathname) for CI compatibility ([d3f98c5](https://github.com/andreyantipov/ctrl.page/commit/d3f98c5aab383c57486bf9b21cb6f3026806ec0a))
* resolve biome lint issues (forEach return, import sorting, formatting) ([9ed596b](https://github.com/andreyantipov/ctrl.page/commit/9ed596b8366adba6185f1cfb2f5461f2232f2ee4))
* restore workspace deps for turbo build ordering — only workspace:* allowed in libs ([a176582](https://github.com/andreyantipov/ctrl.page/commit/a17658241cc697ef327f764e1b253837fc9a74bd))
* sort imports in browsing service (biome) ([ca49e0b](https://github.com/andreyantipov/ctrl.page/commit/ca49e0bb1127821326ab4e897bad155923f60238))
* strip dependencies from libs package.json — root is single source of truth ([851b79e](https://github.com/andreyantipov/ctrl.page/commit/851b79e29913c64b8a791cadd55ea9335a53fbb5))


### Features

* **core.shared:** migrate Tab types to Session with Effect Schema as single source of truth ([32bd192](https://github.com/andreyantipov/ctrl.page/commit/32bd1929353f080ec14f99af27b917d4409e967f))
* **desktop:** wire RPC server on Bun, RPC client on webview ([5c58b85](https://github.com/andreyantipov/ctrl.page/commit/5c58b859a01584ef0dbb06b33e18301ed48b17fd))
* **domain.adapter.db:** implement session + pages schema with SessionRepository ([70bc311](https://github.com/andreyantipov/ctrl.page/commit/70bc3111da2a3f14b8f12465db68b355d07604e6))
* **domain.adapter.db:** switch to drizzle-kit migrations — zero handwritten SQL ([246b1a1](https://github.com/andreyantipov/ctrl.page/commit/246b1a18b4e31b990ca9a7e115a6680f7293b907))
* **domain.adapter.rpc:** implement generic Effect<->Electrobun IPC tunnel ([6aa0e52](https://github.com/andreyantipov/ctrl.page/commit/6aa0e522daf856e98f842aa31e7d41357ca3ba41))
* **domain.feature.session:** rename from tab, implement session model with page history navigation ([7b40ddc](https://github.com/andreyantipov/ctrl.page/commit/7b40ddc98244f5b1155aa179ed68df2e194cb855))
* **domain.service.browsing:** migrate to RPC group as service contract with session model ([265ce33](https://github.com/andreyantipov/ctrl.page/commit/265ce33585b729f15c4d13fb99ee27da62a60f7e))
* **ui.feature.sidebar:** migrate to session model with RPC client ([f3933c1](https://github.com/andreyantipov/ctrl.page/commit/f3933c16e5276230f6fee8b04025a4cf53c3fa13))

# [0.4.0](https://github.com/andreyantipov/ctrl.page/compare/v0.3.1...v0.4.0) (2026-03-14)


### Bug Fixes

* **core.ui:** address PR review — dedup constants, type safety, error handling, gitignore tsbuildinfo ([970b228](https://github.com/andreyantipov/ctrl.page/commit/970b228b43666cb1251413a35df5cf628505b1a0))
* extract hardcoded strings to constants and add no-raw-sql GritQL rule ([240f5b1](https://github.com/andreyantipov/ctrl.page/commit/240f5b1304843122798f3d5d999dedc383b484c3))
* pin dependency versions, update spec and dependency matrix per PR review ([4cd48e4](https://github.com/andreyantipov/ctrl.page/commit/4cd48e4e6e7b7ae738638fc51117c4097d07e210))
* remove declare module, lint ignores, and add GritQL rules ([0a6266e](https://github.com/andreyantipov/ctrl.page/commit/0a6266eca650e715992d2777586cf37d8cc5a852))
* **spec:** add GritQL rule preventing service-to-service imports ([faad32b](https://github.com/andreyantipov/ctrl.page/commit/faad32b310108e2ecdbc35ce69548f1bb1ac130b))
* **spec:** add same-tier isolation GritQL rules ([c3da8bf](https://github.com/andreyantipov/ctrl.page/commit/c3da8bfbc29a119039bef2397703f8201bf29741))
* **spec:** add type-only rule, no hardcoded strings, improve schema docs ([155904f](https://github.com/andreyantipov/ctrl.page/commit/155904f09fdd5f4d04dc155c57bad25048731f10))
* **spec:** address review findings in domain architecture spec ([7a163be](https://github.com/andreyantipov/ctrl.page/commit/7a163bee883f373bcf9356e52f1db8f0b6d96c07))
* **spec:** broaden problem statement to architectural scope ([08463cc](https://github.com/andreyantipov/ctrl.page/commit/08463ccefe1da75d7a2baa83dd5b2ad6be47b18d))
* **spec:** eliminate all remaining hardcoded strings and smells ([05b621b](https://github.com/andreyantipov/ctrl.page/commit/05b621b26f5062949ef8803b1e554a371a8bfdd6))
* **spec:** fix section numbering and Context.Tag generic params ([78c761b](https://github.com/andreyantipov/ctrl.page/commit/78c761bc6dce119eb0fa9e92c660a68c2bd36ab2))
* **spec:** make core.shared and core.ui fully independent ([1df5b30](https://github.com/andreyantipov/ctrl.page/commit/1df5b30a039b0b47377f4f489daeaf837756a4d8))
* **spec:** rename domain.adapter.turso to domain.adapter.db ([273da4c](https://github.com/andreyantipov/ctrl.page/commit/273da4c9dd59342dca9375dc3143a3180a6f1722))
* **spec:** replace manual withSpan with automatic withTracing utility ([c7eaaf0](https://github.com/andreyantipov/ctrl.page/commit/c7eaaf0043abdb62b5c666e9042872bc4781aaaf))
* **spec:** replace raw SQL string in DBSP example with typed repo method ([1e1bd97](https://github.com/andreyantipov/ctrl.page/commit/1e1bd97d7ac44bad019bce1ca4e10eb465d009b4))
* **spec:** use shared spanName helper and constants in test assertions ([42a2498](https://github.com/andreyantipov/ctrl.page/commit/42a2498a8328ee6aa94d246eb18e0e227d3a1dd2))
* type safety in makeRepository, non-fatal notify, null guard useStream, fix Electroview type ([7556cdc](https://github.com/andreyantipov/ctrl.page/commit/7556cdcf088cd8970a56f8b2db9aa9f9556223cd))
* use generic type for Electroview.defineRPC, fix banned {} type ([80ccefc](https://github.com/andreyantipov/ctrl.page/commit/80ccefc2a18eb2d7073a89b850ec3bdd5a495553))


### Features

* **core.shared:** add ports, domain types, withTracing, and spanName utilities ([91cfaff](https://github.com/andreyantipov/ctrl.page/commit/91cfaffcf54a78916e791c17daddcb15a0d24d27))
* **core.ui:** add Effect-SolidJS bridge utilities (useStream, useService, RuntimeProvider) ([d5df0f2](https://github.com/andreyantipov/ctrl.page/commit/d5df0f2fc98a2836c89f689c8c604242c2e02acc))
* **desktop:** wire new hex architecture into desktop app composition root ([8148740](https://github.com/andreyantipov/ctrl.page/commit/8148740c47745d016666b5c9b747304c6ad858f8))
* **domain.adapter.db:** implement Drizzle schema, makeRepository, and TabRepository ([114897b](https://github.com/andreyantipov/ctrl.page/commit/114897b199e6eec30df624bd67b6655e270061d4))
* **domain.adapter.otel:** implement OTEL layers and test span utilities ([f0eab95](https://github.com/andreyantipov/ctrl.page/commit/f0eab9546638753625b24738b47483f8db1a5361))
* **domain.feature.tab:** implement tab service with PubSub reactivity ([8ef8505](https://github.com/andreyantipov/ctrl.page/commit/8ef8505130a111fe75084c528532b94d27f76fb0))
* **domain.service.browsing:** implement composed browsing service with trace assertions ([72be316](https://github.com/andreyantipov/ctrl.page/commit/72be31656bf721f13d7212ce85e32094f0f25762))
* **ui.feature.sidebar:** implement sidebar feature with domain service binding ([f1c3ca6](https://github.com/andreyantipov/ctrl.page/commit/f1c3ca6423ed4743e0767bc8da18b53bade1b64a))
* **ui.page.main:** implement main page composing sidebar feature ([77174c9](https://github.com/andreyantipov/ctrl.page/commit/77174c9809f11cbf6a285b0403edfbf4aeaa89f4))

## [0.3.1](https://github.com/andreyantipov/ctrl.page/compare/v0.3.0...v0.3.1) (2026-03-14)


### Bug Fixes

* **ci:** rename nodeVersion to nodeMajorVersion with Int schema ([ef3e385](https://github.com/andreyantipov/ctrl.page/commit/ef3e3850f0e68555ac9d7c3d8887caee944a5eee))

# [0.3.0](https://github.com/andreyantipov/ctrl.page/compare/v0.2.2...v0.3.0) (2026-03-14)


### Bug Fixes

* **ci:** correct .app output path for electrobun build ([3ddf239](https://github.com/andreyantipov/ctrl.page/commit/3ddf239ef3faba7a9b496ad0e4fbd835d2d4a3f6))
* **core.ui:** address PR review comments ([da5d3c4](https://github.com/andreyantipov/ctrl.page/commit/da5d3c419b19b86d1a88e4294ec33d0314df002d)), closes [#styled-system](https://github.com/andreyantipov/ctrl.page/issues/styled-system)
* **core.ui:** revert #styled-system alias to relative imports ([2c5f5aa](https://github.com/andreyantipov/ctrl.page/commit/2c5f5aaea62fb06bcafb4283f0fb6e5ca70fda42)), closes [#styled-system](https://github.com/andreyantipov/ctrl.page/issues/styled-system)


### Features

* add @zag-js/solid dependency ([328fb73](https://github.com/andreyantipov/ctrl.page/commit/328fb73ded8e343ed790d30d77adf14bc964c450))
* **core.ui:** add #styled-system path alias for styled-system imports ([33b0ef3](https://github.com/andreyantipov/ctrl.page/commit/33b0ef39a633855dcabd6d5081c5d9eae453bd08)), closes [#styled-system](https://github.com/andreyantipov/ctrl.page/issues/styled-system)
* **core.ui:** add design token CSS custom properties ([0d35847](https://github.com/andreyantipov/ctrl.page/commit/0d358472e52dbb7bfb597c22314ec5596bf1e75c))
* **core.ui:** create atomic design directory structure ([44b3210](https://github.com/andreyantipov/ctrl.page/commit/44b3210865472bcecb0a28fe6117dfabbf43aff7))
* **core.ui:** migrate AddressBar to molecules/AddressBar with sva ([14e1351](https://github.com/andreyantipov/ctrl.page/commit/14e135139c6640be87242873aba6141da71f8f72))
* **core.ui:** migrate Button to atoms/Button with sva ([a4dd476](https://github.com/andreyantipov/ctrl.page/commit/a4dd476513aa366a55f66864b8cd57354e8e2967))
* **core.ui:** migrate Input to atoms/Input with sva ([1209ada](https://github.com/andreyantipov/ctrl.page/commit/1209ada29099d9311b5adec44d28c1d29a2e8cc4))
* **core.ui:** migrate panda tokens to CSS custom properties ([e5ed479](https://github.com/andreyantipov/ctrl.page/commit/e5ed4790ea8c7d84d08e8b05e394a11f352771ec))
* **core.ui:** migrate Sidebar to organisms/Sidebar ([f3641d9](https://github.com/andreyantipov/ctrl.page/commit/f3641d912b365b1a04732aadd77e4016e4a464ad))
* **core.ui:** migrate TabBar to molecules/TabBar ([d02c826](https://github.com/andreyantipov/ctrl.page/commit/d02c82674f5fff64537ebec96c80e31940d3a57a))
* **core.ui:** migrate Text to atoms/Text with sva ([fcd3af7](https://github.com/andreyantipov/ctrl.page/commit/fcd3af7d35a27b34606beed1f3751a95b2206ee2))

## [0.2.2](https://github.com/andreyantipov/ctrl.page/compare/v0.2.1...v0.2.2) (2026-03-14)


### Bug Fixes

* **ci:** build libs before desktop app in CI ([f795622](https://github.com/andreyantipov/ctrl.page/commit/f795622fdd187848dd1796bab6aff95bc8bd760e))

## [0.2.1](https://github.com/andreyantipov/ctrl.page/compare/v0.2.0...v0.2.1) (2026-03-13)


### Bug Fixes

* **ci:** use --ignore-scripts for desktop build, run full build script ([2c5d720](https://github.com/andreyantipov/ctrl.page/commit/2c5d720effdcadb9c914b1a1095a44a440031899))

# [0.2.0](https://github.com/andreyantipov/ctrl.page/compare/v0.1.0...v0.2.0) (2026-03-13)


### Features

* **ci:** add macOS desktop build to CI and release pipeline ([7c31947](https://github.com/andreyantipov/ctrl.page/commit/7c3194778832395e3c515f8c9ad62885047e3133))
