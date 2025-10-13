"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Download, FileText } from "lucide-react"
import { useEffect, useState } from "react"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { DeliveryNote } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { generateDeliveryNotePDF } from "@/lib/pdf-generator"

function DeliveryNoteDetailContent() {
  const { toast } = useToast()
  const params = useParams()
  const noteId = params.id as string

  const [note, setNote] = useState<DeliveryNote | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    fetchNote()
  }, [noteId])

  const fetchNote = async () => {
    setLoading(true)
    try {
      const noteDoc = await getDoc(doc(db, "apps/controld/deliveryNotes", noteId))
      if (noteDoc.exists()) {
        const noteData = { id: noteDoc.id, ...noteDoc.data() } as DeliveryNote
        setNote(noteData)
      } else {
        toast({
          title: "Error",
          description: "No se encontró el remito",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("[v0] Error al cargar remito:", error)
      toast({
        title: "Error",
        description: "No se pudo cargar el remito",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!note) return

    setGenerating(true)
    try {
      await generateDeliveryNotePDF(note)
      toast({
        title: "PDF generado",
        description: "El remito se descargó correctamente",
      })
    } catch (error) {
      console.error("[v0] Error al generar PDF:", error)
      toast({
        title: "Error",
        description: "No se pudo generar el PDF",
        variant: "destructive",
      })
    } finally {
      setGenerating(false)
    }
  }

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

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Cargando remito...</p>
        </div>
      </ProtectedRoute>
    )
  }

  if (!note) {
    return null
  }

  return (
    <ProtectedRoute>
      <div>
        <div className="mb-6">
          <Link href="/dashboard/delivery-notes">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a remitos
            </Button>
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold">Remito - Pedido {note.orderNumber}</h2>
              <p className="text-muted-foreground">Detalles del remito</p>
            </div>
            <Button onClick={handleDownloadPDF} disabled={generating}>
              <Download className="mr-2 h-4 w-4" />
              {generating ? "Generando..." : "Descargar PDF"}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {note.itemsDelivered.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Items Entregados
                  </CardTitle>
                  <CardDescription>Productos recibidos correctamente</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Cantidad</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {note.itemsDelivered.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.productName}</TableCell>
                          <TableCell>
                            {item.quantity} {item.unit}
                          </TableCell>
                          <TableCell>
                            <Badge variant="default">Entregado</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {note.itemsReturned.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Items Devueltos
                  </CardTitle>
                  <CardDescription>Productos devueltos con motivo</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Cantidad</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {note.itemsReturned.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.productName}</TableCell>
                          <TableCell>
                            {item.quantity} {item.unit}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{item.returnReason || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {note.itemsNotReceived.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Items No Recibidos
                  </CardTitle>
                  <CardDescription>Productos no recibidos con motivo</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Cantidad</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {note.itemsNotReceived.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.productName}</TableCell>
                          <TableCell>
                            {item.quantity} {item.unit}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.notReceivedReason || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Información del Remito</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium">Número de Pedido</p>
                  <p className="text-sm text-muted-foreground">{note.orderNumber}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Desde</p>
                  <p className="text-sm text-muted-foreground">{note.fromBranchName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Hacia</p>
                  <p className="text-sm text-muted-foreground">{note.toBranchName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Fecha de emisión</p>
                  <p className="text-sm text-muted-foreground">{formatDate(note.createdAt)}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Firmas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border p-4">
                  <p className="mb-2 text-sm font-medium">Delivery</p>
                  <p className="text-sm text-muted-foreground">{note.deliverySignature.userName}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(note.deliverySignature.timestamp)}</p>
                  <div className="mt-3 border-t pt-3">
                    <p className="font-signature text-lg italic">{note.deliverySignature.userName}</p>
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <p className="mb-2 text-sm font-medium">Sucursal Receptora</p>
                  <p className="text-sm text-muted-foreground">{note.branchSignature.userName}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(note.branchSignature.timestamp)}</p>
                  <div className="mt-3 border-t pt-3">
                    <p className="font-signature text-lg italic">{note.branchSignature.userName}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resumen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Items entregados:</span>
                  <Badge variant="default">{note.itemsDelivered.length}</Badge>
                </div>
                {note.itemsReturned.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm">Items devueltos:</span>
                    <Badge variant="destructive">{note.itemsReturned.length}</Badge>
                  </div>
                )}
                {note.itemsNotReceived.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm">Items no recibidos:</span>
                    <Badge variant="destructive">{note.itemsNotReceived.length}</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}

export default DeliveryNoteDetailContent
