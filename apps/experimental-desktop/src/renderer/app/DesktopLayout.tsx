import { useState, type ReactNode } from "react";
import { TopBar } from "../components/layout";

const desktopRootClass =
	"grid h-dvh w-screen min-w-[980px] grid-rows-[44px_minmax(0,1fr)] bg-[var(--desktop-bg)]";
const desktopShellClass =
	"grid min-h-0 grid-cols-[276px_minmax(520px,1fr)] max-[1200px]:grid-cols-[248px_minmax(500px,1fr)]";
type DesktopTopTab = "chat" | "settings";

export function DesktopLayout(props: {
	theme: string;
	onToggleTheme: () => void;
	sidebar: ReactNode;
	children: ReactNode;
	settings: ReactNode;
}) {
	const [activeTab, setActiveTab] = useState<DesktopTopTab>("chat");

	return (
		<div className={desktopRootClass}>
			<TopBar
				activeTab={activeTab}
				theme={props.theme}
				onSelectTab={setActiveTab}
				onToggleTheme={props.onToggleTheme}
			/>
			<main className={desktopShellClass}>
				{props.sidebar}
				{activeTab === "settings" ? props.settings : props.children}
			</main>
		</div>
	);
}
