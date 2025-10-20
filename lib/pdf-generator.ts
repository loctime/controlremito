import type { DeliveryNote, OrderItem } from "./types"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

export async function generateDeliveryNotePDF(note: DeliveryNote) {
  const doc = new jsPDF()

  // Configuración
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20

  // ========== ENCABEZADO ==========
  doc.setFontSize(24)
  doc.setFont("helvetica", "bold")
  doc.text("REMITO", pageWidth / 2, 20, { align: "center" })

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.text(`Pedido: ${note.orderNumber}`, margin, 35)
  doc.text(`Fecha de emisión: ${formatDate(note.createdAt)}`, margin, 42)

  // Línea separadora
  doc.setDrawColor(200, 200, 200)
  doc.line(margin, 48, pageWidth - margin, 48)

  // Información de origen y destino
  let yPosition = 55
  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.text("Desde:", margin, yPosition)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.text(note.fromBranchName, margin, yPosition + 7)

  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.text("Hacia:", pageWidth / 2 + 10, yPosition)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.text(note.toBranchName, pageWidth / 2 + 10, yPosition + 7)

  yPosition = 75

  // ========== SECCIÓN 1: LO PEDIDO ==========
  doc.setDrawColor(59, 130, 246) // Azul
  doc.setLineWidth(1)
  doc.line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 5

  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(59, 130, 246)
  doc.text("🔵 PASO 1: PEDIDO SOLICITADO", margin, yPosition)
  doc.setTextColor(0, 0, 0)
  yPosition += 3

  doc.setDrawColor(59, 130, 246)
  doc.setLineWidth(0.5)
  doc.line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 5

  if (note.itemsRequested.length > 0) {
    autoTable(doc, {
      startY: yPosition,
      head: [["Producto", "Cantidad Pedida", "Unidad"]],
      body: note.itemsRequested.map((item) => [
        item.productName,
        item.quantity.toString(),
        item.unit
      ]),
      theme: "grid",
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: margin, right: margin },
      styles: { fontSize: 9 },
    })

    yPosition = (doc as any).lastAutoTable.finalY + 5
  }

  // Firma de quien solicitó
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.text("✍️ Solicitado por:", margin, yPosition)
  doc.setFont("helvetica", "normal")
  doc.text(note.requestedBySignature.userName, margin + 30, yPosition)
  
  if (note.requestedBySignature.position) {
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text(`(${note.requestedBySignature.position})`, margin + 30, yPosition + 4)
    doc.setTextColor(0, 0, 0)
  }
  
  doc.setFontSize(8)
  doc.text(`📅 ${formatDate(note.requestedBySignature.timestamp)}`, margin, yPosition + 7)

  yPosition += 15

  // ========== SECCIÓN 2: LO ARMADO ==========
  checkAddPage(doc, yPosition, 80)
  if ((doc as any).lastAutoTable && (doc as any).lastAutoTable.finalY > pageHeight - 80) {
    doc.addPage()
    yPosition = 20
  }

  doc.setDrawColor(245, 158, 11) // Naranja
  doc.setLineWidth(1)
  doc.line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 5

  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(245, 158, 11)
  doc.text("🏭 PASO 2: ARMADO EN FÁBRICA", margin, yPosition)
  doc.setTextColor(0, 0, 0)
  yPosition += 3

  doc.setDrawColor(245, 158, 11)
  doc.setLineWidth(0.5)
  doc.line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 5

  if (note.itemsAssembled.length > 0) {
    autoTable(doc, {
      startY: yPosition,
      head: [["Producto", "Pedido", "Armado", "Estado"]],
      body: note.itemsAssembled.map((item) => {
        const assembled = item.assembledQuantity ?? 0
        let estado = ""
        
        if (assembled === 0) {
          estado = "✗ NO DISPONIBLE"
        } else if (assembled === item.quantity) {
          estado = "✓ COMPLETO"
        } else {
          estado = "⚠️ PARCIAL"
        }
        
        return [
          item.productName,
          `${item.quantity} ${item.unit}`,
          `${assembled} ${item.unit}`,
          estado
        ]
      }),
      theme: "grid",
      headStyles: { fillColor: [245, 158, 11] },
      margin: { left: margin, right: margin },
      styles: { fontSize: 9 },
      columnStyles: {
        3: { fontStyle: 'bold' }
      }
    })

    yPosition = (doc as any).lastAutoTable.finalY + 5
  }

  // Mostrar motivos de items no disponibles o parciales
  const itemsWithIssues = note.itemsAssembled.filter(item => 
    (item.assembledQuantity ?? 0) < item.quantity
  )

  if (itemsWithIssues.length > 0) {
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.text("Motivos:", margin, yPosition)
    yPosition += 5

    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    
    itemsWithIssues.forEach(item => {
      const reason = item.assemblyNotes || item.notAvailableReason || "Sin motivo especificado"
      const text = `• ${item.productName}: ${reason}`
      const lines = doc.splitTextToSize(text, pageWidth - margin * 2 - 5)
      
      lines.forEach((line: string) => {
        checkAddPage(doc, yPosition, 10)
        doc.text(line, margin + 3, yPosition)
        yPosition += 4
      })
      yPosition += 1
    })
    
    yPosition += 3
  }

  if (note.assemblyNotes) {
    doc.setFontSize(9)
    doc.setFont("helvetica", "italic")
    doc.setTextColor(100, 100, 100)
    const notes = doc.splitTextToSize(`Notas: ${note.assemblyNotes}`, pageWidth - margin * 2)
    notes.forEach((line: string) => {
      doc.text(line, margin, yPosition)
      yPosition += 4
    })
    doc.setTextColor(0, 0, 0)
    yPosition += 3
  }

  // Firma de quien armó
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.text("✍️ Preparado por:", margin, yPosition)
  doc.setFont("helvetica", "normal")
  doc.text(note.assembledBySignature.userName, margin + 30, yPosition)
  
  if (note.assembledBySignature.position) {
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text(`(${note.assembledBySignature.position})`, margin + 30, yPosition + 4)
    doc.setTextColor(0, 0, 0)
  }
  
  doc.setFontSize(8)
  doc.text(`📅 ${formatDate(note.assembledBySignature.timestamp)}`, margin, yPosition + 7)

  yPosition += 15

  // ========== SECCIÓN 3: LO RECIBIDO ==========
  checkAddPage(doc, yPosition, 80)

  doc.setDrawColor(34, 197, 94) // Verde
  doc.setLineWidth(1)
  doc.line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 5

  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(34, 197, 94)
  doc.text("📦 PASO 3: ENTREGA Y RECEPCIÓN", margin, yPosition)
  doc.setTextColor(0, 0, 0)
  yPosition += 3

  doc.setDrawColor(34, 197, 94)
  doc.setLineWidth(0.5)
  doc.line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 5

  // Tabla de recepción
  const receptionTableData: Array<[string, string, string, string]> = []

  // Items entregados OK
  note.itemsDelivered.forEach(item => {
    receptionTableData.push([
      item.productName,
      `${item.assembledQuantity || item.quantity} ${item.unit}`,
      `${item.assembledQuantity || item.quantity} ${item.unit}`,
      "✓ RECIBIDO OK"
    ])
  })

  // Items parciales
  note.itemsPartial.forEach(item => {
    receptionTableData.push([
      item.productName,
      `${item.assembledQuantity || item.quantity} ${item.unit}`,
      `${item.quantity} ${item.unit}`, // Cantidad real recibida
      "⚠️ PARCIAL"
    ])
  })

  // Items no recibidos
  note.itemsNotReceived.forEach(item => {
    receptionTableData.push([
      item.productName,
      `${item.assembledQuantity || item.quantity} ${item.unit}`,
      "0 " + item.unit,
      "✗ NO RECIBIDO"
    ])
  })

  // Items devueltos
  note.itemsReturned.forEach(item => {
    receptionTableData.push([
      item.productName,
      `${item.assembledQuantity || item.quantity} ${item.unit}`,
      "0 " + item.unit,
      "↩️ DEVUELTO"
    ])
  })

  if (receptionTableData.length > 0) {
    autoTable(doc, {
      startY: yPosition,
      head: [["Producto", "Enviado", "Recibido", "Estado"]],
      body: receptionTableData as any,
      theme: "grid",
      headStyles: { fillColor: [34, 197, 94] },
      margin: { left: margin, right: margin },
      styles: { fontSize: 9 },
      columnStyles: {
        3: { fontStyle: 'bold' }
      }
    })

    yPosition = (doc as any).lastAutoTable.finalY + 5
  }

  // Mostrar incidencias en recepción
  const receptionIssues = [
    ...note.itemsPartial.map(item => ({ item, type: "Parcial", reason: item.notReceivedReason })),
    ...note.itemsNotReceived.map(item => ({ item, type: "No recibido", reason: item.notReceivedReason })),
    ...note.itemsReturned.map(item => ({ item, type: "Devuelto", reason: item.returnReason })),
  ]

  if (receptionIssues.length > 0) {
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.text("Incidencias en recepción:", margin, yPosition)
    yPosition += 5

    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    
    receptionIssues.forEach(({ item, type, reason }) => {
      const text = `• ${item.productName} (${type}): ${reason || "Sin motivo especificado"}`
      const lines = doc.splitTextToSize(text, pageWidth - margin * 2 - 5)
      
      lines.forEach((line: string) => {
        checkAddPage(doc, yPosition, 10)
        doc.text(line, margin + 3, yPosition)
        yPosition += 4
      })
      yPosition += 1
    })
    
    yPosition += 3
  }

  if (note.receptionNotes) {
    doc.setFontSize(9)
    doc.setFont("helvetica", "italic")
    doc.setTextColor(100, 100, 100)
    const notes = doc.splitTextToSize(`Notas de recepción: ${note.receptionNotes}`, pageWidth - margin * 2)
    notes.forEach((line: string) => {
      doc.text(line, margin, yPosition)
      yPosition += 4
    })
    doc.setTextColor(0, 0, 0)
    yPosition += 3
  }

  // ========== FIRMAS FINALES ==========
  checkAddPage(doc, yPosition, 50)

  yPosition = Math.max(yPosition, pageHeight - 70)

  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(1)
  doc.line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 7

  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.text("FIRMAS", pageWidth / 2, yPosition, { align: "center" })
  yPosition += 10

  // Firma del Delivery
  const col1X = margin
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text("Entregado por (Delivery):", col1X, yPosition)
  yPosition += 5

  // Si hay firma dibujada, mostrarla
  if (note.deliverySignature.signatureImage) {
    try {
      doc.addImage(note.deliverySignature.signatureImage, "PNG", col1X, yPosition, 60, 20)
      yPosition += 22
    } catch (error) {
      console.error("Error al agregar imagen de firma:", error)
      yPosition += 5
    }
  } else {
    // Línea para firma manual si no hay imagen
    doc.setDrawColor(0, 0, 0)
    doc.line(col1X, yPosition + 15, col1X + 60, yPosition + 15)
    yPosition += 17
  }

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.text(note.deliverySignature.userName, col1X, yPosition)
  
  if (note.deliverySignature.position) {
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text(note.deliverySignature.position, col1X, yPosition + 4)
    doc.setTextColor(0, 0, 0)
    yPosition += 4
  }
  
  doc.setFontSize(8)
  doc.text(formatDate(note.deliverySignature.timestamp), col1X, yPosition + 4)

  // Firma de la Sucursal Receptora
  const col2X = pageWidth / 2 + 10
  yPosition = pageHeight - 70 + 17

  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text("Recibido por (Sucursal):", col2X, yPosition)
  yPosition += 5

  // Si hay firma dibujada, mostrarla
  if (note.receptionSignature.signatureImage) {
    try {
      doc.addImage(note.receptionSignature.signatureImage, "PNG", col2X, yPosition, 60, 20)
      yPosition += 22
    } catch (error) {
      console.error("Error al agregar imagen de firma:", error)
      yPosition += 5
    }
  } else {
    // Línea para firma manual si no hay imagen
    doc.line(col2X, yPosition + 15, col2X + 60, yPosition + 15)
    yPosition += 17
  }

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.text(note.receptionSignature.userName, col2X, yPosition)
  
  if (note.receptionSignature.position) {
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text(note.receptionSignature.position, col2X, yPosition + 4)
    doc.setTextColor(0, 0, 0)
    yPosition += 4
  }
  
  doc.setFontSize(8)
  doc.text(formatDate(note.receptionSignature.timestamp), col2X, yPosition + 4)

  // Descargar PDF
  doc.save(`remito-${note.orderNumber}.pdf`)
}

