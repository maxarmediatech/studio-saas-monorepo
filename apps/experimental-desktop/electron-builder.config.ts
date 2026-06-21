import type { Configuration } from "electron-builder";

const config: Configuration = {
	appId: "com.stuwiz.experimental.desktop",
	productName: "Experimental Desktop",
	// biome-ignore lint/suspicious/noTemplateCurlyInString: electron-builder expands these placeholders.
	artifactName: "experimental-desktop-${os}-${arch}.${ext}",
	directories: {
		output: "dist",
		buildResources: "resources",
	},
	files: ["out/**/*"],
	mac: {
		category: "public.app-category.developer-tools",
		target: ["dmg", "zip"],
	},
	win: {
		target: ["nsis"],
	},
	nsis: {
		oneClick: true,
		perMachine: false,
	},
};

export default config;
