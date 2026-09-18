(function () {
    "use strict";

    const profiles = {
        ssvep_fixed: {
            label: "固定：1左 2动作 3右",
            commands: { "1": "left", "2": "action", "3": "right" }
        }
    };

    const handlers = new Set();
    const statusHandlers = new Set();
    let socket = null;
    let reconnectTimer = 0;
    function readStoredProfile() {
        try {
            return localStorage.getItem("ssvepCommandProfile");
        } catch (error) {
            return null;
        }
    }

    function writeStoredProfile(nextName) {
        try {
            localStorage.setItem("ssvepCommandProfile", nextName);
        } catch (error) {
            // Some local-file browser policies disable storage; the in-memory value is enough.
        }
    }

    let profileName = readStoredProfile() || "ssvep_fixed";
    if (!profiles[profileName]) {
        profileName = "ssvep_fixed";
    }

    function emit(action, source, raw) {
        if (!action) {
            return;
        }
        handlers.forEach((handler) => handler(action, { source, raw }));
    }

    function emitStatus(state, detail) {
        statusHandlers.forEach((handler) => handler(state, detail || ""));
    }

    function mapRawCommand(raw) {
        const key = String(raw || "").trim();
        const profile = profiles[profileName] || profiles.ssvep_fixed;
        return profile.commands[key] || null;
    }

    function connect(url) {
        const wsUrl = url || "ws://localhost:8767";
        clearTimeout(reconnectTimer);

        try {
            if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
                return;
            }

            socket = new WebSocket(wsUrl);
            emitStatus("connecting", "连接中");

            socket.onopen = function () {
                emitStatus("open", "已连接");
                socket.send("client_connected");
            };

            socket.onmessage = function (event) {
                const action = mapRawCommand(event.data);
                emit(action, "websocket", event.data);
            };

            socket.onerror = function () {
                emitStatus("error", "连接错误");
            };

            socket.onclose = function () {
                emitStatus("closed", "未连接");
                reconnectTimer = setTimeout(function () {
                    socket = null;
                    connect(wsUrl);
                }, 2500);
            };
        } catch (error) {
            emitStatus("error", "连接失败");
            reconnectTimer = setTimeout(function () {
                socket = null;
                connect(wsUrl);
            }, 2500);
        }
    }

    function setProfile(nextName) {
        if (!profiles[nextName]) {
            return;
        }
        profileName = nextName;
        writeStoredProfile(profileName);
        emitStatus("profile", profiles[profileName].label);
    }

    window.addEventListener("keydown", function (event) {
        if (event.repeat) {
            return;
        }
        if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
            event.preventDefault();
            emit("left", "keyboard", event.key);
        } else if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
            event.preventDefault();
            emit("right", "keyboard", event.key);
        } else if (event.key === " " || event.key === "Enter" || event.key === "w" || event.key === "W") {
            event.preventDefault();
            emit("action", "keyboard", event.key);
        }
    });

    window.SSVEPInput = {
        connect,
        onCommand(handler) {
            handlers.add(handler);
            return function () {
                handlers.delete(handler);
            };
        },
        onStatus(handler) {
            statusHandlers.add(handler);
            return function () {
                statusHandlers.delete(handler);
            };
        },
        getProfiles() {
            return Object.keys(profiles).map((name) => ({ name, label: profiles[name].label }));
        },
        getProfile() {
            return profileName;
        },
        setProfile,
        mapRawCommand
    };
})();
