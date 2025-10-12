import type { DeliveryNote } from "./types"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

export async function generateDeliveryNotePDF(note: DeliveryNote) {
  const doc = new jsPDF()

  // Configuración
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20

  // Título
  doc.setFontSize(20)
  doc.setFont("helvetica", "bold")
  doc.text("REMITO", pageWidth / 2, 20, { align: "center" })

  // Información del pedido
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.text(`Pedido: ${note.orderNumber}`, margin, 35)
  doc.text(`Fecha: ${formatDate(note.createdAt)}`, margin, 42)

  // Información de origen y destino
  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.text("Desde:", margin, 55)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.text(note.fromBranchName, margin, 62)

  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.text("Hacia:", pageWidth / 2 + 10, 55)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.text(note.toBranchName, pageWidth / 2 + 10, 62)

  let yPosition = 75

  // Items entregados
  if (note.itemsDelivered.length > 0) {
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text("Items Entregados", margin, yPosition)
    yPosition += 5

    autoTable(doc, {
      startY: yPosition,
      head: [["Producto", "Cantidad", "Estado"]],
      body: note.itemsDelivered.map((item) => [item.productName, `${item.quantity} ${item.unit}`, "Entregado"]),
      theme: "grid",
      headStyles: { fillColor: [34, 197, 94] },
      margin: { left: margin, right: margin },
    })

    yPosition = (doc as any).lastAutoTable.finalY + 10
  }

  // Items devueltos
  if (note.itemsReturned.length > 0) {
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text("Items Devueltos", margin, yPosition)
    yPosition += 5

    autoTable(doc, {
      startY: yPosition,
      head: [["Producto", "Cantidad", "Motivo"]],
      body: note.itemsReturned.map((item) => [
        item.productName,
        `${item.quantity} ${item.unit}`,
        item.returnReason || "-",
      ]),
      theme: "grid",
      headStyles: { fillColor: [239, 68, 68] },
      margin: { left: margin, right: margin },
    })

    yPosition = (doc as any).lastAutoTable.finalY + 10
  }

  // Items no recibidos
  if (note.itemsNotReceived.length > 0) {
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text("Items No Recibidos", margin, yPosition)
    yPosition += 5

    autoTable(doc, {
      startY: yPosition,
      head: [["Producto", "Cantidad", "Motivo"]],
      body: note.itemsNotReceived.map((item) => [
        item.productName,
        `${item.quantity} ${item.unit}`,
        item.notReceivedReason || "-",
      ]),
      theme: "grid",
      headStyles: { fillColor: [239, 68, 68] },
      margin: { left: margin, right: margin },
    })

    yPosition = (doc as any).lastAutoTable.finalY + 10
  }

  // Firmas
  yPosition = Math.max(yPosition, 200)

  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.text("Firmas", margin, yPosition)
  yPosition += 10

  // Firma Delivery
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text("Delivery:", margin, yPosition)
  doc.setFont("helvetica", "normal")
  doc.text(note.deliverySignature.userName, margin, yPosition + 7)
  doc.setFontSize(8)
  doc.text(formatDate(note.deliverySignature.timestamp), margin, yPosition + 12)

  // Línea de firma
  doc.line(margin, yPosition + 20, margin + 60, yPosition + 20)
  doc.setFontSize(10)
  doc.setFont("helvetica", "italic")
  doc.text(note.deliverySignature.userName, margin + 30, yPosition + 25, { align: "center" })

  // Firma Sucursal
  const signatureX = pageWidth / 2 + 10
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text("Sucursal Receptora:", signatureX, yPosition)
  doc.setFont("helvetica", "normal")
  doc.text(note.branchSignature.userName, signatureX, yPosition + 7)
  doc.setFontSize(8)
  doc.text(formatDate(note.branchSignature.timestamp), signatureX, yPosition + 12)

  // Línea de firma
  doc.line(signatureX, yPosition + 20, signatureX + 60, yPosition + 20)
  doc.setFontSize(10)
  doc.setFont("helvetica", "italic")
  doc.text(note.branchSignature.userName, signatureX + 30, yPosition + 25, { align: "center" })

  // Descargar PDF
  doc.save(`remito-${note.orderNumber}.pdf`)
}

function formatDate(timestamp: any): string {
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
