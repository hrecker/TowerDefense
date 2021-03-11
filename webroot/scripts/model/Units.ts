let unitCache;
let unitId = 0;

/** A Unit in the active room */
export type Unit = {
    name: string;
    id: number;
    movement: string;
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
    unitImage.body.setMaxSpeed(unitJson["maxSpeed"]);

    return {
        name: name,
        id: unitId,
        movement: unitJson["movement"],
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
export function handleHit(obj1: Phaser.Types.Physics.Arcade.ImageWithDynamicBody, obj2: Phaser.Types.Physics.Arcade.ImageWithDynamicBody) {
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
    
    //TODO will need more logic for collisions with actual units rather than will bullets
    let unit: Unit = this.getUnit(obj1.getData("id"));
    if (!unit) {
        unit = this.getUnit(obj2.getData("id"));
    }

    //TODO different damage per weapon and per modifier
    if (unit) {
        unit.health -= 1;
        if (unit.health <= 0) {
            unit.gameObj.destroy();
        }
    }
}