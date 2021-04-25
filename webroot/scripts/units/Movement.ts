import { Mod, ModType } from "../model/Mods";
import { Unit, hasMod } from "../model/Units";
import { RoomScene, tileWidthPixels } from "../scenes/RoomScene";
import { getTargetPos } from "./AI";

let activeNavmesh;

export function setRoomNavmesh(navmesh) {
    activeNavmesh = navmesh;
}

/** Move a unit for one frame (call each frame in the update method of a scene) */
export function moveUnit(unit: Unit, targetUnit: Unit, roomScene: RoomScene, delta: number, debugGraphics: Phaser.GameObjects.Graphics) {
    let target = getTargetPos(unit, targetUnit, roomScene);
    let targetId = -1;
    if (targetUnit && targetUnit.gameObj.body) {
        targetId = targetUnit.id;
    }
    
    if (target) {
        // Apply movement mods
        if (hasMod(unit, ModType.DODGE_ENEMIES)) {
            //TODO probably shouldn't even be possible to have multiple DODGE_ENEMIES mods...
            //TODO maybe some kind of assert that prevents duplicates for certain mod types?
            unit.mods[ModType.DODGE_ENEMIES].forEach(mod => {
                if (mod.props.currentCooldownMs > 0) {
                    mod.props.currentCooldownMs -= delta;
                } else if (dodgeNearestEnemy(unit, mod, roomScene)) {
                    mod.props.currentCooldownMs = mod.props.dodgeCooldownMs;
                }
            });
        }

        switch (unit.movement) {
            case "homingLOS":
                //TODO could check line of sight before this, a bit more efficient
                updateUnitTarget(unit, target, delta);
                moveHomingUnit(unit, true, roomScene, debugGraphics, targetId);
                break;
            case "homing":
                updateUnitTarget(unit, target, delta);
                moveHomingUnit(unit, false, roomScene, debugGraphics);
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
    trackAttachedGameObjects(unit);
}

/** How close a unit needs to be before it has officially "made it" to a node on a path */
const pathDistanceCheck = 16;

/** How wide a rectangle to check for valid line of sight for a unit */
const defaultLineOfSightWidth = 20;

/** How often to redo pathfinding logic for homing units */
const pathfindIntervalMs = 500;

/** Width necessary for line of sight depends on weapon - unit wants to be able to shoot
 * at whatever it's looking at, bigger bullets need more space to avoid hitting obstacles.
 */
export function determineLineOfSightWidth(unit: Unit) {
    let los = defaultLineOfSightWidth;
    //TODO handle different weapon/mod types
    if (hasMod(unit, ModType.PROJECTILE_SCALE)) {
        los *= unit.mods[ModType.PROJECTILE_SCALE][0].props.projectileScale;
    }
    return los;
}

/** Check if the origin can see the target in the current room. Return true if line of sight is free. */
export function checkLineOfSight(unit: Unit, target: Phaser.Types.Math.Vector2Like,
        lineOfSightWidth: number, roomScene: RoomScene, debugGraphics: Phaser.GameObjects.Graphics, targetId?: number) {
    let origin = unit.gameObj.body.center;
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
        debugGraphics.strokeLineShape(line1);
        debugGraphics.strokeLineShape(line2);
        debugGraphics.strokeLineShape(line3);
    }

    let roomMap = roomScene.getRoomMap();
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

    // Check for units in the way
    /*let opposingUnits = [];
    if (unit.playerOwned) {
        opposingUnits = roomScene.getShipUnits().getChildren();
    } else {
        opposingUnits = roomScene.getPlayerUnits().getChildren();
    }
    for (let unit of opposingUnits) {
        // Don't check for the unit being targeted
        if (unit.getData("id") == targetId) {
            continue;
        }

        //TODO optimization - can likely rule out some here before looping

        let unitImage = unit as Phaser.Types.Physics.Arcade.ImageWithDynamicBody;
        let unitRect = new Phaser.Geom.Rectangle(0, 0, unitImage.width, unitImage.height);
        unitRect.x = unitImage.getTopLeft().x;
        unitRect.y = unitImage.getTopLeft().y;
        if (debugGraphics) {
            debugGraphics.strokeRectShape(unitRect);
        }
        // Only check center line for blocking units. Intersection means no line of sight
        //TODO any reason to check other lines as well?
        if (Phaser.Geom.Intersects.LineToRectangle(line1, unitRect)) {
            return false;
        }
    }*/

    return true;
}

/** Move a homing unit for one frame */
function moveHomingUnit(unit: Unit, onlyNeedLOS: boolean, roomScene: RoomScene, debugGraphics: Phaser.GameObjects.Graphics, targetId?: number) {
    if (debugGraphics) {
        debugGraphics.clear();
    }
    if (!unit.path || unit.path.length == 0 || unit.currentPathIndex < 0 || unit.currentPathIndex >= unit.path.length) {
        return;
    }

    // Get direction unit should move to hit target
    let target = new Phaser.Math.Vector2(unit.path[unit.currentPathIndex]);
    let homingDir = homingDirection(unit.gameObj.body, target, unit.maxAcceleration);
    let targetRotationAngle = homingDir.angle();

    // If the unit only needs line of sight and it has it, don't need to move any more.
    // Ghost projectiles mean the unit essentially always has line of sight.
    let lastPathTarget = unit.path[unit.path.length - 1];
    let hasLOS = onlyNeedLOS && (hasMod(unit, ModType.GHOST_PROJECTILES) ||
            checkLineOfSight(unit, lastPathTarget,
            determineLineOfSightWidth(unit), roomScene, debugGraphics, targetId));
    if (hasLOS) {
        unit.gameObj.setAcceleration(0);
        targetRotationAngle = new Phaser.Math.Vector2(lastPathTarget.x, lastPathTarget.y).subtract(unit.gameObj.body.center).angle();
    }

    if (unit.rotation) {
        // Rotate towards the target        
        unit.gameObj.setRotation(Phaser.Math.Angle.RotateTo(unit.gameObj.rotation, targetRotationAngle, unit.maxAngularSpeed));
        // Draw line being rotated towards
        if (debugGraphics) {
            let targetStretched = Phaser.Math.Vector2.RIGHT.clone().rotate(targetRotationAngle).scale(50);
            let debugLine = new Phaser.Geom.Line(unit.gameObj.body.center.x, unit.gameObj.body.center.y, 
                    unit.gameObj.body.center.x + targetStretched.x, unit.gameObj.body.center.y + targetStretched.y);
            debugGraphics.strokeLineShape(debugLine);
        }
    }

    // Exit early if LOS is all that's needed
    if (hasLOS) {
        return;
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

/** Match the unit's movement for any GameObjects attached to it. */
function trackAttachedGameObjects(unit: Unit) {
    Object.keys(unit.attachedObjects).forEach(modId => {
        unit.attachedObjects[modId].forEach(attached => {
            // Assume that the GameObject has a Transform component
            (attached as unknown as Phaser.GameObjects.Components.Transform).setPosition(
                    unit.gameObj.body.center.x, unit.gameObj.body.center.y);
        });
    });
}

/** Return true if the currentTarget is different from the target the unit is already after */
function hasTargetChanged(unit: Unit, currentTarget: Phaser.Types.Math.Vector2Like) {
    if (!unit.path || unit.path.length == 0 || unit.currentPathIndex < 0 || unit.currentPathIndex >= unit.path.length) {
        return true;
    }

    let lastTarget = unit.path[unit.path.length - 1];
    return lastTarget.x != currentTarget.x || lastTarget.y != currentTarget.y;
}

/** Generate a path for the unit to follow to the target using the room's navmesh */
export function updateUnitTarget(unit: Unit, target: Phaser.Types.Math.Vector2Like, delta: number) {
    unit.timeSincePathfindMs += delta;
    // Don't need to wait for interval when the target has changed
    if (unit.timeSincePathfindMs < pathfindIntervalMs && !hasTargetChanged(unit, target)) {
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

/** Find which wall a crawler unit should attach to when placed */
export function findCrawlerWall(roomMap: Phaser.Tilemaps.Tilemap, tile: Phaser.Tilemaps.Tile, 
        position: Phaser.Types.Math.Vector2Like): string {
    // Figure out which walls the crawler could attach to
    //TODO will likely need to change if there are non-colliding blocks or
    // blocks that collide but can't have crawlers in the future
    let walls = [];
    if (roomMap.layer.data[tile.y - 1][tile.x].index != -1) {
        walls.push('N');
    }
    if (roomMap.layer.data[tile.y][tile.x + 1].index != -1) {
        walls.push('E');
    }
    if (roomMap.layer.data[tile.y + 1][tile.x].index != -1) {
        walls.push('S');
    }
    if (roomMap.layer.data[tile.y][tile.x - 1].index != -1) {
        walls.push('W');
    }

    // Attach to the wall closest to the click
    let wallDist = Number.MAX_SAFE_INTEGER;
    let wall;
    walls.forEach(w => {
        let dist = Number.MAX_SAFE_INTEGER;
        switch (w) {
            case 'N':
                dist = position.y - tile.pixelY;
                break;
            case 'E':
                dist = tileWidthPixels - (position.x - tile.pixelX);
                break;
            case 'S':
                dist = tileWidthPixels - (position.y - tile.pixelY);
                break;
            case 'W':
                dist = position.x - tile.pixelX;
                break;
        }
        if (dist < wallDist) {
            wallDist = dist;
            wall = w;
        }
    });
    return wall;
}

const dodgeRadius = 50;
/** Check for nearby enemies and apply some dodge velocity if any are found*/
function dodgeNearestEnemy(unit: Unit, dodgeMod: Mod, roomScene: RoomScene): boolean {
    let nearby = roomScene.physics.overlapCirc(unit.gameObj.body.center.x, unit.gameObj.body.center.y, dodgeRadius);
    let nearbyEnemies = (nearby as Phaser.Physics.Arcade.Body[]).filter(body => 
            body.gameObject.getData("playerOwned") != undefined && 
            unit.playerOwned != body.gameObject.getData("playerOwned"));
    // Find the closest enemy
    nearbyEnemies.sort((a, b) => {
        return a.center.distance(unit.gameObj.getCenter()) - b.center.distance(unit.gameObj.getCenter());
    })
    if (nearbyEnemies.length > 0) {
        let dodgeVel;
        let enemy = nearbyEnemies[0];
        if (enemy.velocity.equals(Phaser.Math.Vector2.ZERO)) {
            //TODO handle when backing away just gets the ship stuck in a corner?
            dodgeVel = unit.gameObj.getCenter().clone().subtract(enemy.center).normalize().scale(dodgeMod.props.dodgeSpeed);
        } else {
            dodgeVel = enemy.velocity.clone().normalize().scale(dodgeMod.props.dodgeSpeed);
            // Randomly choose dodge direction - perpendicular to velocity of what is being dodged
            if (Math.random() < 0.5) {
                dodgeVel.normalizeLeftHand();
            } else {
                dodgeVel.normalizeRightHand();
            }
        }
        unit.gameObj.setVelocity(dodgeVel.x, dodgeVel.y);
        return true;
    }
    return false;
}