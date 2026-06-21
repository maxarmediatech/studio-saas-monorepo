import type { ExperimentalDesktopApi } from "../preload/types";

declare global {
	interface Window {
		experimentalDesktop: ExperimentalDesktopApi;
	}
}
