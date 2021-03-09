let unitCache;

/** A Unit in the active room */
export type Unit = {
    name: string;
    maxAcceleration: number;
    maxAngularSpeed: number;
    rotation: boolean;
    health: number;
    weapon: string;
    gameObj: Phaser.Types.Physics.Arcade.ImageWithDynamicBody;
    path: Phaser.Types.Math.Vector2Like[];
    currentPathIndex: number;
}

/** Store unit json data for creating units */
export function loadUnitJson(unitJson) {
    unitCache = unitJson;
}

/** Create a Phaser ImageWithDynamicBody for the unit defined with the given name in units.json */
export function createUnit(name: string, scene: Phaser.Scene) : Unit {
    let unitJson = unitCache[name];
    if (!unitJson) {
        return null;
    }

    // Create the actual Phaser ImageWithDynamicBody
    let unitImage = scene.physics.add.image(200, 200, "ship");
    if (unitJson["bodyType"] == "circle") {
        unitImage.body.setCircle(unitJson["bodySize"], unitJson["bodyOffset"], unitJson["bodyOffset"]);
    } else { // Default to square
        unitImage.setBodySize(unitJson["bodySize"], unitJson["bodySize"]);
    }
    unitImage.body.setMaxSpeed(unitJson["maxSpeed"]);

    return {
        name: name,
        maxAcceleration: unitJson["maxAcceleration"],
        maxAngularSpeed: unitJson["maxAngularSpeed"],
        rotation: unitJson["rotation"],
        health: unitJson["health"],
        weapon: unitJson["weapon"],
        gameObj: unitImage,
        path: null,
        currentPathIndex: -1
    };
}