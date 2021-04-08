import { Unit } from "../model/Units";
import { ModType } from "../model/Mods";
import { RoomScene } from "../scenes/RoomScene";

// Get the appropriate unit for the provided unit to target in the room
export function getUnitTarget(unit: Unit, roomScene: RoomScene): Phaser.Math.Vector2 {
    let targetUnit: Unit;
    let sceneUnits = roomScene.getSceneUnits();
    if (unit.playerOwned) {
        targetUnit = roomScene.getShip();
    } else {
        if (unit.mods[ModType.TARGET_ENEMIES] && unit.mods[ModType.TARGET_ENEMIES].length > 0) {
            let targetId = unit.mods[ModType.TARGET_ENEMIES][0].props.currentTargetId;
            let targetValid = targetId != -1;
            // Check if old target is no longer valid
            if (targetValid && (!sceneUnits[targetId] || !sceneUnits[targetId].gameObj.body)) {
                targetValid = false;
            }
            if (targetValid) {
                targetUnit = sceneUnits[targetId];
            } else {
                for (const unitIdStr of Object.keys(sceneUnits)) {
                    let unitId = parseInt(unitIdStr)
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