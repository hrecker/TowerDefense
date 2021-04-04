import { backgroundColor } from "../util/Util";
import * as move from "../units/Movement";
import * as weapon from "../units/Weapon";
import { handleUnitHit, handleProjectileHit, updateFrameOverlaps } from "../units/Collision";
import { Unit, createUnit, destroyUnit} from "../model/Units";
import { ModType, createUnitMod, purgeExpiredMods } from "../model/Mods";
import { getShopSelection, setInvalidUnitPlacementReason } from "../state/UIState";
import { setTimerMs, setRoomStatus, getRoomStatus, RoomStatus } from "../state/RoomState";
import { setResources, getResources, addResources } from "../state/ResourceState";

let ship: Unit;
let roomNum = 1;
let roomTarget: Unit; // Target the ship is trying to destroy
let roomMap: Phaser.Tilemaps.Tilemap;
let roomBlocks: Phaser.Tilemaps.TilemapLayer;
let roomReward: number;
//let graphics;
// Nav mesh for units to get around the current room
let navMesh;
let sceneUnits: { [id: number]: Unit } = {};
let playerUnits: Phaser.Physics.Arcade.Group;
let shipUnits: Phaser.Physics.Arcade.Group;
let playerBullets: Phaser.Physics.Arcade.Group;
let shipBullets: Phaser.Physics.Arcade.Group;
let playerBulletsCollider;
let playerBulletsOverlap;
let shipBulletsCollider;
let shipBulletsOverlap;
let unitOverlap;

let lastInvalidPlacementReason: string = "";

//TODO vary by room or level?
const transitionTimeMs = 5000;
const roomTimeLimitMs = 60000;
let timerRemainingMs;
let shipSpawnSprite: Phaser.GameObjects.Image;

let lastShipPos: Phaser.Math.Vector2;
let lastTargetPos: Phaser.Math.Vector2;

let sceneTime = 0;

export const tileWidthPixels = 32;

export class RoomScene extends Phaser.Scene {
    constructor() {
        super({
            key: "RoomScene"
        });
    }

    create() {
        this.cameras.main.setBackgroundColor(backgroundColor);
        this.startRoom("room" + roomNum);
        this.input.on('pointerdown', (pointer) => {
            if (!this.createUnitFromShopSelection(pointer)) {
                setInvalidUnitPlacementReason(lastInvalidPlacementReason);
            }
        });
    }

    startRoom(room: string) {
        let roomJson = this.cache.json.get("rooms")[room];
        let shipSpawnPos = roomJson["shipSpawn"];
        let targetSpawnPos = roomJson["targetSpawn"];
        roomReward = roomJson["reward"];

        setRoomStatus(RoomStatus.COUNTDOWN);
        if (roomNum == 1) {
            // Start with 200 resources
            setResources(200);
        }
        //TODO varying setup time by room or floor
        timerRemainingMs = transitionTimeMs;
        setTimerMs(timerRemainingMs);
        //graphics = this.add.graphics();

        // Room tiles
        roomMap = this.make.tilemap({ key: room });
        const tileset = roomMap.addTilesetImage("OneBlock", "block");
        roomBlocks = roomMap.createLayer("tiles", tileset);
        let navMeshLayer = roomMap.getObjectLayer("navmesh");
        roomBlocks.setCollisionByProperty({ collides: true });

        shipSpawnSprite = this.add.image(shipSpawnPos.x, shipSpawnPos.y, "ship");
        this.tweens.addCounter({
            from: 50,
            to: 255,
            duration: 500,
            ease: "Sine.InOut",
            yoyo: true,
            loop: -1,
            onUpdate: function (tween)
            {
                const value = Math.floor(tween.getValue());
                shipSpawnSprite.setTint(Phaser.Display.Color.GetColor(value, value, value));
            }
        });

        // Units
        sceneUnits = {};
        roomTarget = createUnit("target", targetSpawnPos, this);
        sceneUnits[roomTarget.id] = roomTarget;

        playerUnits = this.physics.add.group(roomTarget.gameObj);
        shipUnits = this.physics.add.group();

        if (playerBullets) {
            playerBullets.destroy(true);
        }
        playerBullets = this.physics.add.group();
        if (shipBullets) {
            shipBullets.destroy(true);
        }
        shipBullets = this.physics.add.group();
        
        // Destroy bullets on touching geometry
        if (playerBulletsCollider) {
            this.physics.world.removeCollider(playerBulletsCollider);
        }
        playerBulletsCollider = this.physics.add.collider(playerBullets, this.getRoomBlocks(), (obj1, obj2) => {
            // In these callbacks, tilemap doesn't seem to have the getData function, so have to check for it
            let bullet = obj2;
            if (typeof obj1.getData === "function" && obj1.getData("isBullet")) {
                bullet = obj1;
            }
            bullet.destroy();
        });
        if (shipBulletsCollider) {
            this.physics.world.removeCollider(shipBulletsCollider);
        }
        shipBulletsCollider = this.physics.add.collider(shipBullets, this.getRoomBlocks(), (obj1, obj2) => {
            // In these callbacks, tilemap doesn't seem to have the getData function, so have to check for it
            let bullet = obj2;
            if (typeof obj1.getData === "function" && obj1.getData("isBullet")) {
                bullet = obj1;
            }
            bullet.destroy();
        });
        // Handle bullet hit on target
        playerBulletsOverlap = this.physics.add.overlap(playerBullets, this.getShipUnits(), handleProjectileHit, null, this);
        shipBulletsOverlap = this.physics.add.overlap(shipBullets, this.getPlayerUnits(), handleProjectileHit, null, this);

        this.physics.add.collider(roomBlocks, shipUnits);
        //TODO future units that don't collide with blocks
        this.physics.add.collider(roomBlocks, playerUnits);
        unitOverlap = this.physics.add.overlap(shipUnits, playerUnits, handleUnitHit, null, this);

        navMesh = this["navMeshPlugin"].buildMeshFromTiled(room, navMeshLayer, 8);
        move.setRoomNavmesh(navMesh);
        // Visualize the underlying navmesh
        //navMesh.enableDebug(); 
        /*navMesh.debugDrawMesh({
          drawCentroid: true,
          drawBounds: true,
          drawNeighbors: true,
          drawPortals: false
        });*/
    }

