import { RoomScene } from "../scenes/RoomScene";
import { applyModCreationEffect, createUnitMod, getAllGlobalModsForUnit, getGlobalModsOfType, globalHasMod, Mod, ModProps, ModType } from "./Mods";
import { flickerGameObject } from "../util/Util";
import { getNewId } from "../state/IdState";
import { createExplosion } from "../units/Weapon";

let unitCache: { [name: string]: Unit };
// Index for attached gameobjects not associated with a mod
const nullModId = -1;

const healthBarWidth = 64;
const healthBarHeight = 6;
export const healthBarYPos = 24;
const healthBarFillColor = 0x32a852;
const defaultUnitDrag = 500;

/** A Unit in the active room */
export type Unit = {
    name: string;
    id: number;
    gameObj: Phaser.Types.Physics.Arcade.ImageWithDynamicBody;
    playerOwned: boolean;
    bodyType: string;
    bodySize: number;
    bodyOffset: number;
    // Movement props
    movement: string;
    maxSpeed: number;
    maxAcceleration: number;
    maxAngularSpeed: number;
    maxX: number;
    minX: number;
    maxY: number;
    minY: number;
    rotation: boolean;
    path: Phaser.Types.Math.Vector2Like[];
    currentPathIndex: number;
    timeSincePathfindMs: number;
    // Health props
    health: number;
    maxHealth: number;
    healthBar: Phaser.GameObjects.Rectangle;
    // Weapon props
    weapon: string;
    weaponDelay: number;
    currentWeaponDelay: number;
    // Shop props
    purchasable: boolean;
    price: number;
    tooltip: string;
    // Mods
    // Default mods that should be added when spawning this unit
    defaultMods: { [type: string]: ModProps };
    // Lists of mods indexed by ModType
    mods: { [type: string]: Mod[] };
    // Any gameobject attached to this unit (attached gameobjects will track with
    // this unit's movement). If created by a mod, they will be indexed by modId.
    // Otherwise they will be stored under index nullModId (-1).
    attachedObjects: { [modId: number]: Phaser.GameObjects.GameObject[] }
    // Other objects that should be attached to this Unit, but shouldn't track
    // with simple movement
    otherAttachements: { [attachmentKey: string]: any };
}

/** Store unit json data for creating units */
export function loadUnitJson(unitJson) {
    unitCache = {};
    for (let name in unitJson) {
        let unitProps = unitJson[name];
        let attached = {};
        attached[nullModId] = [];
        unitCache[name] = {
            name: name,
            id: -1,
            movement: unitProps["movement"],
            maxSpeed: unitProps["maxSpeed"],
            maxAcceleration: unitProps["maxAcceleration"],
            maxAngularSpeed: unitProps["maxAngularSpeed"],
            minX: -1,
            maxX: -1,
            minY: -1,
            maxY: -1,
            bodyType: unitProps["bodyType"],
            bodySize: unitProps["bodySize"],
            bodyOffset: unitProps["bodyOffset"],
            rotation: unitProps["rotation"],
            health: unitProps["health"],
            maxHealth: unitProps["health"],
            weapon: unitProps["weapon"],
            weaponDelay: unitProps["weaponDelay"],
            currentWeaponDelay: 0,
            gameObj: null,
            healthBar: null,
            path: null,
            currentPathIndex: -1,
            playerOwned: unitProps["playerOwned"],
            purchasable: unitProps["purchasable"],
            price: unitProps["price"],
            tooltip: unitProps["tooltip"],
            timeSincePathfindMs: 10000, // Set to a high number so the unit doesn't wait for first pathfind
            defaultMods: unitProps["defaultMods"],
            mods: {},
            attachedObjects: attached,
            otherAttachements: {}
        };
    };
}

export function getUnitsJsonProperties(filter): Unit[] {
    let units = [];
    for (let name in unitCache) {
        let unit = getUnitJsonProperties(name);
        if (filter(unit)) {
            units.push(unit);
        }
    }
    return units;
}

