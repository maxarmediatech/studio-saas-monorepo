import { Component, type ErrorInfo, type ReactNode } from "react";

type RendererErrorBoundaryState = {
	error?: Error;
};

export class RendererErrorBoundary extends Component<
	{ children: ReactNode },
	RendererErrorBoundaryState
> {
	state: RendererErrorBoundaryState = {};

	static getDerivedStateFromError(error: Error) {
		return { error };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error("Renderer crashed", error, info);
	}

	render() {
		if (this.state.error) {
			return (
				<main className="grid h-dvh place-items-center bg-[var(--desktop-bg)] px-8 text-[var(--desktop-strong)]">
					<section className="grid max-w-[560px] gap-3 rounded-xl border border-border bg-[var(--desktop-panel)] p-5">
						<p className="m-0 text-[13px] font-medium text-[var(--desktop-subtle)]">
							Renderer recovered
						</p>
						<h1 className="m-0 text-[20px] font-semibold tracking-normal">
							Something in this view failed, but the app is still
							alive.
						</h1>
						<p className="m-0 whitespace-pre-wrap text-[13px] text-[var(--desktop-subtle)]">
							{this.state.error.message ||
								"Unknown renderer error"}
						</p>
					</section>
				</main>
			);
		}
		return this.props.children;
	}
}
