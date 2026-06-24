import type { ReactNode } from "react";
import { TopBar } from "../components/layout";

const desktopRootClass =
	"grid h-dvh w-screen min-w-[980px] grid-rows-[44px_minmax(0,1fr)] bg-[var(--desktop-bg)]";
const desktopShellClass =
	"grid min-h-0 grid-cols-[276px_minmax(520px,1fr)_320px] max-[1200px]:grid-cols-[248px_minmax(500px,1fr)_292px]";

export function DesktopLayout(props: {
	theme: string;
	onToggleTheme: () => void;
	sidebar: ReactNode;
	children: ReactNode;
	inspector: ReactNode;
}) {
	return (
		<div className={desktopRootClass}>
			<TopBar theme={props.theme} onToggleTheme={props.onToggleTheme} />
			<main className={desktopShellClass}>
				{props.sidebar}
				{props.children}
				{props.inspector}
			</main>
		</div>
	);
}