    spawnShipUnit() {
        shipSpawnSprite.destroy();
        ship = createUnit("ship", shipSpawnSprite.getCenter(), this);
        // Add a 1-second "infinitely" strong shield so the player can't always cheese the ship by
        // dumping a bunch of units on the spawn point
        createUnitMod(ship, ModType.SHIELD, { duration: 1000, shieldStrength: 10000, attachSprite: "shield" }, this);
        sceneUnits[ship.id] = ship;
        shipUnits.add(ship.gameObj);
        move.updateUnitTarget(ship, roomTarget.gameObj.body.center, 10000);
        setRoomStatus(RoomStatus.ACTIVE);
    }

    createUnitFromShopSelection(position: Phaser.Types.Math.Vector2Like) {
        let sel = getShopSelection();
        if (!sel) {
            lastInvalidPlacementReason = "";
            return false;
        }
        if (getRoomStatus() == RoomStatus.DEFEAT || getRoomStatus() == RoomStatus.VICTORY) {
            lastInvalidPlacementReason = "Room is no longer active!";
            return false;
        }
        if (sel.price <= getResources()) {
            // Make sure the position is valid
            let tile = roomMap.getTileAtWorldXY(position.x, position.y, true);
            if (tile && tile.collides) {
                lastInvalidPlacementReason = "Can't place unit here!";
                return false;
            }

            // Snap crawlers to wall and orient them correctly
            //TODO handle other unit names that attach to walls
            let wall = null;
            if (sel.name == "crawler") {
                // Check if the tile is a valid place to put a crawler
                if (roomMap.getLayer("wallspawns").data[tile.y][tile.x].index == -1) {
                    lastInvalidPlacementReason = "Crawlers must be adjacent to a wall!";
                    return false;
                }
                wall = move.findCrawlerWall(roomMap, tile, position);
                // If no wall is found somehow, can't place the unit
                if (!wall) {
                    lastInvalidPlacementReason = "SHOULDN'T HAPPEN: Can't determine where to place the crawler!";
                    return false;
                }
            }

            let unit = createUnit(sel.name, { x: tile.getCenterX(), y: tile.getCenterY() }, this, wall);
            sceneUnits[unit.id] = unit;
            playerUnits.add(unit.gameObj);
            addResources(-sel.price);
            return true;
        }
        lastInvalidPlacementReason = "Need more resources!";
        return false;
    }

    getShipUnits() {
        return shipUnits;
    }

    getPlayerUnits() {
        return playerUnits;
    }

    getShipBulletGroup() {
        return shipBullets;
    }

