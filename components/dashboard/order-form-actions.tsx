import { Button } from "@/components/ui/button"
import Link from "next/link"

interface OrderFormActionsProps {
  loading: boolean
  formData: {
    toBranchId: string
    items: { productId: string; productName: string; quantity: number; unit: string }[]
  }
  onSaveAsTemplate: () => void
}

export function OrderFormActions({ loading, formData, onSaveAsTemplate }: OrderFormActionsProps) {
  const isFormValid = formData.toBranchId && 
    formData.items.length > 0 && 
    !formData.items.some(item => !item.productId || item.quantity < 0)

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-end gap-2">
        <Link href="/dashboard/orders" className="w-full sm:w-auto">
          <Button type="button" variant="outline" className="w-full min-h-[44px] touch-manipulation">
            Cancelar
          </Button>
        </Link>
        <Button 
          type="button" 
          variant="secondary"
          onClick={onSaveAsTemplate}
          disabled={!formData.toBranchId || formData.items.length === 0 || formData.items.some(item => !item.productId)}
          className="w-full sm:w-auto min-h-[44px] touch-manipulation"
        >
          📋 Crear plantilla con esta base
        </Button>
        <Button 
          type="submit" 
          disabled={loading || !isFormValid} 
          className="w-full sm:w-auto min-h-[44px] touch-manipulation"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Creando pedido...
            </>
          ) : (
            <>
              ✅ Crear pedido
            </>
          )}
        </Button>
      </div>
      
      {/* Indicador de validación */}
      {!isFormValid && (
        <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
          ⚠️ Completa todos los campos requeridos antes de crear el pedido
        </div>
      )}
    </>
  )
}
