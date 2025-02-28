import { AlignmentType, Document, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

export async function generateInvoice(order) {
    const doc = new Document({
        sections: [
            {
                properties: {},
                children: [
                    // Заголовок
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({
                                text: `Расходная накладная № ${order.orderNumber} от ${order.orderDate}`,
                                size: 36,
                                bold: true
                            })
                        ]
                    }),
                    new Paragraph({
                        spacing: {
                            before: 120
                        }
                    }),
                    // Информация о поставщике и покупателе
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `Поставщик: Литературный подкомитет АН г.Саратов`,
                                size: 24
                            })
                        ]
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `Покупатель: ${order.user.name}`,
                                size: 24
                            })
                        ]
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `Склад: Литературный подкомитет АН г.Саратов`,
                                size: 24
                            })
                        ]
                    }),
                    new Paragraph({
                        spacing: {
                            before: 120
                        }
                    }),
                    new Table({
                        width: {
                            size: "100%",
                            type: WidthType.PERCENTAGE
                        },
                        columnWidths: [5, 55, 15, 10, 15],
                        rows: [
                            // Заголовки таблицы
                            new TableRow({
                                children: [
                                    new TableCell({
                                        children: [new Paragraph({ text: "№", bold: true })]
                                    }),
                                    new TableCell({
                                        children: [new Paragraph({ text: "Наименование", bold: true })]
                                    }),
                                    new TableCell({
                                        children: [new Paragraph({ text: "Цена", bold: true })]
                                    }),
                                    new TableCell({
                                        children: [new Paragraph({ text: "Кол-во", bold: true })]
                                    }),
                                    new TableCell({
                                        children: [new Paragraph({ text: "Сумма", bold: true })]
                                    })
                                ]
                            }),
                            // Строки таблицы
                            ...order.items.map(
                                (item, index) =>
                                    new TableRow({
                                        children: [
                                            new TableCell({
                                                children: [new Paragraph({ text: `${index + 1}` })]
                                            }),
                                            new TableCell({
                                                children: [new Paragraph({ text: item.name })]
                                            }),
                                            new TableCell({
                                                children: [new Paragraph({ text: item.price.toFixed(2) })]
                                            }),
                                            new TableCell({
                                                children: [new Paragraph({ text: `${item.buyQuantity}` })]
                                            }),
                                            new TableCell({
                                                children: [new Paragraph({ text: (item.price * item.buyQuantity).toFixed(2) })]
                                            })
                                        ]
                                    })
                            )
                        ]
                    }),
                    // Итоговая сумма
                    new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [
                            new TextRun({
                                text: order.totalPrice,
                                size: 24,
                                bold: true
                            })
                        ]
                    })
                ]
            }
        ]
    })

    // Сохранение DOCX
    // Packer.toBlob(doc).then((blob) => {
    //     const url = window.URL.createObjectURL(blob);
    //     const a = document.createElement("a");
    //     a.href = url;
    //     a.download = `invoice${order.orderNumber}.docx`;
    //     document.body.appendChild(a);
    //     a.click();
    //     document.body.removeChild(a);
    // });

    // Генерация PDF
    await generatePdf(order)
}

async function generatePdf(order) {
    // Создаём новый PDF документ
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage()
    const { width, height } = page.getSize()

    // Загружаем шрифт
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

    // Добавляем заголовок
    page.drawText(`Расходная накладная № ${order.orderNumber} от ${order.orderDate}`, {
        x: 50,
        y: height - 50,
        size: 24,
        font,
        color: rgb(0, 0, 0)
    })

    // Добавляем информацию о поставщике и покупателе
    let y = height - 100
    page.drawText(`Поставщик: Литературный подкомитет АН г.Саратов`, {
        x: 50,
        y,
        size: 14,
        font,
        color: rgb(0, 0, 0)
    })
    y -= 20
    page.drawText(`Покупатель: ${order.user.name}`, {
        x: 50,
        y,
        size: 14,
        font,
        color: rgb(0, 0, 0)
    })
    y -= 20
    page.drawText(`Склад: Литературный подкомитет АН г.Саратов`, {
        x: 50,
        y,
        size: 14,
        font,
        color: rgb(0, 0, 0)
    })

    // Добавляем таблицу
    y -= 40
    const tableHeaders = ["№", "Наименование", "Цена", "Кол-во", "Сумма"]
    const columnWidths = [50, 300, 100, 80, 100]
    const rowHeight = 20

    // Заголовки таблицы
    tableHeaders.forEach((header, index) => {
        page.drawText(header, {
            x: 50 + columnWidths.slice(0, index).reduce((a, b) => a + b, 0),
            y,
            size: 12,
            font,
            color: rgb(0, 0, 0)
        })
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
                font,
                color: rgb(0, 0, 0)
            })
        })
    })

    // Итоговая сумма
    y -= 40
    page.drawText(`Итого: ${order.totalPrice}`, {
        x: width - 200,
        y,
        size: 14,
        font,
        color: rgb(0, 0, 0)
    })

    // Сохраняем PDF
    const pdfBytes = await pdfDoc.save()
    const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" })

    // Скачиваем PDF
    const url = window.URL.createObjectURL(pdfBlob)
    const a = document.createElement("a")
    a.href = url
    a.download = `invoice${order.orderNumber}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
}
