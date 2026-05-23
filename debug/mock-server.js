const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = '127.0.0.1';
const PORT = 8383;
const INSTANCE_ID = 'mock-instance';

const statusPath = path.join(__dirname, 'example_status.json');
const eventPath = path.join(__dirname, 'example_event.json');

function readJson(filePath, fallback) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        console.error(`[mock-server] Failed to read ${filePath}:`, error.message);
        return fallback;
    }
}

function sendJson(res, statusCode, payload) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(JSON.stringify(payload));
}

function handleInstances(res) {
    sendJson(res, 200, {
        instances: [
            {
                instanceId: INSTANCE_ID,
                teamNames: {
                    red: 'Red Team',
                    blue: 'Blue Team'
                }
            }
        ]
    });
}

function handleState(req, res, requestUrl) {
    const sinceSeq = Number(requestUrl.searchParams.get('sinceSeq') || 0);

    const snapshot = readJson(statusPath, {});
    const events = readJson(eventPath, []).filter(eventItem => {
        return typeof eventItem?.seq === 'number' && eventItem.seq > sinceSeq;
    });

    sendJson(res, 200, {
        snapshot,
        events
    });
}

const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url, `http://${HOST}:${PORT}`);

    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }

    if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'Method Not Allowed' });
        return;
    }

    if (requestUrl.pathname === '/api/scoreboard/instances') {
        handleInstances(res);
        return;
    }

    if (requestUrl.pathname === '/api/scoreboard/state') {
        handleState(req, res, requestUrl);
        return;
    }

    sendJson(res, 404, { error: 'Not Found' });
});

server.listen(PORT, HOST, () => {
    console.log(`[mock-server] Listening on http://${HOST}:${PORT}`);
    if (process.argv.includes('--self-test')) {
        runSelfTest(server);
    }
});

function runSelfTest(activeServer) {
    const testUrl = `http://${HOST}:${PORT}/api/scoreboard/state?instanceId=${INSTANCE_ID}&sinceSeq=0`;
    http.get(testUrl, res => {
        let body = '';
        res.on('data', chunk => {
            body += chunk;
        });
        res.on('end', () => {
            console.log('[mock-server] Self-test response code:', res.statusCode);
            console.log('[mock-server] Self-test body length:', body.length);
            activeServer.close();
        });
    }).on('error', error => {
        console.error('[mock-server] Self-test failed:', error.message);
        activeServer.close();
    });
}
