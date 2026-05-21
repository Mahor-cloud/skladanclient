import fontkit from "@pdf-lib/fontkit"
import { PDFDocument, rgb } from "pdf-lib"

async function loadFont() {
    const response = await fetch("/fonts/time-roman.ttf")
    return await response.arrayBuffer()
}

function formatRub(value) {
    const n = Number(value) || 0
    return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function drawCell(page, font, text, x, y, width, height, opts = {}) {
    const fontSize = opts.fontSize ?? 11
    const align = opts.align ?? "left"
    const bold = opts.bold ?? false
    const fill = opts.fill
    if (fill) {
        page.drawRectangle({
            x,
            y: y - height + 4,
            width,
            height,
            color: fill,
            borderWidth: 0
        })
    }
    const padding = 6
    const textWidth = font.widthOfTextAtSize(text, fontSize)
    let textX = x + padding
    if (align === "right") textX = x + width - textWidth - padding
    if (align === "center") textX = x + (width - textWidth) / 2
    page.drawText(text, {
        x: textX,
        y: y - fontSize - 2,
        size: fontSize,
        font,
        color: rgb(0.1, 0.1, 0.15)
    })
    if (bold) {
        page.drawText(text, {
            x: textX + 0.3,
            y: y - fontSize - 2,
            size: fontSize,
            font,
            color: rgb(0.1, 0.1, 0.15)
        })
    }
}

export async function generateInvoice(order) {
    const pdfDoc = await PDFDocument.create()
    pdfDoc.registerFontkit(fontkit)

    const page = pdfDoc.addPage([595.28, 841.89])
    const { width, height } = page.getSize()
    const fontBytes = await loadFont()
    const font = await pdfDoc.embedFont(fontBytes)

    const marginLeft = 40
    const marginRight = 40
    const contentWidth = width - marginLeft - marginRight
    const accentColor = rgb(0.06, 0.45, 0.7)
    const lineColor = rgb(0.75, 0.78, 0.82)
    const zebraColor = rgb(0.96, 0.97, 0.99)

    let y = height - 50

    page.drawRectangle({
        x: marginLeft,
        y: y - 32,
        width: contentWidth,
        height: 36,
        color: accentColor,
        borderWidth: 0
    })
    page.drawText("РАСХОДНАЯ НАКЛАДНАЯ", {
        x: marginLeft + 12,
        y: y - 22,
        size: 16,
        font,
        color: rgb(1, 1, 1)
    })
    const numberText = `№ ${order.orderNumber}`
    const numberWidth = font.widthOfTextAtSize(numberText, 14)
    page.drawText(numberText, {
        x: width - marginRight - numberWidth - 12,
        y: y - 21,
        size: 14,
        font,
        color: rgb(1, 1, 1)
    })

    y -= 60
    page.drawText(`Дата: ${order.orderDate}`, {
        x: marginLeft,
        y,
        size: 11,
        font,
        color: rgb(0.3, 0.3, 0.35)
    })

    y -= 24
    page.drawText("Покупатель:", {
        x: marginLeft,
        y,
        size: 12,
        font,
        color: rgb(0.3, 0.3, 0.35)
    })
    page.drawText(order.user?.name || "—", {
        x: marginLeft + 80,
        y,
        size: 12,
        font,
        color: rgb(0.1, 0.1, 0.15)
    })

    y -= 32
    const colNumW = 36
    const colSumW = 90
    const colPriceW = 80
    const colQtyW = 60
    const colNameW = contentWidth - colNumW - colSumW - colPriceW - colQtyW
    const cols = [
        { header: "№", w: colNumW, align: "center" },
        { header: "Наименование", w: colNameW, align: "left" },
        { header: "Цена", w: colPriceW, align: "right" },
        { header: "Кол-во", w: colQtyW, align: "center" },
        { header: "Сумма", w: colSumW, align: "right" }
    ]
    const rowHeight = 22
    const headerHeight = 26

    let cx = marginLeft
    for (const col of cols) {
        page.drawRectangle({
            x: cx,
            y: y - headerHeight + 4,
            width: col.w,
            height: headerHeight,
            color: accentColor,
            borderWidth: 0
        })
        const tw = font.widthOfTextAtSize(col.header, 11)
        let tx = cx + 6
        if (col.align === "right") tx = cx + col.w - tw - 6
        if (col.align === "center") tx = cx + (col.w - tw) / 2
        page.drawText(col.header, {
            x: tx,
            y: y - 14,
            size: 11,
            font,
            color: rgb(1, 1, 1)
        })
        cx += col.w
    }
    y -= headerHeight

    const items = order.items || []
    items.forEach((item, idx) => {
        const rowY = y
        if (idx % 2 === 1) {
            page.drawRectangle({
                x: marginLeft,
                y: rowY - rowHeight + 4,
                width: contentWidth,
                height: rowHeight,
                color: zebraColor,
                borderWidth: 0
            })
        }
        const lineSum = (Number(item.price) || 0) * (Number(item.buyQuantity) || 0)
        const cells = [
            { text: String(idx + 1), align: "center" },
            { text: item.name || "", align: "left" },
            { text: formatRub(item.price), align: "right" },
            { text: String(item.buyQuantity || 0), align: "center" },
            { text: formatRub(lineSum), align: "right" }
        ]
        let cellX = marginLeft
        cells.forEach((cell, i) => {
            drawCell(page, font, cell.text, cellX, rowY, cols[i].w, rowHeight, {
                align: cell.align,
                fontSize: 11
            })
            cellX += cols[i].w
        })
        y -= rowHeight
        page.drawLine({
            start: { x: marginLeft, y: y + 4 },
            end: { x: marginLeft + contentWidth, y: y + 4 },
            thickness: 0.5,
            color: lineColor
        })
    })

    cx = marginLeft
    const tableTopY = height - 50 - 60 - 24 - 32
    const tableBottomY = y + 4
    for (let i = 0; i <= cols.length; i++) {
        page.drawLine({
            start: { x: cx, y: tableTopY },
            end: { x: cx, y: tableBottomY },
            thickness: 0.5,
            color: lineColor
        })
        if (i < cols.length) cx += cols[i].w
    }
    page.drawLine({
        start: { x: marginLeft, y: tableTopY },
        end: { x: marginLeft + contentWidth, y: tableTopY },
        thickness: 1,
        color: accentColor
    })
    page.drawLine({
        start: { x: marginLeft, y: tableBottomY },
        end: { x: marginLeft + contentWidth, y: tableBottomY },
        thickness: 1,
        color: accentColor
    })

    y -= 28
    const totalLabel = "ИТОГО:"
    const totalValue = `${formatRub(order.totalPrice)} ₽`
    const totalValueW = font.widthOfTextAtSize(totalValue, 14)
    const totalLabelW = font.widthOfTextAtSize(totalLabel, 12)
    page.drawText(totalLabel, {
        x: width - marginRight - totalValueW - totalLabelW - 12,
        y,
        size: 12,
        font,
        color: rgb(0.3, 0.3, 0.35)
    })
    page.drawText(totalValue, {
        x: width - marginRight - totalValueW,
        y,
        size: 14,
        font,
        color: rgb(0.06, 0.45, 0.7)
    })

    const pdfBytes = await pdfDoc.save()
    const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" })
    const url = window.URL.createObjectURL(pdfBlob)
    const a = document.createElement("a")
    a.href = url
    a.download = `invoice${order.orderNumber}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
}
