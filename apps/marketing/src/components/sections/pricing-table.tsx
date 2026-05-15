'use client';

import { useState } from 'react';

import { Check, ChevronsUpDown } from 'lucide-react';

import Noise from '@/components/elements/noise';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface FeatureSection {
  category: string;
  isNew?: boolean;
  features: {
    name: string;
    isNew?: boolean;
    free: string | boolean | null;
    pro: string | boolean | null;
    business: string | boolean | null;
    enterprise: string | boolean | null;
  }[];
}

const pricingPlans = [
  {
    name: 'Starter',
    price: '$0/mo',
    yearlyPrice: '$0/mo',
  },
  {
    name: 'Studio',
    price: '$250/mo',
    yearlyPrice: '$188/mo',
  },
  {
    name: 'Teams',
    price: '$499/mo',
    yearlyPrice: '$374/mo',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    yearlyPrice: 'Custom',
  },
];

const comparisonFeatures: FeatureSection[] = [
  {
    category: 'Pricing',
    features: [
      {
        name: 'Price/mo',
        free: '$0/mo',
        pro: '$250/mo',
        business: '$499/mo',
        enterprise: 'Custom',
      },
      {
        name: 'Price/mo (annual billing)',
        free: '$0/mo',
        pro: '$188/mo',
        business: '$374/mo',
        enterprise: 'Custom',
      },
    ],
  },
  {
    category: 'Studio operations',
    features: [
      {
        name: 'Bookings and clients',
        free: true,
        pro: true,
        business: true,
        enterprise: true,
      },
      {
        name: 'Shoots and event dates',
        free: true,
        pro: true,
        business: true,
        enterprise: true,
      },
      {
        name: 'Tasks and deliverables',
        isNew: true,
        free: true,
        pro: true,
        business: true,
        enterprise: true,
      },
      {
        name: 'Discussions and notifications',
        free: true,
        pro: true,
        business: true,
        enterprise: true,
      },
      {
        name: 'Calendar workspace',
        free: true,
        pro: true,
        business: true,
        enterprise: true,
      },
    ],
  },
  {
    category: 'Team scale',
    features: [
      {
        name: 'Active bookings',
        free: 'Up to 25',
        pro: 'Up to 100',
        business: 'Custom',
        enterprise: 'Custom',
      },
      {
        name: 'Team members',
        free: 'Unlimited',
        pro: 'Unlimited',
        business: 'Unlimited',
        enterprise: 'Unlimited',
      },
      {
        name: 'Crew profiles',
        free: 'Up to 5',
        pro: 'Unlimited',
        business: 'Unlimited',
        enterprise: 'Unlimited',
      },
      {
        name: 'Saved views',
        free: '1',
        pro: 'Unlimited',
        business: 'Unlimited',
        enterprise: 'Unlimited',
      },
      {
        name: 'Table exports',
        free: null,
        pro: 'Unlimited',
        business: 'Unlimited',
        enterprise: 'Unlimited',
      },
      {
        name: 'Custom configurations',
        free: 'Basic',
        pro: 'Customizable',
        business: 'Custom',
        enterprise: 'Custom',
      },
      {
        name: 'Workspaces',
        free: '1',
        pro: 'Unlimited',
        business: 'Unlimited',
        enterprise: 'Unlimited',
      },
    ],
  },
  {
    category: 'Finance',
    isNew: true,
    features: [
      {
        name: 'Payment schedules',
        free: true,
        pro: true,
        business: true,
        enterprise: true,
      },
      {
        name: 'Invoices and receipts',
        free: true,
        pro: true,
        business: true,
        enterprise: true,
      },
      {
        name: 'Expenses and financial dashboard',
        free: null,
        pro: true,
        business: true,
        enterprise: true,
      },
    ],
  },
  {
    category: 'Controls',
    features: [
      {
        name: 'Role-based access',
        free: true,
        pro: true,
        business: true,
        enterprise: true,
      },
      {
        name: 'Organization settings',
        free: true,
        pro: true,
        business: true,
        enterprise: true,
      },
    ],
  },
  {
    category: 'Support',
    features: [
      {
        name: 'Email support',
        free: true,
        pro: true,
        business: true,
        enterprise: true,
      },
      {
        name: 'Email support response time',
        free: '<5 week days',
        pro: '<5 week days',
        business: '<1 week days',
        enterprise: '<12 hours',
      },
      {
        name: 'Private onboarding channel',
        free: null,
        pro: null,
        business: null,
        enterprise: '90 days',
      },
      {
        name: 'Onboarding call',
        free: null,
        pro: null,
        business: true,
        enterprise: true,
      },
    ],
  },
];

