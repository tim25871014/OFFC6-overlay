const DEFAULT_POLL_MS = 2000;

let baseUrl = '';
let instanceId = '';
let pollMs = DEFAULT_POLL_MS;
let timerId = null;
let lastEventSeq = 0;
let lastSnapshotSignature = '';

function apiUrl(path) {
    return `${baseUrl}${path}`;
}

async function requestJson(path) {
    const response = await fetch(apiUrl(path), {
        credentials: 'omit'
    });

    if (!response.ok) {
        const bodyText = await response.text().catch(() => '');
        const error = new Error(bodyText || `HTTP ${response.status}`);
        error.status = response.status;
        throw error;
    }

    return response.json();
}

function shallowStatusSignature(nextStatus) {
    try {
        return JSON.stringify(nextStatus || {});
    } catch {
        return String(Date.now());
    }
}

function resetState() {
    lastEventSeq = 0;
    lastSnapshotSignature = '';
}

function stopTimer() {
    if (timerId) {
        clearInterval(timerId);
        timerId = null;
    }
}

function startTimer() {
    stopTimer();
    if (!baseUrl || !instanceId) {
        return;
    }
    timerId = setInterval(() => {
        pollScoreboard(true).catch(() => {});
    }, pollMs);
}

function sendMessage(payload) {
    try {
        postMessage(payload);
    } catch {
        // ignore postMessage failures
    }
}

async function pollScoreboard(force = false) {
    if (!baseUrl || !instanceId) {
        return;
    }

    try {
        const payload = await requestJson(`/api/scoreboard/state?instanceId=${encodeURIComponent(instanceId)}&sinceSeq=${force ? 0 : lastEventSeq}`);

        if (payload && typeof payload.snapshot === 'object' && payload.snapshot) {
            const signature = shallowStatusSignature(payload.snapshot);
            if (signature !== lastSnapshotSignature) {
                lastSnapshotSignature = signature;
                sendMessage({ type: 'snapshot', snapshot: payload.snapshot });
            }
        }

        if (Array.isArray(payload?.events) && payload.events.length) {
            if (force) {
                // On forced (full) fetch, send all events so client can merge/replace
                sendMessage({ type: 'events', events: payload.events, force: true });
                // update lastEventSeq to highest seq in payload
                for (const item of payload.events) {
                    const seq = Number(item?.seq);
                    if (Number.isFinite(seq)) {
                        lastEventSeq = Math.max(lastEventSeq, seq);
                    }
                }
            } else {
                const newEvents = [];
                for (const item of payload.events) {
                    const seq = Number(item?.seq);
                    if (Number.isFinite(seq) && seq > lastEventSeq) {
                        newEvents.push(item);
                        lastEventSeq = Math.max(lastEventSeq, seq);
                    }
                }

                if (newEvents.length) {
                    sendMessage({ type: 'events', events: newEvents, force: false });
                }
            }
        }

        sendMessage({ type: 'connected', instanceId });
    } catch (error) {
        const status = Number(error?.status);
        if (status === 404 || String(error?.message || '').includes('404')) {
            sendMessage({ type: 'gone', instanceId });
            instanceId = '';
            stopTimer();
            return;
        }

        sendMessage({ type: 'error', message: error?.message || 'unknown error' });
    }
}

onmessage = event => {
    const payload = event?.data || {};

    if (payload.type === 'configure') {
        baseUrl = String(payload.baseUrl || '').trim();
        instanceId = String(payload.instanceId || '').trim();
        pollMs = Number(payload.pollMs) > 0 ? Number(payload.pollMs) : DEFAULT_POLL_MS;
        if (payload.reset) {
            resetState();
        }
        startTimer();
        pollScoreboard(true).catch(() => {});
        return;
    }

    if (payload.type === 'stop') {
        stopTimer();
        return;
    }

    if (payload.type === 'pollOnce') {
        pollScoreboard(Boolean(payload.force)).catch(() => {});
    }
};