/** Get a unit with property values defined in json, but don't actually create it in the scene.
 *  This method deep-copies the Unit, so the returned Unit can be modified as needed.
 */
export function getUnitJsonProperties(name: string) : Unit {
    let unitProps = unitCache[name];
    if (!unitProps) {
        return null;
    }
    //TODO ensure this is sufficient - if not, try lodash.deepcopy module
    return JSON.parse(JSON.stringify(unitProps));
}

/** Create a Phaser ImageWithDynamicBody for the unit defined with the given name in units.json */
export function createUnit(name: string, location: Phaser.Types.Math.Vector2Like, scene: RoomScene, crawlerWall?: string) : Unit {
    let unitJson = unitCache[name];
    if (!unitJson) {
        return null;
    }
    let unit = getUnitJsonProperties(name);

    // Create the actual Phaser ImageWithDynamicBody
    let unitImage = scene.physics.add.image(location.x, location.y, name);
    let unitId = getNewId();
    unitImage.setData("id", unitId);
    unitImage.setName(name);
    unitImage.setData("playerOwned", unit.playerOwned);
    if (unitJson["bodyType"] == "circle") {
        unitImage.body.setCircle(unitJson["bodySize"], unitJson["bodyOffset"], unitJson["bodyOffset"]);
    } else { // Default to square
        unitImage.setBodySize(unitJson["bodySize"], unitJson["bodySize"]);
    }
    unitImage.setDrag(defaultUnitDrag);

    // Create the Unit's health bar
    let healthBarBackground = scene.add.rectangle(location.x, location.y,
        healthBarWidth + 2, healthBarHeight + 2, 0, 0.5).setDisplayOrigin(healthBarWidth / 2 + 1, healthBarYPos + 1);
    unit.healthBar = scene.add.rectangle(location.x, location.y,
        healthBarWidth, healthBarHeight, healthBarFillColor, 0.5).setDisplayOrigin(healthBarWidth / 2, healthBarYPos);

    unit.attachedObjects[nullModId].push(healthBarBackground);
    unit.attachedObjects[nullModId].push(unit.healthBar);

    if (unit.movement == "crawler") {
        unit.movement = "crawler" + crawlerWall;
        let roomBlocks = scene.getRoomBlocks();
        let startingTile = roomBlocks.getTileAtWorldXY(location.x, location.y, true);

        switch (crawlerWall) {
            case 'N':
                unitImage.setRotation(Math.PI / 2);
                setMinMaxX(unit, startingTile.x, startingTile.y - 1, roomBlocks);
                break;
            case 'E':
                unitImage.setRotation(Math.PI);
                setMinMaxY(unit, startingTile.x + 1, startingTile.y, roomBlocks);
                break;
            case 'S':
                unitImage.setRotation(3 * Math.PI / 2);
                setMinMaxX(unit, startingTile.x, startingTile.y + 1, roomBlocks);
                break;
            case 'W':
                setMinMaxY(unit, startingTile.x - 1, startingTile.y, roomBlocks);
                break;
        }
    }

    unit.id = unitId;
    unit.gameObj = unitImage;

    // Create any default mods for the unit
    if (unit.defaultMods) {
        Object.keys(unit.defaultMods).forEach(type => {
            createUnitMod(unit, ModType[type], unit.defaultMods[type], scene);
        });
    }

    // Apply any on-creation effects for mods applied to this unit
    getAllGlobalModsForUnit(unit.playerOwned).forEach(mod => {
        applyModCreationEffect(mod, unit);
    })

    return unit;
}

