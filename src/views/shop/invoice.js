import fontkit from "@pdf-lib/fontkit"
import { PDFDocument, rgb } from "pdf-lib"

async function loadFont() {
    const response = await fetch("/fonts/time-roman.ttf")
    const fontBytes = await response.arrayBuffer()
    return fontBytes
}

export async function generateInvoice(order) {
    const pdfDoc = await PDFDocument.create()
    pdfDoc.registerFontkit(fontkit)

    const page = pdfDoc.addPage([595.28, 841.89]) // A4 размер
    const { width, height } = page.getSize()

    const fontBytes = await loadFont()
    const customFont = await pdfDoc.embedFont(fontBytes)

    // Заголовок
    page.drawText(`Расходная накладная. Номер ${order.orderNumber} от ${order.orderDate}`, {
        x: 50,
        y: height - 50,
        size: 24,
        font: customFont,
        color: rgb(0, 0, 0)
    })

    // Информация о поставщике и покупателе
    let y = height - 100
    page.drawText(`Поставщик: Литературный подкомитет АН г.Саратов`, {
        x: 50,
        y,
        size: 14,
        font: customFont,
        color: rgb(0, 0, 0)
    })
    y -= 20
    page.drawText(`Покупатель: ${order.user.name}`, {
        x: 50,
        y,
        size: 14,
        font: customFont,
        color: rgb(0, 0, 0)
    })
    y -= 20
    page.drawText(`Склад: Литературный подкомитет АН г.Саратов`, {
        x: 50,
        y,
        size: 14,
        font: customFont,
        color: rgb(0, 0, 0)
    })

    // Таблица
    y -= 40
    const columnWidths = [40, 335, 40, 40, 40]
    const tableHeaders = ["Номер", "Наименование", "Цена", "Кол-во", "Сумма"]
    const rowHeight = 20

    // Линия сверху таблицы
    const tableTopY = y + 10 // Верхняя линия таблицы
    page.drawLine({
        start: { x: 50, y: tableTopY },
        end: { x: width - 50, y: tableTopY },
        thickness: 1,
        color: rgb(0, 0, 0)
    })

    // Заголовки таблицы
    tableHeaders.forEach((header, index) => {
        page.drawText(header, {
            x: 50 + columnWidths.slice(0, index).reduce((a, b) => a + b, 0),
            y,
            size: 12,
            font: customFont,
            color: rgb(0, 0, 0)
        })
    })

    // Горизонтальная линия под заголовками
    const headerBottomY = y - 5
    page.drawLine({
        start: { x: 50, y: headerBottomY },
        end: { x: width - 50, y: headerBottomY },
        thickness: 1,
        color: rgb(0, 0, 0)
    })

    // Строки таблицы
    order.items.forEach((item, rowIndex) => {
        y -= rowHeight
        const rowData = [`${rowIndex + 1}`, item.name, item.price.toFixed(2), `${item.buyQuantity}`, (item.price * item.buyQuantity).toFixed(2)]
        rowData.forEach((cell, cellIndex) => {
            page.drawText(cell, {
                x: 50 + columnWidths.slice(0, cellIndex).reduce((a, b) => a + b, 0),
                y,
                size: 12,
                font: customFont,
                color: rgb(0, 0, 0)
            })
        })

        // Горизонтальная линия под строкой
        page.drawLine({
            start: { x: 50, y: y - 5 },
            end: { x: width - 50, y: y - 5 },
            thickness: 1,
            color: rgb(0, 0, 0)
        })
    })

    // Вертикальные линии таблицы
    let x = 50
    const tableBottomY = y - 5 // Нижняя линия таблицы
    columnWidths.forEach((width, index) => {
        page.drawLine({
            start: { x, y: tableTopY }, // Начинаем от верхней линии таблицы
            end: { x, y: tableBottomY }, // Заканчиваем на нижней линии таблицы
            thickness: 1,
            color: rgb(0, 0, 0)
        })
        x += width
    })
    // Последняя вертикальная линия
    page.drawLine({
        start: { x, y: tableTopY },
        end: { x, y: tableBottomY },
        thickness: 1,
        color: rgb(0, 0, 0)
    })

    // Итоговая сумма
    y -= 40
    page.drawText(`${order.totalPrice} Руб.`, {
        x: width - 200,
        y,
        size: 14,
        font: customFont,
        color: rgb(0, 0, 0)
    })

    // Сохранение и скачивание PDF
    const pdfBytes = await pdfDoc.save()
    const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" })
    const url = window.URL.createObjectURL(pdfBlob)
    const a = document.createElement("a")
    a.href = url
    a.download = `invoice${order.orderNumber}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
}
