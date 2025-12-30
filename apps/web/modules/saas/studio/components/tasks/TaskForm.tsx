"use client";

import { useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full min-h-0">
        <ScrollArea className="flex-1 min-h-0" onScrollCapture={handleScroll}>
          <div className="px-4 space-y-6 py-4">
            {/* Essential Fields */}
            <FormField
              control={form.control}
              name="bookingId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Booking *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={mode === "edit"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a booking" />
                      </SelectTrigger>
                    </FormControl>
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
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter task name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Advanced Options (Collapsible) */}
            <CollapsibleSection title="Task Details" defaultOpen={mode === "edit"}>
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter task description"
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
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CollapsibleSection>
          </div>
        </ScrollArea>

        <div className="shrink-0 border-t p-4 bg-background">
          <FormActions mode={mode} isSubmitting={isSubmitting} submitLabel={mode === "edit" ? "Save Changes" : "Add Task"} />
        </div>
      </form>
    </Form>
  );
}
