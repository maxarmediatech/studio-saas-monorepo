import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({ path: "../../.env.local" });

export default defineConfig({
	test: {
		environment: "node",
		testTimeout: 30000,
		hookTimeout: 30000,
	},
});
