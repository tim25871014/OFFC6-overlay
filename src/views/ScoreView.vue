<script>
// Bridge control console: polls the scoreboard bridge server (URL from
// _data/config/endpoints.json, or the mock from `npm run mock:bridge`) and mirrors
// the latest state into localStorage['game-state'], which the gameplay/actions/winner
// overlays read.
import { getConfig } from '../lib/config'

const STORAGE_INSTANCE_KEY = 'offc6-score-selected-instance'
const INSTANCE_REFRESH_MS = 5000
const SCOREBOARD_POLL_MS = 2000
const MAX_EVENT_LOG = 200

export default {
    data() {
        return {
            bridgeBaseUrl: getConfig().bridgeBaseUrl,
            selectedInstanceId: String(window.localStorage.getItem(STORAGE_INSTANCE_KEY) || '').trim(),
            instanceList: [],
            instanceListTimer: null,
            scoreboardTimer: null,
            syncTimer: null,
            pollingWorker: null,
            useWorkerPolling: false,
            lastEventSeq: 0,
            lastSnapshotSignature: '',
            isBridgeConnected: false,
            gameStatus: {},
            gameEvent: [],
            connectionStatus: '等待選擇可連線的 index.html。',
            snapshotStatus: 'game_status 尚未同步',
            eventStatus: 'game_event 0 筆',
            statusDot: 'warn',
        }
    },
    computed: {
        statusDotClass() {
            if (this.statusDot === 'ok') return 'bg-emerald-400'
            if (this.statusDot === 'err') return 'bg-rose-400'
            return 'bg-amber-400'
        },
        gameStatusText() {
            return JSON.stringify(this.gameStatus || {}, null, 4)
        },
        gameEventText() {
            const reversed = [...this.gameEvent].reverse()
            return JSON.stringify(reversed, null, 4)
        },
    },
    mounted() {
        this.loadInstances().catch(() => { })
        this.startInstanceRefresh()
        this.initPollingWorker()
        if (this.selectedInstanceId) {
            this.pollScoreboard(true).catch(() => { })
            this.startPolling()
        }
        // Mirror state to localStorage once per second (matches the original render.js).
        this.syncTimer = window.setInterval(this.syncState, 1000)
    },
    beforeUnmount() {
        if (this.scoreboardTimer) {
            window.clearInterval(this.scoreboardTimer)
        }
        if (this.instanceListTimer) {
            window.clearInterval(this.instanceListTimer)
        }
        if (this.syncTimer) {
            window.clearInterval(this.syncTimer)
        }
        if (this.pollingWorker) {
            this.pollingWorker.terminate()
            this.pollingWorker = null
        }
    },
    methods: {
        syncState() {
            const state = { gameStatus: this.gameStatus, gameEvent: this.gameEvent }
            try {
                window.localStorage.setItem('game-state', JSON.stringify(state))
            } catch {
                /* ignore quota/serialisation errors */
            }
        },
        apiUrl(path) {
            return `${this.bridgeBaseUrl}${path}`
        },
        async requestJson(path, options = {}) {
            const response = await fetch(this.apiUrl(path), {
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
        },
        shallowStatusSignature(nextStatus) {
            try {
                return JSON.stringify(nextStatus || {})
            } catch {
                return String(Date.now())
            }
        },
        setStatusDot(mode) {
            this.statusDot = mode === 'ok' ? 'ok' : mode === 'err' ? 'err' : 'warn'
        },
        initPollingWorker() {
            if (!window.Worker) {
                this.useWorkerPolling = false
                return
            }

            try {
                this.pollingWorker = new Worker(new URL('../workers/bridge-worker.js', import.meta.url), {
                    type: 'module',
                })
                this.useWorkerPolling = true
            } catch {
                this.pollingWorker = null
                this.useWorkerPolling = false
                return
            }

            this.pollingWorker.onmessage = (event) => {
                this.handleWorkerMessage(event.data)
            }
            this.pollingWorker.onerror = (error) => {
                this.useWorkerPolling = false
                this.pollingWorker?.terminate()
                this.pollingWorker = null
                this.connectionStatus = `背景同步失敗：${error?.message || 'worker error'}`
                this.setStatusDot('err')
            }

            if (this.selectedInstanceId) {
                this.configureWorkerPolling(this.selectedInstanceId, true)
            }
        },
        configureWorkerPolling(instanceId, reset = false) {
            if (!this.pollingWorker) {
                return
            }
            this.pollingWorker.postMessage({
                type: 'configure',
                baseUrl: this.bridgeBaseUrl,
                instanceId: String(instanceId || '').trim(),
                pollMs: SCOREBOARD_POLL_MS,
                reset,
            })
        },
        requestWorkerPoll(force = false) {
            if (!this.pollingWorker) {
                return
            }
            this.pollingWorker.postMessage({ type: 'pollOnce', force })
        },
        stopWorkerPolling() {
            if (!this.pollingWorker) {
                return
            }
            this.pollingWorker.postMessage({ type: 'stop' })
        },
        handleWorkerMessage(payload) {
            if (!payload || typeof payload !== 'object') {
                return
            }

            console.log('[worker]', payload.type, payload?.events?.length ?? '', payload.force ? 'force' : '')

            if (payload.type === 'snapshot') {
                this.setGameStatus(payload.snapshot)
                return
            }

            if (payload.type === 'events') {
                if (Array.isArray(payload.events) && payload.events.length) {
                    this.setGameEvents(payload.events, Boolean(payload.force))
                }
                return
            }

            if (payload.type === 'connected') {
                this.isBridgeConnected = true
                this.connectionStatus = `已同步：${payload.instanceId}`
                this.setStatusDot('ok')
                return
            }

            if (payload.type === 'gone') {
                this.isBridgeConnected = false
                this.selectedInstanceId = ''
                window.localStorage.removeItem(STORAGE_INSTANCE_KEY)
                this.connectionStatus = '目標對局已離線，已停止同步並自動刷新清單。'
                this.setStatusDot('warn')
                this.loadInstances().catch(() => { })
                return
            }

            if (payload.type === 'error') {
                this.isBridgeConnected = false
                this.connectionStatus = `同步失敗：${payload.message}`
                this.setStatusDot('err')
            }
        },
        updateStatusText() {
            this.snapshotStatus = this.gameStatus?.updatedAt
                ? `game_status 已更新：${new Date(this.gameStatus.updatedAt).toLocaleString('zh-TW', { hour12: false })}`
                : 'game_status 已同步'
            this.connectionStatus = this.selectedInstanceId
                ? `已連線：${this.selectedInstanceId}`
                : '等待選擇可連線的 index.html。'
        },
        updateEventText() {
            this.eventStatus = `game_event ${this.gameEvent.length} 筆`
            this.syncState()
        },
        setGameStatus(nextStatus) {
            const signature = this.shallowStatusSignature(nextStatus)
            if (signature === this.lastSnapshotSignature) {
                return false
            }
            this.lastSnapshotSignature = signature
            this.gameStatus = nextStatus && typeof nextStatus === 'object' ? nextStatus : {}
            this.updateStatusText()
            this.syncState()
            return true
        },
        appendGameEvent(eventItem) {
            if (!eventItem || typeof eventItem !== 'object') {
                return false
            }

            this.gameEvent = [...this.gameEvent, eventItem].slice(-MAX_EVENT_LOG)
            this.updateEventText()
            return true
        },
        setGameEvents(eventItems, force = false) {
            const list = Array.isArray(eventItems) ? eventItems : []
            if (!list.length) {
                return false
            }

            if (force) {
                // Merge/replace by seq so modified old events are applied
                const existingBySeq = new Map()
                for (const ev of this.gameEvent) {
                    const s = Number(ev?.seq)
                    if (Number.isFinite(s)) existingBySeq.set(s, ev)
                }

                for (const item of list) {
                    const s = Number(item?.seq)
                    if (!Number.isFinite(s)) continue
                    existingBySeq.set(s, item)
                    this.lastEventSeq = Math.max(this.lastEventSeq, s)
                }

                // Rebuild ordered array
                const merged = Array.from(existingBySeq.entries())
                    .sort((a, b) => a[0] - b[0])
                    .map(([, v]) => v)
                    .slice(-MAX_EVENT_LOG)

                this.gameEvent = merged
                this.updateEventText()
                console.log('[events] merged, total=', this.gameEvent.length)
                return true
            }

            let changed = false
            for (const item of list) {
                const seq = Number(item?.seq)
                if (Number.isFinite(seq) && seq > this.lastEventSeq) {
                    this.appendGameEvent(item)
                    this.lastEventSeq = seq
                    changed = true
                }
            }
            if (changed) console.log('[events] appended, lastSeq=', this.lastEventSeq)
            return changed
        },
        formatInstanceLabel(instance) {
            const redName = instance?.teamNames?.red || '紅隊'
            const blueName = instance?.teamNames?.blue || '藍隊'
            return `${redName} / ${blueName} (${instance.instanceId.slice(0, 8)})`
        },
        async loadInstances() {
            try {
                const payload = await this.requestJson('/api/scoreboard/instances')
                this.instanceList = Array.isArray(payload.instances) ? payload.instances : []

                if (this.selectedInstanceId) {
                    const stillExists = this.instanceList.some(
                        (instance) => String(instance?.instanceId || '') === this.selectedInstanceId,
                    )
                    if (!stillExists) {
                        this.selectedInstanceId = ''
                        window.localStorage.removeItem(STORAGE_INSTANCE_KEY)
                        this.isBridgeConnected = false
                        if (this.useWorkerPolling) {
                            this.stopWorkerPolling()
                        }
                    }
                }

                if (!this.selectedInstanceId && this.instanceList.length === 1) {
                    await this.selectInstance(this.instanceList[0].instanceId)
                }

                if (!this.selectedInstanceId) {
                    this.connectionStatus = this.instanceList.length
                        ? '請從選單選擇要同步的 index.html。'
                        : '尚未偵測到任何 index.html。'
                    this.isBridgeConnected = false
                    if (this.useWorkerPolling) {
                        this.stopWorkerPolling()
                    }
                }

                this.setStatusDot('warn')
            } catch (error) {
                this.isBridgeConnected = false
                this.connectionStatus = `無法連線到 bridge server：${error.message}`
                this.setStatusDot('err')
            }
        },
        async selectInstance(instanceId) {
            this.selectedInstanceId = String(instanceId || '').trim()
            window.localStorage.setItem(STORAGE_INSTANCE_KEY, this.selectedInstanceId)
            this.lastEventSeq = 0
            this.gameEvent = []
            this.isBridgeConnected = false
            this.updateEventText()
            this.updateStatusText()
            if (this.useWorkerPolling) {
                this.configureWorkerPolling(this.selectedInstanceId, true)
            }
            await this.pollScoreboard(true)
            this.startPolling()
        },
        async pollScoreboard(force = false) {
            if (!this.selectedInstanceId) {
                return
            }

            if (this.useWorkerPolling) {
                this.requestWorkerPoll(force)
                return
            }

            try {
                const payload = await this.requestJson(
                    `/api/scoreboard/state?instanceId=${encodeURIComponent(this.selectedInstanceId)}&sinceSeq=${force ? 0 : this.lastEventSeq}`,
                )
                if (payload && typeof payload.snapshot === 'object' && payload.snapshot) {
                    this.setGameStatus(payload.snapshot)
                }

                if (Array.isArray(payload?.events) && payload.events.length) {
                    this.setGameEvents(payload.events)
                    const latestSeq = payload.events.reduce(
                        (max, eventItem) => Math.max(max, Number(eventItem.seq) || 0),
                        this.lastEventSeq,
                    )
                    this.lastEventSeq = Math.max(this.lastEventSeq, latestSeq)
                }

                this.isBridgeConnected = true
                this.connectionStatus = `已同步：${this.selectedInstanceId}`
                this.setStatusDot('ok')
            } catch (error) {
                if (Number(error?.status) === 404 || String(error?.message || '').includes('404')) {
                    this.isBridgeConnected = false
                    this.selectedInstanceId = ''
                    window.localStorage.removeItem(STORAGE_INSTANCE_KEY)
                    this.connectionStatus = '目標對局已離線，已停止同步並自動刷新清單。'
                    this.setStatusDot('warn')
                    await this.loadInstances()
                    return
                }

                this.isBridgeConnected = false
                this.connectionStatus = `同步失敗：${error.message}`
                this.setStatusDot('err')
            }
        },
        startPolling() {
            if (this.useWorkerPolling) {
                this.stopTimer()
                this.configureWorkerPolling(this.selectedInstanceId, false)
                return
            }
            if (this.scoreboardTimer) {
                window.clearInterval(this.scoreboardTimer)
            }
            this.scoreboardTimer = window.setInterval(() => {
                this.pollScoreboard(true).catch(() => { })
            }, SCOREBOARD_POLL_MS)
        },
        stopTimer() {
            if (this.scoreboardTimer) {
                window.clearInterval(this.scoreboardTimer)
                this.scoreboardTimer = null
            }
        },
        startInstanceRefresh() {
            if (this.instanceListTimer) {
                window.clearInterval(this.instanceListTimer)
            }
            this.instanceListTimer = window.setInterval(() => {
                if (!this.selectedInstanceId || !this.isBridgeConnected) {
                    this.loadInstances().catch(() => { })
                }
            }, INSTANCE_REFRESH_MS)
        },
        async refreshInstances() {
            await this.loadInstances()
            if (this.selectedInstanceId) {
                await this.pollScoreboard(true)
            }
        },
        async reconnect() {
            await this.loadInstances()
            if (this.selectedInstanceId) {
                await this.pollScoreboard(true)
            }
        },
        async handleInstanceChange() {
            if (!this.selectedInstanceId) {
                return
            }
            await this.selectInstance(this.selectedInstanceId)
        },
    },
}
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
