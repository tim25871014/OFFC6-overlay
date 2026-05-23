const ws = ConnectSocket();

const { createApp, ref } = Vue;

const mapInfo = createApp({ setup() {
    return {
        AR: ref(0),
        CS: ref(0),
        OD: ref(0),
        SR: ref(0),
        mapId: ref(0),
        setId: ref(0),
        BGUrl: ref("")
    }
}}).mount('#map-info');

const scoreInfo = createApp({ setup() {
    return {
        RedScore: ref(0),
        BlueScore: ref(0),
        BarWidth: ref(0)
    }
}}).mount('#score-info');

/////////////////////////////////////////////////////////////

let wsdata = {}; // for debugging purposes
ws.onmessage = (event) => {
    let data = JSON.parse(event.data);
    wsdata = data;
    let beatmapMng = data.beatmap;
    let tourneyMng = data.tourney;
    updateMapData(beatmapMng);
    updateScoreData(tourneyMng);
};

function updateMapData(beatmapMng) {
    mapInfo.AR = beatmapMng.stats.ar.converted;
    mapInfo.CS = beatmapMng.stats.cs.converted;
    mapInfo.OD = beatmapMng.stats.od.converted;
    mapInfo.SR = beatmapMng.stats.stars.total;

    if (beatmapMng.id != mapInfo.mapId) { // map has changed
        mapInfo.mapId = beatmapMng.id;
        mapInfo.setId = beatmapMng.set;
        mapInfo.BGUrl = `https://assets.ppy.sh/beatmaps/${beatmapMng.set}/covers/cover.jpg`;
    }

}

function updateScoreData(tourneyMng) {
    let teamSize = 2;
    let clients = tourneyMng.clients;

    // client 這個陣列的前 teamSize 個元素是紅隊，後 teamSize 個元素是藍隊
    let redTeam = clients.slice(0, teamSize);
    let blueTeam = clients.slice(teamSize, teamSize * 2);

    // 計算隊伍總分，分數在 clients[i].play.score
    let redTeamScore = redTeam.reduce((sum, client) => sum + client.play.score, 0);
    let blueTeamScore = blueTeam.reduce((sum, client) => sum + client.play.score, 0);

    scoreInfo.RedScore = redTeamScore;
    scoreInfo.BlueScore = blueTeamScore;
    scoreInfo.BarWidth = Math.max(redTeamScore, blueTeamScore) / 1000000 * 100;
    
}

// 讀取 LocalStorage 中的 game-state，並更新畫面
let gameStatus = {};
let gameEvent = [];
function loadGameState(value) {
    if (!value) return;
    const newState = JSON.parse(value);
    gameStatus = newState.gameStatus || {};
    gameEvent = newState.gameEvent || [];
}
loadGameState(localStorage.getItem('game-state'));
window.addEventListener("storage", (event) => {
    if (event.key === "game-state") loadGameState(event.newValue);
});