    getPlayerBulletGroup() {
        return playerBullets;
    }

    getRoomBlocks() {
        return roomBlocks;
    }

    getUnit(id: number) {
        if (!id) {
            return null;
        }
        return sceneUnits[id];
    }

    getSceneTime() {
        return sceneTime;
    }

    // Prevent any further unit damage from bullets in the scene
    startRoomTransition() {
        this.physics.world.removeCollider(playerBulletsOverlap);
        this.physics.world.removeCollider(shipBulletsOverlap);
        this.physics.world.removeCollider(unitOverlap);
        timerRemainingMs = transitionTimeMs;
    }

    handleRoomVictory() {
        setRoomStatus(RoomStatus.VICTORY);
        this.startRoomTransition();
        //TODO better way to keep count of max rooms, probably will totally change when there are multiple "levels"
        roomNum = Math.min(roomNum + 1, 3);
        // Add reward for room + half-rebate on units that are still living
        let resourceBonus = roomReward;
        Object.keys(sceneUnits).forEach(id => {
            let unit: Unit = sceneUnits[id];
            if (unit.playerOwned && unit.price) {
                resourceBonus += unit.price / 2;
            }
        });
        addResources(Math.floor(resourceBonus));
    }

    handleRoomDefeat() {
        setRoomStatus(RoomStatus.DEFEAT);
        this.startRoomTransition();
        roomNum = 1;
    }

    moveUnits(delta) {
        Object.keys(sceneUnits).forEach(id => {
            // Pass in graphics for some debugging (the arcade physics debug property must be set to true)
            move.moveUnit(sceneUnits[id], this.getUnitTarget(sceneUnits[id]), roomMap, delta, null /*graphics*/);
        });
    }

    getUnitTarget(unit): Phaser.Math.Vector2 {
        let targetUnit: Unit;
        if (unit.playerOwned) {
            targetUnit = ship;
        } else if (roomTarget.gameObj.body) {
            targetUnit = roomTarget;
        }
        let target;
        if (targetUnit && targetUnit.gameObj.body) {
            target = targetUnit.gameObj.body.center;
        } else if (unit.playerOwned) {
            target = lastShipPos;
        } else {
            target = lastTargetPos;
        }
        
        return target;
    }

    update(time, delta) {
        sceneTime += delta;
        if (timerRemainingMs > 0) {
            // Counting down until ship spawns/next room starts/player wins by default
            timerRemainingMs -= delta;
            if (timerRemainingMs < 0) {
                timerRemainingMs = 0;
            }
            setTimerMs(timerRemainingMs);
            if (timerRemainingMs == 0) {
                switch (getRoomStatus()) {
                    case RoomStatus.COUNTDOWN:
                        this.spawnShipUnit();
                        timerRemainingMs = roomTimeLimitMs;
                        break;
                    case RoomStatus.ACTIVE:
                        // After room time limit ends, ship self-destructs
                        destroyUnit(ship);
                        break;
                    case RoomStatus.DEFEAT:
                    case RoomStatus.VICTORY:
                        this.scene.restart();
                        break;
                }
            }
        } 
        if (getRoomStatus() != RoomStatus.COUNTDOWN) {
            // Remove units from sceneUnits when they are destroyed
            Object.keys(sceneUnits).forEach(id => {
                if (!sceneUnits[id].gameObj.body) {
                    let name = sceneUnits[id].name;
                    delete sceneUnits[id];
                    // Reload room on victory/failure
                    //TODO maintain resources between rooms in some way
                    if (name == "ship") {
                        setRoomStatus(RoomStatus.VICTORY);
                        this.handleRoomVictory();
                    } else if (name == "target") {
                        setRoomStatus(RoomStatus.DEFEAT);
                        this.handleRoomDefeat();
                    }
                }
            });

            // Remove mods that have expired
            purgeExpiredMods(sceneTime);

            // Movement
            this.moveUnits(delta);

            if (getRoomStatus() == RoomStatus.ACTIVE) {
                // Weapons
                Object.keys(sceneUnits).forEach(id => {
                    weapon.updateUnitWeapon(sceneUnits[id], this.getUnitTarget(sceneUnits[id]), delta, this);
                });
                // Track units overlapping for dealing damage
                updateFrameOverlaps();

                lastShipPos = ship.gameObj.body.center.clone();
                lastTargetPos = roomTarget.gameObj.body.center.clone();
            }
        }
    }
}