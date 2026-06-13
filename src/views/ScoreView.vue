<script setup>
// Bridge control console: polls the scoreboard bridge server (URL from
// _data/config/endpoints.json, or the mock from `npm run mock:bridge`) and mirrors
// the latest state into localStorage['game-state'], which the gameplay/actions/winner
// overlays read.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { getConfig } from '../lib/config'

const STORAGE_INSTANCE_KEY = 'offc6-score-selected-instance'
const INSTANCE_REFRESH_MS = 5000
const SCOREBOARD_POLL_MS = 2000
const MAX_EVENT_LOG = 200

const bridgeBaseUrl = getConfig().bridgeBaseUrl

// --- reactive state (bound in the template) ---
const selectedInstanceId = ref(String(window.localStorage.getItem(STORAGE_INSTANCE_KEY) || '').trim())
const instanceList = ref([])
const gameStatus = ref({})
const gameEvent = ref([])
const connectionStatus = ref('等待選擇可連線的 index.html。')
const snapshotStatus = ref('game_status 尚未同步')
const eventStatus = ref('game_event 0 筆')
const statusDot = ref('warn')

// --- non-reactive internals (only touched in JS, never rendered) ---
let instanceListTimer = null
let scoreboardTimer = null
let syncTimer = null
let pollingWorker = null
let useWorkerPolling = false
let lastEventSeq = 0
let lastSnapshotSignature = ''
let isBridgeConnected = false

const statusDotClass = computed(() => {
    if (statusDot.value === 'ok') return 'bg-emerald-400'
    if (statusDot.value === 'err') return 'bg-rose-400'
    return 'bg-amber-400'
})
const gameStatusText = computed(() => JSON.stringify(gameStatus.value || {}, null, 4))
const gameEventText = computed(() => JSON.stringify([...gameEvent.value].reverse(), null, 4))

function syncState() {
    const state = { gameStatus: gameStatus.value, gameEvent: gameEvent.value }
    try {
        window.localStorage.setItem('game-state', JSON.stringify(state))
    } catch {
        /* ignore quota/serialisation errors */
    }
}

function apiUrl(path) {
    // Tolerate a trailing slash in bridgeBaseUrl so we never emit `//api/...`,
    // which the bridge server treats as an unregistered route (Cannot GET).
    return `${bridgeBaseUrl.replace(/\/+$/, '')}${path}`
}

async function requestJson(path, options = {}) {
    const response = await fetch(apiUrl(path), {
        ...options,
        credentials: 'omit',
    })

    if (!response.ok) {
        const bodyText = await response.text().catch(() => '')
        const error = new Error(bodyText || `HTTP ${response.status}`)
        error.status = response.status
        throw error
    }

    return response.json()
}

function shallowStatusSignature(nextStatus) {
    try {
        return JSON.stringify(nextStatus || {})
    } catch {
        return String(Date.now())
    }
}

function setStatusDot(mode) {
    statusDot.value = mode === 'ok' ? 'ok' : mode === 'err' ? 'err' : 'warn'
}

function initPollingWorker() {
    if (!window.Worker) {
        useWorkerPolling = false
        return
    }

    try {
        pollingWorker = new Worker(new URL('../workers/bridge-worker.js', import.meta.url), {
            type: 'module',
        })
        useWorkerPolling = true
    } catch {
        pollingWorker = null
        useWorkerPolling = false
        return
    }

    pollingWorker.onmessage = (event) => {
        handleWorkerMessage(event.data)
    }
    pollingWorker.onerror = (error) => {
        useWorkerPolling = false
        pollingWorker?.terminate()
        pollingWorker = null
        connectionStatus.value = `背景同步失敗：${error?.message || 'worker error'}`
        setStatusDot('err')
    }

    if (selectedInstanceId.value) {
        configureWorkerPolling(selectedInstanceId.value, true)
    }
}

