<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
// Знак: синий круг, ромб, золотая раскрытая книга. draw — прорисовка линией и редкий блик по книге (при «уменьшить движение» — сразу готовый знак).
defineProps({ draw: Boolean })
const id = "lg" + ++seq
const book = "M100 80C89 71 69 68 54 72v52c15-4 35-1 46 8 11-9 31-12 46-8V72c-15-4-35-1-46 8z"
</script>

<script>
let seq = 0
</script>

<template>
    <svg class="lgo" :class="{ 'lgo--draw': draw }" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
        <defs>
            <clipPath :id="id + 'c'"><path :d="book" /></clipPath>
            <linearGradient :id="id + 'g'" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stop-color="#fff" stop-opacity="0" />
                <stop offset=".5" stop-color="#fff" stop-opacity=".95" />
                <stop offset="1" stop-color="#fff" stop-opacity="0" />
            </linearGradient>
        </defs>
        <circle class="lgo__bg" cx="100" cy="100" r="96.5" fill="#fff" />
        <circle class="lgo__ring" pathLength="1" cx="100" cy="100" r="96.5" transform="rotate(-90 100 100)" />
        <path class="lgo__ring lgo__rhomb" pathLength="1" d="M55.5 55.5L100 11l89 89-89 89L11 100z" />
        <g class="lgo__book">
            <path class="lgo__page" :d="book" />
            <path class="lgo__gold" pathLength="1" :d="book" />
            <path class="lgo__gold" pathLength="1" d="M100 80v52" />
            <path class="lgo__gold lgo__cover" pathLength="1" d="M48 78v52c17-3 39-1 52 9 13-10 35-12 52-9V78" />
            <path class="lgo__gold lgo__txt" pathLength="1" d="M62 84c10-2 22-1 31 4M62 95c10-2 22-1 31 4M62 106c10-2 22-1 31 4M138 84c-10-2-22-1-31 4M138 95c-10-2-22-1-31 4M138 106c-10-2-22-1-31 4" />
            <g :clip-path="`url(#${id}c)`"><rect class="lgo__shine" x="-10" y="56" width="44" height="90" :fill="`url(#${id}g)`" transform="skewX(-16)" /></g>
        </g>
    </svg>
</template>
