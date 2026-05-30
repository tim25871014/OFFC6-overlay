const ws = ConnectSocket();

const { createApp, ref } = Vue;

const mappoolView = createApp({ setup() {
    const mods = ref([]);
    const pickState = ref({});
    const blinkState = ref({});

    const onPick = (event, identifier, color) => {
        if (event.ctrlKey) pickState.value[identifier] = 'none';
        else if (event.shiftKey) pickState.value[identifier] = `${color}-ban`;
        else {
            pickState.value[identifier] = color;
            blinkState.value[identifier] = true;
            window.setTimeout(() => { blinkState.value[identifier] = false; }, 3000);
        }
    };

    const stateStyles = {
        'none': 'border-gray-300',
        'red': 'border-red-500',
        'blue': 'border-blue-500',
        'red-ban': 'border-red-500 brightness-75',
        'blue-ban': 'border-blue-500 brightness-75',
    };

    return {
        mods, pickState, blinkState, onPick, stateStyles
    };
}}).mount('#content');

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

const controlPanel = createApp({ setup() {

    const toggleComboMode = () => {
        controlPanel.comboMode = !controlPanel.comboMode;
    };

    const toggleChat = () => {
        controlPanel.chatMode = !controlPanel.chatMode;
    }

    return {
        comboMode: ref(false),
        chatMode: ref(true),
        toggleComboMode,
        toggleChat
    }
}}).mount('#control-panel');

/////////////////////////////////////////////////////////////

// main function
let mappools = {}, pool = {}, teams = [];
(async () => {
    mappools = await fetch('../_data/config/mappools.json').then(res => res.json());
    teams = await fetch('../_data/config/teams.json').then(res => res.json());
    updateStageInfo();
})();

function updateStageInfo() {
    const stage = mappools?.current_stage || "Unknown Stage";
    // 從 mappools.mappools 找到 stage = current_stage 的物件
    pool = mappools?.mappools?.find(p => p.stage === stage);
    StageInfo.Stage = stage;
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
};

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
