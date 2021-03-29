import { Unit, healthBarYPos } from "../model/Units";

let activeNavmesh;

export function setRoomNavmesh(navmesh) {
    activeNavmesh = navmesh;
}

/** Move a unit for one frame (call each frame in the update method of a scene) */
export function moveUnit(unit: Unit, target: Phaser.Math.Vector2, roomMap: Phaser.Tilemaps.Tilemap, delta: number, debugGraphics: Phaser.GameObjects.Graphics) {
    if (target) {
        switch (unit.movement) {
            case "homingLOS":
                //TODO could check line of sight before this, a bit more efficient
                updateUnitTarget(unit, target, delta);
                moveHomingUnit(unit, true, roomMap, debugGraphics);
                break;
            case "homing":
                updateUnitTarget(unit, target, delta);
                moveHomingUnit(unit, false, roomMap, debugGraphics);
                break;
            case "crawlerN":
                moveCrawlerUnit(unit, target, 'N');
                break;
            case "crawlerE":
                moveCrawlerUnit(unit, target, 'E');
                break;
            case "crawlerS":
                moveCrawlerUnit(unit, target, 'S');
                break;
            case "crawlerW":
                moveCrawlerUnit(unit, target, 'W');
                break;
        }
    }

    clampUnitSpeed(unit);
    clampUnitPosition(unit);
    trackUnitHealthBar(unit);
}

/** How close a unit needs to be before it has officially "made it" to a node on a path */
const pathDistanceCheck = 16;

//TODO make variable depending on unit/weapon
const lineOfSightWidth = 20;

/** How often to redo pathfinding logic for homing units */
const pathfindIntervalMs = 500;

/** Check if the origin can see the target in the current room. Return true if line of sight is free. */
export function checkLineOfSight(origin: Phaser.Types.Math.Vector2Like, target: Phaser.Types.Math.Vector2Like,
    roomMap: Phaser.Tilemaps.Tilemap, debugGraphics: Phaser.GameObjects.Graphics) {
    // Create 3 lines from near center of origin to near center of target, to ensure space for firing weapons
    let targetVector = new Phaser.Math.Vector2(target).subtract(new Phaser.Math.Vector2(origin));
    let left = targetVector.clone().normalizeLeftHand().setLength(lineOfSightWidth / 2);
    let right = targetVector.normalizeRightHand().setLength(lineOfSightWidth / 2);

    let leftOrigin = new Phaser.Math.Vector2(origin).add(left);
    let rightOrigin = new Phaser.Math.Vector2(origin).add(right);
    let leftTarget = new Phaser.Math.Vector2(target).add(left);
    let rightTarget = new Phaser.Math.Vector2(target).add(right);

    let line1 = new Phaser.Geom.Line(origin.x, origin.y, target.x, target.y);
    let line2 = new Phaser.Geom.Line(leftOrigin.x, leftOrigin.y, leftTarget.x, leftTarget.y);
    let line3 = new Phaser.Geom.Line(rightOrigin.x, rightOrigin.y, rightTarget.x, rightTarget.y);

    // Debugging for line of sight
    if (debugGraphics) {
        debugGraphics.clear();
        debugGraphics.strokeLineShape(line1);
        debugGraphics.strokeLineShape(line2);
        debugGraphics.strokeLineShape(line3);
    }

    let originTile = roomMap.layer.tilemapLayer.worldToTileXY(origin.x, origin.y, true);
    let targetTile = roomMap.layer.tilemapLayer.worldToTileXY(target.x, target.y, true);
    let pointStart = new Phaser.Math.Vector2(Math.min(originTile.x, targetTile.x), Math.min(originTile.y, targetTile.y));
    let pointEnd = new Phaser.Math.Vector2(Math.max(originTile.x, targetTile.x), Math.max(originTile.y, targetTile.y));

    // Tiles within bounding rectangle of origin and target tiles, to narrow down which ones to check
    var width = pointEnd.x - pointStart.x + 1;
    var height = pointEnd.y - pointStart.y + 1;
    let possibleIntersects = roomMap.getTilesWithin(pointStart.x, pointStart.y, width, height, { isColliding: true });

    for (let tile of possibleIntersects) {
        let tileRect = new Phaser.Geom.Rectangle(0, 0, roomMap.layer.tileWidth, roomMap.layer.tileHeight);
        let worldPoint = roomMap.layer.tilemapLayer.tileToWorldXY(tile.x, tile.y);
        tileRect.x = worldPoint.x;
        tileRect.y = worldPoint.y;
        for (let line of [line1, line2, line3]) {
            // Any intersection means no line of sight
            if (Phaser.Geom.Intersects.LineToRectangle(line, tileRect)) {
                return false;
            }
        }
    }
    return true;
}

