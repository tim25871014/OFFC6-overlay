const ws = ConnectSocket();

const { createApp, ref, computed } = Vue;

const sceneInfo = createApp({ setup() {
    return {
        teams: ref({blue: "", red: ""}),
        avatar: ref({blue: "", red: ""}),
        winner: ref('red'),
        Stage: ref(''),
        redPlayers: ref([]),
        bluePlayers: ref([]),
    }
}}).mount("#main");

let wsdata = {}; // for debugging purposes
ws.onmessage = (event) => {
    let data = JSON.parse(event.data);
    wsdata = data;
    let beatmapMng = data.beatmap;
    let tourneyMng = data.tourney;

    updateTeamInfo(tourneyMng);
    updateWinnerBackground(tourneyMng);
    updatePlayerInfo();
};

function updateWinnerBackground(tourneyMng) {
    if (tourneyMng.points.left > tourneyMng.points.right) {
        sceneInfo.winner = 'red';
    } else if (tourneyMng.points.right > tourneyMng.points.left) {
        sceneInfo.winner = 'blue';
    } else {
        sceneInfo.winner = 'none';
    }
}

function updateTeamInfo(tourneyMng) {
    sceneInfo.teams.red = tourneyMng?.team?.left || "Red Team";
    sceneInfo.teams.blue = tourneyMng?.team?.right || "Blue Team";
    sceneInfo.avatar.red = "../_data/img/avatar/" + (teams.find(team => team.teamName === sceneInfo.teams.red)?.avatar || "default.jpg");
    sceneInfo.avatar.blue = "../_data/img/avatar/" + (teams.find(team => team.teamName === sceneInfo.teams.blue)?.avatar || "default.jpg");
}

// main function
let mappools = {}, pool = {}, teams = [];
(async () => {
    mappools = await fetch('../_data/config/mappools.json').then(res => res.json());
    teams = await fetch('../_data/config/teams.json').then(res => res.json());
    updateStageInfo();
})();

function updateStageInfo() {
    const stage = mappools?.current_stage || "Unknown Stage";
    pool = mappools?.mappools?.find(p => p.stage === stage);
    sceneInfo.Stage = stage;
}

function updatePlayerInfo() {
    // 去 teams 裡找出目前在比賽的隊伍
    const redTeam = teams.find(t => t.teamName === sceneInfo.teams.red)?.players || [];
    const blueTeam = teams.find(t => t.teamName === sceneInfo.teams.blue)?.players || [];

    // 把每個玩家新增 avatarUrl 屬性，https://a.ppy.sh/{id}
    redTeam.forEach(player => {
        player.avatarUrl = `https://a.ppy.sh/${player.id}`;
    });

    blueTeam.forEach(player => {
        player.avatarUrl = `https://a.ppy.sh/${player.id}`;
    });

    sceneInfo.redPlayers = redTeam;
    sceneInfo.bluePlayers = blueTeam;
}