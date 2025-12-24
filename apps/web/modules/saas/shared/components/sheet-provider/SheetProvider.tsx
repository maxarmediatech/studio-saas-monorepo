"use client";

import {
	createContext,
	useCallback,
	useContext,
	useState,
	type ReactNode,
} from "react";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";

export type SheetSize = "sm" | "md" | "lg" | "xl" | "full";

export interface SheetConfig {
	title: string;
	description?: string;
	content: ReactNode;
	size?: SheetSize;
	side?: "left" | "right";
	/** Called when sheet is closed */
	onClose?: () => void;
}

interface SheetContextValue {
	openSheet: (config: SheetConfig) => void;
	closeSheet: () => void;
	isOpen: boolean;
}

const SheetContext = createContext<SheetContextValue | null>(null);

export function useSheet() {
	const context = useContext(SheetContext);
	if (!context) {
		throw new Error("useSheet must be used within a SheetProvider");
	}
	return context;
}

const sizeClasses: Record<SheetSize, string> = {
	sm: "sm:max-w-sm",
	md: "sm:max-w-md",
	lg: "sm:max-w-lg",
	xl: "sm:max-w-xl",
	full: "sm:max-w-full w-full",
};

interface SheetProviderProps {
	children: ReactNode;
}

export function SheetProvider({ children }: SheetProviderProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [config, setConfig] = useState<SheetConfig | null>(null);

	const openSheet = useCallback((newConfig: SheetConfig) => {
		setConfig(newConfig);
		setIsOpen(true);
	}, []);

	const closeSheet = useCallback(() => {
		setIsOpen(false);
		config?.onClose?.();
	}, [config]);

	const handleOpenChange = useCallback(
		(open: boolean) => {
			if (!open) {
				closeSheet();
			}
		},
		[closeSheet],
	);

	return (
		<SheetContext.Provider value={{ openSheet, closeSheet, isOpen }}>
			{children}
			<Sheet open={isOpen} onOpenChange={handleOpenChange}>
				{config && (
					<SheetContent
						side={config.side ?? "right"}
						className={sizeClasses[config.size ?? "md"]}
					>
						<SheetHeader>
							<SheetTitle>{config.title}</SheetTitle>
							{config.description && (
								<SheetDescription>{config.description}</SheetDescription>
							)}
						</SheetHeader>
						<div className="flex-1 overflow-y-auto px-4 pb-4">
							{config.content}
						</div>
					</SheetContent>
				)}
			</Sheet>
		</SheetContext.Provider>
	);
}
