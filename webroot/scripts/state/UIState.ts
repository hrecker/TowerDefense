import { Unit } from "../model/Units";

// Unit selected in the UI
let shopSelection: Unit;
let shopSelectionCallbacks = [];
let shopMessage: string;
let shopMessageCallbacks = [];

export function setShopSelection(selection: Unit) {
    shopSelection = selection;
    shopSelectionCallbacks.forEach(callback => 
        callback.callback(shopSelection, callback.scene));
}

export function getShopSelection(): Unit {
    return shopSelection;
}

export function addShopSelectionListener(callback, scene) {
    shopSelectionCallbacks.push({
        callback: callback,
        scene: scene
    });
}

export function setShopMessage(message: string) {
    shopMessage = message;
    shopMessageCallbacks.forEach(callback => 
        callback.callback(shopMessage, callback.scene));
}

export function addShopMessageListener(callback, scene) {
    shopMessageCallbacks.push({ 
        callback: callback,
        scene: scene
    });
}
