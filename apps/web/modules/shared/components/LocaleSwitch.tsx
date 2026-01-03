"use client";

import { updateLocale } from "@i18n/lib/update-locale";
import { config } from "@repo/config";
import type { Locale } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { LanguagesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const { locales, defaultLocale, localeCookieName } = config.i18n;

function getLocaleFromCookie(): string {
	if (typeof document === "undefined") {
		return defaultLocale;
	}
	const match = document.cookie.match(
		new RegExp(`(^| )${localeCookieName}=([^;]+)`),
	);
	return match?.[2] ?? defaultLocale;
}

export function LocaleSwitch() {
	const router = useRouter();
	const [value, setValue] = useState<string>(defaultLocale);

	useEffect(() => {
		setValue(getLocaleFromCookie());
	}, []);

	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" aria-label="Language">
					<LanguagesIcon className="size-4" />
				</Button>
			</DropdownMenuTrigger>

			<DropdownMenuContent>
				<DropdownMenuRadioGroup
					value={value}
					onValueChange={(newValue) => {
						setValue(newValue);
						updateLocale(newValue as Locale);
						router.refresh();
					}}
				>
					{Object.entries(locales).map(([locale, { label }]) => {
						return (
							<DropdownMenuRadioItem key={locale} value={locale}>
								{label}
							</DropdownMenuRadioItem>
						);
					})}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
