import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

/** Türkçe karakterlere duyarlı arama (İ/I, ı/i vb.) */
function trIncludes(haystack, needle) {
  if (!needle?.trim()) return true
  const h = String(haystack ?? "").toLocaleLowerCase("tr-TR")
  const n = needle.toLocaleLowerCase("tr-TR")
  return h.includes(n)
}

const Combobox = ({
  options,
  value,
  onSelect,
  placeholder,
  searchPlaceholder,
  emptyPlaceholder,
  triggerClassName,
  isMulti = false,
}) => {
  const [open, setOpen] = React.useState(false)

  const triggerLabel = React.useMemo(() => {
    if (isMulti && Array.isArray(value)) {
      if (value.length === 0) return null
      if (value.length === 1) {
        return options.find((o) => o.value === value[0])?.label ?? null
      }
      return `${value.length} personel seçildi`
    }
    if (value) return options.find((o) => o.value === value)?.label
    return null
  }, [isMulti, value, options])

  const isSelected = (optionValue) => {
    if (isMulti && Array.isArray(value)) return value.includes(optionValue)
    return value === optionValue
  }

  const commandFilter = React.useCallback(
    (itemValue, search) => {
      // cmdk, Item value'yu önce trim + toLowerCase ile saklar; label ile === kıyaslamak hep başarısız olurdu.
      const opt = options.find(
        (o) =>
          String(o.value).trim().toLowerCase() === String(itemValue ?? "").trim().toLowerCase()
      )
      if (!opt) return 0
      if (trIncludes(opt.label, search)) return 1
      if (opt.keywords?.some((k) => trIncludes(String(k), search))) return 1
      return 0
    },
    [options]
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", triggerClassName)}
        >
          <span className="truncate text-left">{triggerLabel ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-none sm:w-[400px] p-0" align="start">
        <Command filter={commandFilter}>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyPlaceholder}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={String(option.value)}
                  onSelect={() => {
                    if (isMulti) {
                      onSelect(option.value)
                    } else {
                      onSelect(option.value === value ? "" : option.value)
                      setOpen(false)
                    }
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      isSelected(option.value) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export { Combobox };