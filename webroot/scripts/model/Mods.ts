import { RoomScene } from "../scenes/RoomScene";
import { Unit } from "./Units";

let modId = 0;
// All active mods that have a duration
let allTimebasedMods: Mod[] = [];

/** A Mod, which affects Units stats/abilities/movement. These can be attached
 * to a single unit, affect all units, or affect a subset with a filter.
 */
export type Mod = {
    id: number,
    type: ModType,
    startTime: number,
    // Unit this mod is attached to, if applicable
    unit?: Unit,
    // filter should return true for Units that it applies to
    // Only necessary for global/semi-global mods
    filter?: (unit: Unit) => boolean,
    // Properties of this mod
    props: ModProps
};

/** ModProps is the individual properties that define a mod's behavior */
export type ModProps = {
    // How much time after creation before the mod is destroyed
    duration?: number,
    // Sprites that should be attached to the unit while this mod is active
    attachSprite?: string,
    // properties for specific mod types:
    // Generic (may be used by multiple mod types)
    currentCooldownMs?: number
    // ModType.SHIELD
    shieldStrength?: number,
    // ModType.DODGE_ENEMIES
    dodgeCooldownMs?: number,
    dodgeSpeed?: number,
    // ModType.TARGET_ENEMIES
    currentTargetId?: number,
    // ModType.PROJECTILE_SCALE
    projectileScale?: number
}

/** Types of Mods that can be created */
export enum ModType {
    SHIELD = "SHIELD",
    DODGE_ENEMIES = "DODGE_ENEMIES",
    TARGET_ENEMIES = "TARGET_ENEMIES",
    PROJECTILE_SCALE = "PROJECTILE_SCALE"
};

/** Create a Mod attached to a Unit. The passed in mod should
 * have all necessary properties set, and this function will
 * connect it to the unit and instantiate necessary GameObjects.
 */
export function createUnitMod(unit: Unit, type: ModType, props: ModProps, scene: RoomScene) {
    modId++;
    let mod: Mod = {
        id: modId,
        unit: unit,
        startTime: scene.getSceneTime(),
        type: type,
        props: props
    };
    mod.unit = unit;
    if (mod.props.duration) {
        allTimebasedMods.push(mod);
    }
    if (mod.props.attachSprite) {
        let attach = scene.add.image(unit.gameObj.body.center.x, unit.gameObj.body.center.y, mod.props.attachSprite);
        unit.attachedObjects[mod.id] = [attach];
    }
    if (!unit.mods[type]) {
        unit.mods[type] = [];
    }
    unit.mods[type].push(mod);
}

/** Destroy mods that expired based on the current time */
export function purgeExpiredMods(time: number) {
    for (let i = allTimebasedMods.length - 1; i >= 0; i--) {
        let mod = allTimebasedMods[i];
        if (time - mod.startTime >= mod.props.duration) {
            destroyMod(mod);
            allTimebasedMods.splice(i, 1);
        }
    }
}

/** Destroy mod, remove from unit and destroy GameObjects if necessary */
//TODO handle mods not attached to units here (global/semi-global)
export function destroyMod(mod: Mod) {
    // Remove the mod from the unit's list
    //TODO remove the type key from unit.mods if there are no more of the given type? Probably doesn't matter
    for (let i = 0; i < mod.unit.mods[mod.type].length; i++) {
        if (mod.unit.mods[mod.type][i].id == mod.id) {
            mod.unit.mods[mod.type].splice(i, 1);
            break;
        }
    }
    // Destroy any attached gameobjects belonging to the mod
    if (mod.unit.attachedObjects[mod.id]) {
        for (let i = 0; i < mod.unit.attachedObjects[mod.id].length; i++) {
            mod.unit.attachedObjects[mod.id][i].destroy();
        }
        delete mod.unit.attachedObjects[mod.id];
    }
}