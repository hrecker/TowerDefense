import { RoomScene } from "../scenes/RoomScene";
import { getNewId } from "../state/IdState";
import { Unit } from "./Units";

// All active mods that have a duration
let allTimebasedMods: Mod[] = [];
let playerOwnedMods: { [type: string]: Mod[] } = {};
let nonPlayerOwnedMods: { [type: string]: Mod[] } = {};

/** A Mod, which affects Units stats/abilities/movement. These can be attached
 * to a single unit, affect all units, or affect a subset with a filter.
 */
export type Mod = {
    id: number,
    type: ModType,
    startTime: number,
    // Unit this mod is attached to, if applicable
    unit?: Unit,
    // TODO is more fine-grained filter logic necessary here?
    // Whether this is a global mod affecting all player-owned or all non-player-owned units
    // Mods that are attached to a single unit should leave each of these undefined or set to false
    isPlayerOwned?: boolean,
    isNonPlayerOwned?: boolean,
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
    // ModType.DAMAGE_BUFF
    damageDiff?: number
}

/** Types of Mods that can be created */
export enum ModType {
    SHIELD = "SHIELD",
    DODGE_ENEMIES = "DODGE_ENEMIES",
    TARGET_ENEMIES = "TARGET_ENEMIES",
    PROJECTILE_SCALE = "PROJECTILE_SCALE",
    GHOST_PROJECTILES = "GHOST_PROJECTILES",
    EXPLODING_PROJECTILES = "EXPLODING_PROJECTILES",
    NO_CONTACT_DAMAGE = "NO_CONTACT_DAMAGE",
    DAMAGE_BUFF = "DAMAGE_BUFF"
};

/** Create a Mod attached to a Unit. The passed in mod should
 * have all necessary properties set, and this function will
 * connect it to the unit and instantiate necessary GameObjects.
 */
export function createUnitMod(unit: Unit, type: ModType, props: ModProps, scene: RoomScene) {
    let mod = createMod(type, props, scene);
    mod.unit = unit;
    if (mod.props.attachSprite) {
        let attach = scene.add.image(unit.gameObj.body.center.x, unit.gameObj.body.center.y, mod.props.attachSprite);
        unit.attachedObjects[mod.id] = [attach];
    }
    addModToList(mod, unit.mods);
}

export function createGlobalMod(playerOwned: boolean, type: ModType, props: ModProps, scene: RoomScene) {
    let mod = createMod(type, props, scene);
    if (playerOwned) {
        addModToList(mod, playerOwnedMods);
        mod.isPlayerOwned = true;
    } else {
        addModToList(mod, nonPlayerOwnedMods);
        mod.isNonPlayerOwned = true;
    }
}

function createMod(type: ModType, props: ModProps, scene: RoomScene) {
    if (!props) {
        props = {};
    }
    let mod: Mod = {
        id: getNewId(),
        startTime: scene.getSceneTime(),
        type: type,
        props: props
    };
    if (mod.props.duration) {
        allTimebasedMods.push(mod);
    }
    return mod;
}

function addModToList(mod: Mod, list: { [type: string]: Mod[] }) {
    if (!list[mod.type]) {
        list[mod.type] = [];
    }
    list[mod.type].push(mod);
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

export function purgeGlobalMods() {
    purgeModList(playerOwnedMods);
    purgeModList(nonPlayerOwnedMods);
}

//TODO remove the type key the list if there are no more of the given type? Probably doesn't matter
function purgeModList(modList: { [type: string]: Mod[] }) {
    for (let modType in modList) {
        for (let i = 0; i < modList[modType].length; i++) {
            destroyMod(modList[modType][i]);
        }
    }
}

/** Destroy mod, remove from unit and destroy GameObjects if necessary */
export function destroyMod(mod: Mod) {
    if (mod.unit) {
        // Remove the mod from the unit's list
        removeModFromList(mod.unit.mods, mod);
        // Destroy any attached gameobjects belonging to the mod
        if (mod.unit.attachedObjects[mod.id]) {
            for (let i = 0; i < mod.unit.attachedObjects[mod.id].length; i++) {
                mod.unit.attachedObjects[mod.id][i].destroy();
            }
            delete mod.unit.attachedObjects[mod.id];
        }
    } else if (mod.isPlayerOwned) {
        removeModFromList(playerOwnedMods, mod);
    } else if (mod.isNonPlayerOwned) {
        removeModFromList(nonPlayerOwnedMods, mod);
    }
}

function removeModFromList(modList: { [type: string]: Mod[] }, mod) {
    for (let i = 0; i < modList[mod.type].length; i++) {
        if (modList[mod.type][i].id == mod.id) {
            modList[mod.type].splice(i, 1);
            return true;
        }
    }
    return false;
}

/** Check if a global mod of the given type applies to player-owned/non-player-owned units */
export function globalHasMod(playerOwned: boolean, type: ModType) {
    let list = playerOwnedMods;
    if (!playerOwned) {
        list = nonPlayerOwnedMods;
    }
    return list && list[type] && list[type].length > 0;
}

/** Check if a global mod of the given type applies to player-owned/non-player-owned units */
export function getGlobalModsOfType(playerOwned: boolean, type: ModType) {
    let list = [];
    if (playerOwned && playerOwnedMods[type]) {
        list = playerOwnedMods[type];
    } else if (!playerOwned && nonPlayerOwnedMods[type]) {
        list = nonPlayerOwnedMods[type];
    }
    return list;
}

/** Check if a given weapon and mod are compatible */
export function weaponAndModCompatible(unitName: string, weapon: string, modType: string, scene: RoomScene) {
    if (unitName != "ship") {
        // Currently this only applies to ship weapons
        return true;
    }

    //TODO this is really inefficient, iterating every time rather than using a table/cache
    let incompatibleMods = scene.cache.json.get("shipWeapons")[weapon]["incompatibleMods"];
    return !incompatibleMods || !incompatibleMods.includes(modType);
}