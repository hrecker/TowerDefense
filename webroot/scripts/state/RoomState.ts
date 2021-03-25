let timeUntilSpawnMs: number;
let timeUntilSpawnMsCallbacks = [];

let shipActive: boolean = false;
let shipActiveCallbacks = [];

export function setTimeUntilSpawnMs(timeUntilSpawn: number) {
    if (timeUntilSpawnMs == timeUntilSpawn) {
        return;
    }
    timeUntilSpawnMs = timeUntilSpawn;
    if (timeUntilSpawnMs < 0) {
        timeUntilSpawnMs = 0;
    }
    timeUntilSpawnMsCallbacks.forEach(callback => 
        callback.callback(getTimeUntilSpawnMs(), callback.scene));
}

export function getTimeUntilSpawnMs() {
    return timeUntilSpawnMs;
}

export function addTimeUntilSpawnMsListener(callback, scene) {
    timeUntilSpawnMsCallbacks.push({ 
        callback: callback,
        scene: scene
    });
}

export function setShipActive(isActive: boolean) {
    console.log("setting ship active " + isActive);
    if (shipActive == isActive) {
        return;
    }
    shipActive = isActive;
    shipActiveCallbacks.forEach(callback => 
        callback.callback(isShipActive(), callback.scene));
}

export function isShipActive() {
    return shipActive;
}

export function addShipActiveListener(callback, scene) {
    shipActiveCallbacks.push({ 
        callback: callback,
        scene: scene
    });
}