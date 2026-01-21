import type { ReactNode } from "react";

type Props = {
	children: ReactNode;
};

export default function DiscussionsLayout({ children }: Props) {
	return <>{children}</>;
}
