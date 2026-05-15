'use client';

import { useEffect, useState } from 'react';

import Noise from '@/components/elements/noise';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { cn } from '@/lib/utils';

const COMMON_CARDS_CLASSNAMES = {
  big: 'col-span-4 lg:[&_blockquote]:text-base lg:[&_blockquote]:leading-loose lg:[&_blockquote]:text-foreground',
};
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
      'Stuwiz finally gave our booking, payment, and shoot schedule one home. I can see what is coming up, what is pending, and who owns the next step without asking three people.',
    className: COMMON_CARDS_CLASSNAMES.big,
  },
  {
    id: '2',
    name: 'Alex Chen',
    title: 'Operations Lead',
    company: 'Northlight Films',
    image:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face',
    testimonial:
      'Crew assignments used to live in messages. Now each shoot has the right people, dates, venues, and deliverables attached.',
    className: 'col-span-2 ',
  },
  {
    id: '3',
    name: 'Marcus Johnson',
    title: 'Wedding Studio Manager',
    company: 'Vows & Frames',
    image:
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face',
    testimonial:
      'We stopped losing track of album edits and final delivery. The whole team can see what is done and what is waiting.',
    className: 'col-span-2 ',
  },
  {
    id: '4',
    name: 'Emily Davis',
    title: 'Client Coordinator',
    company: 'The Bridal Edit',
    image:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face',
    testimonial:
      'Client details, event dates, payment status, and conversations are all easier to find. It feels built for the way studios work.',
    className: 'col-span-2 ',
  },
  {
    id: '5',
    name: 'Ben Parker',
    title: 'Post-production Lead',
    company: 'Cut & Color Studio',
    image:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=face',
    testimonial:
      'Editors know exactly which deliverables are due and which booking they belong to. That clarity saves us hours every week.',
    className: 'col-span-2 ',
  },
  {
    id: '6',
    name: 'Samantha Lee',
    title: 'Finance Manager',
    company: 'Silverline Weddings',
    image:
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop&crop=face',
    testimonial:
      'Payment schedules, received amounts, receipts, and invoices are no longer split across files. The money picture is much clearer.',
    className: 'col-span-2',
  },
  {
    id: '7',
    name: 'David Kim',
    title: 'Founder',
    company: 'Studio Meridian',
    image:
      'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=400&h=400&fit=crop&crop=face',
    testimonial:
      'We use Stuwiz across bookings, shoots, crew, and delivery. It has made our morning planning much faster.',
    className: 'col-span-2',
  },
  {
    id: '8',
    name: 'Rachel Green',
    title: 'Producer',
    company: 'Archive Motion',
    image:
      'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=400&h=400&fit=crop&crop=face',
    companyLogo: {
      src: '/images/logos/zapiar.png',
      width: 105,
      height: 28,
    },
    testimonial:
      'Before Stuwiz, every project required a status hunt. Now our dashboard tells us what is upcoming, overdue, assigned, paid, and still open.',
    className: cn(COMMON_CARDS_CLASSNAMES.big, ''),
  },
  {
    id: '9',
    name: 'Mike Johnson',
    title: 'Creative Director',
    company: 'Golden Hour Co.',
    image:
      'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop&crop=face',
    companyLogo: {
      src: '/images/logos/tailwindcss.png',
      width: 130,
      height: 20,
    },
    testimonial:
      'I can create a booking, add shoots, add payments, and assign the team before the kickoff call ends.',
    className: cn(
      COMMON_CARDS_CLASSNAMES.big,
      'lg:[&_blockquote]:text-4xl lg:[&_blockquote]:leading-tight lg:shadow-lg',
    ),
  },
];

