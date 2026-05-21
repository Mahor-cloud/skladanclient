/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

export default function formatTimestamp(timestamp) {
    const date = new Date(timestamp)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${day}.${month}.${year}`
}
