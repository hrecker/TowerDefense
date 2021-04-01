import { Unit, takeDamage } from "../model/Units";
import { projectileNames } from "../units/Weapon";

let activeOverlaps: { [id: string]: number } = {};
let currentFrameOverlaps: { [id: string]: boolean } = {};

// How many frames of constant overlap before triggering overlap again
// This is necessary so that homing units that are constantly overlapping
// the ship can do more than one damage.
const framesToReOverlap = 60;

/** Update which units are currently overlapping */
export function updateFrameOverlaps() {
    Object.keys(activeOverlaps).forEach(overlapId => {
        if (!currentFrameOverlaps[overlapId]) {
            activeOverlaps[overlapId] = 0;
        }
    });
    currentFrameOverlaps = {};
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