const PricingTable = () => {
  const [selectedPlan, setSelectedPlan] = useState(1);

  return (
    <section className="section-padding">
      <div className="bigger-container space-y-8 lg:space-y-12">
        <Noise />

        <h2 className="text-4xl leading-tight font-medium tracking-tight lg:text-5xl">
          Pricing Details
        </h2>
        <div>
          <PlanHeaders
            selectedPlan={selectedPlan}
            onPlanChange={setSelectedPlan}
          />
          <FeatureSections selectedPlan={selectedPlan} />
        </div>
      </div>
    </section>
  );
};

const PlanHeaders = ({
  selectedPlan,
  onPlanChange,
}: {
  selectedPlan: number;
  onPlanChange: (index: number) => void;
  prefersReducedMotion?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="">
      {/* Mobile View */}
      <div className="md:hidden">
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="">
          <div className="flex items-center justify-between py-4">
            <CollapsibleTrigger className="flex items-center gap-2">
              <h3 className="text-2xl">{pricingPlans[selectedPlan].name}</h3>
              <ChevronsUpDown
                className={`size-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="flex flex-col space-y-2 p-2">
            {pricingPlans.map(
              (plan, index) =>
                index !== selectedPlan && (
                  <Button
                    variant="outline"
                    key={index}
                    onClick={() => {
                      onPlanChange(index);
                      setIsOpen(false);
                    }}
                  >
                    {plan.name}
                  </Button>
                ),
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Desktop View */}
      <div className="grid grid-cols-6 gap-4 max-md:hidden">
        <div className="col-span-1 max-md:hidden md:col-span-2"></div>

        {pricingPlans.map((plan, index) => (
          <h3 key={index} className="mb-3 text-center text-2xl">
            {plan.name}
          </h3>
        ))}
      </div>
    </div>
  );
};

const FeatureSections = ({ selectedPlan }: { selectedPlan: number }) => {
  return (
    <>
      {comparisonFeatures.map((section, sectionIndex) => (
        <div key={sectionIndex} className="flex flex-col md:mt-4 md:gap-1">
          <div className="py-4">
            <h3 className="flex items-center gap-8 text-lg">
              {section.category}
              {section.isNew && <Badge variant="outline">NEW</Badge>}
            </h3>
          </div>
          {section.features.map((feature, featureIndex) => (
            <div
              key={featureIndex}
              className="text-primary grid grid-cols-2 items-center font-medium md:grid-cols-6"
            >
              <span className="me-8 inline-flex items-center gap-4 py-4 md:col-span-2">
                {feature.name}
                {feature.isNew && (
                  <Badge variant="default" className="rounded-sm">
                    NEW
                  </Badge>
                )}
              </span>
              {/* Mobile View - Only Selected Plan */}
              <div className="md:hidden">
                <div className="bg-border border-input flex items-center justify-center gap-1 rounded-md border py-3 text-sm">
                  {(() => {
                    const value = [
                      feature.free,
                      feature.pro,
                      feature.business,
                      feature.enterprise,
                    ][selectedPlan];
                    return renderFeatureValue(value);
                  })()}
                </div>
              </div>
              {/* Desktop View - All Plans */}
              <div className="hidden md:col-span-4 md:grid md:grid-cols-4 md:gap-1">
                {[
                  feature.free,
                  feature.pro,
                  feature.business,
                  feature.enterprise,
                ].map((value, i) => (
                  <div
                    key={i}
                    className="bg-border border-input flex items-center justify-center gap-1 rounded-md border py-3 text-sm"
                  >
                    {renderFeatureValue(value)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </>
  );
};

const renderFeatureValue = (value: string | boolean | null) => {
  if (value === null) {
    return <span className="text-gray-400">-</span>;
  }

  if (typeof value === 'boolean') {
    return value ? (
      <Check className="size-5" />
    ) : (
      <span className="text-gray-400">-</span>
    );
  }

  return <span>{value}</span>;
};

export default PricingTable;
