'use client'
import { Input } from './input'
import { Search } from 'lucide-react'
import { useDebouncedCallback } from 'use-debounce'

interface SearchInputProps {
  onSearch: (value: string) => void
  placeholder?: string
  delay?: number
  className?: string
}

export function SearchInput({ 
  onSearch, 
  placeholder = "Buscar...", 
  delay = 300,
  className
}: SearchInputProps) {
  const debouncedSearch = useDebouncedCallback(onSearch, delay)
  
  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="search"
        placeholder={placeholder}
        onChange={(e) => debouncedSearch(e.target.value)}
        className="pl-10 min-h-[44px] touch-manipulation"
      />
    </div>
  )
}
