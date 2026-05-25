"use client";

import { FaDiscord, FaGithub, FaLinkedin, FaXTwitter } from "react-icons/fa6";

import Logo from "@/components/layout/logo";
import { EXTERNAL_LINKS } from "@/constants/external-links";
import { cn } from "@/lib/utils";

const FOOTER_LINK_GROUPS = [
	{
		title: "Contact",
		links: [
			{ label: "hello@stuwiz.com", href: "mailto:hello@stuwiz.com" },
			{ label: "+1 (415) 555-0184", href: "tel:+14155550184" },
			{
				label: "456 Studio Avenue, Suite 204, San Francisco, CA 94107",
				href: "/contact",
			},
		],
		featured: true,
	},
	{
		title: "Navigation",
		links: [
			{ label: "Home", href: "/" },
			{ label: "About", href: "/about" },
			{ label: "Pricing", href: "/pricing" },
			{ label: "Blog", href: "/blog" },
		],
	},
	{
		title: "Support",
		links: [
			{ label: "FAQ", href: "/faq" },
			{ label: "Contact", href: "/contact" },
			{ label: "Privacy Policy", href: "/privacy-policy" },
			{ label: "Terms of Service", href: "/terms-of-service" },
		],
	},
];

const Footer = () => {
	const themeClass =
		"bg-[#09090B] text-white [--background:#09090B] [--foreground:#FFFFFF] [--border:rgba(255,255,255,0.1)] [--muted-foreground:#A1A1AA] [&_*]:border-white/10 dark:bg-white dark:text-[#09090B] dark:[--background:#FFFFFF] dark:[--foreground:#09090B] dark:[--border:rgba(9,9,11,0.1)] dark:[--muted-foreground:#71717A] dark:[&_*]:border-black/10";

	const logoWordmarkClass =
		cn(
			"mt-[4.85rem] sm:mt-[4.35rem] md:mt-[5.85rem] lg:mt-[7.2rem]",
			"text-white/15 dark:text-black/[0.03]",
		);

	return (
		<footer className={cn("overflow-hidden", themeClass)}>
			<div className="container">
				<div className="bordered-div-padding border-x">
					<Logo tone="light" wordmarkClassName="h-11 dark:hidden" />
					<Logo
						tone="dark"
						wordmarkClassName="hidden h-11 dark:block"
					/>
					<p className="mt-8 max-w-3xl text-2xl leading-tight text-white/80 md:text-4xl md:leading-tight dark:text-[#09090B]/75">
						Run bookings, shoots, crews, projects, and client
						delivery from one calm studio workspace.
					</p>
				</div>

				<div className="grid divide-y border md:grid-cols-[1.45fr_0.95fr_0.95fr] md:divide-x md:divide-y-0">
					{FOOTER_LINK_GROUPS.map((group) => (
						<div
							key={group.title}
							className="bordered-div-padding min-h-48 md:min-h-56"
						>
							<h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45 dark:text-[#09090B]/45">
								{group.title}
							</h3>
							<ul
								className={cn(
									"mt-7 space-y-3.5",
									group.featured && "max-w-sm",
								)}
							>
								{group.links.map((link) => (
									<li key={link.label}>
										<a
											href={link.href}
											className={cn(
												"text-base font-medium text-white/90 transition-opacity hover:opacity-70 md:text-lg dark:text-[#09090B]/85",
												group.featured &&
													"leading-snug",
											)}
										>
											{link.label}
										</a>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>

				{/* Social and Status Section */}
				<div className="flex flex-col justify-between border-x border-b md:flex-row">
					<div className="bordered-div-padding flex items-center space-x-3">
						<a
							href={EXTERNAL_LINKS.DISCORD}
							className="px-3 py-2.5 transition-opacity hover:opacity-80"
							target="_blank"
							rel="noopener noreferrer"
							aria-label="Discord"
						>
							<FaDiscord className="size-5" />
						</a>
						<a
							href={EXTERNAL_LINKS.GITHUB}
							className="px-3 py-2.5 transition-opacity hover:opacity-80"
							target="_blank"
							rel="noopener noreferrer"
							aria-label="GitHub"
						>
							<FaGithub className="size-5" />
						</a>
						<a
							href={EXTERNAL_LINKS.TWITTER}
							className="px-3 py-2.5 transition-opacity hover:opacity-80"
							target="_blank"
							rel="noopener noreferrer"
							aria-label="Twitter"
						>
							<FaXTwitter className="size-5" />
						</a>
						<a
							href={EXTERNAL_LINKS.LINKEDIN}
							className="px-3 py-2.5 transition-opacity hover:opacity-80"
							target="_blank"
							rel="noopener noreferrer"
							aria-label="LinkedIn"
						>
							<FaLinkedin className="size-5" />
						</a>
					</div>
					<div className="bordered-div-padding flex items-center border-t text-[#00A656] md:border-t-0">
						<span
							className={cn(
								"me-3 h-2 w-2 animate-pulse rounded-full bg-[#00A656]",
							)}
						/>
						<span className="font-medium">
							All systems operational
						</span>
					</div>
				</div>

				{/* Legal Links Section */}
				<div className="bordered-div-padding text-muted-foreground flex items-center justify-center space-x-6 border-x border-b text-sm">
					<a
						href="/privacy-policy"
						className="hover:text-foreground transition-opacity hover:opacity-80"
					>
						Privacy Policy
					</a>
					<span className="text-border">•</span>
					<a
						href="/terms-of-service"
						className="hover:text-foreground transition-opacity hover:opacity-80"
					>
						Terms of Service
					</a>
				</div>

				{/* Large Logo */}
				<a
					href="/"
					className={cn(
						"relative flex h-44 items-start justify-center overflow-hidden border-x sm:h-52 md:h-64 lg:h-[18.25rem]",
						"bg-[#09090B] dark:bg-white",
					)}
					aria-label="Stuwiz home"
				>
					<span
						aria-hidden="true"
						className={cn(
							logoWordmarkClass,
							"block text-center text-[6.5rem] font-semibold leading-none tracking-normal sm:text-[8.5rem] md:text-[12.75rem] lg:text-[17rem]",
						)}
					>
						Stuwiz
					</span>
					<span className="sr-only">Stuwiz</span>
				</a>
			</div>
		</footer>
	);
};

export default Footer;
