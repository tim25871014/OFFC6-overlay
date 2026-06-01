const ws = ConnectSocket();

const { createApp, ref } = Vue;

const cardNameToId = {
    '發燒': 'D1',
    '猴子': 'D2',
    '緊繃': 'D3',
    '勝利之舞': 'B1',
    '拉進垃圾車': 'B2',
    '黃金的守護者 魔法之光的龍': 'B3'
};

const bdInfo = createApp({ setup() {
    return {
        redBD: ref([]),
        blueBD: ref([])
    };
}}).mount('#bd-group');

const picksInfo = createApp({ setup() {
    const getBeatmap = (identifier) => {
        return picksInfo.beatmapMap?.[identifier] || null;
    };

    return {
        redStadiums: ref([]),
        blueStadiums: ref([]),
        redBans: ref([]),
        blueBans: ref([]),
        redPicks: ref([]),
        bluePicks: ref([]),
        pickCount: ref(0),
        beatmapMap: ref({}),
        TBPicked: ref(false),
        getBeatmap
    };
}}).mount('#picks-group');

const StageInfo = createApp({ setup() {
    return {
        Stage: ref("")
    }
}}).mount('#stage');

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

const chatInfo = createApp({ setup() {
    return {
        messages: ref([]),
        showChat: ref(false)
    }
}}).mount('#chat');

const cardInfo = createApp({ setup() {

    const isBanSectionVisible = (stadium) => {
    if (stadium.banOrder === 0) return true;
    
        const targetBans = stadium.banOrder === 1 
            ? stadium.firstBans 
            : stadium.secondBans;

        return (targetBans[0] + targetBans[1]) === '';
    };

    const thisSlotBanInfo = (stadium, num) => {
        return stadium.banOrder === 1 ? stadium.firstBans[num] : stadium.secondBans[num];
    };

    const thisSlotBanDetail = (stadium, num) => {
        const identifier = thisSlotBanInfo(stadium, num);
        const beatmap = Array.isArray(pool?.beatmaps) ? pool.beatmaps.find(b => b.identifier === identifier) : null;
        if (!identifier || !beatmap) {
            return {
                identifier: '',
                bgUrl: ''
            };
        }
        return ({
            identifier: identifier,
            bgUrl: beatmap?.beatmapset_id
                ? `https://assets.ppy.sh/beatmaps/${beatmap.beatmapset_id}/covers/cover.jpg`
                : ''
        });
    }


    return {
        Cards: ref([]),
        RedStadiums: ref([]),
        BlueStadiums: ref([]),
        isTwoStadiums: ref(false),
        isBanSectionVisible,
        thisSlotBanInfo,
        thisSlotBanDetail
    }
}}).mount('#cards');

const controlPanel = createApp({ setup() {

    const toggleComboMode = () => {
        controlPanel.comboMode = !controlPanel.comboMode;
    };

    const toggleChat = () => {
        controlPanel.chatMode = !controlPanel.chatMode;
    }

    const onStageChange = () => {
        refreshBeatmapOptions();
    };

    const addExBeatmap = () => {
        const index = Number(controlPanel.selectedBeatmapIndex);
        const option = controlPanel.beatmapOptions?.[index];
        if (!option || !pool?.beatmaps) return;

        const exCount = pool.beatmaps.filter(beatmap => /^EX\d+$/i.test(beatmap.identifier)).length;
        const newBeatmap = { ...option.beatmap, identifier: `EX${exCount + 1}` };
        pool.beatmaps = [...pool.beatmaps, newBeatmap];
        refreshMappool();
        resetExSelectors();
    };

    const resetExSelectors = () => {
        controlPanel.selectedStage = '';
        controlPanel.beatmapOptions = [];
        controlPanel.selectedBeatmapIndex = '';
    };

    const removeIdentifierFromLists = (identifier) => {
        picksInfo.redPicks = picksInfo.redPicks.filter(item => item !== identifier);
        picksInfo.bluePicks = picksInfo.bluePicks.filter(item => item !== identifier);
        picksInfo.redBans = picksInfo.redBans.filter(item => item !== identifier);
        picksInfo.blueBans = picksInfo.blueBans.filter(item => item !== identifier);
    };

    const handlePickAction = (event, identifier) => {
        if (event.button !== 0 && event.button !== 2) return;
        const side = event.button === 0 ? 'red' : 'blue';
        removeIdentifierFromLists(identifier);
        if (event.ctrlKey) return;

        const isBan = event.shiftKey;
        if (side === 'red') {
            if (isBan) picksInfo.redBans = [...picksInfo.redBans, identifier];
            else picksInfo.redPicks = [...picksInfo.redPicks, identifier];
        } else {
            if (isBan) picksInfo.blueBans = [...picksInfo.blueBans, identifier];
            else picksInfo.bluePicks = [...picksInfo.bluePicks, identifier];
        }
        updateStadiumInfo();
    };

    const handleTBAction = (event, identifier) => {
        if (event.button !== 0 && event.button !== 2) return;

        if (event.ctrlKey) return picksInfo.TBPicked = false;
        else return picksInfo.TBPicked = true;
    }

    return {
        comboMode: ref(false),
        chatMode: ref(true),
        mappoolButtons: ref([]),
        stages: ref([]),
        selectedStage: ref(''),
        beatmapOptions: ref([]),
        selectedBeatmapIndex: ref(''),
        toggleComboMode, toggleChat, onStageChange,
        addExBeatmap, resetExSelectors, handlePickAction, handleTBAction
    }
}}).mount('#control-panel');

