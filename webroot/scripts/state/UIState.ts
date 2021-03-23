import { Unit } from "../model/Units"

// Unit selected in the UI
let shopSelection: Unit;

export function setShopSelection(selection: Unit) {
    shopSelection = selection;
}

export function getShopSelection(): Unit {
    return shopSelection;
}