// Función helper para formatear fechas
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

// Función helper para agregar página si es necesario
function checkAddPage(doc: jsPDF, yPosition: number, spaceNeeded: number) {
  const pageHeight = doc.internal.pageSize.getHeight()
  if (yPosition + spaceNeeded > pageHeight - 20) {
    doc.addPage()
    return 20
  }
  return yPosition
}

// ========== PDF SIMPLIFICADO ==========
export async function generateSimplifiedDeliveryNotePDF(note: DeliveryNote) {
  // Formato ticket térmico 80mm de ancho (~72mm imprimible)
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: [80, 200] })

  // Configuración
  let pageWidth = doc.internal.pageSize.getWidth()
  let pageHeight = doc.internal.pageSize.getHeight()
  const margin = 7

  // ========== ENCABEZADO ==========
  doc.setFontSize(18)
  doc.setFont("helvetica", "bold")
  doc.text("REMITO INTERNO", pageWidth / 2, 15, { align: "center" })

  // Banda superior con borde (datos del pedido)
  const headerTop = 18
  const headerHeight = 14
  doc.setDrawColor(0)
  doc.setLineWidth(0.25)
  doc.rect(margin, headerTop, pageWidth - margin * 2, headerHeight)

  doc.setFontSize(7.5)
  doc.setFont("helvetica", "normal")
  const headerTextY1 = headerTop + 5
  const headerTextY2 = headerTop + 10
  const pedidoText = `Pedido: ${note.orderNumber}`
  const pedidoFitted = (doc as any).splitTextToSize(pedidoText, pageWidth - margin * 2 - 4)[0]
  doc.text(pedidoFitted, margin + 2, headerTextY1)
  doc.text(`Fecha: ${formatDate(note.createdAt)}`, pageWidth - margin - 2, headerTextY2, { align: "right" })

  // Cajas DE / HACIA
  let yPosition = headerTop + headerHeight + 6 // separación visual
  const half = (pageWidth - margin * 2) / 2
  const boxHeight = 9
  doc.rect(margin, yPosition, half - 1, boxHeight)
  doc.rect(margin + half + 1, yPosition, half - 1, boxHeight)

  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.text("DE:", margin + 2, yPosition + 3)
  doc.setFont("helvetica", "normal")
  doc.text(note.fromBranchName, margin + 12, yPosition + 3)

  doc.setFont("helvetica", "bold")
  doc.text("HACIA:", margin + half + 3, yPosition + 3)
  doc.setFont("helvetica", "normal")
  doc.text(note.toBranchName, margin + half + 3 + 15, yPosition + 3)

  yPosition = yPosition + boxHeight + 6

  // ========== TABLA UNIFICADA ==========
  const tableData: any[] = []

  // Combinar todos los items en una sola tabla
  const allProductIds = new Set<string>()
  note.itemsRequested.forEach(item => allProductIds.add(item.productId))

  Array.from(allProductIds).forEach(productId => {
    const requested = note.itemsRequested.find(i => i.productId === productId)
    const assembled = note.itemsAssembled.find(i => i.productId === productId)
    
    if (!requested) return

    const assembledQty = assembled?.assembledQuantity ?? 0
    
    // Determinar cantidad recibida
    let receivedQty = 0
    let estado = ""
    
    const delivered = note.itemsDelivered?.find(i => i.productId === productId)
    const partial = note.itemsPartial?.find(i => i.productId === productId)
    const returned = note.itemsReturned?.find(i => i.productId === productId)
    const notReceived = note.itemsNotReceived?.find(i => i.productId === productId)
    
    if (delivered) {
      receivedQty = assembledQty
      estado = "✓ OK"
    } else if (partial) {
      receivedQty = partial.quantity // La cantidad que finalmente se recibió
      estado = "⚠️ Parcial"
    } else if (returned) {
      receivedQty = 0
      estado = "↩️ Devuelto"
    } else if (notReceived) {
      receivedQty = 0
      estado = "✗ No recibido"
    } else {
      // Por defecto, asumir que se recibió lo que se armó
      receivedQty = assembledQty
      estado = assembledQty > 0 ? "✓ OK" : "✗ No enviado"
    }

    tableData.push([
      requested.quantity.toString(),
      requested.productName,
      `${assembledQty}`,
      `${receivedQty}`,
      estado
    ])
  })

  autoTable(doc, {
    startY: yPosition,
    head: [["Pedido", "Producto", "Armado", "Recibido", "Estado"]],
    body: tableData,
    theme: "grid",
    headStyles: { 
      fillColor: [40, 40, 40],
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle'
    },
    styles: { 
      fontSize: 7,
      cellPadding: 1.5,
      overflow: 'linebreak'
    },
    columnStyles: {
      0: { halign: 'center', valign: 'middle', cellWidth: 10 },
      1: { halign: 'left',   valign: 'middle', cellWidth: 26 },
      2: { halign: 'center', valign: 'middle', cellWidth: 10 },
      3: { halign: 'center', valign: 'middle', cellWidth: 10 },
      4: { halign: 'center', valign: 'middle', cellWidth: 10, fontStyle: 'bold' }
    },
    margin: { left: margin, right: margin },
  })

  yPosition = (doc as any).lastAutoTable.finalY + 6

  // ========== FIRMAS SIMPLIFICADAS ==========
  // Posicionarlas inmediatamente después de la tabla
  // Si no entra, crear nueva página del mismo tamaño y continuar
  const need = 28
  if (yPosition + need > doc.internal.pageSize.getHeight() - margin) {
    doc.addPage([80, 200], 'p')
    // actualizar métricas tras nueva página
    pageWidth = doc.internal.pageSize.getWidth()
    pageHeight = doc.internal.pageSize.getHeight()
    yPosition = margin
  }

  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.5)
  // Caja firmas
  doc.rect(margin, yPosition, pageWidth - margin * 2, 24)
  // Línea divisoria centro
  doc.line(pageWidth / 2, yPosition, pageWidth / 2, yPosition + 24)
  yPosition += 5

  // Firma 1: Quien preparó (Fábrica)
  const col1X = margin + (pageWidth / 2 - margin) / 2
  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  doc.text("PREPARADO POR", col1X, yPosition, { align: "center" })
  yPosition += 4

  if (note.assembledBySignature?.signatureImage) {
    try {
      doc.addImage(note.assembledBySignature.signatureImage, "PNG", col1X - 18, yPosition, 36, 10)
      yPosition += 12
    } catch (error) {
      doc.line(col1X - 18, yPosition + 7, col1X + 18, yPosition + 7)
      yPosition += 9
    }
  } else {
    doc.line(col1X - 18, yPosition + 7, col1X + 18, yPosition + 7)
    yPosition += 9
  }

  doc.setFontSize(7)
  doc.setFont("helvetica", "normal")
  doc.text(note.assembledBySignature?.userName || "-", col1X, yPosition, { align: "center" })
  if (note.assembledBySignature?.position) {
    doc.setFontSize(6)
    doc.setTextColor(80, 80, 80)
    doc.text(note.assembledBySignature.position, col1X, yPosition + 3, { align: "center" })
    doc.setTextColor(0, 0, 0)
  }

  // Firma 2: Quien recibió (Sucursal)
  let y2 = (doc as any).lastAutoTable.finalY + 6 // mantener referencia por si yPosition mutó
  const col2X = pageWidth - margin - (pageWidth / 2 - margin) / 2
  // Basar segunda firma en la parte superior de la caja de firmas
  const signaturesTop = (doc as any).lastAutoTable.finalY + 6 + 5
  let yPos2 = signaturesTop

  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  doc.text("RECIBIDO POR", col2X, yPos2, { align: "center" })
  yPos2 += 3

  if (note.receptionSignature?.signatureImage) {
    try {
      doc.addImage(note.receptionSignature.signatureImage, "PNG", col2X - 18, yPos2, 36, 10)
      yPos2 += 12
    } catch (error) {
      doc.line(col2X - 18, yPos2 + 7, col2X + 18, yPos2 + 7)
      yPos2 += 9
    }
  } else {
    doc.line(col2X - 18, yPos2 + 7, col2X + 18, yPos2 + 7)
    yPos2 += 9
  }

  doc.setFontSize(7)
  doc.setFont("helvetica", "normal")
  doc.text(note.receptionSignature?.userName || "-", col2X, yPos2, { align: "center" })
  if (note.receptionSignature?.position) {
    doc.setFontSize(6)
    doc.setTextColor(80, 80, 80)
    doc.text(note.receptionSignature.position, col2X, yPos2 + 3, { align: "center" })
    doc.setTextColor(0, 0, 0)
  }

  // Descargar PDF
  doc.save(`remito-simplificado-${note.orderNumber}.pdf`)
}
