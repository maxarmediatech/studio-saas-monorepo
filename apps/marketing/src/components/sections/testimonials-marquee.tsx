import { Quote, Star } from 'lucide-react';

import Noise from '@/components/elements/noise';
import { Marquee } from '@/components/magicui/marquee';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

const platformLogos = [
  {
    name: 'G2',
    src: 'https://logo.clearbit.com/g2.com',
    alt: 'G2',
  },
  {
    name: 'Airtable',
    src: 'https://logo.clearbit.com/airtable.com',
    alt: 'Airtable',
  },
  {
    name: 'Trustpilot',
    src: 'https://logo.clearbit.com/trustpilot.com',
    alt: 'Trustpilot',
  },
  {
    name: 'GetApp',
    src: 'https://logo.clearbit.com/getapp.com',
    alt: 'GetApp',
  },
  {
    name: 'Software Advice',
    src: 'https://logo.clearbit.com/softwareadvice.com',
    alt: 'Software Advice',
  },
];

const testimonials = [
  {
    id: '1',
    name: 'Sarah Mitchell',
    title: 'Studio Owner',
    company: 'Frame House Studio',
    image:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=face',
    companyLogo: {
      src: '/images/logos/nike.png',
      width: 67.5,
      height: 24,
    },
    testimonial:
      'Stuwiz brought our bookings, payments, and shoot schedules into one place.',
  },
  {
    id: '2',
    name: 'Alex Chen',
    title: 'Operations Lead',
    company: 'Northlight Films',
    image:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face',
    testimonial:
      "Crew assignments are finally tied to the exact shoot, venue, and booking context.",
  },
  {
    id: '3',
    name: 'Marcus Johnson',
    title: 'Wedding Studio Manager',
    company: 'Vows & Frames',
    image:
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face',
    testimonial:
      'We used to lose track of edits every week. Now ownership is clear.',
  },
  {
    id: '4',
    name: 'Emily Davis',
    title: 'Client Coordinator',
    company: 'The Bridal Edit',
    image:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face',
    testimonial:
      'Client details, event dates, and payments are much easier to find.',
  },
  {
    id: '5',
    name: 'Ben Parker',
    title: 'Engineering Lead',
    company: 'IBM',
    image:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=face',
    testimonial:
      "Since adopting Stuwiz, our delivery follow-ups became shorter and much clearer.",
  },
  {
    id: '6',
    name: 'Samantha Lee',
    title: 'Design Director',
    company: 'Logitech',
    image:
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop&crop=face',
    testimonial:
      "Stuwiz makes it easier to manage finance, crew, and client work together.",
  },
  {
    id: '7',
    name: 'David Kim',
    title: 'CTO',
    company: 'Fortinet',
    image:
      'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=400&h=400&fit=crop&crop=face',
    testimonial:
      'We use Stuwiz across bookings, shoots, editing, and finance.',
  },
  {
    id: '8',
    name: 'Rachel Green',
    title: 'Producer',
    company: 'Zapier',
    image:
      'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=400&h=400&fit=crop&crop=face',
    companyLogo: {
      src: '/images/logos/zapiar.png',
      width: 105,
      height: 28,
    },
    testimonial:
      'Stuwiz changed our daily planning. We know what is upcoming and what is overdue.',
  },
  {
    id: '9',
    name: 'Mike Johnson',
    title: 'Startup Founder',
    company: 'Tailwind CSS',
    image:
      'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop&crop=face',
    companyLogo: {
      src: '/images/logos/tailwindcss.png',
      width: 130,
      height: 20,
    },
    testimonial:
      "I can create a booking, add payments, and assign work before the kickoff call ends.",
  },
];

const TestimonialsMarquee = () => {
  return (
    <section className="section-padding relative">
      <Noise />
      <div className="container">
        {/* Reviews Section */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {/* 5 Star Rating */}
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className="size-3 fill-yellow-400 text-yellow-400"
              />
            ))}
          </div>
          <span className="text-muted-foreground text-xs font-medium">
            25,000+ reviews from
          </span>

          {/* Platform Logos */}
          {platformLogos.map((logo) => (
            <img
              key={logo.name}
              src={logo.src}
              alt={logo.alt}
              width={12}
              height={12}
            />
          ))}
        </div>

        <div className="max-w-4xl space-y-3 lg:space-y-4">
          <h2 className="text-4xl tracking-tight lg:text-5xl">
            Why studios are moving their operations into Stuwiz
          </h2>
          <p className="text-muted-foreground text-lg leading-snug">
            Hear how studio teams are reducing spreadsheet drift, payment
            confusion, and lost delivery follow-ups.
          </p>
        </div>
      </div>

      <div className="mt-8 space-y-4 mask-r-from-90% mask-r-to-100% mask-l-from-90% mask-l-to-100% lg:mt-12">
        <Marquee pauseOnHover className="py-0">
          {firstRow.map((review) => (
            <ReviewCard
              key={review.id}
              name={review.name}
              title={review.title}
              company={review.company}
              image={review.image}
              testimonial={review.testimonial}
            />
          ))}
        </Marquee>
        <Marquee reverse pauseOnHover className="py-0">
          {secondRow.map((review) => (
            <ReviewCard
              key={review.id}
              name={review.name}
              title={review.title}
              company={review.company}
              image={review.image}
              testimonial={review.testimonial}
            />
          ))}
        </Marquee>
      </div>
    </section>
  );
};

export default TestimonialsMarquee;

// Split testimonials into two rows for marquee
const firstRow = testimonials.slice(0, 5);
const secondRow = testimonials.slice(5);

interface ReviewCardProps {
  name: string;
  title: string;
  company: string;
  image: string;
  testimonial: string;
}

function ReviewCard({
  name,
  title,
  company,
  image,
  testimonial,
}: ReviewCardProps) {
  return (
    <Card
      className={cn(
        'hover:bg-accent/10 max-w-xs gap-3 bg-transparent md:max-w-md',
        'transition-colors duration-200',
      )}
    >
      <CardHeader className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            className="border-input rounded-full border"
            width={48}
            height={48}
            src={image}
            alt={name}
          />
          <div className="flex flex-col">
            <CardTitle className="text-sm font-medium">
              <cite className="not-italic">{name}</cite>
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs">
              {title} at {company}
            </CardDescription>
          </div>
        </div>
        <Quote className="fill-foreground size-5" />
      </CardHeader>
      <CardContent className="">
        <blockquote className="leading-snug">{testimonial}</blockquote>
      </CardContent>
    </Card>
  );
}
