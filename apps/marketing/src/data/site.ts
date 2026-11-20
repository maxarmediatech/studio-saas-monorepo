/**
 * Every claim on the marketing site lives here. Copy is drawn from the product itself
 * (plan features in packages/i18n/translations/en.json, the screens in apps/web), so
 * nothing on the page promises what the app does not do.
 */

export const APP_URL = "https://app.stuwiz.com";

export const links = {
  signup: `${APP_URL}/auth/signup`,
  login: `${APP_URL}/auth/login`,
  email: "hello@stuwiz.com",
};

export const nav = [
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/faq" },
  { label: "About", href: "/about" },
];

/** What a studio keeps in Stuwiz, shown as the scrolling strip under the hero. */
export const modules = [
  { name: "Quotations", glyph: "◧", color: "#466cf3" },
  { name: "Bookings", glyph: "✳", color: "#21ccee" },
  { name: "Shoots", glyph: "◎", color: "#f23d94" },
  { name: "Deliverables", glyph: "❖", color: "#6927da" },
  { name: "Crew", glyph: "✦", color: "#1470ef" },
  { name: "Clients", glyph: "∿", color: "#f83d69" },
  { name: "Payments", glyph: "◔", color: "#0e9384" },
  { name: "Invoices", glyph: "◧", color: "#466cf3" },
  { name: "Receipts", glyph: "✳", color: "#21ccee" },
  { name: "Expenses", glyph: "◎", color: "#f23d94" },
];

export const why = [
  {
    image: "/images/product/quotations-card.webp",
    alt: "Stuwiz quotations list with drafts, versions and status",
    title: "Quotes that become bookings",
    copy: "Every version you send is kept, and the accepted one turns into a booking in one step.",
  },
  {
    image: "/images/product/deliverable-card.webp",
    alt: "A Stuwiz deliverable with its production workflow and due date",
    title: "Deliverables with due dates",
    copy: "Albums, films and edits tracked per booking, from the wedding day to handover.",
  },
  {
    image: "/images/product/payments-card.webp",
    alt: "Stuwiz payments received against bookings with UPI references",
    title: "Payments against every booking",
    copy: "Log each payment with its method and reference, UPI included, and see what is still due.",
  },
];

export const tools = [
  {
    id: "bookings",
    label: "Bookings",
    copy: "Every wedding is one booking, with its package, cost and balance always in view. Packages cover one or both families over several days.",
    image: "/images/product/bookings.webp",
    imageSm: "/images/product/bookings-sm.webp",
    alt: "Stuwiz bookings list with packages, costs and balances due",
  },
  {
    id: "production",
    label: "Production",
    copy: "Shoots, deliverables and linked tasks on each booking, so the team knows what is due and who is on it.",
    image: "/images/product/deliverables.webp",
    imageSm: "/images/product/deliverables-sm.webp",
    alt: "Stuwiz deliverables across bookings with due dates and status",
  },
  {
    id: "finance",
    label: "Payments and finance",
    copy: "Scheduled payments, invoices, receipts and expenses in one ledger, with balances due on the bookings list.",
    image: "/images/product/payments.webp",
    imageSm: "/images/product/payments-sm.webp",
    alt: "Stuwiz payments received, booking by booking",
  },
];

/** The Studio Basics plan, feature by feature. */
export const features = [
  {
    icon: "calendar",
    title: "Unlimited bookings",
    copy: "Bookings with their linked shoots and deliverables, as many as your season needs.",
  },
  {
    icon: "users",
    title: "Client CRM",
    copy: "Client records with notes and booking history, shared across quotes and bookings.",
  },
  {
    icon: "crew",
    title: "Crew and teams",
    copy: "In-house and contract crew with roles, teams, rates and assignments.",
  },
  {
    icon: "wallet",
    title: "Finance in one place",
    copy: "Payments, invoices, receipts and expenses, kept against the booking they belong to.",
  },
  {
    icon: "pulse",
    title: "Dashboard and search",
    copy: "A dashboard, search, notifications and team discussions across the studio.",
  },
  {
    icon: "template",
    title: "Your packages",
    copy: "Custom booking types, packages and templates that match how you sell.",
  },
];

export const screens = [
  {
    label: "Clients",
    color: "#21ccee",
    glyph: "∿",
    image: "/images/product/clients-sm.webp",
    alt: "Stuwiz clients list with contact details and city",
  },
  {
    label: "Crew",
    color: "#1470ef",
    glyph: "✦",
    image: "/images/product/people-sm.webp",
    alt: "Stuwiz people list of crew members with type, access and status",
  },
  {
    label: "Deliverable",
    color: "#f23d94",
    glyph: "❖",
    image: "/images/product/deliverable-sm.webp",
    alt: "A single Stuwiz deliverable with its production workflow",
  },
];

/** Before and after, in the bento that used to hold testimonials. No invented numbers. */
export const switches = [
  { before: "Quotes in spreadsheets", after: "Quotations with every version kept" },
  { before: "Crew on WhatsApp groups", after: "Crew with roles, rates and access" },
  { before: "Payments in a notebook", after: "One ledger against every booking" },
  { before: "Deadlines in someone's head", after: "Deliverables with due dates and status" },
];

export const plans = [
  {
    name: "Studio Basics",
    blurb: "Everything a studio needs to run bookings, crew and money in one place.",
    features: [
      "Unlimited bookings with linked shoots and deliverables",
      "Client CRM with notes and booking history",
      "Crew roles, teams, and assignments",
      "Payments, invoices, receipts, and expenses",
      "Dashboard, search, notifications, and team discussions",
      "Custom booking types, packages, and templates",
    ],
    soon: [] as string[],
  },
  {
    name: "Studio Advance",
    blurb: "Basics, plus automation that answers leads and follows up for you.",
    features: ["Everything in Studio Basics", "Instant lead replies", "Automated follow-ups"],
    soon: ["Client reminders and status updates"],
  },
];

export const faqs = [
  {
    q: "What is Stuwiz?",
    a: "Stuwiz is studio management software for wedding and photography studios. Each wedding is one booking that holds the quote it came from, every shoot, every deliverable, the crew and every payment collected.",
  },
  {
    q: "How is Stuwiz different from generic project tools?",
    a: "It is built around how studios work: quotations with versions, packages for one or both families over several days, deliverables with due dates, and in-house and contract crew. Generic tools make you rebuild all of that yourself.",
  },
  {
    q: "Can I turn a quotation into a booking?",
    a: "Yes. Quotations keep every version you send, and the accepted one becomes a booking in one step, with its package, cost and balance.",
  },
  {
    q: "Does it handle contract crew?",
    a: "Yes. Add in-house and contract crew with their rates, and give each person only the access they need.",
  },
  {
    q: "How are payments tracked?",
    a: "Payments are logged against each booking with the method and reference, including UPI. Scheduled payments and receipts sit in the same ledger, so balances due show on the bookings list.",
  },
  {
    q: "Will it work for video production studios too?",
    a: "Yes. Bookings, deliverables, crew and payments work the same way for videography and other creative studios.",
  },
];
