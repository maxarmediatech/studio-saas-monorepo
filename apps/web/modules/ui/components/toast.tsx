"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
	const { forcedTheme, resolvedTheme, theme } = useTheme();
	const activeTheme =
		(forcedTheme ?? resolvedTheme ?? theme ?? "light") as ToasterProps["theme"];

	return (
		<Sonner
			theme={activeTheme}
			className="toaster group"
			toastOptions={{
				classNames: {
					toast: "group toast !rounded-lg !font-sans group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-md",
					description: "group-[.toast]:text-muted-foreground",
					actionButton:
						"group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
					cancelButton:
						"group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
					success: "!text-success",
					error: "!text-destructive",
				},
				duration: 5000,
			}}
			{...props}
		/>
	);
};

export { Toaster };
