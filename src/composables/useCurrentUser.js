/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { ref } from "vue"

function readUserFromStorage() {
    try {
        return JSON.parse(localStorage.getItem("user") || "null")
    } catch {
        return null
    }
}

const userState = ref(readUserFromStorage())

function refreshUserState(e) {
    if (!e || e.key === "user" || e.key === null) {
        userState.value = readUserFromStorage()
    }
}

if (typeof window !== "undefined") {
    window.addEventListener("storage", refreshUserState)
}

export function useCurrentUser() {
    return userState
}

export function syncCurrentUser() {
    userState.value = readUserFromStorage()
}
