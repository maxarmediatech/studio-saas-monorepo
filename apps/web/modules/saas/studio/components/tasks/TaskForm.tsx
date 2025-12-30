"use client";

import { useEffect, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { Loader2Icon } from "lucide-react";
import type { TaskDetail } from "@repo/api/modules/studio/schemas/task";
import { bookingsApi } from "@saas/studio/lib/api";
import { CollapsibleSection } from "../ui/CollapsibleSection";
import { FormActions } from "../ui/FormActions";

const taskFormSchema = z.object({
  bookingId: z.string().min(1, "Booking is required"),
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().max(5000).optional().or(z.literal("")),
  status: z.string().max(50).optional().or(z.literal("")),
  priority: z.string().max(50).optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal("")),
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;

interface TaskFormProps {
  defaultValues?: TaskDetail;
  onSubmit: (data: TaskFormValues) => Promise<void>;
  mode: "create" | "edit";
  isPending?: boolean;
  onScrollChange?: (isScrolled: boolean) => void;
}

export function TaskForm({
  defaultValues,
  onSubmit,
  mode,
  isPending = false,
  onScrollChange,
}: TaskFormProps) {
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      bookingId: "",
      name: "",
      description: "",
      status: "",
      priority: "",
      dueDate: "",
    },
  });

  const { data: bookingsData, isLoading: bookingsLoading } = useQuery(
    bookingsApi.listMinimalOptions()
  );

  const bookings = bookingsData?.data ?? [];

  useEffect(() => {
    if (defaultValues) {
      form.reset({
        bookingId: defaultValues.bookingId,
        name: defaultValues.name,
        description: defaultValues.description ?? "",
        status: defaultValues.status ?? "",
        priority: defaultValues.priority ?? "",
        dueDate: defaultValues.dueDate?.split("T")[0] ?? "",
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
              name="bookingId"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Booking *</FieldLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={mode === "edit"}
                  >
                    <SelectTrigger id={field.name} aria-invalid={fieldState.invalid}>
                      <SelectValue placeholder="Select a booking" />
                    </SelectTrigger>
                    <SelectContent>
                      {bookingsLoading ? (
                        <div className="flex items-center justify-center p-2">
                          <Loader2Icon className="h-4 w-4 animate-spin" />
                        </div>
                      ) : (
                        bookings.map((booking) => (
                          <SelectItem key={booking.id} value={booking.id}>
                            {booking.name} ({booking.referenceNumber})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Name *</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    placeholder="Enter task name"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            {/* Advanced Options (Collapsible) */}
            <CollapsibleSection title="Task Details" defaultOpen={mode === "edit"}>
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
                        placeholder="Enter task description"
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
                    name="status"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor={field.name}>Status</FieldLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger id={field.name} aria-invalid={fieldState.invalid}>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />

                  <Controller
                    name="priority"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor={field.name}>Priority</FieldLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger id={field.name} aria-invalid={fieldState.invalid}>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />
                </div>

                <Controller
                  name="dueDate"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>Due Date</FieldLabel>
                      <Input
                        {...field}
                        id={field.name}
                        type="date"
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
              </FieldGroup>
            </CollapsibleSection>
          </FieldGroup>
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t p-4 bg-background">
        <FormActions mode={mode} isSubmitting={isSubmitting} submitLabel={mode === "edit" ? "Save Changes" : "Add Task"} />
      </div>
    </form>
  );
}
