'use client';

import { ChevronRightIcon, MessageSquare } from 'lucide-react';

import Noise from '@/components/elements/noise';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';

const faqData = [
  {
    id: 'stuwiz-who-is-it-for',
    question: 'What is Stuwiz and who is it for?',
    answer:
      'Stuwiz is studio management software for photography, video, wedding, event, and production teams that need one place for bookings, shoots, crew, clients, payments, and deliverables.',
  },
  {
    id: 'technical-knowledge',
    question: 'Can my team use Stuwiz without technical knowledge?',
    answer:
      'Yes. Stuwiz is designed for studio owners, coordinators, managers, editors, and crew members. You can start with bookings and payments, then bring in crew, tasks, discussions, and dashboards as your workflow matures.',
  },
  {
    id: 'integrations',
    question: 'Can I manage payment schedules, invoices, and receipts?',
    answer:
      'Yes. Stuwiz connects payments to bookings, tracks scheduled milestones, records received amounts, supports invoices and receipts, and keeps expenses visible for each project.',
  },
  {
    id: 'task-automation',
    question: 'Can crew members be assigned to shoots and tasks?',
    answer:
      'Yes. You can manage crew profiles, roles, specialisations, day rates, availability, app access, shoot assignments, task assignments, and deliverable responsibilities.',
  },
  {
    id: 'security-compliance',
    question: 'Does Stuwiz replace my spreadsheets?',
    answer:
      'That is the goal. Instead of tracking bookings in one sheet, payments in another, crew availability in chat, and deliverables in reminders, Stuwiz keeps those records connected inside the app.',
  },
];

export default function FAQSection() {
  return (
    <section className="section-padding relative">
      <Noise />
      <div className="container">
        {/* Section Header */}
        <h2 className="text-4xl leading-tight tracking-tight lg:text-5xl">
          Frequently <br className="hidden md:block" />
          asked questions:
        </h2>

        {/* FAQ Content */}
        <div className="mt-8 grid gap-6 lg:mt-12 lg:grid-cols-3">
          {/* FAQ Accordion - Left Side */}
          <div className="lg:col-span-2">
            <Accordion type="single" collapsible className="space-y-4">
              {faqData.map((faq) => (
                <AccordionItem
                  key={faq.id}
                  value={faq.id}
                  className="border-input hover:shadow-primary/5 rounded-lg !border px-6 py-2 transition-all duration-300 hover:shadow-md"
                >
                  <AccordionTrigger className="cursor-pointer text-base font-medium hover:no-underline md:text-lg lg:text-xl">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pb-6 text-base leading-relaxed">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          <Card className="hover:shadow-primary/5 h-full gap-6 transition-all duration-300 hover:shadow-lg">
            <CardHeader className="gap-6 md:gap-8 lg:gap-11">
              <MessageSquare className="text-secondary size-18 stroke-1 md:size-20" />
              <h3 className="text-2xl">Still have questions?</h3>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-muted-foreground">
                Let&apos;s talk through how your studio currently manages
                bookings, crew, payments, and deliverables.
              </p>
            </CardContent>
            <CardFooter className="mt-auto">
              <Button
                size="lg"
                variant="light"
                className="group h-12 w-full gap-4"
                asChild
              >
                <a href="/contact">
                  Contact With Us
                  <div className="bg-border border-input grid size-5.5 place-items-center rounded-full border">
                    <ChevronRightIcon className="size-4 transition-transform group-hover:translate-x-0.25" />
                  </div>
                </a>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </section>
  );
}
