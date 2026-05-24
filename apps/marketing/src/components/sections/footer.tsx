import { Facebook, Linkedin, Twitter } from "lucide-react";

import { Button } from "@/components/ui/button";

const navigation = [
  {
    title: "Product",
    links: [
      { name: "Home", href: "/" },
      { name: "Feature1", href: "/#feature1" },
      { name: "Feature2", href: "/#feature2" },
      { name: "Feature3", href: "/#feature3" },
    ],
  },
  {
    title: "Company",
    links: [
      { name: "About", href: "/about" },
      { name: "Pricing", href: "/pricing" },
    ],
  },
  {
    title: "Support",
    links: [
      { name: "FAQ", href: "/faq" },
      { name: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Service",
    links: [
      { name: "Terms of service", href: "/terms" },
      { name: "Privacy policy", href: "/privacy" },
    ],
  },
];

const socialLinks = [
  { icon: Facebook, href: "https://facebook.com" },
  { icon: Twitter, href: "https://twitter.com" },
  { icon: Linkedin, href: "https://linkedin.com" },
];

export const Footer = () => {
  return (
    <footer className="overflow-hidden bg-primary text-primary-foreground">
      <div className="border-sand-600/50 mx-auto max-w-[95vw] border-x">
        <div className="border-sand-600 flex flex-col items-center border-b py-10 text-center md:py-14 lg:py-20">
          <h2 className="max-w-[800px] text-balance text-5xl font-semibold leading-none tracking-tight lg:text-6xl">
            Stuwiz starts now.{" "}
            <span className="text-sand-600">Your studio won&apos;t wait.</span>
          </h2>
          <Button asChild variant="secondary" size="lg" className="mt-9">
            <a href="/get-started">Get started with 7 days free</a>
          </Button>
        </div>

        {/* Navigation Section */}
        <nav className="border-sand-600/50 border-b py-6">
          <div className="container flex flex-wrap gap-x-32 gap-y-20 md:justify-end md:gap-y-24 lg:gap-y-32">
            {navigation.map((section) => (
              <div key={section.title}>
                <h3 className="mb-6 font-medium lg:text-lg">{section.title}</h3>
                <ul className="space-y-6">
                  {section.links.map((link) => (
                    <li key={link.name}>
                      <a
                        href={link.href}
                        className="hover:text-muted-foreground lg:text-lg"
                      >
                        {link.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        {/* Bottom Section */}
        <div className="border-sand-600/50 border-b">
          <div className="container flex flex-wrap items-center justify-between gap-4 py-8">
            <p className="font-medium">
              © {new Date().getFullYear()} Stuwiz
            </p>
            <div className="flex items-center gap-6">
              {socialLinks.map((link) => (
                <a
                  aria-label={link.href}
                  key={link.href}
                  href={link.href}
                  className="hover:text-muted-foreground"
                >
                  <link.icon size={20} />
                </a>
              ))}
            </div>
          </div>
        </div>

        <a
          href="/"
          aria-label="Stuwiz home"
          className="border-sand-600/50 group relative flex h-36 items-end justify-center overflow-hidden border-b px-4 md:h-48 lg:h-60"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none block max-w-full translate-y-[28%] text-center text-[clamp(6rem,15vw,18rem)] font-semibold uppercase leading-none tracking-normal text-primary-foreground/[0.13] transition duration-500 group-hover:text-primary-foreground/[0.18] md:translate-y-[32%]"
          >
            STUWIZ
          </span>
          <span className="sr-only">Stuwiz</span>
        </a>
      </div>
    </footer>
  );
};
