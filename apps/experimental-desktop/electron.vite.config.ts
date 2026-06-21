import { defineConfig } from "electron-vite";

export default defineConfig({
	main: {
		build: {
			rollupOptions: {
				input: {
					index: "src/main/index.ts",
					sidecar: "src/main/sidecar.ts",
				},
			},
		},
	},
	preload: {
		build: {
			rollupOptions: {
				input: {
					index: "src/preload/index.ts",
				},
				output: {
					format: "cjs",
					entryFileNames: "[name].js",
				},
			},
		},
	},
	renderer: {
		root: "src/renderer",
		build: {
			rollupOptions: {
				input: {
					main: "src/renderer/index.html",
				},
			},
		},
	},
});
