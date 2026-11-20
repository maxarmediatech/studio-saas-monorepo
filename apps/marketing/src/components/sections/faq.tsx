import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";

const leftQuestions = [
  {
    question: "What is Stuwiz?",
    answer:
      "Stuwiz is studio management software for wedding and photography studios. Each wedding is one booking that holds the quote it came from, every shoot, every deliverable, the crew and every payment collected.",
  },
  {
    question: "How is Stuwiz different from generic project tools?",
    answer:
      "It is built around how studios work: quotations with versions, packages for one or both families over several days, deliverables with due dates, and in-house and contract crew. Generic tools make you rebuild all of that yourself.",
  },
  {
    question: "Can I turn a quotation into a booking?",
    answer:
      "Yes. Quotations keep every version you send, and the accepted one becomes a booking in one step, with its package, cost and balance.",
  },
];

const rightQuestions = [
  {
    question: "Does it handle contract crew?",
    answer:
      "Yes. Add in-house and contract crew with their rates, and give each person only the access they need.",
  },
  {
    question: "How are payments tracked?",
    answer:
      "Payments are logged against each booking with the method and reference, including UPI. Scheduled payments and receipts sit in the same ledger, so balances due show on the bookings list.",
  },
  {
    question: "Will it work for video production studios too?",
    answer:
      "Yes. Bookings, deliverables, crew and payments work the same way for videography and other creative studios.",
  },
];

export const FAQ = () => {
  return (
    <section className={"pb-16 md:pb-28 lg:pb-32"}>
      <div className="container mx-auto lg:max-w-5xl">
        <h2 className="text-center text-2xl font-semibold tracking-tight lg:text-3xl">
          Frequently Asked Questions
        </h2>

        <div className="mt-6 grid gap-x-12 md:mt-10 md:grid-cols-2 lg:mt-14">
          <Accordion
            type="single"
            collapsible
            className="text-muted-foreground border-t"
          >
            {leftQuestions.map((item, i) => (
              <AccordionItem key={i} value={`left-${i}`}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent className="text-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <Accordion
            collapsible
            type="single"
            className="text-muted-foreground md:border-t"
          >
            {rightQuestions.map((item, i) => (
              <AccordionItem key={i} value={`right-${i}`}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent className="text-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};
