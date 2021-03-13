let unitCache;
let unitId = 0;
let activeOverlaps: { [id: string]: boolean } = {};
let currentFrameOverlaps: { [id: string]: boolean } = {};

/** A Unit in the active room */
export type Unit = {
    name: string;
    id: number;
    movement: string;
    maxSpeed: number;
    maxAcceleration: number;
    maxAngularSpeed: number;
    rotation: boolean;
    health: number;
    weapon: string;
    weaponDelay: number;
    currentWeaponDelay: number;
    gameObj: Phaser.Types.Physics.Arcade.ImageWithDynamicBody;
    path: Phaser.Types.Math.Vector2Like[];
    currentPathIndex: number;
    playerOwned: boolean;
}

/** Store unit json data for creating units */
export function loadUnitJson(unitJson) {
    unitCache = unitJson;
}

/** Create a Phaser ImageWithDynamicBody for the unit defined with the given name in units.json */
export function createUnit(name: string, location: Phaser.Types.Math.Vector2Like, scene: Phaser.Scene) : Unit {
    let unitJson = unitCache[name];
    if (!unitJson) {
        return null;
    }

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

    return {
        name: name,
        id: unitId,
        movement: unitJson["movement"],
        maxSpeed: unitJson["maxSpeed"],
        maxAcceleration: unitJson["maxAcceleration"],
        maxAngularSpeed: unitJson["maxAngularSpeed"],
        rotation: unitJson["rotation"],
        health: unitJson["health"],
        weapon: unitJson["weapon"],
        weaponDelay: unitJson["weaponDelay"],
        currentWeaponDelay: 0,
        gameObj: unitImage,
        path: null,
        currentPathIndex: -1,
        playerOwned: unitJson["playerOwned"]
    };
}

/** Should be used as an overlap callback, to handle when a projectile hits a unit */
export function handleProjectileHit(obj1: Phaser.Types.Physics.Arcade.ImageWithDynamicBody, obj2: Phaser.Types.Physics.Arcade.ImageWithDynamicBody) {
    //TODO handle different projectile types
    let bullet: Phaser.Types.Physics.Arcade.ImageWithDynamicBody;
    if (obj1.name == "playerBullet") {
        bullet = obj1;
    } else if (obj2.name == "playerBullet") {
        bullet = obj2;
    }
    if (bullet) {
        bullet.destroy();
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

    let id1 = unit1.id;
    let id2 = unit2.id;
    if (id2 < id1) {
        id1 = unit2.id;
        id2 = unit1.id;
    }
    let overlapId = id1 + "_" + id2;

    currentFrameOverlaps[overlapId] = true;
    if (activeOverlaps[overlapId]) {
        // Don't cause multiple collisions while units remain overlapped
        return;
    }
    activeOverlaps[overlapId] = true;

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
        unit.gameObj.destroy();
    }
}

/** Update which units are currently overlapping */
export function updateFrameOverlaps() {
    Object.keys(activeOverlaps).forEach(overlapId => {
        if (!currentFrameOverlaps[overlapId]) {
            activeOverlaps[overlapId] = undefined;
        }
    });
    currentFrameOverlaps = {};
}