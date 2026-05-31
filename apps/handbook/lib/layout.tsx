import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { BookOpen, Github } from "lucide-react";

export const baseOptions: BaseLayoutProps = {
	nav: {
		title: (
			<>
				<span className="handbook-mark grid size-7 place-items-center rounded-sm">
					<BookOpen className="size-4" />
				</span>
				<span>Studio Handbook</span>
			</>
		),
	},
	links: [
		{
			text: "Repository",
			url: "https://github.com",
			icon: <Github className="size-4" />,
			external: true,
		},
	],
};
