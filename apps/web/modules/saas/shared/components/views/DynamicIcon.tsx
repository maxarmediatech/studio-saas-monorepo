"use client";

import { cn } from "@repo/ui/lib/utils";
import * as LucideIcons from "lucide-react";
import type { CSSProperties, ComponentType, SVGProps } from "react";

type IconComponent = ComponentType<
	SVGProps<SVGSVGElement> & { className?: string }
>;

interface DynamicIconProps {
	name: string;
	className?: string;
	style?: CSSProperties;
	fallback?: IconComponent;
}

export function DynamicIcon({
	name,
	className,
	style,
	fallback: Fallback,
}: DynamicIconProps) {
	const icons = LucideIcons as unknown as Record<
		string,
		IconComponent | undefined
	>;

	const normalizedName = name.endsWith("Icon") ? name : `${name}Icon`;
	const Icon = icons[normalizedName] ?? icons[name] ?? Fallback;

	if (!Icon) {
		return <span className={cn("inline-block", className)} style={style} />;
	}

	return <Icon className={className} style={style} />;
}