/////////////////////////////////////////////////////////////

// main function
let mappools = {}, pool = {}, teams = [];
(async () => {
    mappools = await fetch('../_data/config/mappools.json').then(res => res.json());
    teams = await fetch('../_data/config/teams.json').then(res => res.json());
    updateStageInfo();
    refreshStageOptions();    
})();


function updateStageInfo() {
    const stage = mappools?.current_stage || "Unknown Stage";
    pool = mappools?.mappools?.find(p => p.stage === stage);
    StageInfo.Stage = stage;
    refreshMappool();
}

function refreshMappool() {
    controlPanel.mappoolButtons = pool?.beatmaps?.map(b => b.identifier).filter(Boolean) || [];
    updateBeatmapMap();
}

function updateBeatmapMap() {
    const beatmaps = Array.isArray(pool?.beatmaps) ? pool.beatmaps : [];
    const nextMap = {};
    beatmaps.forEach((beatmap) => {
        if (!beatmap?.identifier) return;
        nextMap[beatmap.identifier] = {
            identifier: beatmap.identifier,
            artist: beatmap.artist || '',
            title: beatmap.title || '',
            beatmapset_id: beatmap.beatmapset_id,
            bgUrl: beatmap.beatmapset_id
                ? `https://assets.ppy.sh/beatmaps/${beatmap.beatmapset_id}/covers/cover.jpg`
                : ''
        };
    });
    picksInfo.beatmapMap = nextMap;
}

function refreshStageOptions() {
    controlPanel.stages = mappools?.mappools?.map(p => p.stage).filter(Boolean) || [];
    controlPanel.selectedStage = '';
    controlPanel.beatmapOptions = [];
    controlPanel.selectedBeatmapIndex = '';
}

function refreshBeatmapOptions() {
    const stage = controlPanel.selectedStage;
    if (!stage) {
        controlPanel.beatmapOptions = [];
        controlPanel.selectedBeatmapIndex = '';
        return;
    }
    const stagePool = mappools?.mappools?.find(p => p.stage === stage) || {};
    const beatmaps = Array.isArray(stagePool?.beatmaps) ? stagePool.beatmaps : [];
    controlPanel.beatmapOptions = beatmaps.map((beatmap, index) => ({
        label: beatmap.identifier || beatmap.title || `Map ${index + 1}`,
        beatmap
    }));
    controlPanel.selectedBeatmapIndex = '';
}

/////////////////////////////////////////////////////////////

let wsdata = {}; // for debugging purposes
ws.onmessage = (event) => {
    let data = JSON.parse(event.data);
    wsdata = data;
    let beatmapMng = data.beatmap;
    let tourneyMng = data.tourney;
    updateTeamInfo(tourneyMng);
    updateChat(tourneyMng);
    generatePickSlots(tourneyMng);
};

function generatePickSlots(tourneyMng) {
    const bo = tourneyMng?.bestOF || 9;
    picksInfo.pickCount = Math.floor(bo / 2);
    cardInfo.isTwoStadiums = (tourneyMng?.bestOF >= 13);
}

function updateTeamInfo(tourneyMng) {
    teamInfo.RedTeamName = tourneyMng?.team?.left || "Red Team";
    teamInfo.BlueTeamName = tourneyMng?.team?.right || "Blue Team";
    teamInfo.showAtk = tourneyMng?.scoreVisible === true;
    // 要去 teams.json 找對應隊伍的 avatar，沒有就用空字串
    let redTeamData = teams.find(team => team.teamName === teamInfo.RedTeamName);
    let blueTeamData = teams.find(team => team.teamName === teamInfo.BlueTeamName);
    teamInfo.RedTeamAvatar = "../_data/img/avatar/" + (redTeamData?.avatar || "default.jpg");
    teamInfo.BlueTeamAvatar = "../_data/img/avatar/" + (blueTeamData?.avatar || "default.jpg");
}

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

