import { dataPath } from './dataPath'

// Endpoint URLs are read at runtime from _data/config/endpoints.json so they can be
// changed in a deployed dist without rebuilding. loadConfig() runs once at startup
// (see main.js); getConfig() then returns the resolved values synchronously.
const defaults = {
	tosuSocketUrl: 'ws://localhost:24050/websocket/v2',
	bridgeBaseUrl: 'http://localhost:8383',
}

let current = { ...defaults }

export async function loadConfig() {
	try {
		const data = await fetch(dataPath('config/endpoints.json')).then((r) => r.json())
		current = { ...defaults, ...data }
	} catch {
		current = { ...defaults }
	}
	return current
}

export function getConfig() {
	return current
}
