const ws = ConnectSocket();

const { createApp, ref } = Vue;

const mapInfo = createApp({ setup() {
    return {
        AR: ref(0),
        CS: ref(0),
        OD: ref(0),
        SR: ref(0),
        BPM: ref(0),
        LEN: ref(0),
        Title: ref(""),
        Artist: ref(""),
        Creator: ref(""),
        Difficulty: ref(""),
        mapId: ref(0),
        setId: ref(0),
        BGUrl: ref("")
    }
}}).mount('#map-info');

const StageInfo = createApp({ setup() {
    return {
        Stage: ref("")
    }
}}).mount('#stage');

const scoreInfo = createApp({ setup() {
    
    const formatNumber = (value) => {
        return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    const scoreBarStyle = (value) => {
        const width = Math.abs(value);
        if (value >= 0) { 
            return { left: '50%', transform: 'translateX(-100%)', width: `${width}px`, borderBottomLeftRadius: '20px' };
        } else return { left: '50%', width: `${width}px`, borderBottomRightRadius: '20px'};
    };

    const scoreBorderStyle = (value) => {
        console.log("BorderWidth:", value);
        const width = Math.abs(value);
        if (value >= 0) { 
            return { borderLeft: `${width}px solid #E57373` };
        } else return { borderRight: `${width}px solid #64B5F6` };
    };

    const scoreSize = (value) => {
        if (value >= 0) { return { fontSize: '38px', transform: 'translateY(-4px)' };
        } else return { fontSize: '25px', transform: 'translateY(2px)' }; 
    }

    return {
        RedScore: ref(0),
        BlueScore: ref(0),
        BarWidth: ref(0),
        BorderWidth: ref(0),
        formatNumber,
        scoreBarStyle,
        scoreSize,
        scoreBorderStyle
    }
}}).mount('#score-info');

const teamInfo = createApp({ setup() {
    const hpColor = (percent) => {
        const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
        const hue = (clamped / 100) * 120;
        return `hsl(${hue}, 80%, 45%)`;
    };

    return {
        RedTeamName: ref(""),
        BlueTeamName: ref(""),
        RedTeamHP: ref(0),
        BlueTeamHP: ref(0),
        RedTeamAvatar: ref(""),
        BlueTeamAvatar: ref(""),
        RedTeamHPPercent: ref(100),
        BlueTeamHPPercent: ref(100),
        MaxHP: ref(0),
        RedTeamATK: ref(0),
        BlueTeamATK: ref(0),
        showAtk: ref(false),
        hpColor
    }
}}).mount('#team-info');

const controlPanel = createApp({ setup() {

    const toggleComboMode = () => {
        controlPanel.comboMode = !controlPanel.comboMode;
    };

    const toggleChat = () => {
        controlPanel.chatMode = !controlPanel.chatMode;
    }

    return {
        comboMode: ref(false),
        chatMode: ref(false),
        toggleComboMode,
        toggleChat
    }
}}).mount('#control-panel');

const chatInfo = createApp({ setup() {
    return {
        messages: ref([]),
        showChat: ref(false)
    }
}}).mount('#chat');

const adInfo = createApp({ setup() {
    const adImages = ref([]);
    const adIndex = ref(0);
    const currentAdUrl = ref('');
    const adOpacity = ref(1);
    let adTimer = null;
    let fadeTimer = null;

    const swapAd = () => {
        if (!adImages.value.length) return currentAdUrl.value = '', adOpacity.value = 1;
        adOpacity.value = 0;
        if (fadeTimer) clearTimeout(fadeTimer);
        fadeTimer = setTimeout(() => {
            adIndex.value = (adIndex.value + 1) % adImages.value.length;
            currentAdUrl.value = adImages.value[adIndex.value] || '';
            adOpacity.value = 1;
        }, 250);
    };

    const startRotation = () => {
        if (adTimer) clearInterval(adTimer);
        if (!adImages.value.length) return currentAdUrl.value = '', adOpacity.value = 1;
        currentAdUrl.value = adImages.value[adIndex.value] || '';
        adOpacity.value = 1;
        if (adImages.value.length > 1) {
            adTimer = setInterval(() => { swapAd(); }, 20000);
        }
    };

    fetch('../_data/img/ad/ad-list.json').then(res => res.json()).then(list => {
            adImages.value = Array.isArray(list) ? list.map(file => `../_data/img/ad/${file}`) : [];
            startRotation();
        }).catch(() => {
            adImages.value = [];
            startRotation();
        });

    return {
        currentAdUrl,
        adOpacity
    };
}}).mount('#advertisment');

/////////////////////////////////////////////////////////////

// main function
let mappool = {}, teams = [];
(async () => {
    mappool = await fetch('../_data/config/beatmaps.json').then(res => res.json());
    teams = await fetch('../_data/config/teams.json').then(res => res.json());
    updateStageInfo();
})();

let wsdata = {}; // for debugging purposes
ws.onmessage = (event) => {
    let data = JSON.parse(event.data);
    wsdata = data;
    let beatmapMng = data.beatmap;
    let tourneyMng = data.tourney;
    updateMapData(beatmapMng);
    updateScoreData(tourneyMng);
    updateTeamInfo(tourneyMng);
    updateChat(tourneyMng);
};

function updateChat(tourneyMng) {
    chatInfo.showChat = (tourneyMng?.scoreVisible === false) || controlPanel.chatMode;
    const nextMessages = Array.isArray(tourneyMng?.chat) ? tourneyMng.chat : [];
    chatInfo.messages = nextMessages
        .filter(item => item?.name !== 'BanchoBot')
        .filter(item => !(item?.messageBody || '').startsWith('Match history'))
        .map(item => ({
            time: item?.time || '',
            name: item?.name || '',
            messageBody: item?.messageBody || '',
            team: item?.team || ''
        }))
        .reverse();
    
}

function updateStageInfo() {
    let stage = mappool?.stage || "Unknown Stage";
    StageInfo.Stage = stage;
}

function updateMapData(beatmapMng) {
    mapInfo.AR = beatmapMng.stats.ar.converted.toFixed(1);
    mapInfo.CS = beatmapMng.stats.cs.converted.toFixed(1);
    mapInfo.OD = beatmapMng.stats.od.converted.toFixed(1);
    mapInfo.SR = beatmapMng.stats.stars.total.toFixed(2);
    mapInfo.BPM = beatmapMng.stats.bpm.common.toFixed(0);
    mapInfo.LEN = formatTime(beatmapMng.time.lastObject - beatmapMng.time.firstObject);

    mapInfo.Title = beatmapMng.title;
    mapInfo.Artist = beatmapMng.artist;
    mapInfo.Creator = beatmapMng.mapper;
    mapInfo.Difficulty = beatmapMng.version;

    if (beatmapMng.id != mapInfo.mapId) { // map has changed
        mapInfo.mapId = beatmapMng.id;
        mapInfo.setId = beatmapMng.set;
        mapInfo.BGUrl = `https://assets.ppy.sh/beatmaps/${beatmapMng.set}/covers/cover.jpg`;
    }

}

function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function updateScoreData(tourneyMng) {
    let clients = tourneyMng.clients;

    let redTeam = clients.filter(client => client.team === "left");
    let blueTeam = clients.filter(client => client.team === "right");

    // 計算隊伍總分，分數在 clients[i].play.score
    let redTeamScore = 0, blueTeamScore = 0;

    if (!controlPanel.comboMode) {
        redTeamScore = redTeam.reduce((sum, client) => sum + client.play.score, 0);
        blueTeamScore = blueTeam.reduce((sum, client) => sum + client.play.score, 0);
    } else {
        redTeamScore = redTeam.reduce((sum, client) => sum + client.play.combo.max, 0);
        blueTeamScore = blueTeam.reduce((sum, client) => sum + client.play.combo.max, 0);
    }

    // 計算雙方的 clients[i].play.accuracy * clients[i].play.combo.current 總和
    let redTeamComboScore = redTeam.reduce((sum, client) => sum + (client.play.accuracy * client.play.combo.current), 0);
    let blueTeamComboScore = blueTeam.reduce((sum, client) => sum + (client.play.accuracy * client.play.combo.current), 0);

    scoreInfo.RedScore = redTeamScore;
    scoreInfo.BlueScore = blueTeamScore;
    scoreInfo.BarWidth = mapTanh(redTeamScore - blueTeamScore);
    scoreInfo.BorderWidth = (!controlPanel.comboMode) ? 3 * mapTanh(redTeamComboScore - blueTeamComboScore) : 0;
}

function mapTanh(x) {
    let width;
    if (!controlPanel.comboMode) {
        width = 480 * Math.tanh(x / 300000);
    } else {
        width = 480 * Math.tanh(x / 300);
    }
    if (width > 480) return 480;
    else if (width < -480) return -480;
    else return width;
}

function updateTeamInfo(tourneyMng) {
    teamInfo.RedTeamName = tourneyMng?.team?.left || "Red Team";
    teamInfo.BlueTeamName = tourneyMng?.team?.right || "Blue Team";
    teamInfo.showAtk = tourneyMng?.scoreVisible === true;
    // 要去 teams.json 找對應隊伍的 avatar，沒有就用空字串
    let redTeamData = teams.find(team => team.teamName === teamInfo.RedTeamName);
    let blueTeamData = teams.find(team => team.teamName === teamInfo.BlueTeamName);
    teamInfo.RedTeamAvatar = "../_data/avatar/" + (redTeamData ? redTeamData.avatar : "");
    teamInfo.BlueTeamAvatar = "../_data/avatar/" + (blueTeamData ? blueTeamData.avatar : "");
}

/////////////////////////////////////////////////////////////

// 讀取 LocalStorage 中的 game-state，並更新畫面
let gameStatus = {};
let gameEvent = [];

setInterval(() => {
    loadGameState(localStorage.getItem('game-state'));
    updateRefInfo();
}, 1000);

function loadGameState(value) {
    if (!value) return;
    const newState = JSON.parse(value);
    gameStatus = newState.gameStatus || {};
    gameEvent = newState.gameEvent || [];
}

function updateRefInfo() {
    const redTeam = gameStatus?.teams?.red || {};
    const blueTeam = gameStatus?.teams?.blue || {};
    teamInfo.RedTeamHP = redTeam.hp || 0;
    teamInfo.BlueTeamHP = blueTeam.hp || 0;
    teamInfo.RedTeamATK = redTeam.totalAtk || 0;
    teamInfo.BlueTeamATK = blueTeam.totalAtk || 0;
    teamInfo.MaxHP = Math.max(teamInfo.MaxHP, teamInfo.RedTeamHP, teamInfo.BlueTeamHP);
    teamInfo.RedTeamHPPercent = teamInfo.MaxHP > 0 ? (teamInfo.RedTeamHP / teamInfo.MaxHP * 100) : 0;
    teamInfo.BlueTeamHPPercent = teamInfo.MaxHP > 0 ? (teamInfo.BlueTeamHP / teamInfo.MaxHP * 100) : 0;
}
