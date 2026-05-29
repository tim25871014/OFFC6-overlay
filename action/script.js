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

/////////////////////////////////////////////////////////////

// main function
let mappool = {};
(async () => {
    mappool = await fetch('../_data/config/beatmaps.json').then(res => res.json());
    renderMappool(mappool);
    
})();

function renderMappool(mappool) {

    const groups = {};
    for (const beatmap of mappool.beatmaps) {

        // 以 mods 作為分組依據，將 beatmap 分組
        const mod = beatmap.mods;
        if (!groups[mod]) groups[mod] = [];
        groups[mod].push(beatmap);

        // 初始化 pickState，預設為 'none'
        const id = beatmap.identifier;
        if (!mappoolView.pickState[id]) mappoolView.pickState[id] = 'none';
    }

    mappoolView.mods = Object.entries(groups).map(([mod, maps]) => ({
        mod,
        maps
    }));
}

/////////////////////////////////////////////////////////////

let wsdata = {}; // for debugging purposes
ws.onmessage = (event) => {
    let data = JSON.parse(event.data);
    wsdata = data;
    let beatmapMng = data.beatmap;
    let tourneyMng = data.tourney;
};

