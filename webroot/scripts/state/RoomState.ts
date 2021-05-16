import { purgeGlobalMods } from "../model/Mods";
import { RoomScene } from "../scenes/RoomScene";

let timerMs: number;
let timerMsCallbacks = [];

export enum RoomStatus {
    COUNTDOWN,
    ACTIVE,
    VICTORY,
    DEFEAT
};

let roomScene: RoomScene;
let roomStatus: RoomStatus;
let roomStatusCallbacks = [];
let activeShipMods: string[];
let shipModCallbacks = [];
let activeShipWeapon: string;
let shipWeaponCallbacks = [];
let activeRoomShopBuffs: string[] = [];
let roomResetCallbacks = [];

export function resetRoom(scene: RoomScene) {
    roomScene = scene;
    activeRoomShopBuffs = [];
    //TODO this may not be wanted always? Right now just clears mods on each room start.
    purgeGlobalMods();
    roomResetCallbacks.forEach(callback => 
        callback.callback(callback.scene));
}

export function addRoomResetListener(callback, scene) {
    roomResetCallbacks.push({ 
        callback: callback,
        scene: scene
    });
}

export function getRoomScene() {
    return roomScene;
}

export function addRoomShopBuff(buff: string) {
    activeRoomShopBuffs.push(buff);
}

export function isRoomShopBuffActive(buff: string) {
    return activeRoomShopBuffs.includes(buff);
}

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