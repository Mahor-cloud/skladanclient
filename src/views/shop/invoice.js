import { AlignmentType, Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx"

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

    // Сохранение документа
    Packer.toBlob(doc).then((blob) => {
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `invoice${order.orderNumber}.docx`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
    })
}