//TODO may need updated if I have tiles that collide but don't allow crawlers on them
function setMinMaxX(unit: Unit, startingTileX: number, startingWallTileY: number, roomBlocks: Phaser.Tilemaps.TilemapLayer) {
    let x = startingTileX;
    while (x > 0) {
        x--;
        let tile = roomBlocks.getTileAt(x, startingWallTileY, true);
        if (!tile.collides) {
            unit.minX = tile.pixelX + 3 * tile.width / 2;
            break;
        }
    }
    x = startingTileX;
    while (x < 18) {
        x++;
        let tile = roomBlocks.getTileAt(x, startingWallTileY, true);
        if (!tile.collides) {
            unit.maxX = tile.pixelX - tile.width / 2;
            break;
        }
    }
}

//TODO may need updated if I have tiles that collide but don't allow crawlers on them
function setMinMaxY(unit: Unit, startingWallTileX: number, startingTileY: number, roomBlocks: Phaser.Tilemaps.TilemapLayer) {
    let y = startingTileY;
    while (y > 0) {
        y--;
        let tile = roomBlocks.getTileAt(startingWallTileX, y, true);
        if (!tile.collides) {
            unit.minY = tile.pixelY + 3 * tile.width / 2;
            break;
        }
    }
    y = startingTileY;
    while (y < 18) {
        y++;
        let tile = roomBlocks.getTileAt(startingWallTileX, y, true);
        if (!tile.collides) {
            unit.maxY = tile.pixelY - tile.width / 2;
            break;
        }
    }
}

export function destroyUnit(unit: Unit) {
    unit.gameObj.destroy();
    Object.keys(unit.attachedObjects).forEach(modId => {
        unit.attachedObjects[modId].forEach(attached => {
            attached.destroy();
        });
    });
}

/** Update the health/max health of a given unit */
export function updateHealth(unit: Unit, newHealth: number, newMaxHealth?: number) {
    let damaged = newHealth < unit.health;

    unit.health = newHealth;
    if (newMaxHealth) {
        unit.maxHealth = newMaxHealth;
    }

    if (unit.health <= 0) {
        if (hasMod(unit, ModType.EXPLODE_ON_DEATH)) {
            createExplosion(unit.playerOwned, unit.gameObj.body.center, unit.gameObj.scene as RoomScene, null, null, null, unit);
        }
        destroyUnit(unit);
    } else {
        let healthFraction = unit.health / unit.maxHealth;
        let barWidth = healthBarWidth * healthFraction;
        unit.healthBar.setSize(barWidth, healthBarHeight);

        // Flash on taking hit for some visual feedback
        if (damaged) {
            flickerGameObject(unit.gameObj.scene, unit.gameObj);
        }
    }
}

/** Cause the unit to take a certain amount of damage, and destroy it if health reaches zero. */
export function takeDamage(unit: Unit, damage: number) {
    if (damage <= 0) {
        return;
    }

    // Apply any shield mods
    if (hasMod(unit, ModType.SHIELD)) {
        unit.mods[ModType.SHIELD].forEach(mod => {
            if (mod.props.shieldStrength > 0) {
                damage -= mod.props.shieldStrength;
                // Flash the shield itself for visual feedback
                if (unit.attachedObjects[mod.id]) {
                    unit.attachedObjects[mod.id].forEach(attached => {
                        flickerGameObject(unit.gameObj.scene, attached as unknown as Phaser.GameObjects.Components.Tint);
                    });
                }
            }
        });
    }
    if (damage <= 0) {
        return;
    }

    updateHealth(unit, unit.health - damage);
}

/** Check if unit has an active mod of the given type */
export function hasMod(unit: Unit, type: ModType): boolean {
    return unit && ((unit.mods[type] && unit.mods[type].length > 0) || globalHasMod(unit.playerOwned, type));
}

export function getAllModsOfType(unit: Unit, type: ModType): Mod[] {
    let allMods = [];
    if (unit.mods[type]) {
        allMods = allMods.concat(unit.mods[type]);
    }
    allMods = allMods.concat(getGlobalModsOfType(unit.playerOwned, type));
    return allMods;
}