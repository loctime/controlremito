import type { DeliveryNote, OrderItem } from "./types"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

export async function generateDeliveryNotePDF(note: DeliveryNote) {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 18
  let y = margin

  const palette = {
    primary: [33, 150, 243] as [number, number, number],
    secondary: [249, 115, 22] as [number, number, number],
    success: [4, 120, 87] as [number, number, number],
    slateLight: [245, 247, 250] as [number, number, number],
    slateBorder: [226, 232, 240] as [number, number, number],
    textMuted: [90, 102, 121] as [number, number, number],
  } as const

  const ensureSpace = (spaceNeeded: number) => {
    if (y + spaceNeeded > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
  }

  const drawSectionHeader = (title: string, subtitle: string | undefined, color: readonly [number, number, number]) => {
    ensureSpace(24)
    doc.setFillColor(color[0], color[1], color[2])
    doc.rect(margin, y, 3, 18, "F")

    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    doc.setTextColor(31, 41, 55)
    doc.text(title.toUpperCase(), margin + 7, y + 7)

    if (subtitle) {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      doc.setTextColor(palette.textMuted[0], palette.textMuted[1], palette.textMuted[2])
      doc.text(subtitle, margin + 7, y + 14.5)
    }

    doc.setTextColor(0, 0, 0)
    y += 20
  }

  const drawNoteCard = (title: string, content: string, background: readonly [number, number, number]) => {
    const text = doc.splitTextToSize(content, pageWidth - margin * 2 - 12)
    const cardHeight = text.length * 4.5 + 12
    ensureSpace(cardHeight + 6)

    doc.setFillColor(background[0], background[1], background[2])
    doc.setDrawColor(palette.slateBorder[0], palette.slateBorder[1], palette.slateBorder[2])
    doc.roundedRect(margin, y, pageWidth - margin * 2, cardHeight, 2, 2, "FD")

    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(31, 41, 55)
    doc.text(title, margin + 5, y + 6)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(71, 85, 105)

    let textY = y + 11
    text.forEach((line: string) => {
      doc.text(line, margin + 5, textY)
      textY += 4.5
    })

    doc.setTextColor(0, 0, 0)
    y += cardHeight + 6
  }

  const drawSignatureMeta = (label: string, signature?: DeliveryNote["requestedBySignature"]) => {
    if (!signature) return
    ensureSpace(18)

    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.text(label, margin, y)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    const signer = signature.userName || "-"
    doc.text(signer, margin, y + 5)

    if (signature.position) {
      doc.setFontSize(8)
      doc.setTextColor(palette.textMuted[0], palette.textMuted[1], palette.textMuted[2])
      doc.text(signature.position, margin, y + 9.5)
      doc.setTextColor(0, 0, 0)
    }

    doc.setFontSize(8)
    doc.setTextColor(palette.textMuted[0], palette.textMuted[1], palette.textMuted[2])
    doc.text(formatDate(signature.timestamp), margin, y + 14)
    doc.setTextColor(0, 0, 0)

    y += 18
  }

  const drawSummaryBadges = () => {
    const badges = [
      { label: "Entregados", value: note.itemsDelivered.length, color: palette.success },
      { label: "Parciales", value: note.itemsPartial.length, color: [217, 119, 6] },
      { label: "Devueltos", value: note.itemsReturned.length, color: [185, 28, 28] },
      { label: "No recibidos", value: note.itemsNotReceived.length, color: [124, 45, 18] },
    ].filter(badge => badge.value > 0)

    if (badges.length === 0) return

    ensureSpace(24)
    const badgeWidth = (pageWidth - margin * 2 - (badges.length - 1) * 6) / badges.length
    let badgeX = margin

    badges.forEach(badge => {
      doc.setFillColor(245, 245, 245)
      doc.setDrawColor(229, 231, 235)
      doc.roundedRect(badgeX, y, badgeWidth, 18, 2, 2, "FD")

      doc.setFont("helvetica", "bold")
      doc.setFontSize(8.5)
      doc.setTextColor(71, 85, 105)
      doc.text(badge.label.toUpperCase(), badgeX + 5, y + 7)

      doc.setTextColor(badge.color[0], badge.color[1], badge.color[2])
      doc.setFontSize(12)
      doc.text(String(badge.value), badgeX + badgeWidth - 6, y + 12, { align: "right" })

      badgeX += badgeWidth + 6
    })

    doc.setTextColor(0, 0, 0)
    y += 24
  }

  // ====== ENCABEZADO ======
  doc.setFont("helvetica", "bold")
  doc.setFontSize(22)
  doc.text("REMITO DE MOVIMIENTO INTERNO", margin, y)
  y += 9

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(palette.textMuted[0], palette.textMuted[1], palette.textMuted[2])
  doc.text("Documento interno de control y trazabilidad de pedidos", margin, y)
  doc.setTextColor(0, 0, 0)

  y += 10
  doc.setDrawColor(220, 223, 230)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  // Resumen principal
  ensureSpace(34)
  doc.setFillColor(palette.slateLight[0], palette.slateLight[1], palette.slateLight[2])
  doc.setDrawColor(palette.slateBorder[0], palette.slateBorder[1], palette.slateBorder[2])
  doc.roundedRect(margin, y, pageWidth - margin * 2, 28, 3, 3, "FD")

  const columnWidth = (pageWidth - margin * 2) / 2
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)

  doc.text("Pedido", margin + 6, y + 7)
  doc.text("Fecha de emisión", margin + columnWidth + 6, y + 7)
  doc.text("Desde", margin + 6, y + 17)
  doc.text("Hacia", margin + columnWidth + 6, y + 17)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(11)
  doc.setTextColor(17, 24, 39)
  doc.text(note.orderNumber || "-", margin + 6, y + 13)
  doc.text(formatDate(note.createdAt), margin + columnWidth + 6, y + 13)

  doc.setFontSize(10)
  doc.setTextColor(palette.textMuted[0], palette.textMuted[1], palette.textMuted[2])
  doc.text(note.fromBranchName || "-", margin + 6, y + 23)
  doc.text(note.toBranchName || "-", margin + columnWidth + 6, y + 23)
  doc.setTextColor(0, 0, 0)

  y += 34

  // ====== PASO 1: PEDIDO ======
  drawSectionHeader("Paso 1 - Pedido Solicitado", "Detalle original del requerimiento", palette.primary)

  if (note.itemsRequested && note.itemsRequested.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Producto", "Cant. pedida", "Unidad"]],
      body: note.itemsRequested.map(item => [
        item.productName,
        item.quantity.toLocaleString("es-AR", { maximumFractionDigits: 2 }),
        item.unit,
      ]),
      theme: "grid",
      headStyles: {
        fillColor: palette.primary,
        textColor: [255, 255, 255],
        fontSize: 9,
        halign: "left",
      },
      alternateRowStyles: { fillColor: [245, 249, 255] },
      styles: {
        fontSize: 9,
        cellPadding: 3,
        textColor: [45, 55, 72],
      },
      margin: { left: margin, right: margin },
    })
    y = (doc as any).lastAutoTable.finalY + 8
  } else {
    ensureSpace(10)
    doc.setFont("helvetica", "italic")
    doc.setFontSize(9)
    doc.setTextColor(palette.textMuted[0], palette.textMuted[1], palette.textMuted[2])
    doc.text("No se registraron productos solicitados.", margin, y)
    doc.setTextColor(0, 0, 0)
    y += 10
  }

  if (note.requestNotes) {
    drawNoteCard("Comentarios del pedido", note.requestNotes, [232, 240, 254])
  }

  drawSignatureMeta("Autorizado por", note.requestedBySignature)

  // ====== PASO 2: ARMADO ======
  drawSectionHeader("Paso 2 - Preparación en origen", "Estado del armado en fábrica", palette.secondary)

  if (note.itemsAssembled && note.itemsAssembled.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Producto", "Pedido", "Armado", "Estado"]],
      body: note.itemsAssembled.map(item => {
        const assembled = item.assembledQuantity ?? 0
        let estado = "Completo"

        if (assembled === 0) {
          estado = "No disponible"
        } else if (assembled < item.quantity) {
          estado = "Parcial"
        }

        return [
          item.productName,
          `${item.quantity.toLocaleString("es-AR", { maximumFractionDigits: 2 })} ${item.unit}`,
          `${assembled.toLocaleString("es-AR", { maximumFractionDigits: 2 })} ${item.unit}`,
          estado,
        ]
      }),
      theme: "grid",
      headStyles: {
        fillColor: palette.secondary,
        textColor: [255, 255, 255],
        fontSize: 9,
      },
      columnStyles: {
        3: { fontStyle: "bold" },
      },
      alternateRowStyles: { fillColor: [255, 246, 235] },
      styles: {
        fontSize: 9,
        cellPadding: 3,
        textColor: [45, 55, 72],
      },
      margin: { left: margin, right: margin },
    })
    y = (doc as any).lastAutoTable.finalY + 8
  } else {
    ensureSpace(10)
    doc.setFont("helvetica", "italic")
    doc.setFontSize(9)
    doc.setTextColor(palette.textMuted[0], palette.textMuted[1], palette.textMuted[2])
    doc.text("No se registraron items armados en origen.", margin, y)
    doc.setTextColor(0, 0, 0)
    y += 10
  }

  const itemsWithIssues = note.itemsAssembled.filter(item => (item.assembledQuantity ?? 0) < item.quantity)
  if (itemsWithIssues.length > 0) {
    const issuesText = itemsWithIssues.map(item => {
      const assembled = item.assembledQuantity ?? 0
      const reason = item.assemblyNotes || item.notAvailableReason || "Sin motivo especificado"
      return `- ${item.productName} | ${assembled}/${item.quantity} ${item.unit} | ${reason}`
    }).join("\n")

    drawNoteCard("Incidencias en armado", issuesText, [255, 248, 237])
  }

  if (note.assemblyNotes) {
    drawNoteCard("Notas generales de la fábrica", note.assemblyNotes, [255, 248, 237])
  }

  drawSignatureMeta("Preparado por", note.assembledBySignature)

  // ====== PASO 3: RECEPCIÓN ======
  drawSectionHeader("Paso 3 - Recepción en destino", "Verificación final en sucursal receptora", palette.success)

  const receptionTableData: string[][] = []
  note.itemsDelivered.forEach(item => {
    const assembled = item.assembledQuantity ?? item.quantity
    receptionTableData.push([
      item.productName,
      `${(assembled).toLocaleString("es-AR", { maximumFractionDigits: 2 })} ${item.unit}`,
      `${(assembled).toLocaleString("es-AR", { maximumFractionDigits: 2 })} ${item.unit}`,
      "Recibido OK",
    ])
  })

  note.itemsPartial.forEach(item => {
    const assembled = item.assembledQuantity ?? item.quantity
    receptionTableData.push([
      item.productName,
      `${assembled.toLocaleString("es-AR", { maximumFractionDigits: 2 })} ${item.unit}`,
      `${item.quantity.toLocaleString("es-AR", { maximumFractionDigits: 2 })} ${item.unit}`,
      "Parcial",
    ])
  })

  note.itemsNotReceived.forEach(item => {
    const assembled = item.assembledQuantity ?? item.quantity
    receptionTableData.push([
      item.productName,
      `${assembled.toLocaleString("es-AR", { maximumFractionDigits: 2 })} ${item.unit}`,
      `0 ${item.unit}`,
      "No recibido",
    ])
  })

  note.itemsReturned.forEach(item => {
    const assembled = item.assembledQuantity ?? item.quantity
    receptionTableData.push([
      item.productName,
      `${assembled.toLocaleString("es-AR", { maximumFractionDigits: 2 })} ${item.unit}`,
      `0 ${item.unit}`,
      "Devuelto",
    ])
  })

  if (receptionTableData.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Producto", "Enviado", "Recibido", "Estado"]],
      body: receptionTableData,
      theme: "grid",
      headStyles: {
        fillColor: palette.success,
        textColor: [255, 255, 255],
        fontSize: 9,
      },
      columnStyles: {
        3: { fontStyle: "bold" },
      },
      alternateRowStyles: { fillColor: [240, 253, 244] },
      styles: {
        fontSize: 9,
        cellPadding: 3,
        textColor: [31, 41, 55],
      },
      margin: { left: margin, right: margin },
    })
    y = (doc as any).lastAutoTable.finalY + 8
  } else {
    ensureSpace(10)
    doc.setFont("helvetica", "italic")
    doc.setFontSize(9)
    doc.setTextColor(palette.textMuted[0], palette.textMuted[1], palette.textMuted[2])
    doc.text("No se registraron items verificados en recepción.", margin, y)
    doc.setTextColor(0, 0, 0)
    y += 10
  }

  const receptionIssues = [
    ...note.itemsPartial.map(item => ({ product: item.productName, detail: item.notReceivedReason || "Sin motivo especificado", state: "Parcial" })),
    ...note.itemsNotReceived.map(item => ({ product: item.productName, detail: item.notReceivedReason || "Sin motivo especificado", state: "No recibido" })),
    ...note.itemsReturned.map(item => ({ product: item.productName, detail: item.returnReason || "Sin motivo especificado", state: "Devuelto" })),
  ]

  if (receptionIssues.length > 0) {
    const text = receptionIssues
      .map(issue => `- ${issue.product} | ${issue.state} | ${issue.detail}`)
      .join("\n")
    drawNoteCard("Observaciones de recepción", text, [240, 253, 244])
  }

  if (note.receptionNotes) {
    drawNoteCard("Notas internas de la sucursal", note.receptionNotes, [240, 253, 244])
  }

  drawSignatureMeta("Recibido por", note.receptionSignature)

  drawSummaryBadges()

  // ====== FIRMAS ======
  ensureSpace(60)
  doc.setDrawColor(209, 213, 219)
  doc.line(margin, y, pageWidth - margin, y)
  y += 4

  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.text("Resumen de firmas", margin, y)
  y += 8

  const signatureColumnWidth = (pageWidth - margin * 2 - 10) / 2
  const renderSignaturePanel = (
    label: string,
    signature: DeliveryNote["deliverySignature"],
    x: number
  ) => {
    doc.setDrawColor(palette.slateBorder[0], palette.slateBorder[1], palette.slateBorder[2])
    doc.roundedRect(x, y, signatureColumnWidth, 40, 2, 2)

    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.text(label, x + 5, y + 7)

    if (signature?.signatureImage) {
      try {
        doc.addImage(signature.signatureImage, "PNG", x + 5, y + 10, signatureColumnWidth - 10, 16, undefined, "FAST")
      } catch (error) {
        console.error("Error al agregar imagen de firma:", error)
      }
    } else {
      doc.setDrawColor(203, 213, 225)
      doc.line(x + 5, y + 24, x + signatureColumnWidth - 5, y + 24)
    }

    doc.setFont("helvetica", "normal")
    doc.setFontSize(8.5)
    doc.setTextColor(31, 41, 55)
    doc.text(signature?.userName || "-", x + 5, y + 32)

    if (signature?.position) {
      doc.setFontSize(8)
      doc.setTextColor(palette.textMuted[0], palette.textMuted[1], palette.textMuted[2])
      doc.text(signature.position, x + 5, y + 36)
    }

    doc.setFontSize(7.5)
    doc.setTextColor(palette.textMuted[0], palette.textMuted[1], palette.textMuted[2])
    doc.text(signature ? formatDate(signature.timestamp) : "-", x + signatureColumnWidth - 5, y + 36, { align: "right" })
    doc.setTextColor(0, 0, 0)
  }

  renderSignaturePanel("Entregado por - Logística", note.deliverySignature, margin)
  renderSignaturePanel("Recibido por - Sucursal", note.receptionSignature, margin + signatureColumnWidth + 10)

  // Guardar PDF
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
      estado = "OK"
    } else if (partial) {
      receivedQty = partial.quantity // La cantidad que finalmente se recibió
      estado = "PARCIAL"
    } else if (returned) {
      receivedQty = 0
      estado = "DEVUELTO"
    } else if (notReceived) {
      receivedQty = 0
      estado = "NO RECIBIDO"
    } else {
      // Por defecto, asumir que se recibió lo que se armó
      receivedQty = assembledQty
      estado = assembledQty > 0 ? "OK" : "SIN ENVIO"
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
