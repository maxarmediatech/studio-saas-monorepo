"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Shoot } from "@repo/api/modules/studio/schemas/shoot";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Textarea } from "@repo/ui/components/textarea";
import { bookingsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CollapsibleSection } from "../ui/CollapsibleSection";
import { FormActions } from "../ui/FormActions";

const shootFormSchema = z.object({
  bookingId: z.string().min(1, "Booking is required"),
  name: z.string().min(1, "Name is required").max(255),
  shootType: z.string().min(1, "Shoot type is required").max(100),
  shootDate: z.string().min(1, "Shoot date is required"),
  startTime: z.string().optional().or(z.literal("")),
  endTime: z.string().optional().or(z.literal("")),
  venue: z.string().max(255).optional().or(z.literal("")),
  venueAddress: z.string().max(500).optional().or(z.literal("")),
  notes: z.string().max(5000).optional().or(z.literal("")),
});

export type ShootFormValues = z.infer<typeof shootFormSchema>;

const SHOOT_TYPES = [
  { value: "pre_wedding", label: "Pre Wedding" },
  { value: "wedding", label: "Wedding" },
  { value: "engagement", label: "Engagement" },
  { value: "mehendi", label: "Mehendi" },
  { value: "sangeet", label: "Sangeet" },
  { value: "haldi", label: "Haldi" },
  { value: "portrait", label: "Portrait" },
  { value: "maternity", label: "Maternity" },
  { value: "baby_shoot", label: "Baby Shoot" },
  { value: "corporate", label: "Corporate" },
  { value: "other", label: "Other" },
];

interface ShootFormProps {
  defaultValues?: Shoot;
  defaultBookingId?: string;
  onSubmit: (data: ShootFormValues) => Promise<void>;
  mode: "create" | "edit";
  isPending?: boolean;
}

export function ShootForm({
  defaultValues,
  defaultBookingId,
  onSubmit,
  mode,
  isPending = false,
}: ShootFormProps) {
  const { data: bookingsData, isLoading: isLoadingBookings } = useQuery(
    bookingsApi.listMinimalOptions({}),
  );

  const bookings = bookingsData?.data ?? [];

  const form = useForm<ShootFormValues>({
    resolver: zodResolver(shootFormSchema),
    defaultValues: {
      bookingId: defaultBookingId ?? "",
      name: "",
      shootType: "",
      shootDate: "",
      startTime: "",
      endTime: "",
      venue: "",
      venueAddress: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (defaultValues) {
      form.reset({
        bookingId: defaultValues.bookingId,
        name: defaultValues.name,
        shootType: defaultValues.shootType,
        shootDate: defaultValues.shootDate,
        startTime: defaultValues.startTime ?? "",
        endTime: defaultValues.endTime ?? "",
        venue: defaultValues.venue ?? "",
        venueAddress: defaultValues.venueAddress ?? "",
        notes: defaultValues.notes ?? "",
      });
    }
  }, [defaultValues, form]);

  const isSubmitting = form.formState.isSubmitting || isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                disabled={mode === "edit" || isLoadingBookings}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select booking" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {bookings.map((booking) => (
                    <SelectItem key={booking.id} value={booking.id}>
                      {booking.name} ({booking.referenceNumber})
                    </SelectItem>
                  ))}
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
                <Input placeholder="Enter shoot name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="shootType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Shoot Type *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {SHOOT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="shootDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Shoot Date *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Scheduling & Location (Collapsible) */}
        <CollapsibleSection title="Time & Location" defaultOpen={mode === "edit"}>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="startTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Time</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="endTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End Time</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="venue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Venue</FormLabel>
                <FormControl>
                  <Input placeholder="Enter venue name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="venueAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Venue Address</FormLabel>
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

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Additional notes..."
                    className="resize-none"
                    rows={2}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CollapsibleSection>

        <FormActions mode={mode} isSubmitting={isSubmitting} submitLabel={mode === "edit" ? "Save Changes" : "Add Shoot"} />
      </form>
    </Form>
  );
}
