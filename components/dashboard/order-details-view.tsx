import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, Edit, Send, CheckCircle, Truck, AlertCircle } from "lucide-react"
import Link from "next/link"
import type { Order } from "@/lib/types"

interface OrderDetailsViewProps {
  orderDetails: Order
  onBackToForm: () => void
  onSaveAsPersonalTemplate: () => void
}

export function OrderDetailsView({ orderDetails, onBackToForm, onSaveAsPersonalTemplate }: OrderDetailsViewProps) {
  // Función para obtener el badge de estado
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: "Borrador", variant: "outline" as const, icon: Edit },
      sent: { label: "Enviado", variant: "secondary" as const, icon: Send },
      ready: { label: "Listo", variant: "default" as const, icon: CheckCircle },
      in_transit: { label: "En camino", variant: "default" as const, icon: Truck },
      received: { label: "Recibido", variant: "default" as const, icon: CheckCircle },
    }
    const config = statusConfig[status as keyof typeof statusConfig] || {
      label: status,
      variant: "secondary" as const,
      icon: AlertCircle,
    }
    const Icon = config.icon
    return (
      <Badge variant={config.variant} className="flex w-fit items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  // Función para formatear fechas
  const formatDate = (timestamp: any) => {
    if (!timestamp) return "-"
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="sm" onClick={onBackToForm}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Crear otro pedido
          </Button>
          <Link href="/dashboard/orders">
            <Button variant="ghost" size="sm">
              Ver todos los pedidos
            </Button>
          </Link>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Pedido Creado</h2>
            <p className="text-muted-foreground">Detalles del pedido creado exitosamente</p>
          </div>
          {getStatusBadge(orderDetails.status)}
        </div>
      </div>

      <div className="space-y-6">
        {/* Información general del pedido */}
        <Card>
          <CardHeader>
            <CardTitle>Información del Pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Número de Pedido</Label>
                <p className="text-lg font-semibold">{orderDetails.orderNumber}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Estado</Label>
                <div className="mt-1">{getStatusBadge(orderDetails.status)}</div>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Desde</Label>
                <p>{orderDetails.fromBranchName}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Hacia</Label>
                <p>{orderDetails.toBranchName}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Creado por</Label>
                <p>{orderDetails.createdByName}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Fecha de creación</Label>
                <p>{formatDate(orderDetails.createdAt)}</p>
              </div>
            </div>
            {orderDetails.notes && (
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Notas</Label>
                <p className="mt-1 p-3 bg-muted rounded-md">{orderDetails.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Productos del pedido */}
        <Card>
          <CardHeader>
            <CardTitle>Productos ({orderDetails.items.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderDetails.items.map((item, index) => (
                  <TableRow key={item.id || index}>
                    <TableCell className="font-medium">{item.productName}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {item.status === "pending" ? "Pendiente" : 
                         item.status === "available" ? "Disponible" :
                         item.status === "not_available" ? "No disponible" :
                         item.status === "delivered" ? "Entregado" :
                         item.status === "not_received" ? "No recibido" :
                         item.status === "returned" ? "Devuelto" : item.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Botones de acción */}
        <div className="flex flex-col sm:flex-row justify-between gap-2">
          <Button variant="secondary" onClick={onSaveAsPersonalTemplate}>
            💾 Guardar como plantilla personal
          </Button>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={onBackToForm}>
              Crear otro pedido
            </Button>
            <Link href="/dashboard/orders">
              <Button>
                Ver todos los pedidos
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
