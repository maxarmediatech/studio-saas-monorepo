# Form design kit

The single blessed pattern for every form in this repo. Design language:
tiny uppercase labels, compact controls, dashed section rules (pages only),
card-style rows for repeating lists.

## Building blocks

| Import | Components | Use for |
|---|---|---|
| `@repo/ui/components/form-fields` | `TextField`, `TextareaField`, `NumberField`, `SelectField`, `DateField`, `PasswordField`, `CustomField` | Every react-hook-form field |
| `@repo/ui/components/form-section` | `FormSection`, `FormSectionHeading`, `FieldRow` | Grouping and side-by-side layout |
| `@repo/ui/components/item-list` | `ItemCard`, `ItemCardHeader`, `AddItemButton` | `useFieldArray` repeating entries |
| `@repo/ui/components/field` | `Field`, `FieldLabel`, `FieldError`, … | Escape hatch when wrappers don't fit |

Density comes from the wrappers automatically (`size="sm"` controls, `text-13`,
micro uppercase labels). Pass `size="sm"` / `className="h-8 px-2.5 text-13"`
manually to controls rendered inside `CustomField`.

## The standard field

```tsx
<TextField control={form.control} name="name" label="Name" required placeholder="Client name" />
```

Label optional — omit it when the surrounding layout already labels the field
(e.g. single-field `SettingsItem` rows).

## Custom controls

Anything the typed wrappers don't cover (combobox, masked ₹ input, multi-select,
rich text, OTP, radio cards) goes through `CustomField`, which renders the
standard label + error shell around your control:

```tsx
<CustomField control={form.control} name="bookingId" label="Booking" required>
	{({ field, fieldState }) => (
		<Combobox
			{...field}
			className="h-8 px-2.5 text-13"
			aria-invalid={fieldState.invalid}
		/>
	)}
</CustomField>
```

## Layout rules

- Side-by-side pairs/triples: `<FieldRow>` / `<FieldRow cols={3}>`; span with
  `className="sm:col-span-2"`. Asymmetric spans keep a manual grid.
- Logical groups: wrap in `<FormSection>` (spacing only).
- **Section headings (`FormSectionHeading`, icon + dashed rule) are for
  full-page forms only — never inside Sheets or Dialogs.** In sheets, spacing
  groups alone carry the hierarchy.

## Repeating entries (`useFieldArray`)

```tsx
{fields.map((item, index) => (
	<ItemCard key={item.id}>
		<ItemCardHeader
			title={`Item ${index + 1}`}
			meta={formatMoney(computedAmount)}
			onRemove={() => remove(index)}
		/>
		<FieldRow>…fields…</FieldRow>
	</ItemCard>
))}
<AddItemButton onClick={() => append(defaults)}>Add item</AddItemButton>
```

Single-field rows (e.g. a list of URLs) may keep a lighter inline row instead.

## When to fall back to a manual `Controller`

- Field uses inline RHF `rules` instead of the zod resolver.
- Label needs inline UI (e.g. a "Hide" toggle button next to it).

In both cases use `Field` + `FieldLabel variant="micro"` + `FieldError` and a
`size="sm"` control so it still looks identical.

## Gotchas

- `NumberField` emits `""` when cleared. If the schema expects a fallback
  (`0`, `1`), keep the original `onChange` inside a `CustomField`.
- Switch rows (label + description + `Switch`) keep the default label size —
  micro labels are for input fields.
- Do not import from `@repo/ui/components/form` (legacy shadcn Form) — use
  `FormProvider` from `react-hook-form` directly if you need context.