export default function Testimonials() {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!api) {
      return;
    }

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap());

    api.on('select', () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  return (
    <section className="section-padding relative overflow-x-hidden">
      <Noise />
      <div className="container">
        {/* Section Header */}
        <div className="mx-auto max-w-4xl space-y-3 lg:space-y-4 lg:text-center">
          <h2 className="text-4xl tracking-tight lg:text-5xl">
            Trusted by studio teams
          </h2>
          <p className="text-muted-foreground text-lg leading-snug lg:text-balance">
            For studio owners, coordinators, editors, and field teams who need
            every booking, payment, shoot, and deliverable to stay visible.
          </p>
        </div>

        {/* Desktop Grid */}
        <div className="mx-auto mt-8 hidden max-w-6xl grid-cols-8 gap-2 lg:mt-12 lg:grid">
          {testimonials.map((testimonial) => (
            <TestimonialCard key={testimonial.id} testimonial={testimonial} />
          ))}
        </div>

        {/* Mobile Carousel */}
        <div className="mt-8 -mr-[max(2rem,calc((100vw-80rem)/2+5rem))] lg:hidden">
          <Carousel
            opts={{
              align: 'start',
              loop: true,
            }}
            className="w-full"
            setApi={setApi}
          >
            <CarouselContent className="-ml-2 lg:-ml-4">
              {testimonials.map((testimonial) => (
                <CarouselItem
                  key={testimonial.id}
                  className="basis-9/10 pl-2 sm:basis-1/2 lg:pl-4"
                >
                  <TestimonialCard testimonial={testimonial} />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden" />
            <CarouselNext className="hidden" />
          </Carousel>

          {/* Carousel Dots */}
          <div className="mt-6 flex justify-center gap-2">
            {Array.from({ length: count }, (_, index) => (
              <button
                key={index}
                onClick={() => api?.scrollTo(index)}
                className={cn(
                  'size-2 rounded-full transition-all duration-200',
                  index === current
                    ? 'bg-foreground scale-110'
                    : 'bg-muted-foreground/30 hover:bg-muted-foreground/50',
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

interface TestimonialCardProps {
  testimonial: {
    id: string;
    name: string;
    title: string;
    company: string;
    image: string;
    companyLogo?: {
      src: string;
      width: number;
      height: number;
    };
    testimonial: string;
    featured?: boolean;
    className?: string;
  };
}

function TestimonialCard({ testimonial }: TestimonialCardProps) {
  const isBigCard = testimonial.className?.includes('col-span-4');
  const withGradientBorder = testimonial.id === '1' || testimonial.id === '9';
  return (
    <Card
      className={cn(
        'hover:shadow-primary/5 relative h-full transition-all duration-300 hover:shadow-lg',
        withGradientBorder &&
          'lg:before:from-chart-1 lg:before:via-chart-2 lg:before:to-chart-3 lg:border-0 lg:before:absolute lg:before:inset-[-1px] lg:before:z-[-1] lg:before:rounded-xl lg:before:bg-gradient-to-tr lg:before:content-[""]',
        testimonial.className,
      )}
    >
      <CardHeader>
        {/* Author Info at Top for Small Cards */}
        {!isBigCard && (
          <div className="flex items-center gap-3">
            <img
              src={testimonial.image}
              alt={`${testimonial.name} profile`}
              width={40}
              height={40}
              className="rounded-full object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="text-card-foreground truncate text-sm font-medium">
                {testimonial.name}
              </div>
              <div className="text-muted-foreground truncate text-xs">
                {testimonial.title} at {testimonial.company}
              </div>
            </div>
          </div>
        )}

        {/* Company Logo for Big Cards Only */}
        {testimonial?.companyLogo?.src && (
          <img
            src={testimonial.companyLogo.src}
            alt={`${testimonial.company} logo`}
            width={testimonial.companyLogo.width}
            height={testimonial.companyLogo.height}
            className="object-contain dark:invert"
          />
        )}
      </CardHeader>

      <CardContent className="">
        {/* Testimonial Text */}
        <blockquote
          className={cn('lg:text-muted-foreground leading-relaxed lg:text-sm')}
        >
          “{testimonial.testimonial}”
        </blockquote>
      </CardContent>

      {/* Author Info at Bottom for Big Cards */}
      {isBigCard && (
        <CardFooter className="flex items-center gap-3">
          <div className="relative">
            <img
              src={testimonial.image}
              alt={`${testimonial.name} profile`}
              width={40}
              height={40}
              className="size-10 rounded-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-card-foreground truncate text-sm font-medium">
              {testimonial.name}
            </div>
            <div className="text-muted-foreground truncate text-xs">
              {testimonial.title} at {testimonial.company}
            </div>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
