"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { Badge } from "@repo/ui/components/badge";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import type { Client } from "@repo/api/modules/studio/schemas/client";
import { CollapsibleSection } from "../ui/CollapsibleSection";
import { FormActions } from "../ui/FormActions";

const SOURCE_SUGGESTIONS = [
  "Word of Mouth",
  "Instagram",
  "Google",
  "Referral",
  "Website",
] as const;

const clientFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phoneNumber: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .optional()
    .or(z.literal("")),
  alternatePhone: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .optional()
    .or(z.literal("")),
  address: z.string().max(1000).optional().or(z.literal("")),
  // Metadata fields
  profession: z.string().max(255).optional().or(z.literal("")),
  source: z.string().optional().or(z.literal("")),
  socialHandle: z.string().max(255).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;

interface ClientFormProps {
  defaultValues?: Client;
  onSubmit: (data: ClientFormValues) => Promise<void>;
  mode: "create" | "edit";
  isPending?: boolean;
}

export function ClientForm({
  defaultValues,
  onSubmit,
  mode,
  isPending = false,
}: ClientFormProps) {
  // Extract metadata fields from Client type
  type ClientMetadata = {
    profession?: string;
    source?: string;
    socialHandle?: string;
    notes?: string;
  };

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phoneNumber: "",
      alternatePhone: "",
      address: "",
      profession: "",
      source: "",
      socialHandle: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (defaultValues) {
      const metadata = (defaultValues.metadata ?? {}) as ClientMetadata;
      form.reset({
        name: defaultValues.name,
        email: defaultValues.email ?? "",
        phoneNumber: defaultValues.phoneNumber ?? "",
        alternatePhone: defaultValues.alternatePhone ?? "",
        address: defaultValues.address ?? "",
        profession: metadata.profession ?? "",
        source: metadata.source ?? "",
        socialHandle: metadata.socialHandle ?? "",
        notes: metadata.notes ?? "",
      });
    }
  }, [defaultValues, form]);

  const isSubmitting = form.formState.isSubmitting || isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full min-h-0">
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-4 space-y-6 pb-4">
            {/* Essential Fields */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter client name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="email@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Contact Details - Always visible */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+91 9876543210" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="alternatePhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alternate Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+91 9876543210" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter full address"
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Additional Info (Collapsible) - all fields full width */}
            <CollapsibleSection title="Additional Info" defaultOpen={mode === "edit"}>
              <FormField
                control={form.control}
                name="profession"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profession</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Software Engineer, Doctor" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>How did they find you?</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Instagram, Friend's referral"
                        {...field}
                      />
                    </FormControl>
                    <div className="flex flex-wrap gap-1.5 pt-1.5">
                      {SOURCE_SUGGESTIONS.map((suggestion) => (
                        <Badge
                          key={suggestion}
                          variant="outline"
                          className="cursor-pointer hover:bg-accent transition-colors text-xs"
                          onClick={() => field.onChange(suggestion)}
                        >
                          {suggestion}
                        </Badge>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="socialHandle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Social Handle</FormLabel>
                    <FormControl>
                      <Input placeholder="@instagram_handle" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Preferences, expectations, cultural considerations..."
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CollapsibleSection>
          </div>
        </ScrollArea>

        <div className="shrink-0 border-t p-4 bg-background">
          <FormActions
            mode={mode}
            isSubmitting={isSubmitting}
            submitLabel={mode === "edit" ? "Save Changes" : "Add Client"}
          />
        </div>
      </form>
    </Form>
  );
}
