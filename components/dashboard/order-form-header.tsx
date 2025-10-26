import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

interface OrderFormHeaderProps {
  editingOrderId: string | null
  saving: boolean
  lastSaved: Date | null
  autoSaving?: boolean
  autoLastSaved?: Date | null
}

export function OrderFormHeader({ editingOrderId, saving, lastSaved, autoSaving, autoLastSaved }: OrderFormHeaderProps) {
  return (
    <div className="mb-6">
      <Link href="/dashboard/orders">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a pedidos
        </Button>
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            {editingOrderId ? "Editar Pedido" : "Nuevo Pedido"}
          </h2>
          <p className="text-muted-foreground">
            {editingOrderId ? "Modifica los detalles del pedido" : "Crea un nuevo pedido de productos"}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {saving && (
            <div className="flex items-center gap-1">
              <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-600"></div>
              <span>Guardando...</span>
            </div>
          )}
          {autoSaving && !saving && (
            <div className="flex items-center gap-1">
              <div className="animate-pulse rounded-full h-2 w-2 bg-green-500"></div>
              <span>Auto-guardando...</span>
            </div>
          )}
          {lastSaved && !saving && (
            <span>Guardado: {lastSaved.toLocaleTimeString()}</span>
          )}
          {autoLastSaved && !saving && !lastSaved && (
            <span>Auto-guardado: {autoLastSaved.toLocaleTimeString()}</span>
          )}
        </div>
      </div>
    </div>
  )
}
