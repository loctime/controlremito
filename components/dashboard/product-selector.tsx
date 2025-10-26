"use client"

import { useState } from "react"
import { Search, Plus } from "lucide-react"
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Seleccionar productos</DialogTitle>
          <DialogDescription>
            Selecciona los productos que quieres incluir en la plantilla
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="max-h-96 overflow-y-auto border rounded">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Seleccionar</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Unidad</TableHead>
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
                    <TableCell>{product.name}</TableCell>
                    <TableCell>{product.sku || "-"}</TableCell>
                    <TableCell>{product.unit}</TableCell>
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
