import { useState, useCallback } from "react"

export function useCollapsible(initialState: boolean = false) {
  const [isOpen, setIsOpen] = useState(initialState)

  const toggle = useCallback(() => {
    setIsOpen(prev => !prev)
  }, [])

  const open = useCallback(() => {
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  return {
    isOpen,
    toggle,
    open,
    close,
  }
}

// Hook para manejar múltiples elementos colapsables
export function useCollapsibleSet() {
  const [collapsedItems, setCollapsedItems] = useState<Set<string>>(new Set())

  const toggle = useCallback((itemId: string) => {
    setCollapsedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }, [])

  const isCollapsed = useCallback((itemId: string) => {
    return collapsedItems.has(itemId)
  }, [collapsedItems])

  const collapse = useCallback((itemId: string) => {
    setCollapsedItems(prev => new Set(prev).add(itemId))
  }, [])

  const expand = useCallback((itemId: string) => {
    setCollapsedItems(prev => {
      const newSet = new Set(prev)
      newSet.delete(itemId)
      return newSet
    })
  }, [])

  const collapseAll = useCallback((itemIds: string[]) => {
    setCollapsedItems(new Set(itemIds))
  }, [])

  const expandAll = useCallback(() => {
    setCollapsedItems(new Set())
  }, [])

  return {
    collapsedItems,
    toggle,
    isCollapsed,
    collapse,
    expand,
    collapseAll,
    expandAll,
  }
}
