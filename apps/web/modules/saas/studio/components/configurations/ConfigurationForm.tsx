"use client";

import { useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { Switch } from "@repo/ui/components/switch";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import type { Configuration } from "@repo/api/modules/studio/schemas/configuration";
import { CollapsibleSection } from "../ui/CollapsibleSection";
import { FormActions } from "../ui/FormActions";

const configurationFormSchema = z.object({
  key: z
    .string()
    .min(1, "Key is required")
    .max(100)
    .regex(
      /^[a-z][a-z0-9_]*$/,
      "Key must start with lowercase letter and contain only lowercase letters, numbers, and underscores"
    ),
  label: z.string().min(1, "Label is required").max(255),
  description: z.string().max(1000).optional().or(z.literal("")),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color")
    .optional()
    .or(z.literal("")),
  sortOrder: z.number().int().min(0).optional(),
  isDefault: z.boolean().optional(),
});

export type ConfigurationFormValues = z.infer<typeof configurationFormSchema>;

interface ConfigurationFormProps {
  defaultValues?: Configuration;
  onSubmit: (data: ConfigurationFormValues) => Promise<void>;
  mode: "create" | "edit";
  isPending?: boolean;
  onScrollChange?: (isScrolled: boolean) => void;
}

export function ConfigurationForm({
  defaultValues,
  onSubmit,
  mode,
  isPending = false,
  onScrollChange,
}: ConfigurationFormProps) {
  const form = useForm<ConfigurationFormValues>({
    resolver: zodResolver(configurationFormSchema),
    defaultValues: {
      key: "",
      label: "",
      description: "",
      color: "",
      sortOrder: 0,
      isDefault: false,
    },
  });

  useEffect(() => {
    if (defaultValues) {
      form.reset({
        key: defaultValues.key,
        label: defaultValues.label,
        description: defaultValues.description ?? "",
        color: defaultValues.color ?? "",
        sortOrder: defaultValues.sortOrder,
        isDefault: defaultValues.isDefault,
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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full min-h-0">
        <ScrollArea className="flex-1 min-h-0" onScrollCapture={handleScroll}>
          <div className="px-4 space-y-6 py-4">
        {/* Essential Fields */}
        {mode === "create" && (
          <FormField
            control={form.control}
            name="key"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Key *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., wedding_premium" {...field} />
                </FormControl>
                <FormDescription>
                  Unique identifier (lowercase, underscores allowed)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="label"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Label *</FormLabel>
              <FormControl>
                <Input placeholder="Display name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Advanced Options (Collapsible) */}
        <CollapsibleSection title="Advanced Options" defaultOpen={mode === "edit"}>
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Optional description"
                    className="resize-none"
                    rows={2}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        className="w-12 h-10 p-1 cursor-pointer"
                        value={field.value || "#6B7280"}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                      <Input
                        placeholder="#6B7280"
                        {...field}
                        className="flex-1"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sortOrder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sort Order</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      {...field}
                      value={field.value ?? 0}
                      onChange={(e) =>
                        field.onChange(e.target.value ? Number(e.target.value) : 0)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="isDefault"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel>Default</FormLabel>
                  <FormDescription>Pre-select this option in forms</FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </CollapsibleSection>
          </div>
        </ScrollArea>

        <div className="shrink-0 border-t p-4 bg-background">
          <FormActions mode={mode} isSubmitting={isSubmitting} />
        </div>
      </form>
    </Form>
  );
}
