import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { RendererErrorBoundary } from "./app/RendererErrorBoundary";
import "./styles.css";

const root = document.getElementById("root");

if (!(root instanceof HTMLElement)) {
	throw new Error("Renderer root not found.");
}

createRoot(root).render(
	<StrictMode>
		<RendererErrorBoundary>
			<App />
		</RendererErrorBoundary>
	</StrictMode>,
);