/** Move a homing unit for one frame */
function moveHomingUnit(unit: Unit, onlyNeedLOS: boolean, roomMap: Phaser.Tilemaps.Tilemap, debugGraphics: Phaser.GameObjects.Graphics) {
    if (!unit.path || unit.path.length == 0 || unit.currentPathIndex < 0 || unit.currentPathIndex >= unit.path.length) {
        return;
    }

    // Get direction unit should move to hit target
    let target = new Phaser.Math.Vector2(unit.path[unit.currentPathIndex]);
    let homingDir = homingDirection(unit.gameObj.body, target, unit.maxAcceleration);
    let targetAngle = homingDir.clone().add(unit.gameObj.body.center);

    if (unit.rotation) {
        // Rotate towards the target
        let angleBetween = Phaser.Math.Angle.BetweenPoints(unit.gameObj.body.center, targetAngle);
        unit.gameObj.setRotation(Phaser.Math.Angle.RotateTo(unit.gameObj.rotation, angleBetween, unit.maxAngularSpeed));
    }

    // If the unit only needs line of sight and it has it, don't need to move any more
    if (onlyNeedLOS && checkLineOfSight(unit.gameObj.body.center, unit.path[unit.path.length - 1], roomMap, debugGraphics)) {
        unit.gameObj.setAcceleration(0);
        // Once the target is visible, allow drag to slow the unit down more naturally
        unit.gameObj.setDrag(500);
        return;
    } else {
        unit.gameObj.setDrag(0);
    }

    // Accelerate towards the target
    unit.gameObj.setAcceleration(homingDir.x * unit.maxAcceleration, homingDir.y * unit.maxAcceleration);

    // Update current target along path if appropriate
    updatePathTarget(unit);
}

function clampUnitSpeed(unit: Unit) {
    if (unit.gameObj.body.velocity.length() > unit.maxSpeed) {
        let newVel = unit.gameObj.body.velocity.normalize().scale(unit.maxSpeed);
        unit.gameObj.setVelocity(newVel.x, newVel.y);
    }
}

function clampUnitPosition(unit: Unit) {
    if (unit.minX != -1 && unit.gameObj.x < unit.minX) {
        unit.gameObj.setPosition(unit.minX, unit.gameObj.y);
        unit.gameObj.setVelocity(0);
    } else if (unit.maxX != -1 && unit.gameObj.x > unit.maxX) {
        unit.gameObj.setPosition(unit.maxX, unit.gameObj.y);
        unit.gameObj.setVelocity(0);
    }
    
    if (unit.minY != -1 && unit.gameObj.y < unit.minY) {
        unit.gameObj.setPosition(unit.gameObj.x, unit.minY);
        unit.gameObj.setVelocity(0);
    } else if (unit.maxY != -1 && unit.gameObj.y > unit.maxY) {
        unit.gameObj.setPosition(unit.gameObj.x, unit.maxY);
        unit.gameObj.setVelocity(0);
    }
}

function trackUnitHealthBar(unit: Unit) {
    unit.healthBar.setPosition(unit.gameObj.body.center.x, unit.gameObj.body.center.y - healthBarYPos);
    unit.healthBarBackground.setPosition(unit.gameObj.body.center.x, unit.gameObj.body.center.y - healthBarYPos);
}

/** Generate a path for the unit to follow to the target using the room's navmesh */
export function updateUnitTarget(unit: Unit, target: Phaser.Types.Math.Vector2Like, delta: number) {
    unit.timeSincePathfindMs += delta;
    if (unit.timeSincePathfindMs < pathfindIntervalMs) {
        return;
    }

    let path = activeNavmesh.findPath(
        { x: unit.gameObj.body.center.x, y: unit.gameObj.body.center.y }, 
        { x: target.x, y: target.y });
    let index = 0;
    if (path) {
        index = 1;
    } else {
        console.log("Couldn't find a path for " + unit.name + "!");
        // Just try to go straight towards it (probably won't work though)
        // Likely to occur if the target point is right next to an obstacle in the room (and thus outside the navmesh)
        path = [new Phaser.Math.Vector2(target)];
    }

    unit.path = path;
    unit.currentPathIndex = index;
    unit.timeSincePathfindMs = 0;
}

/** If a unit has reached the current target of its path, then move to the next one */
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

/**
 * Note: this assumes the target is stationary
 * See https://gamedev.stackexchange.com/questions/52988/implementing-a-homing-missile
 * and https://gamedev.stackexchange.com/questions/17313/how-does-one-prevent-homing-missiles-from-orbiting-their-targets
 * Based on a (possibly moving) body, a stationary target, and the max acceleration of the body, 
 * calculate the direction the body should accelerate to hit the target.
 */
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

/** How many pixels off the crawler can be when considering itself in line with its target */
const crawlerErrorMargin = 10;

function moveCrawlerUnit(unit: Unit, target: Phaser.Math.Vector2, wall: string) {
    switch (wall) {
        case 'N':
        case 'S':
            let xDiff = Math.abs(target.x - unit.gameObj.body.center.x);
            if (xDiff > crawlerErrorMargin) {
                if (target.x > unit.gameObj.body.center.x && (unit.gameObj.x < unit.maxX || unit.maxX == -1)) {
                    unit.gameObj.setVelocity(unit.maxSpeed, 0);
                } else if (target.x < unit.gameObj.body.center.x && (unit.gameObj.x > unit.minX || unit.maxX == -1)) {
                    unit.gameObj.setVelocity(-unit.maxSpeed, 0);
                }
            } else {
                unit.gameObj.setVelocity(0);
            }
            break;
        case 'E':
        case 'W':
            let yDiff = Math.abs(target.y - unit.gameObj.body.center.y);
            if (yDiff > crawlerErrorMargin) {
                if (target.y > unit.gameObj.body.center.y && (unit.gameObj.y < unit.maxY || unit.maxY == -1)) {
                    unit.gameObj.setVelocity(0, unit.maxSpeed);
                } else if (target.y < unit.gameObj.body.center.y && (unit.gameObj.y > unit.minY || unit.minY == -1)) {
                    unit.gameObj.setVelocity(0, -unit.maxSpeed);
                }
            } else {
                unit.gameObj.setVelocity(0);
            }
            break;
    }
}