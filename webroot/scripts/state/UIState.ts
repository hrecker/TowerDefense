import { Unit } from "../model/Units";

// Unit selected in the UI
let shopSelection: Unit;
let invalidUnitPlacementReason: string;
let invalidUnitPlacementCallbacks = [];

export function setShopSelection(selection: Unit) {
    shopSelection = selection;
}

export function getShopSelection(): Unit {
    return shopSelection;
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