function configureWorkerPolling(instanceId, reset = false) {
    if (!pollingWorker) {
        return
    }
    pollingWorker.postMessage({
        type: 'configure',
        baseUrl: bridgeBaseUrl,
        instanceId: String(instanceId || '').trim(),
        pollMs: SCOREBOARD_POLL_MS,
        reset,
    })
}

function requestWorkerPoll(force = false) {
    if (!pollingWorker) {
        return
    }
    pollingWorker.postMessage({ type: 'pollOnce', force })
}

function stopWorkerPolling() {
    if (!pollingWorker) {
        return
    }
    pollingWorker.postMessage({ type: 'stop' })
}

function handleWorkerMessage(payload) {
    if (!payload || typeof payload !== 'object') {
        return
    }

    console.log('[worker]', payload.type, payload?.events?.length ?? '', payload.force ? 'force' : '')

    if (payload.type === 'snapshot') {
        setGameStatus(payload.snapshot)
        return
    }

    if (payload.type === 'events') {
        if (Array.isArray(payload.events) && payload.events.length) {
            setGameEvents(payload.events, Boolean(payload.force))
        }
        return
    }

    if (payload.type === 'connected') {
        isBridgeConnected = true
        connectionStatus.value = `已同步：${payload.instanceId}`
        setStatusDot('ok')
        return
    }

    if (payload.type === 'gone') {
        isBridgeConnected = false
        selectedInstanceId.value = ''
        window.localStorage.removeItem(STORAGE_INSTANCE_KEY)
        connectionStatus.value = '目標對局已離線，已停止同步並自動刷新清單。'
        setStatusDot('warn')
        loadInstances().catch(() => { })
        return
    }

    if (payload.type === 'error') {
        isBridgeConnected = false
        connectionStatus.value = `同步失敗：${payload.message}`
        setStatusDot('err')
    }
}

function updateStatusText() {
    snapshotStatus.value = gameStatus.value?.updatedAt
        ? `game_status 已更新：${new Date(gameStatus.value.updatedAt).toLocaleString('zh-TW', { hour12: false })}`
        : 'game_status 已同步'
    connectionStatus.value = selectedInstanceId.value
        ? `已連線：${selectedInstanceId.value}`
        : '等待選擇可連線的 index.html。'
}

function updateEventText() {
    eventStatus.value = `game_event ${gameEvent.value.length} 筆`
    syncState()
}

function setGameStatus(nextStatus) {
    const signature = shallowStatusSignature(nextStatus)
    if (signature === lastSnapshotSignature) {
        return false
    }
    lastSnapshotSignature = signature
    gameStatus.value = nextStatus && typeof nextStatus === 'object' ? nextStatus : {}
    updateStatusText()
    syncState()
    return true
}

function appendGameEvent(eventItem) {
    if (!eventItem || typeof eventItem !== 'object') {
        return false
    }

    gameEvent.value = [...gameEvent.value, eventItem].slice(-MAX_EVENT_LOG)
    updateEventText()
    return true
}

function setGameEvents(eventItems, force = false) {
    const list = Array.isArray(eventItems) ? eventItems : []
    if (!list.length) {
        return false
    }

    if (force) {
        // Merge/replace by seq so modified old events are applied
        const existingBySeq = new Map()
        for (const ev of gameEvent.value) {
            const s = Number(ev?.seq)
            if (Number.isFinite(s)) existingBySeq.set(s, ev)
        }

        for (const item of list) {
            const s = Number(item?.seq)
            if (!Number.isFinite(s)) continue
            existingBySeq.set(s, item)
            lastEventSeq = Math.max(lastEventSeq, s)
        }

        // Rebuild ordered array
        const merged = Array.from(existingBySeq.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([, v]) => v)
            .slice(-MAX_EVENT_LOG)

        gameEvent.value = merged
        updateEventText()
        console.log('[events] merged, total=', gameEvent.value.length)
        return true
    }

    let changed = false
    for (const item of list) {
        const seq = Number(item?.seq)
        if (Number.isFinite(seq) && seq > lastEventSeq) {
            appendGameEvent(item)
            lastEventSeq = seq
            changed = true
        }
    }
    if (changed) console.log('[events] appended, lastSeq=', lastEventSeq)
    return changed
}

