<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'

// Single-line text that scrolls (marquee) only when it overflows its container.
// Loop: scroll head -> tail (linear), pause at the tail, then jump straight back
// to the head (no reverse). Inherits font/size from the parent so the overflow
// measurement matches the rendered text.
const props = defineProps({
    text: { type: [String, Number], default: '' },
    speed: { type: Number, default: 30 }, // scroll px per second
    pause: { type: Number, default: 3.5 },  // seconds held at the tail before jumping back
    scaleX: { type: Number, default: 1 },   // horizontal glyph scale, e.g. 0.8 = 80% width
})

const container = ref(null)
const inner = ref(null)
const offset = ref(0)           // current translateX in px
const transition = ref('none')  // css transition applied to the inner span

let shift = 0                   // px the text overflows by
let timer = null
let raf = 0

const stop = () => {
    if (timer) clearTimeout(timer)
    if (raf) cancelAnimationFrame(raf)
    timer = null
    raf = 0
    transition.value = 'none'
    offset.value = 0
}

const runCycle = () => {
    if (shift <= 0) return
    // (re)start at the head, no transition -> instant jump back on later cycles
    transition.value = 'none'
    offset.value = 0
    // hold at the head, then scroll head -> tail
    timer = setTimeout(() => {
        const travel = shift / props.speed // seconds
        transition.value = `transform ${travel}s linear`
        offset.value = -shift
        // hold at the tail, then jump back to the head and repeat
        timer = setTimeout(() => {
            // wait for the jump to paint before re-enabling the transition
            raf = requestAnimationFrame(() => {
                raf = requestAnimationFrame(runCycle)
            })
        }, (travel + props.pause) * 1000)
    }, props.pause * 1000)
}

// Re-measure the overflow and (re)start or halt scrolling accordingly.
// `force` restarts from the head even if the overflow amount is unchanged.
const measure = (force = false) => {
    const c = container.value
    const i = inner.value
    if (!c || !i) return
    const overflow = i.scrollWidth * props.scaleX - c.clientWidth
    const next = overflow > 1 ? overflow : 0
    if (!force && next === shift) return // size unchanged, keep current animation
    shift = next
    stop()
    if (shift > 0) runCycle()
}

let ro = null
watch(() => [props.text, props.scaleX], () => nextTick(() => measure(true)))
onMounted(() => {
    measure(true)
    // custom fonts change text width once loaded, so re-measure then
    if (document.fonts?.ready) document.fonts.ready.then(() => measure())
    // watch the text and container size directly so any style change
    // (font-size, width, ...) re-evaluates whether scrolling is needed
    ro = new ResizeObserver(() => measure())
    ro.observe(container.value)
    ro.observe(inner.value)
})
onBeforeUnmount(() => {
    stop()
    if (ro) ro.disconnect()
})
</script>

<template>
    <div ref="container" class="overflow-hidden whitespace-nowrap">
        <span ref="inner" class="inline-block"
            :style="{ transform: `translateX(${offset}px) scaleX(${scaleX})`, transformOrigin: 'left center', transition }">
            {{ text }}
        </span>
    </div>
</template>
