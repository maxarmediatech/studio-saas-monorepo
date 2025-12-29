"use client"

import * as React from "react"
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react"

import { cn } from "@repo/ui/lib/utils"
import { Button } from "@repo/ui/components/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@repo/ui/components/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover"

export interface ComboboxOption {
  value: string
  label: string
  disabled?: boolean
  description?: string
}

export interface ComboboxProps {
  /** Available options */
  options: ComboboxOption[]
  /** Currently selected value */
  value?: string
  /** Callback when value changes */
  onValueChange?: (value: string) => void
  /** Placeholder text when no value selected */
  placeholder?: string
  /** Placeholder text for search input */
  searchPlaceholder?: string
  /** Text to show when no options match search */
  emptyText?: string
  /** Whether the combobox is disabled */
  disabled?: boolean
  /** Optional create action */
  onCreate?: {
    label: string
    onClick: () => void
  }
  /** Additional class name for trigger button */
  className?: string
  /** ID for form association */
  id?: string
  /** aria-invalid for form validation */
  "aria-invalid"?: boolean
}

function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  disabled = false,
  onCreate,
  className,
  id,
  "aria-invalid": ariaInvalid,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)

  const selectedOption = React.useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={ariaInvalid}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          {selectedOption ? selectedOption.label : placeholder}
          <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  onSelect={(currentValue) => {
                    // Only change if selecting a different value
                    if (currentValue !== value) {
                      onValueChange?.(currentValue)
                    }
                    setOpen(false)
                  }}
                  keywords={[option.label]}
                >
                  <CheckIcon
                    className={cn(
                      "mr-2 size-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{option.label}</span>
                    {option.description && (
                      <span className="text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            {onCreate && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      onCreate.onClick()
                      setOpen(false)
                    }}
                  >
                    <PlusIcon className="mr-2 size-4" />
                    {onCreate.label}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export { Combobox }