function formatInstanceLabel(instance) {
    const redName = instance?.teamNames?.red || '紅隊'
    const blueName = instance?.teamNames?.blue || '藍隊'
    return `${redName} / ${blueName} (${instance.instanceId.slice(0, 8)})`
}

async function loadInstances() {
    try {
        const payload = await requestJson('/api/scoreboard/instances')
        instanceList.value = Array.isArray(payload.instances) ? payload.instances : []

        if (selectedInstanceId.value) {
            const stillExists = instanceList.value.some(
                (instance) => String(instance?.instanceId || '') === selectedInstanceId.value,
            )
            if (!stillExists) {
                selectedInstanceId.value = ''
                window.localStorage.removeItem(STORAGE_INSTANCE_KEY)
                isBridgeConnected = false
                if (useWorkerPolling) {
                    stopWorkerPolling()
                }
            }
        }

        if (!selectedInstanceId.value && instanceList.value.length === 1) {
            await selectInstance(instanceList.value[0].instanceId)
        }

        if (!selectedInstanceId.value) {
            connectionStatus.value = instanceList.value.length
                ? '請從選單選擇要同步的 index.html。'
                : '尚未偵測到任何 index.html。'
            isBridgeConnected = false
            if (useWorkerPolling) {
                stopWorkerPolling()
            }
        }

        setStatusDot('warn')
    } catch (error) {
        isBridgeConnected = false
        connectionStatus.value = `無法連線到 bridge server：${error.message}`
        setStatusDot('err')
    }
}

async function selectInstance(instanceId) {
    selectedInstanceId.value = String(instanceId || '').trim()
    window.localStorage.setItem(STORAGE_INSTANCE_KEY, selectedInstanceId.value)
    lastEventSeq = 0
    gameEvent.value = []
    isBridgeConnected = false
    updateEventText()
    updateStatusText()
    if (useWorkerPolling) {
        configureWorkerPolling(selectedInstanceId.value, true)
    }
    await pollScoreboard(true)
    startPolling()
}

async function pollScoreboard(force = false) {
    if (!selectedInstanceId.value) {
        return
    }

    if (useWorkerPolling) {
        requestWorkerPoll(force)
        return
    }

    try {
        const payload = await requestJson(
            `/api/scoreboard/state?instanceId=${encodeURIComponent(selectedInstanceId.value)}&sinceSeq=${force ? 0 : lastEventSeq}`,
        )
        if (payload && typeof payload.snapshot === 'object' && payload.snapshot) {
            setGameStatus(payload.snapshot)
        }

        if (Array.isArray(payload?.events) && payload.events.length) {
            setGameEvents(payload.events)
            const latestSeq = payload.events.reduce(
                (max, eventItem) => Math.max(max, Number(eventItem.seq) || 0),
                lastEventSeq,
            )
            lastEventSeq = Math.max(lastEventSeq, latestSeq)
        }

        isBridgeConnected = true
        connectionStatus.value = `已同步：${selectedInstanceId.value}`
        setStatusDot('ok')
    } catch (error) {
        if (Number(error?.status) === 404 || String(error?.message || '').includes('404')) {
            isBridgeConnected = false
            selectedInstanceId.value = ''
            window.localStorage.removeItem(STORAGE_INSTANCE_KEY)
            connectionStatus.value = '目標對局已離線，已停止同步並自動刷新清單。'
            setStatusDot('warn')
            await loadInstances()
            return
        }

        isBridgeConnected = false
        connectionStatus.value = `同步失敗：${error.message}`
        setStatusDot('err')
    }
}

