import { Unit } from "../model/Units";

// How close a unit needs to be before it has officially "made it" to a node on a path
const pathDistanceCheck = 16;

// Move a homing unit for one frame (call each frame in the update method of a scene)
export function moveHomingUnit(unit: Unit) {
    if (!unit.path || unit.path.length == 0 || unit.currentPathIndex < 0 || unit.currentPathIndex >= unit.path.length) {
        return;
    }

    // Get direction unit should move to hit target
    let target = new Phaser.Math.Vector2(unit.path[unit.currentPathIndex]);
    let homingDir = homingDirection(unit.gameObj.body, target, unit.maxAcceleration);
    let targetAngle = homingDir.clone().add(unit.gameObj.body.center);

    // Accelerate towards the target
    unit.gameObj.setAcceleration(homingDir.x * unit.maxAcceleration, homingDir.y * unit.maxAcceleration);

    if (unit.rotation) {
        // Rotate towards the target
        let angleBetween = Phaser.Math.Angle.BetweenPoints(unit.gameObj.body.center, targetAngle);
        unit.gameObj.setRotation(Phaser.Math.Angle.RotateTo(unit.gameObj.rotation, angleBetween, unit.maxAngularSpeed));
    }

    // Update current target along path if appropriate
    updatePathTarget(unit);
}

// Generate a path for the unit to follow to the target using the room's navmesh
export function updateUnitTarget(unit: Unit, navMesh, target: Phaser.Types.Math.Vector2Like) {
    let path = navMesh.findPath(
        { x: unit.gameObj.body.center.x, y: unit.gameObj.body.center.y }, 
        { x: target.x, y: target.y });
    let index = 0;
    if (path) {
        index = 1;
    } else {
        console.log("Couldn't find a path for " + unit.name + "!");
        // Just try to go straight towards it (probably won't work though)
        // Likely to occur if the target point is right next to an obstacle in the room (and thus outside the navmesh)
        path = [target];
    }

    unit.path = path;
    unit.currentPathIndex = index;
}

// If a unit has reached the current target of its path, then move to the next one
function updatePathTarget(unit: Unit) {
    // Don't need to update the target if we're at the end of the current path
    if (!unit.path || unit.currentPathIndex >= unit.path.length - 1 || unit.currentPathIndex < 0) {
        return;
    }

    // If ship has reached a node, aim for the next one
    let dist = unit.gameObj.body.center.distance(new Phaser.Math.Vector2(unit.path[unit.currentPathIndex]));
    if (dist <= pathDistanceCheck) {
        unit.currentPathIndex++;
    }
}

// Note: this assumes the target is stationary
// See https://gamedev.stackexchange.com/questions/52988/implementing-a-homing-missile
// and https://gamedev.stackexchange.com/questions/17313/how-does-one-prevent-homing-missiles-from-orbiting-their-targets
// Based on a (possibly moving) body, a stationary target, and the max acceleration of the body, 
// calculate the direction the body should accelerate to hit the target.
export function homingDirection(body : Phaser.Physics.Arcade.Body, target: Phaser.Math.Vector2, maxAcc: number): Phaser.Math.Vector2 {
    let dirToImpact = target.clone().subtract(body.center);
    let dirtoImpactNorm = dirToImpact.clone().normalize();
    if (body.velocity.equals(Phaser.Math.Vector2.ZERO)) {
        return dirtoImpactNorm;
    }
    // Get relative velocity of target from body's frame of reference
    let relativeTargetVel = body.velocity.clone().negate();

    // Component of relative target velocity towards the body
    let v = relativeTargetVel.clone().negate().dot(dirtoImpactNorm);

    // Time estimate for impact
    let eta = (-v / maxAcc) + Math.sqrt(Math.pow(v, 2) / Math.pow(maxAcc, 2) + (2 * dirToImpact.length() / maxAcc));

    // Estimate impact position, and aim towards it
    let impactPos = relativeTargetVel.scale(eta).add(target);
    return impactPos.subtract(body.center).normalize();
}