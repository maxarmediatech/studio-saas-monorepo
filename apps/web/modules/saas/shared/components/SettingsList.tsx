import type { PropsWithChildren } from "react";

export function SettingsList({ children }: PropsWithChildren) {
	return <div className="divide-y divide-border">{children}</div>;
}
