import Noise from '@/components/elements/noise';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const FEATURES_DATA = [
  {
    id: 1,
    image: '/images/features-grid/1.webp',
    imageAlt: 'Booking management interface',
    title: 'Booking management',
    description:
      'Create full wedding, event, and commercial bookings with clients, dates, package cost, notes, and status in one record.',
    className: 'lg:col-span-3',
    width: 423,
    height: 228,
  },
  {
    id: 2,
    image: '/images/features-grid/2.webp',
    imageAlt: 'Shoot planning dashboard',
    title: 'Shoot scheduling',
    description:
      'Break each booking into shoots with dates, venues, call details, and assigned crew so the field team knows what matters.',
    className: 'lg:col-span-3',
    width: 435,
    height: 228,
  },
  {
    id: 3,
    image: '/images/features-grid/3.webp',
    imageAlt: 'Crew and people management',
    title: 'Crew and people',
    description:
      'Manage photographers, editors, assistants, roles, specialisations, rates, availability, and app access from one people hub.',
    className: 'lg:col-span-4',
    width: 599,
    height: 218,
  },
  {
    id: 4,
    image: '/images/features-grid/4.webp',
    imageAlt: 'Client relationship view',
    title: 'Client CRM',
    description:
      'Keep client contacts, participants, relations, booking history, and communication context easy to find.',
    className: 'lg:col-span-2',
    width: 292,
    height: 215,
  },
  {
    id: 5,
    image: '/images/features-grid/5.webp',
    imageAlt: 'Financial tracking view',
    title: 'Finance tracking',
    description:
      'Follow payment milestones, received amounts, invoices, receipts, expenses, and outstanding balances without spreadsheet drift.',
    className: 'lg:col-span-3',
    width: 417,
    height: 175,
  },
  {
    id: 6,
    image: '/images/features-grid/6.webp',
    imageAlt: 'Team collaboration workspace',
    title: 'Team coordination',
    description:
      'Use discussions, activity, notifications, check-ins, tasks, and deliverables to keep studio work moving after booking day.',
    className: 'lg:col-span-3',
    width: 433,
    height: 155,
  },
];

export default function FeaturesGrid() {
  return (
    <section id="features-grid" className="section-padding relative">
      <Noise />
      <div className="container">
        {/* Section Header */}
        <div className="mx-auto max-w-5xl space-y-3 lg:space-y-4 lg:text-center">
          <h2 className="text-4xl tracking-tight lg:text-5xl">
            Built around how studios actually operate
          </h2>
          <p className="text-muted-foreground text-lg leading-snug lg:text-balance">
            Stuwiz follows the real path of studio work: book the client,
            schedule the shoot, assign the crew, collect payments, finish
            deliverables, and keep every team member in sync.
          </p>
        </div>

        {/* Features Grid */}
        <div className="mt-8 grid grid-cols-1 gap-2 lg:mt-12 lg:grid-cols-6">
          {FEATURES_DATA.map((feature) => (
            <FeatureCard key={feature.id} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
}

interface FeatureCardProps {
  image: string;
  imageAlt: string;
  title: string;
  description: string;
  className?: string;
  width: number;
  height: number;
}

function FeatureCard({
  image,
  imageAlt,
  title,
  description,
  className,
  width,
  height,
}: FeatureCardProps) {
  return (
    <Card className={cn('h-full', className)}>
      {/* Image Section */}
      <CardContent>
        <div className="overflow-hidden rounded-lg">
          <img
            src={image}
            alt={imageAlt}
            width={width}
            height={height}
            className="w-full object-cover"
          />
        </div>
      </CardContent>

      {/* Content Section */}
      <CardHeader>
        <CardTitle className="text-xl leading-tight font-semibold">
          {title}
        </CardTitle>
        <p className="text-muted-foreground/70 leading-relaxed">
          {description}
        </p>
      </CardHeader>
    </Card>
  );
}
