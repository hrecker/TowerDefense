import { ModType } from "../model/Mods";
import { Unit, takeDamage, hasMod } from "../model/Units";
import { RoomScene } from "../scenes/RoomScene";
import { WithId } from "../state/IdState";
import { createExplosion, projectileNames } from "../units/Weapon";

let activeOverlaps: { [id: string]: number } = {};
let currentFrameOverlaps: { [id: string]: boolean } = {};

// How many frames of constant overlap before triggering overlap again
// This is necessary so that homing units that are constantly overlapping
// the ship can do more than one damage, and for AOE damage areas like explosions.
const framesToReOverlap = 60;

/** Update which objects are currently overlapping/colliding */
export function updateFrameOverlaps() {
    Object.keys(activeOverlaps).forEach(overlapId => {
        if (!currentFrameOverlaps[overlapId]) {
            activeOverlaps[overlapId] = 0;
        }
    });
    currentFrameOverlaps = {};
}

/** Get a string key corresponding to two objects overlapping */
function getOverlapId(obj1: WithId, obj2: WithId) {
    let id1 = obj1.id;
    let id2 = obj2.id;
    if (id2 < id1) {
        id1 = obj2.id;
        id2 = obj1.id;
    }
    return id1 + "_" + id2;
}

/** Set the overlapId as current and check if it should be skipped this frame.
 * Prevents rapid collisions/overlaps after initial overlap.
 */
function shouldSkipCurrentOverlap(overlapId: string) {
    if (overlapId in activeOverlaps && activeOverlaps[overlapId] > 0 &&
        activeOverlaps[overlapId] < framesToReOverlap) {
        activeOverlaps[overlapId]++;
        return true;
    }
    return false;
}

/** Any action the projectile itself needs to take when it hits something */
function projectileOnHit(projectile: Phaser.Types.Physics.Arcade.ImageWithDynamicBody, scene: RoomScene) {
    if (!projectile.getData("isAOE")) {
        if (projectile.getData("exploding")) {
            createExplosion(projectile.getData("playerOwned"), projectile.body.center, scene);
        }
        projectile.destroy();
    }
}

/** Should be used as an overlap callback, to handle when a projectile hits a unit */
export function handleProjectileHit(obj1: Phaser.Types.Physics.Arcade.ImageWithDynamicBody, obj2: Phaser.Types.Physics.Arcade.ImageWithDynamicBody) {
    let proj: Phaser.Types.Physics.Arcade.ImageWithDynamicBody;
    if (projectileNames.includes(obj1.name)) {
        proj = obj1;
    } else if (projectileNames.includes(obj2.name)) {
        proj = obj2;
    }
    if (proj && proj.getData("id")) {
        projectileOnHit(proj, this);
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

    let overlapId = getOverlapId(unit, { id: proj.getData("id") });
    currentFrameOverlaps[overlapId] = true;
    if (shouldSkipCurrentOverlap(overlapId)) {
        return;
    }
    activeOverlaps[overlapId] = 1;

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

    let overlapId = getOverlapId(unit1, unit2);
    currentFrameOverlaps[overlapId] = true;
    if (shouldSkipCurrentOverlap(overlapId)) {
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

/** Handle projectiles that need special behavior when hitting the room geometry (destroy, bounce, explode, etc.) */
export function handleProjectileHitGeometry(obj1: Phaser.Types.Physics.Arcade.ImageWithDynamicBody, obj2: Phaser.Types.Physics.Arcade.ImageWithDynamicBody) {
    // In these callbacks, tilemap doesn't seem to have the getData function, so have to check for it
    let bullet = obj2;
    if (typeof obj1.getData === "function" && obj1.getData("isBullet")) {
        bullet = obj1;
    }
    projectileOnHit(bullet, this);
}