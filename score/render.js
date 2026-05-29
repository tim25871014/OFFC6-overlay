let gameStatus = {};
let gameEvent = [];

function render_status(game_status) {
    console.log('Rendering game status');
    gameStatus = game_status;
    const el = document.getElementById('game-status');
    el.textContent = JSON.stringify(game_status || {}, null, 4);
    syncState();
}

function render_event(game_event) {
    console.log('Rendering game event');
    gameEvent = game_event;
    const el = document.getElementById('game-event');
    const reversed = Array.isArray(game_event) ? [...game_event].reverse() : [];
    el.textContent = JSON.stringify(reversed, null, 4);
    syncState();
}

// localStorage 同步
function syncState() {
    const state = {
        gameStatus, gameEvent
    };
    localStorage.setItem("game-state", JSON.stringify(state));
    console.log('State synced to localStorage');
}

setInterval(syncState, 1000);