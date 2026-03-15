// packages/libs/domain.adapter.db/drizzle.config.ts
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./src/model/*.schema.ts",
  out: "./src/migrations",
  dialect: "sqlite",
})
