"use client";

import { useEffect, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { Switch } from "@repo/ui/components/switch";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import type { Configuration } from "@repo/api/modules/studio/schemas/configuration";
import { CollapsibleSection } from "../ui/CollapsibleSection";
import { FormActions } from "../ui/FormActions";

const configurationFormSchema = z.object({
  label: z
    .string()
    .min(1, "Label is required")
    .max(255)
    .refine(
      (val) => /[a-zA-Z0-9]/.test(val),
      "Label must contain at least one letter or number"
    ),
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
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full min-h-0">
      <ScrollArea className="flex-1 min-h-0" onScrollCapture={handleScroll}>
        <div className="px-4 py-4">
          <FieldGroup>
            <Controller
              name="label"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Label *</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    placeholder="Display name"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            {/* Advanced Options (Collapsible) */}
            <CollapsibleSection title="Advanced Options" defaultOpen={mode === "edit"}>
              <FieldGroup>
                <Controller
                  name="description"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>Description</FieldLabel>
                      <Textarea
                        {...field}
                        id={field.name}
                        placeholder="Optional description"
                        className="resize-none"
                        rows={2}
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <Controller
                    name="color"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor={field.name}>Color</FieldLabel>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            className="w-12 h-10 p-1 cursor-pointer"
                            value={field.value || "#6B7280"}
                            onChange={(e) => field.onChange(e.target.value)}
                          />
                          <Input
                            {...field}
                            id={field.name}
                            placeholder="#6B7280"
                            className="flex-1"
                            aria-invalid={fieldState.invalid}
                          />
                        </div>
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />

                  <Controller
                    name="sortOrder"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor={field.name}>Sort Order</FieldLabel>
                        <Input
                          id={field.name}
                          type="number"
                          min={0}
                          placeholder="0"
                          value={field.value ?? 0}
                          onChange={(e) =>
                            field.onChange(e.target.value ? Number(e.target.value) : 0)
                          }
                          aria-invalid={fieldState.invalid}
                        />
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />
                </div>

                <Controller
                  name="isDefault"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid} orientation="horizontal" className="rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FieldLabel htmlFor={field.name}>Default</FieldLabel>
                        <FieldDescription>Pre-select this option in forms</FieldDescription>
                      </div>
                      <Switch
                        id={field.name}
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </Field>
                  )}
                />
              </FieldGroup>
            </CollapsibleSection>
          </FieldGroup>
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t p-4 bg-background">
        <FormActions mode={mode} isSubmitting={isSubmitting} />
      </div>
    </form>
  );
}
