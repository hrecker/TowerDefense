import { RoomScene } from "../scenes/RoomScene";
import { projectileNames } from "../units/Weapon";

let unitCache;
let unitId = 0;
let activeOverlaps: { [id: string]: number } = {};
let currentFrameOverlaps: { [id: string]: boolean } = {};

// How many frames of constant overlap before triggering overlap again
// This is necessary so that homing units that are constantly overlapping
// the ship can do more than one damage.
const framesToReOverlap = 60;

const healthBarWidth = 64;
const healthBarHeight = 6;
export const healthBarYPos = 24;
const healthBarFillColor = 0x32a852;

/** A Unit in the active room */
export type Unit = {
    name: string;
    id: number;
    movement: string;
    maxSpeed: number;
    maxAcceleration: number;
    maxAngularSpeed: number;
    maxX: number;
    minX: number;
    maxY: number;
    minY: number;
    rotation: boolean;
    health: number;
    maxHealth: number;
    weapon: string;
    weaponDelay: number;
    currentWeaponDelay: number;
    gameObj: Phaser.Types.Physics.Arcade.ImageWithDynamicBody;
    healthBarBackground: Phaser.GameObjects.Rectangle;
    healthBar: Phaser.GameObjects.Rectangle;
    path: Phaser.Types.Math.Vector2Like[];
    currentPathIndex: number;
    playerOwned: boolean;
    purchasable: boolean;
    price: number;
    timeSincePathfindMs: number;
}

/** Store unit json data for creating units */
export function loadUnitJson(unitJson) {
    unitCache = {};
    for (let name in unitJson) {
        let unitProps = unitJson[name];
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
            rotation: unitProps["rotation"],
            health: unitProps["health"],
            maxHealth: unitProps["health"],
            weapon: unitProps["weapon"],
            weaponDelay: unitProps["weaponDelay"],
            currentWeaponDelay: 0,
            gameObj: null,
            healthBarBackground: null,
            healthBar: null,
            path: null,
            currentPathIndex: -1,
            playerOwned: unitProps["playerOwned"],
            purchasable: unitProps["purchasable"],
            price: unitProps["price"],
            timeSincePathfindMs: 10000 // Set to a high number so the unit doesn't wait for first pathfind
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
    unitId++;
    unitImage.setData("id", unitId);
    unitImage.setName(name);
    if (unitJson["bodyType"] == "circle") {
        unitImage.body.setCircle(unitJson["bodySize"], unitJson["bodyOffset"], unitJson["bodyOffset"]);
    } else { // Default to square
        unitImage.setBodySize(unitJson["bodySize"], unitJson["bodySize"]);
    }

    // Create the Unit's health bar
    unit.healthBarBackground = scene.add.rectangle(location.x, location.y - healthBarYPos,
        healthBarWidth + 2, healthBarHeight + 2, 0, 0.5);
    unit.healthBar = scene.add.rectangle(location.x, location.y - healthBarYPos,
        healthBarWidth, healthBarHeight, healthBarFillColor, 0.5);

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
    unit.healthBarBackground.destroy();
    unit.healthBar.destroy();
}

/** Should be used as an overlap callback, to handle when a projectile hits a unit */
export function handleProjectileHit(obj1: Phaser.Types.Physics.Arcade.ImageWithDynamicBody, obj2: Phaser.Types.Physics.Arcade.ImageWithDynamicBody) {
    let bullet: Phaser.Types.Physics.Arcade.ImageWithDynamicBody;
    if (projectileNames.includes(obj1.name)) {
        bullet = obj1;
    } else if (projectileNames.includes(obj2.name)) {
        bullet = obj2;
    }
    if (bullet && bullet.getData("id")) {
        bullet.destroy();
    } else {
        // If bullet isn't defined or has no id, it has already hit something. In that case,
        // don't damage the unit, so that one bullet can't hit multiple units
        //TODO this behavior may need to change for projectiles that pierce enemies
        return;
    }
    
    let unit: Unit = this.getUnit(obj1.getData("id"));
    if (!unit) {
        unit = this.getUnit(obj2.getData("id"));
    }

    //TODO different damage per weapon and per modifier
    if (unit) {
        takeDamage(unit, 1);
    }
}

/** Should be used as an overlap callback, to handle when a unit hits another unit */
export function handleUnitHit(obj1: Phaser.Types.Physics.Arcade.ImageWithDynamicBody, obj2: Phaser.Types.Physics.Arcade.ImageWithDynamicBody) {
    let unit1: Unit = this.getUnit(obj1.getData("id"));
    let unit2: Unit = this.getUnit(obj2.getData("id"));

    // When the ship is overlapping multiple player units and is destroyed before the last one,
    // in the subsequent overlap calls it can be null.
    if (!unit1 || !unit2) {
        return;
    }

    let id1 = unit1.id;
    let id2 = unit2.id;
    if (id2 < id1) {
        id1 = unit2.id;
        id2 = unit1.id;
    }
    let overlapId = id1 + "_" + id2;

    currentFrameOverlaps[overlapId] = true;
    if (overlapId in activeOverlaps && activeOverlaps[overlapId] > 0 &&
        activeOverlaps[overlapId] < framesToReOverlap) {
        // Prevent rapid overlaps after initial overlap
        activeOverlaps[overlapId]++;
        return;
    }

    activeOverlaps[overlapId] = 1;

    let ship = unit1;
    if (unit2.name == "ship") {
        ship = unit2;
    }

    //TODO modifiers etc.
    takeDamage(ship, 1);
}

/** Cause the unit to take a certain amount of damage, and destroy it if health reaches zero. */
export function takeDamage(unit: Unit, damage: number) {
    unit.health -= damage;
    if (unit.health <= 0) {
        destroyUnit(unit);
    } else {
        let healthFraction = unit.health / unit.maxHealth;
        let barWidth = healthBarWidth * healthFraction;
        unit.healthBar.setSize(barWidth, healthBarHeight);

        // Flash on taking hit for some visual feedback
        unit.gameObj.scene.tweens.addCounter({
            from: 50,
            to: 255,
            duration: 200,
            onUpdate: function (tween)
            {
                const value = Math.floor(tween.getValue());
                unit.gameObj.setTint(Phaser.Display.Color.GetColor(value, value, value));
            }
        });
    }
}

/** Update which units are currently overlapping */
export function updateFrameOverlaps() {
    Object.keys(activeOverlaps).forEach(overlapId => {
        if (!currentFrameOverlaps[overlapId]) {
            activeOverlaps[overlapId] = 0;
        }
    });
    currentFrameOverlaps = {};
}