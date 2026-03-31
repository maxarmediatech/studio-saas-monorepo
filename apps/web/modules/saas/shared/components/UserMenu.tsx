"use client";

import { DropdownMenuSub } from "@radix-ui/react-dropdown-menu";
import { authClient } from "@repo/auth/client";
import { config } from "@repo/config";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuPortal,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { cn } from "@repo/ui/lib/utils";
import { useSession } from "@saas/auth/hooks/use-session";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import {
	NotificationMenuPanel,
	useNotificationMenuState,
} from "@saas/studio/components/notifications/notification-bell";
import { UserAvatar } from "@shared/components/UserAvatar";
import {
	HardDriveIcon,
	HomeIcon,
	LogOutIcon,
	MoonIcon,
	MoreVerticalIcon,
	SettingsIcon,
	SunIcon,
	UserRoundXIcon,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useState } from "react";

export function UserMenu({
	showUserName,
	triggerClassName,
	avatarClassName,
	includeNotifications,
	showNotificationBadge,
}: {
	showUserName?: boolean;
	triggerClassName?: string;
	avatarClassName?: string;
	includeNotifications?: boolean;
	showNotificationBadge?: boolean;
}) {
	const t = useTranslations();
	const { session, user } = useSession();
	const { activeOrganization } = useActiveOrganization();
	const { setTheme: setCurrentTheme, theme: currentTheme } = useTheme();
	const [theme, setTheme] = useState<string>(currentTheme ?? "system");
	const [isStoppingImpersonation, setIsStoppingImpersonation] =
		useState(false);
	const [open, setOpen] = useState(false);
	const accountSettingsHref = activeOrganization
		? `/app/${activeOrganization.slug}/settings/profile`
		: "/app";
	const isImpersonating = Boolean(session?.impersonatedBy);
	const shouldShowNotifications =
		Boolean(includeNotifications) || Boolean(showNotificationBadge);
	const notificationState = useNotificationMenuState(shouldShowNotifications);

	const colorModeOptions = [
		{
			value: "system",
			label: "System",
			icon: HardDriveIcon,
		},
		{
			value: "light",
			label: "Light",
			icon: SunIcon,
		},
		{
			value: "dark",
			label: "Dark",
			icon: MoonIcon,
		},
	];

	const onLogout = () => {
		authClient.signOut({
			fetchOptions: {
				onSuccess: async () => {
					window.location.href = new URL(
						config.auth.redirectAfterLogout,
						window.location.origin,
					).toString();
				},
			},
		});
	};

	const onStopImpersonation = async () => {
		if (isStoppingImpersonation) {
			return;
		}

		setIsStoppingImpersonation(true);

		try {
			const { error } = await authClient.admin.stopImpersonating();

			if (error) {
				return;
			}

			window.location.href = new URL(
				"/admin/users",
				window.location.origin,
			).toString();
		} finally {
			setIsStoppingImpersonation(false);
		}
	};

	if (!user) {
		return null;
	}

	const { name, email, image } = user;

	return (
		<DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className={cn("relative cursor-pointer", triggerClassName)}
					// className="flex cursor-pointer w-full items-center justify-between gap-2 rounded-lg outline-hidden focus-visible:ring-2 focus-visible:ring-primary md:w-[100%+1rem] md:px-2 md:py-1.5 md:hover:bg-primary/5"
					aria-label="User menu"
				>
					<span className="flex items-center gap-2">
						<span className="relative">
							<UserAvatar
								name={name ?? ""}
								avatarUrl={image}
								className={avatarClassName}
							/>
							{showNotificationBadge &&
							notificationState.badgeLabel ? (
								<span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
									{notificationState.badgeLabel}
								</span>
							) : null}
						</span>
						{showUserName && (
							<span className="text-left leading-tight">
								<span className="font-medium text-sm">
									{name}
								</span>
								<span className="block text-xs opacity-70">
									{email}
								</span>
							</span>
						)}
					</span>

					{showUserName && <MoreVerticalIcon className="size-4" />}
				</button>
			</DropdownMenuTrigger>

			<DropdownMenuContent
				align="end"
				className={cn(includeNotifications && "w-80 p-0")}
			>
				<DropdownMenuLabel>
					{name}
					<span className="block font-normal text-xs opacity-70">
						{email}
					</span>
				</DropdownMenuLabel>

				<DropdownMenuSeparator />

				{includeNotifications ? (
					<>
						<div className="-mx-1 -mt-1 mb-1 overflow-hidden">
							<NotificationMenuPanel
								unreadCount={notificationState.unreadCount}
								notifications={notificationState.notifications}
								isLoading={notificationState.isLoading}
								isMarkAllPending={
									notificationState.isMarkAllPending
								}
								organizationSlug={activeOrganization?.slug}
								onMarkAllRead={notificationState.markAllRead}
								onMarkRead={notificationState.markRead}
								onClose={() => setOpen(false)}
							/>
						</div>

						<DropdownMenuSeparator />
					</>
				) : null}

				{/* Color mode selection — gated behind enabledThemes */}
				{config.ui.enabledThemes.length > 1 && (
					<>
						<DropdownMenuSub>
							<DropdownMenuSubTrigger>
								<SunIcon className="mr-2 size-4" />
								{t("app.userMenu.colorMode")}
							</DropdownMenuSubTrigger>
							<DropdownMenuPortal>
								<DropdownMenuSubContent>
									<DropdownMenuRadioGroup
										value={theme}
										onValueChange={(value) => {
											setTheme(value);
											setCurrentTheme(value);
										}}
									>
										{colorModeOptions.map((option) => (
											<DropdownMenuRadioItem
												key={option.value}
												value={option.value}
											>
												<option.icon className="mr-2 size-4 opacity-50" />
												{option.label}
											</DropdownMenuRadioItem>
										))}
									</DropdownMenuRadioGroup>
								</DropdownMenuSubContent>
							</DropdownMenuPortal>
						</DropdownMenuSub>

						<DropdownMenuSeparator />
					</>
				)}

				<DropdownMenuItem asChild>
					<Link href={accountSettingsHref}>
						<SettingsIcon className="mr-2 size-4" />
						{t("app.userMenu.accountSettings")}
					</Link>
				</DropdownMenuItem>

				<DropdownMenuItem asChild>
					<Link href="/">
						<HomeIcon className="mr-2 size-4" />
						{t("app.userMenu.home")}
					</Link>
				</DropdownMenuItem>

				{isImpersonating && (
					<DropdownMenuItem
						onClick={onStopImpersonation}
						disabled={isStoppingImpersonation}
					>
						<UserRoundXIcon className="mr-2 size-4" />
						{t("app.userMenu.stopImpersonation")}
					</DropdownMenuItem>
				)}

				<DropdownMenuItem onClick={onLogout}>
					<LogOutIcon className="mr-2 size-4" />
					{t("app.userMenu.logout")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
