let timerMs: number;
let timerMsCallbacks = [];

export enum RoomStatus {
    COUNTDOWN,
    ACTIVE,
    VICTORY,
    DEFEAT
};

let roomStatus: RoomStatus;
let roomStatusCallbacks = [];
let activeShipMods: string[];
let shipModCallbacks = [];
let activeShipWeapon: string;
let shipWeaponCallbacks = [];

export function setTimerMs(timeLeft: number) {
    if (timerMs == timeLeft) {
        return;
    }
    timerMs = timeLeft;
    if (timerMs < 0) {
        timerMs = 0;
    }
    timerMsCallbacks.forEach(callback => 
        callback.callback(getTimerMs(), callback.scene));
}

export function getTimerMs() {
    return timerMs;
}

export function addTimerMsListener(callback, scene) {
    timerMsCallbacks.push({ 
        callback: callback,
        scene: scene
    });
}

export function setRoomStatus(status: RoomStatus) {
    if (roomStatus == status) {
        return;
    }
    roomStatus = status;
    roomStatusCallbacks.forEach(callback => 
        callback.callback(getRoomStatus(), callback.scene));
}

export function getRoomStatus(): RoomStatus {
    return roomStatus;
}

export function addRoomStatusListener(callback, scene) {
    roomStatusCallbacks.push({ 
        callback: callback,
        scene: scene
    });
}

export function setActiveShipMods(activeMods: string[]) {
    activeShipMods = activeMods;
    shipModCallbacks.forEach(callback => 
        callback.callback(activeShipMods, callback.scene));
}

export function getActiveShipMods(): string[] {
    return activeShipMods;
}

export function addShipModListener(callback, scene) {
    shipModCallbacks.push({ 
        callback: callback,
        scene: scene
    });
}

export function setActiveShipWeapon(activeWeapon: string) {
    activeShipWeapon = activeWeapon;
    shipWeaponCallbacks.forEach(callback => 
        callback.callback(activeShipWeapon, callback.scene));
}

export function getActiveShipWeapon(): string {
    return activeShipWeapon;
}

export function addShipWeaponListener(callback, scene) {
    shipWeaponCallbacks.push({ 
        callback: callback,
        scene: scene
    });
}