/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

/** Автор сообщения одной строкой: «Иван (@ivan), Представитель» — снимок на момент отправки */
export const who = (u) => `${u?.name || "—"}${u?.login ? ` (@${u.login})` : ""}${u?.role ? `, ${u.role}` : ""}`

/** Новые сообщения из показанных, которые ещё не отправлены на отметку «прочитано» */
export const toMark = (items, queued) => (items || []).filter((m) => !m.readAt && !queued.has(m._id)).map((m) => m._id)
