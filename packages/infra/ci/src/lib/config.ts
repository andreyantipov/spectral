import { Schema } from "effect";

export class CiConfig extends Schema.Class<CiConfig>("CiConfig")({
	image: Schema.optionalWith(Schema.String, {
		default: () => "oven/bun:latest",
	}),
	nodeMajorVersion: Schema.optionalWith(Schema.Int, { default: () => 22 }),
	gitBotName: Schema.optionalWith(Schema.String, {
		default: () => "github-actions[bot]",
	}),
	gitBotEmail: Schema.optionalWith(Schema.String, {
		default: () => "github-actions[bot]@users.noreply.github.com",
	}),
	releaseBranch: Schema.optionalWith(Schema.String, {
		default: () => "main",
	}),
	workdir: Schema.optionalWith(Schema.String, { default: () => "/app" }),
	mountExcludes: Schema.optionalWith(Schema.Array(Schema.String), {
		default: () => ["**/node_modules", "packages/infra/ci/sdk"],
	}),
}) {}

export const defaultConfig = new CiConfig({});
