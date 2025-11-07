"use client"

import { useState } from "react"
import type { CheckedState } from "@radix-ui/react-checkbox"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Product } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

interface ProductSelectorProps {
  isOpen: boolean
  onClose: () => void
  products: Product[]
  selectedProductIds: Set<string>
  onProductToggle: (productId: string) => void
  onAddProducts: (productIds: string[]) => void
}

export function ProductSelector({
  isOpen,
  onClose,
  products,
  selectedProductIds,
  onProductToggle,
  onAddProducts,
}: ProductSelectorProps) {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const allFilteredSelected =
    filteredProducts.length > 0 &&
    filteredProducts.every((product) => selectedProductIds.has(product.id))
  const someFilteredSelected = filteredProducts.some((product) =>
    selectedProductIds.has(product.id),
  )

  const handleToggleSelectAll = (checked: CheckedState) => {
    if (filteredProducts.length === 0 || checked === "indeterminate") {
      return
    }

    if (checked) {
      filteredProducts.forEach((product) => {
        if (!selectedProductIds.has(product.id)) {
          onProductToggle(product.id)
        }
      })
      return
    }

    filteredProducts.forEach((product) => {
      if (selectedProductIds.has(product.id)) {
        onProductToggle(product.id)
      }
    })
  }

  const handleAddProducts = () => {
    const selectedCount = selectedProductIds.size
    if (selectedCount === 0) {
      toast({
        title: "Sin productos",
        description: "Selecciona al menos un producto",
        variant: "destructive",
      })
      return
    }

    onAddProducts(Array.from(selectedProductIds))
    toast({
      title: "Productos agregados",
      description: `Se agregaron ${selectedCount} productos a la plantilla`,
    })
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl w-full max-h-[90vh] overflow-y-auto overflow-x-hidden p-6 sm:p-8">
        <DialogHeader>
          <DialogTitle>Seleccionar productos</DialogTitle>
          <DialogDescription>
            Selecciona los productos que quieres incluir en la plantilla
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="max-h-80 overflow-y-auto overflow-x-hidden border rounded">
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        allFilteredSelected
                          ? true
                          : someFilteredSelected
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={handleToggleSelectAll}
                      aria-label="Seleccionar todos los productos visibles"
                    />
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Producto</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">SKU</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Unidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedProductIds.has(product.id)}
                        onCheckedChange={() => onProductToggle(product.id)}
                      />
                    </TableCell>
                    <TableCell className="max-w-[16rem] whitespace-normal break-words text-sm">{product.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{product.sku || "-"}</TableCell>
                    <TableCell className="text-sm">{product.unit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              {selectedProductIds.size} productos seleccionados
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={handleAddProducts}>
                Agregar productos
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
