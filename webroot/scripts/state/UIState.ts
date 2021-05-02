import { Unit } from "../model/Units";

// Unit selected in the UI
let shopSelection: Unit;
let shopSelectionCallbacks = [];
let invalidUnitPlacementReason: string;
let invalidUnitPlacementCallbacks = [];

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

export function setInvalidUnitPlacementReason(reason: string) {
    invalidUnitPlacementReason = reason;
    invalidUnitPlacementCallbacks.forEach(callback => 
        callback.callback(invalidUnitPlacementReason, callback.scene));
}

export function addInvalidUnitPlacementListener(callback, scene) {
    invalidUnitPlacementCallbacks.push({ 
        callback: callback,
        scene: scene
    });
}
