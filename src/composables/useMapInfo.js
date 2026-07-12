import { reactive } from 'vue'
import { getConfig } from '../lib/config'
import { formatTime, convertAR, convertCS, convertOD, convertedTime } from '../lib/osu'

// tosu serves local beatmap files over HTTP on the same host as the websocket.
// Build the background URL from folders.beatmap + files.background so it works for
// unsubmitted maps too (beatmap.set === -1, no assets.ppy.sh cover).
export function tosuBgUrl(folders, files) {
    if (!folders?.beatmap || !files?.background) return ''
    const base = getConfig().tosuSocketUrl.replace(/^ws/, 'http').replace(/\/websocket.*$/, '')
    const rel = `${folders.beatmap}/${files.background}`.replace(/\\/g, '/')
    const path = rel.split('/').map(encodeURIComponent).join('/')
    return `${base}/files/beatmap/${path}`
}

// Prefer the osu! CDN cover for submitted maps; only fall back to tosu's local
// file server when there is no set id (unsubmitted maps report set === -1).
export function beatmapBgUrl(setId, folders, files) {
    if (setId > 0) return `https://assets.ppy.sh/beatmaps/${setId}/covers/cover.jpg`
    return tosuBgUrl(folders, files)
}

// Shared beatmap / now-playing state for the gameplay & showcase overlays.
// `pool` is the current pool computed from useConfig(). `onMapChange` (optional)
// fires once per map switch — e.g. to refresh the strain graph.
export function useMapInfo(pool, { onMapChange } = {}) {
    const mapInfo = reactive({
        AR: 0, CS: 0, OD: 0, SR: 0, BPM: 0, LEN: 0,
        Title: '', Artist: '', Creator: '', Difficulty: '',
        mapId: 0, setId: 0, BGUrl: '', MapIdentifier: '',
    })

    // match by beatmap_id first; if that misses (e.g. re-uploaded id), fall back
    // to matching title + artist + version
    const findPoolBeatmap = ({ id, title, artist, version }) => {
        const beatmaps = pool.value?.beatmaps
        if (!beatmaps) return undefined
        return (
            beatmaps.find((b) => b.beatmap_id === id) ||
            beatmaps.find((b) => b.title === title) // && b.artist === artist && b.version === version)
        )
    }

    function updateMapData(beatmapMng, folders, files) {
        const beatmap = findPoolBeatmap({
            id: beatmapMng.id,
            title: beatmapMng.title,
            artist: beatmapMng.artist,
            version: beatmapMng.version,
        })
        mapInfo.MapIdentifier = beatmap ? beatmap.identifier : 'EX'
        const mapMods = beatmap ? beatmap.mods : ''

        if (mapInfo.MapIdentifier == 'EX') {
            mapInfo.AR = beatmapMng.stats.ar.original.toFixed(1)
            mapInfo.CS = beatmapMng.stats.cs.original.toFixed(1)
            mapInfo.OD = beatmapMng.stats.od.original.toFixed(1)
            mapInfo.SR = beatmapMng.stats.stars.total.toFixed(2)
            mapInfo.BPM = beatmapMng.stats.bpm.common.toFixed(0)
            mapInfo.LEN = formatTime(beatmapMng.time.lastObject - beatmapMng.time.firstObject)
        } else {
            mapInfo.AR = convertAR(beatmapMng.stats.ar.original, mapMods).toFixed(1)
            mapInfo.CS = convertCS(beatmapMng.stats.cs.original, mapMods).toFixed(1)
            mapInfo.OD = convertOD(beatmapMng.stats.od.original, mapMods).toFixed(1)
            mapInfo.SR = beatmap.sr.toFixed(2)
            mapInfo.BPM = beatmap.bpm.toFixed(0)
            mapInfo.LEN = formatTime(
                convertedTime(beatmapMng.time.lastObject - beatmapMng.time.firstObject, mapMods),
            )
        }

        mapInfo.Title = beatmapMng.title
        mapInfo.Artist = beatmapMng.artist
        mapInfo.Creator = beatmapMng.mapper
        mapInfo.Difficulty = beatmapMng.version

        const bgUrl = beatmapBgUrl(beatmapMng.set, folders, files)
        // treat a changed background as a map change too, since unsubmitted maps
        // all report id/set === -1 and would otherwise never refresh
        if (beatmapMng.id != mapInfo.mapId || mapInfo.BGUrl !== bgUrl) {
            mapInfo.mapId = beatmapMng.id
            mapInfo.setId = beatmapMng.set
            mapInfo.BGUrl = bgUrl
            onMapChange?.()
        }
    }

    return { mapInfo, updateMapData, findPoolBeatmap }
}
