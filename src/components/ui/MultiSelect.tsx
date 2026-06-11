import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "./Popover"
import { cn } from "@/lib/utils"

interface MultiSelectProps {
  options: { id: string; name: string; icon?: string }[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select options...",
  className,
  disabled
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)

  const handleToggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter(item => item !== id))
    } else {
      onChange([...selected, id])
    }
  }

  const handleRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    onChange(selected.filter(item => item !== id))
  }

  const selectedOptions = options.filter(opt => selected.includes(opt.id))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex min-h-[40px] w-full items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white hover:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 text-left",
            className
          )}
        >
          <div className="flex flex-wrap gap-1 items-center">
            {selectedOptions.length === 0 ? (
              <span className="text-slate-500">{placeholder}</span>
            ) : (
              selectedOptions.map(opt => (
                <span
                  key={opt.id}
                  className="inline-flex items-center gap-1 rounded bg-indigo-500/20 px-2 py-0.5 text-xs font-medium text-indigo-300 border border-indigo-500/30"
                >
                  {opt.icon && <span className="mr-0.5">{opt.icon}</span>}
                  {opt.name}
                  <button
                    type="button"
                    onClick={(e) => handleRemove(e, opt.id)}
                    className="ml-0.5 rounded-full outline-none hover:bg-indigo-500/40 p-0.5 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))
            )}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-1 bg-slate-900 border border-white/10 z-[100]" align="start">
        <div className="flex flex-col gap-0.5">
          {options.map(opt => {
            const isSelected = selected.includes(opt.id)
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleToggle(opt.id)}
                className={cn(
                  "relative flex w-full cursor-default select-none items-center rounded-lg py-1.5 pl-8 pr-2 text-sm text-slate-300 outline-none hover:bg-indigo-600 hover:text-white focus:bg-indigo-600 focus:text-white transition-colors duration-150 text-left"
                )}
              >
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                  {isSelected && <Check className="h-4 w-4 text-indigo-400" />}
                </span>
                {opt.icon && <span className="mr-2">{opt.icon}</span>}
                <span>{opt.name}</span>
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
