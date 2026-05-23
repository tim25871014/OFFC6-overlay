function ConnectSocket() {
    let mode = "debug";
    if (mode == "debug") {
        return new WebSocket('ws://127.0.0.1:3000/ws');
    } else {
        return new WebSocket("ws://localhost:24050/websocket/v2");
    }
}