function startPolling() {
    if (useWorkerPolling) {
        stopTimer()
        configureWorkerPolling(selectedInstanceId.value, false)
        return
    }
    if (scoreboardTimer) {
        window.clearInterval(scoreboardTimer)
    }
    scoreboardTimer = window.setInterval(() => {
        pollScoreboard(true).catch(() => { })
    }, SCOREBOARD_POLL_MS)
}

function stopTimer() {
    if (scoreboardTimer) {
        window.clearInterval(scoreboardTimer)
        scoreboardTimer = null
    }
}

function startInstanceRefresh() {
    if (instanceListTimer) {
        window.clearInterval(instanceListTimer)
    }
    instanceListTimer = window.setInterval(() => {
        if (!selectedInstanceId.value || !isBridgeConnected) {
            loadInstances().catch(() => { })
        }
    }, INSTANCE_REFRESH_MS)
}

async function refreshInstances() {
    await loadInstances()
    if (selectedInstanceId.value) {
        await pollScoreboard(true)
    }
}

async function reconnect() {
    await loadInstances()
    if (selectedInstanceId.value) {
        await pollScoreboard(true)
    }
}

async function handleInstanceChange() {
    if (!selectedInstanceId.value) {
        return
    }
    await selectInstance(selectedInstanceId.value)
}

onMounted(() => {
    loadInstances().catch(() => { })
    startInstanceRefresh()
    initPollingWorker()
    if (selectedInstanceId.value) {
        pollScoreboard(true).catch(() => { })
        startPolling()
    }
    // Mirror state to localStorage once per second (matches the original render.js).
    syncTimer = window.setInterval(syncState, 1000)
})

onBeforeUnmount(() => {
    if (scoreboardTimer) {
        window.clearInterval(scoreboardTimer)
    }
    if (instanceListTimer) {
        window.clearInterval(instanceListTimer)
    }
    if (syncTimer) {
        window.clearInterval(syncTimer)
    }
    if (pollingWorker) {
        pollingWorker.terminate()
        pollingWorker = null
    }
})
</script>

<template>
    <div id="app" class="flex min-h-screen w-[1920px] flex-col text-slate-100">
        <div id="main" class="flex justify-center">
            <div class="relative h-[1080px] w-[1920px] bg-black">
                <pre id="game-status"
                    class="absolute left-3 top-3 h-[1080px] w-[560px] whitespace-pre-wrap text-[18px] text-white truncate">{{ gameStatusText }}</pre>
                <pre id="game-event"
                    class="absolute left-[600px] h-[1080px] top-3 w-[560px] whitespace-pre-wrap text-[18px] text-white truncate">{{ gameEventText }}</pre>
            </div>
        </div>

        <div class="flex flex-wrap items-center gap-3 bg-slate-800 px-4 py-3 text-[30px]">
            <button @click="refreshInstances" class="bg-amber-200 p-2 text-black">重新整理清單</button>

            <label class="flex items-center gap-3">
                index.html
                <select class="rounded bg-slate-100 px-3 py-2 text-slate-900" :disabled="!instanceList.length"
                    v-model="selectedInstanceId" @change="handleInstanceChange">
                    <option value="" disabled>
                        {{ instanceList.length ? '請選擇一個已連線的 index.html' : '尚未偵測到任何 index.html' }}
                    </option>
                    <option v-for="instance in instanceList" :key="instance.instanceId" :value="instance.instanceId">
                        {{ formatInstanceLabel(instance) }}
                    </option>
                </select>
            </label>

            <button @click="reconnect" class="bg-amber-200 p-2 text-black">重新連線</button>
        </div>

        <div class="flex w-[1920px] flex-wrap items-center justify-between gap-3 bg-slate-800 px-4 py-3 text-[30px]">
            <div class="flex items-center gap-3">
                <span class="h-[30px] w-[30px] rounded-full" :class="statusDotClass"></span>
                <span>{{ connectionStatus }}</span>
            </div>
            <div class="flex items-center gap-3">
                <span>{{ snapshotStatus }}</span>
                <span>{{ eventStatus }}</span>
            </div>
        </div>
    </div>
</template>
