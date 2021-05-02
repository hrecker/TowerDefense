import { hasMod, Unit } from "../model/Units";
import { ModType } from "../model/Mods";
import { RoomScene } from "../scenes/RoomScene";
import { getRandomArrayElements } from "../util/Util";
import { setActiveShipWeapon, setActiveShipMods } from "../state/RoomState";

export function randomizeShipMods(numActive: number, roomScene: RoomScene) {
    let allMods = Object.keys(roomScene.cache.json.get("shipMods"));
    setActiveShipMods(getRandomArrayElements(allMods, numActive));
}

export function randomizeShipWeapon(roomScene: RoomScene) {
    let allWeapons = Object.keys(roomScene.cache.json.get("shipWeapons"));
    setActiveShipWeapon(getRandomArrayElements(allWeapons, 1)[0]);
}

// Get the appropriate unit for the provided unit to target in the room, or null if no target unit is around
export function getUnitTarget(unit: Unit, roomScene: RoomScene): Unit {
    let targetUnit: Unit;
    let sceneUnits = roomScene.getSceneUnits();
    if (unit.playerOwned) {
        targetUnit = roomScene.getShip();
    } else {
        if (hasMod(unit, ModType.TARGET_ENEMIES)) {
            let targetId = unit.mods[ModType.TARGET_ENEMIES][0].props.currentTargetId;
            let targetValid = targetId != -1;
            // Check if old target is no longer valid
            if (targetValid && (!sceneUnits[targetId] || !sceneUnits[targetId].gameObj.body)) {
                targetValid = false;
            }
            if (targetValid) {
                targetUnit = sceneUnits[targetId];
            } else {
                let sortedByDistance = Object.keys(sceneUnits).sort((keyAStr, keyBStr) => {
                    let keyA = parseInt(keyAStr);
                    let keyB = parseInt(keyBStr);
                    return sceneUnits[keyA].gameObj.getCenter().distance(unit.gameObj.getCenter()) - 
                        sceneUnits[keyB].gameObj.getCenter().distance(unit.gameObj.getCenter());
                });
                for (const unitIdStr of sortedByDistance) {
                    let unitId = parseInt(unitIdStr);
                    // Get the first non-target enemy in the scene
                    if (sceneUnits[unitId].playerOwned && sceneUnits[unitId].name != "target") {
                        targetUnit = sceneUnits[unitId];
                        unit.mods[ModType.TARGET_ENEMIES][0].props.currentTargetId = unitId;
                        break;
                    }
                }
            }
        }
        // If the TARGET_ENEMIES mod isn't present or no target is found, use the room target
        if (!targetUnit && roomScene.getRoomTarget().gameObj.body) {
            targetUnit = roomScene.getRoomTarget();
        }
    }
    return targetUnit;
}

// Get the position the unit should target
export function getTargetPos(unit: Unit, targetUnit: Unit, roomScene: RoomScene) {
    let target;
    if (targetUnit && targetUnit.gameObj.body) {
        target = targetUnit.gameObj.body.center;
    } else if (unit.playerOwned) {
        target = roomScene.getLastShipPos();
    } else {
        target = roomScene.getLastTargetPos();
    }
    return target;
}