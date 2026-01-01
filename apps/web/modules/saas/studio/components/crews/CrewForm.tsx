"use client";

import { useEffect, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import type { Crew } from "@repo/api/modules/studio/schemas/crew";
import { CollapsibleSection } from "../ui/CollapsibleSection";
import { FormActions } from "../ui/FormActions";

const crewFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phoneNumber: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .optional()
    .or(z.literal("")),
  role: z.string().min(1, "Role is required").max(100),
  status: z.string().min(1, "Status is required"),
  dailyRate: z.string().optional().or(z.literal("")),
});

export type CrewFormValues = z.infer<typeof crewFormSchema>;

const CREW_ROLES = [
  { value: "lead_photographer", label: "Lead Photographer" },
  { value: "photographer", label: "Photographer" },
  { value: "lead_videographer", label: "Lead Videographer" },
  { value: "videographer", label: "Videographer" },
  { value: "drone_operator", label: "Drone Operator" },
  { value: "assistant", label: "Assistant" },
  { value: "editor", label: "Editor" },
  { value: "member", label: "Member" },
];

const CREW_STATUSES = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "unavailable", label: "Unavailable" },
];

interface CrewFormProps {
  defaultValues?: Crew;
  onSubmit: (data: CrewFormValues) => Promise<void>;
  mode: "create" | "edit";
  isPending?: boolean;
  onScrollChange?: (isScrolled: boolean) => void;
}

export function CrewForm({
  defaultValues,
  onSubmit,
  mode,
  isPending = false,
  onScrollChange,
}: CrewFormProps) {
  const form = useForm<CrewFormValues>({
    resolver: zodResolver(crewFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phoneNumber: "",
      role: "",
      status: "active",
      dailyRate: "",
    },
  });

  useEffect(() => {
    if (defaultValues) {
      form.reset({
        name: defaultValues.name,
        email: defaultValues.email ?? "",
        phoneNumber: defaultValues.phoneNumber ?? "",
        role: defaultValues.role,
        status: defaultValues.status,
        dailyRate: defaultValues.dailyRate ?? "",
      });
    }
  }, [defaultValues, form]);

  const isSubmitting = form.formState.isSubmitting || isPending;

  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const target = event.target as HTMLDivElement;
      const isScrolled = target.scrollTop > 0;
      onScrollChange?.(isScrolled);
    },
    [onScrollChange]
  );

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full min-h-0">
      <ScrollArea className="flex-1 min-h-0" onScrollCapture={handleScroll}>
        <div className="px-4 py-4">
          <FieldGroup>
            {/* Essential Fields */}
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Name *</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    placeholder="Enter name"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              name="role"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Role *</FieldLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id={field.name} aria-invalid={fieldState.invalid}>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {CREW_ROLES.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            {/* Advanced Options (Collapsible) */}
            <CollapsibleSection title="Contact & Details" defaultOpen={mode === "edit"}>
              <FieldGroup>
                <div className="grid grid-cols-2 gap-4">
                  <Controller
                    name="email"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                        <Input
                          {...field}
                          id={field.name}
                          type="email"
                          placeholder="email@example.com"
                          aria-invalid={fieldState.invalid}
                        />
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />

                  <Controller
                    name="phoneNumber"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor={field.name}>Phone</FieldLabel>
                        <Input
                          {...field}
                          id={field.name}
                          placeholder="+91 9876543210"
                          aria-invalid={fieldState.invalid}
                        />
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Controller
                    name="status"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor={field.name}>Status *</FieldLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger id={field.name} aria-invalid={fieldState.invalid}>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            {CREW_STATUSES.map((status) => (
                              <SelectItem key={status.value} value={status.value}>
                                {status.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />

                  <Controller
                    name="dailyRate"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor={field.name}>Daily Rate (INR)</FieldLabel>
                        <Input
                          {...field}
                          id={field.name}
                          type="number"
                          placeholder="5000"
                          aria-invalid={fieldState.invalid}
                        />
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />
                </div>
              </FieldGroup>
            </CollapsibleSection>
          </FieldGroup>
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t p-4 bg-background">
        <FormActions mode={mode} isSubmitting={isSubmitting} submitLabel={mode === "edit" ? "Save Changes" : "Add Member"} />
      </div>
    </form>
  );
}
