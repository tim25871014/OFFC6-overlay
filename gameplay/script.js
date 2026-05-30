const ws = ConnectSocket();

const { createApp, ref, computed } = Vue;

const mapInfo = createApp({ setup() {
    const AR = ref(0);
    const CS = ref(0);
    const OD = ref(0);
    const SR = ref(0);
    const BPM = ref(0);
    const LEN = ref(0);
    const Title = ref("");
    const Artist = ref("");
    const Creator = ref("");
    const Difficulty = ref("");
    const mapId = ref(0);
    const setId = ref(0);
    const BGUrl = ref("");
    const MapIdentifier = ref("");

    const mapStats = computed(() => ([
        { label: 'AR', value: AR.value },
        { label: 'CS', value: CS.value },
        { label: 'OD', value: OD.value },
        { label: 'BPM', value: BPM.value },
        { label: 'LEN', value: LEN.value },
        { label: 'SR', value: SR.value }
    ]));

    return {
        AR, CS, OD, SR, BPM, LEN, 
        Title, Artist, Creator, Difficulty, mapId, setId, BGUrl, MapIdentifier,
        mapStats
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

    const scoreBarStyle = (barWidth, borderWidth = 0) => {
        const totalWidth = barWidth + borderWidth;
        const width = Math.abs(totalWidth);
        const sameDirection = Math.sign(barWidth) === Math.sign(borderWidth) || borderWidth === 0;
        const offset = sameDirection ? 0 : -borderWidth;

        if (totalWidth >= 0) {
            return {
                left: '50%',
                transform: `translateX(-100%) translateX(${offset}px)` ,
                width: `${width}px`,
                borderBottomLeftRadius: '5px'
            };
        }

        return {
            left: '50%',
            transform: `translateX(${offset}px)` ,
            width: `${width}px`,
            borderBottomRightRadius: '5px'
        };
    };

    const scoreBorderStyle = (value) => {
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
    const showAd = computed(() => adImages.value.length > 0);
    let adTimer = null;
    let fadeTimer = null;

    const setAd = (index) => {
        adIndex.value = index;
        currentAdUrl.value = adImages.value[index] || '';
        adOpacity.value = 1;
    };

    const clearTimers = () => {
        if (adTimer) clearInterval(adTimer);
        if (fadeTimer) clearTimeout(fadeTimer);
        adTimer = null;
        fadeTimer = null;
    };

    const swapAd = () => {
        if (!adImages.value.length) return setAd(0);
        adOpacity.value = 0;
        if (fadeTimer) clearTimeout(fadeTimer);
        fadeTimer = setTimeout(() => {
            setAd((adIndex.value + 1) % adImages.value.length);
        }, 250);
    };

    const startRotation = () => {
        clearTimers();
        if (!adImages.value.length) return setAd(0);
        setAd(adIndex.value);
        if (adImages.value.length > 1) adTimer = setInterval(swapAd, 20000);
    };

    const preloadAds = (files) => {
        if (!Array.isArray(files) || files.length === 0) return Promise.resolve([]);
        const urls = files.map(file => `../_data/img/ad/${file}`);
        return Promise.all(urls.map((url) => new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(url);
            img.onerror = () => resolve(null);
            img.src = url;
        }))).then(results => results.filter(Boolean));
    };

    fetch('../_data/img/ad/ad-list.json')
        .then(res => res.json()).then(preloadAds).then(validUrls => {
            adImages.value = validUrls;
            startRotation(); })
        .catch(() => { adImages.value = []; startRotation(); });

    return { currentAdUrl, adOpacity, showAd };
}}).mount('#advertisment');

/////////////////////////////////////////////////////////////

// main function
let mappools = {}, pool = {}, teams = [];
(async () => {
    mappools = await fetch('../_data/config/mappools.json').then(res => res.json());
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
        .filter(item => !(item?.message || '').startsWith('Match history'))
        .map(item => ({
            timestamp: item?.timestamp || '',
            name: item?.name || '',
            message: item?.message || '',
            team: item?.team || ''
        }))
        .reverse();
    
}

function updateStageInfo() {
    const stage = mappools?.current_stage || "Unknown Stage";
    // 從 mappools.mappools 找到 stage = current_stage 的物件
    pool = mappools?.mappools?.find(p => p.stage === stage);
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

    const beatmap = pool?.beatmaps?.find(b => b.beatmap_id === beatmapMng.id);
    mapInfo.MapIdentifier = beatmap ? beatmap.identifier : "EX";

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
    const barWidth = mapScoreWidth(redTeamScore - blueTeamScore);
    scoreInfo.BarWidth = barWidth;
    scoreInfo.BorderWidth = 2 * getBarWidthDelta(barWidth);
}

const barWidthHistory = [];
let lastBarWidth = 0;
let lastBarWidthChangeAt = Date.now();
function getBarWidthDelta(currentWidth) {
    const now = Date.now();
    barWidthHistory.push({ t: now, value: currentWidth });

    const epsilon = 0.1;
    if (Math.abs(currentWidth - lastBarWidth) > epsilon) {
        lastBarWidth = currentWidth;
        lastBarWidthChangeAt = now;
    }

    if (now - lastBarWidthChangeAt > 2000) return 0;

    const cutoff = now - 1000;
    while (barWidthHistory.length && barWidthHistory[0].t < now - 1000) {
        barWidthHistory.shift();
    }

    let pastValue = barWidthHistory[0]?.value ?? currentWidth;
    for (let i = barWidthHistory.length - 1; i >= 0; i--) {
        if (barWidthHistory[i].t <= cutoff) {
            pastValue = barWidthHistory[i].value;
            break;
        }
    }

    return currentWidth - pastValue;
}

function mapScoreWidth(x) {
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

function mapForceWidth(x) {
    let width;
    if (!controlPanel.comboMode) {
        width = 200 * Math.tanh(x / 300000);
    } else {
        width = 5 * Math.sign(x);
    }
    if (width > 15) return 15;
    else if (width < -15) return -15;
    else return width;
}

function updateTeamInfo(tourneyMng) {
    teamInfo.RedTeamName = tourneyMng?.team?.left || "Red Team";
    teamInfo.BlueTeamName = tourneyMng?.team?.right || "Blue Team";
    teamInfo.showAtk = tourneyMng?.scoreVisible === true;
    // 要去 teams.json 找對應隊伍的 avatar，沒有就用空字串
    let redTeamData = teams.find(team => team.teamName === teamInfo.RedTeamName);
    let blueTeamData = teams.find(team => team.teamName === teamInfo.BlueTeamName);
    teamInfo.RedTeamAvatar = "../_data/img/avatar/" + (redTeamData ? redTeamData.avatar : "");
    teamInfo.BlueTeamAvatar = "../_data/img/avatar/" + (blueTeamData ? blueTeamData.avatar : "");
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
