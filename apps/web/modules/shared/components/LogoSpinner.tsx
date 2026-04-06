"use client";

import { config } from "@repo/config";
import { cn } from "@repo/ui/lib/utils";
import Image from "next/image";

const LOGO_SPINNER_SRC = "/images/brand/stuwiz-mark.png";

interface LogoSpinnerProps {
	size?: "sm" | "md" | "lg";
	className?: string;
}

/**
 * Animated logo spinner using the app's actual logo.
 * Features a layered animation effect where each layer pulses with a stagger.
 */
export function LogoSpinner({ size = "md", className }: LogoSpinnerProps) {
	const sizeClasses = {
		sm: "size-10",
		md: "size-16",
		lg: "size-24",
	};
	const sizePixels = {
		sm: "40px",
		md: "64px",
		lg: "96px",
	};

	return (
		<div className={cn("flex items-center justify-center", className)}>
			<div className={cn("relative", sizeClasses[size])}>
				<Image
					alt={`${config.appName} loading mark`}
					className="animate-pulse object-contain drop-shadow-[0_18px_40px_rgba(124,58,237,0.18)]"
					fill
					loading="eager"
					sizes={sizePixels[size]}
					src={LOGO_SPINNER_SRC}
				/>
			</div>
		</div>
	);
}

/**
 * Full-page loading screen that covers the entire viewport.
 * Use this for app-level loading states.
 */
export function FullPageLoader() {
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
			<LogoSpinner size="lg" />
		</div>
	);
}