/////////////////////////////////////////////////////////////

// 讀取 LocalStorage 中的 game-state，並更新畫面
let gameStatus = {};
let gameEvent = [];

setInterval(() => {
    loadGameState(localStorage.getItem('game-state'));
    updateRefInfo();
    updateBDInfo();
    setTimeout(() => { updateCardInfo(); }, 100);
    setTimeout(() => { updateStadiumInfo(); }, 100);
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

function updateBDInfo() {
    const redTeam = gameStatus?.teams?.red || {};
    const blueTeam = gameStatus?.teams?.blue || {};

    const toCardUrls = (team) => {
        const blessings = Array.isArray(team?.blessings) ? team.blessings : [];
        const disasters = Array.isArray(team?.disasters) ? team.disasters : [];
        return [...blessings, ...disasters]
            .map(name => cardNameToId[name])
            .filter(Boolean)
            .map(id => `../_data/img/cards/${id}.png`);
    };

    bdInfo.redBD = toCardUrls(redTeam);
    bdInfo.blueBD = toCardUrls(blueTeam);
}

function updateStadiumInfo() {
    const nextEvents = Array.isArray(gameEvent) ? gameEvent : [];

    const stadiumEvents = nextEvents.filter(item => item?.type === 'stadium');

    // 看 stadiumEvents 事件裡 item.card = "S1" 和 "S2" 哪個先出現
    let firstBan = 'S2';
    for (const item of stadiumEvents) {
        if (item?.card === 'S2') break;
        firstBan = 'S1';
    }

    const redStadiums = stadiumEvents.filter(item => item?.team === 'red').map(item => ({
        id: item?.card || '',
        name: item?.cardName || '',
        description: item?.effect || '',
        imageUrl: `../_data/img/cards/${item?.card || ''}.png`,
        banOrder: (item?.card === "S1" || item?.card === "S2") ? (item?.card === firstBan ? 1 : 2) : 0,
        firstBans: [(picksInfo.redBans[0] || ''), (picksInfo.blueBans[0] || '')],
        secondBans: [(picksInfo.redBans[1] || ''), (picksInfo.blueBans[1] || '')]
    }));
    const blueStadiums = stadiumEvents.filter(item => item?.team === 'blue').map(item => ({
        id: item?.card || '',
        name: item?.cardName || '',
        description: item?.effect || '',
        imageUrl: `../_data/img/cards/${item?.card || ''}.png`,
        banOrder: (item?.card === "S1" || item?.card === "S2") ? (item?.card === firstBan ? 1 : 2) : 0,
        firstBans: [(picksInfo.redBans[0] || ''), (picksInfo.blueBans[0] || '')],
        secondBans: [(picksInfo.redBans[1] || ''), (picksInfo.blueBans[1] || '')]
    }));
    cardInfo.RedStadiums = redStadiums;
    cardInfo.BlueStadiums = blueStadiums;
}

function updateCardInfo() {
    const nextEvents = Array.isArray(gameEvent) ? gameEvent : [];
    
    const playEvents = nextEvents.filter(item => item?.type == 'play');
    
    const currentCount = cardInfo.Cards.length;
    if (playEvents.length < currentCount) cardInfo.Cards = [];

    const newEvents = playEvents.slice(currentCount);
    const newCards = newEvents.map(item => ({
        team: item?.team || '',
        id: item?.card || '',
        name: item?.cardName || '',
        type: item?.cardType || '',
        description: (item.cardType == 'M') ? (item?.effect) : (item?.trigger + '，' + item?.effect) || '',
        isAutoHovered: true, // 新卡片預設為展開狀態
        imageUrl: `../_data/img/cards/${item?.card}.png`,
        avatarUrl: (item.team === 'red' ? teamInfo.RedTeamAvatar : teamInfo.BlueTeamAvatar)
    }));
    newCards.reverse();

    cardInfo.Cards.unshift(...newCards);

    const addedCount = newCards.length;
    for (let i = 0; i < addedCount; i++) {
        const reactiveCard = cardInfo.Cards[i];
        setTimeout(() => { reactiveCard.isAutoHovered = false;}, 10000); // 過幾秒後自動收起
    }

    for (let idx = 0; idx < cardInfo.Cards.length; idx++) {
        const card = cardInfo.Cards[idx];
        if (idx === 0) continue;
        const prevCard = cardInfo.Cards[idx - 1];
        if (card.team === prevCard.team) card.avatarUrl = 'none';
    }
}