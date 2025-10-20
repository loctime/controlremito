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
            {/* SECCIÓN 1: LO PEDIDO */}
            {note.itemsRequested?.length > 0 && (
              <Card className="border-blue-200">
                <CardHeader className="bg-blue-50">
                  <CardTitle className="flex items-center gap-2 text-blue-800">
                    <FileText className="h-5 w-5" />
                    🔵 PASO 1: Pedido Solicitado
                  </CardTitle>
                  <CardDescription className="text-blue-700">
                    Items originales solicitados por {note.requestedBySignature?.userName || '-'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Cantidad Pedida</TableHead>
                        <TableHead>Unidad</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {note.itemsRequested.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.productName}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{item.unit}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
                    ✍️ Solicitado por: <span className="font-medium">{note.requestedBySignature?.userName}</span>
                    {note.requestedBySignature?.position && ` - ${note.requestedBySignature.position}`}
                    <br />
                    📅 {formatDate(note.requestedBySignature?.timestamp)}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* SECCIÓN 2: LO ARMADO */}
            {note.itemsAssembled?.length > 0 && (
              <Card className="border-orange-200">
                <CardHeader className="bg-orange-50">
                  <CardTitle className="flex items-center gap-2 text-orange-800">
                    <FileText className="h-5 w-5" />
                    🏭 PASO 2: Armado en Fábrica
                  </CardTitle>
                  <CardDescription className="text-orange-700">
                    Items preparados por {note.assembledBySignature?.userName || '-'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Pedido</TableHead>
                        <TableHead>Armado</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {note.itemsAssembled.map((item, index) => {
                        const assembled = item.assembledQuantity ?? 0
                        let estadoBadge
                        if (assembled === 0) {
                          estadoBadge = <Badge variant="destructive">✗ NO DISPONIBLE</Badge>
                        } else if (assembled === item.quantity) {
                          estadoBadge = <Badge variant="default">✓ COMPLETO</Badge>
                        } else {
                          estadoBadge = <Badge variant="secondary">⚠️ PARCIAL</Badge>
                        }
                        
                        return (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{item.productName}</TableCell>
                            <TableCell>{item.quantity} {item.unit}</TableCell>
                            <TableCell>{assembled} {item.unit}</TableCell>
                            <TableCell>{estadoBadge}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                  {note.assemblyNotes && (
                    <div className="mt-3 p-3 bg-orange-50 rounded-lg text-sm">
                      <span className="font-medium">Notas del armado:</span> {note.assemblyNotes}
                    </div>
                  )}
                  <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
                    ✍️ Preparado por: <span className="font-medium">{note.assembledBySignature?.userName}</span>
                    {note.assembledBySignature?.position && ` - ${note.assembledBySignature.position}`}
                    <br />
                    📅 {formatDate(note.assembledBySignature?.timestamp)}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* SECCIÓN 3: LO RECIBIDO */}
            <Card className="border-green-200">
              <CardHeader className="bg-green-50">
                <CardTitle className="flex items-center gap-2 text-green-800">
                  <FileText className="h-5 w-5" />
                  📦 PASO 3: Entrega y Recepción
                </CardTitle>
                <CardDescription className="text-green-700">
                  Verificación final en destino
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {note.receptionNotes && (
                  <div className="p-3 bg-green-50 rounded-lg text-sm">
                    <span className="font-medium">Notas de recepción:</span> {note.receptionNotes}
                  </div>
                )}
              </CardContent>
            </Card>

            {note.itemsDelivered?.length > 0 && (
              <Card className="border-l-4 border-l-green-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    ✓ Items Recibidos Completos
                  </CardTitle>
                  <CardDescription>Productos recibidos en perfectas condiciones</CardDescription>
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
                            <Badge variant="default">✓ Entregado</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {note.itemsPartial?.length > 0 && (
              <Card className="border-l-4 border-l-yellow-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    ⚠️ Items Recibidos Parcialmente
                  </CardTitle>
                  <CardDescription>Productos recibidos con menor cantidad de la enviada</CardDescription>
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
                      {note.itemsPartial.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.productName}</TableCell>
                          <TableCell>
                            {item.quantity} {item.unit}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{item.notReceivedReason || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {note.itemsReturned?.length > 0 && (
              <Card className="border-l-4 border-l-red-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    ↩️ Items Devueltos
                  </CardTitle>
                  <CardDescription>Productos rechazados o devueltos</CardDescription>
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

            {note.itemsNotReceived?.length > 0 && (
              <Card className="border-l-4 border-l-red-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    ✗ Items No Recibidos
                  </CardTitle>
                  <CardDescription>Productos que no llegaron o no se enviaron</CardDescription>
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
                  <p className="text-sm text-muted-foreground">{note.deliverySignature?.userName || '-'}</p>
                  {note.deliverySignature?.position && (
                    <p className="text-xs text-muted-foreground">{note.deliverySignature.position}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{formatDate(note.deliverySignature?.timestamp)}</p>
                  {note.deliverySignature?.signatureImage ? (
                    <div className="mt-3 border-t pt-3">
                      <img src={note.deliverySignature.signatureImage} alt="Firma Delivery" className="max-h-16" />
                    </div>
                  ) : (
                    <div className="mt-3 border-t pt-3">
                      <p className="font-signature text-lg italic">{note.deliverySignature?.userName}</p>
                    </div>
                  )}
                </div>

                <div className="rounded-lg border p-4">
                  <p className="mb-2 text-sm font-medium">Sucursal Receptora</p>
                  <p className="text-sm text-muted-foreground">{note.receptionSignature?.userName || '-'}</p>
                  {note.receptionSignature?.position && (
                    <p className="text-xs text-muted-foreground">{note.receptionSignature.position}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{formatDate(note.receptionSignature?.timestamp)}</p>
                  {note.receptionSignature?.signatureImage ? (
                    <div className="mt-3 border-t pt-3">
                      <img src={note.receptionSignature.signatureImage} alt="Firma Recepción" className="max-h-16" />
                    </div>
                  ) : (
                    <div className="mt-3 border-t pt-3">
                      <p className="font-signature text-lg italic">{note.receptionSignature?.userName}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resumen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {note.itemsDelivered?.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm">Items entregados:</span>
                    <Badge variant="default">{note.itemsDelivered.length}</Badge>
                  </div>
                )}
                {note.itemsPartial?.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm">Items parciales:</span>
                    <Badge variant="secondary">{note.itemsPartial.length}</Badge>
                  </div>
                )}
                {note.itemsReturned?.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm">Items devueltos:</span>
                    <Badge variant="destructive">{note.itemsReturned.length}</Badge>
                  </div>
                )}
                {note.itemsNotReceived?.length > 0 && (
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
