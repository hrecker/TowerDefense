import { backgroundColor } from "../util/Util";
import * as move from "../units/Movement";
import * as weapon from "../units/Weapon";
import { Unit, createUnit, handleUnitHit, handleProjectileHit, updateFrameOverlaps } from "../model/Units";
import { getShopSelection } from "../state/UIState";
import { setTimeUntilSpawnMs, setShipActive, setTargetActive, isShipActive, isTargetActive } from "../state/RoomState";
import { setResources, getResources, useResources } from "../state/ResourceState";

let ship: Unit;
let roomName = "room1";
let roomTarget: Unit; // Target the ship is trying to destroy
let roomMap: Phaser.Tilemaps.Tilemap;
let roomBlocks: Phaser.Tilemaps.TilemapLayer;
//let graphics;
// Nav mesh for units to get around the current room
let navMesh;
let roomNavMeshes = {};
let sceneUnits: { [id: number]: Unit } = {};
let playerUnits: Phaser.Physics.Arcade.Group;
let shipUnits: Phaser.Physics.Arcade.Group;
let playerBullets: Phaser.Physics.Arcade.Group;
let shipBullets: Phaser.Physics.Arcade.Group;
let playerBulletsCollider;
let playerBulletsOverlap;
let shipBulletsCollider;
let shipBulletsOverlap;

//TODO vary by room or level?
const transitionTimeMs = 5000;
let setupTimeRemainingMs, roomTransitionTimeRemainingMs;
let shipSpawnPos = { x: 200, y: 200 }
let shipSpawnSprite: Phaser.GameObjects.Image;
let roomComplete;

// Coordinates for placing crawler units in the room
const crawlerMinTile = 1;
const crawlerMaxTile = 17;

export class RoomScene extends Phaser.Scene {
    constructor() {
        super({
            key: "RoomScene"
        });
    }

    create() {
        console.log("RoomScene starting");
        this.cameras.main.setBackgroundColor(backgroundColor);
        this.startRoom(roomName);
        this.input.on('pointerdown', (pointer) => {
            if (!this.createUnitFromShopSelection(pointer)) {
                console.log("Unable to place this unit here");
            }
        });
    }

    startRoom(room: string) {
        roomComplete = false;
        //TODO varying setup time by room or floor
        setupTimeRemainingMs = transitionTimeMs;
        setTimeUntilSpawnMs(setupTimeRemainingMs);
        //graphics = this.add.graphics();

        // Room tiles
        roomMap = this.make.tilemap({ key: room });
        const tileset = roomMap.addTilesetImage("OneBlock", "block");
        roomBlocks = roomMap.createLayer(0, tileset);
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
        roomTarget = createUnit("target", {x: 400, y: 500}, this);
        sceneUnits[roomTarget.id] = roomTarget;
        setTargetActive(true);

        playerUnits = this.physics.add.group(roomTarget.gameObj);
        shipUnits = this.physics.add.group();
        playerBullets = this.physics.add.group();
        shipBullets = this.physics.add.group();
        
        // Destroy bullets on touching geometry
        playerBulletsCollider = this.physics.add.collider(playerBullets, this.getRoomBlocks(), (obj1, obj2) => {
            // In these callbacks, tilemap doesn't seem to have the getData function, so have to check for it
            let bullet = obj2;
            if (typeof obj1.getData === "function" && obj1.getData("isBullet")) {
                bullet = obj1;
            }
            bullet.destroy();
        });
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
        this.physics.add.overlap(shipUnits, playerUnits, handleUnitHit, null, this);

        if (!roomNavMeshes[room]) {
            roomNavMeshes[room] = this["navMeshPlugin"].buildMeshFromTiled("mesh", navMeshLayer, 8);
        }
        navMesh = roomNavMeshes[room];
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
        ship = createUnit("ship", {x: 200, y: 200}, this);
        sceneUnits[ship.id] = ship;
        shipUnits.add(ship.gameObj);
        move.updateUnitTarget(ship, roomTarget.gameObj.body.center, 10000);
        setShipActive(true);
    }

    createUnitFromShopSelection(position: Phaser.Types.Math.Vector2Like) {
        let sel = getShopSelection()
        if (sel && sel.price <= getResources()) {
            // Make sure the position is valid
            let tile = roomMap.getTileAtWorldXY(position.x, position.y, true);
            if (tile && tile.collides) {
                return false;
            }

            // Snap crawlers to wall and orient them correctly
            //TODO handle other unit names that attach to walls
            let wall = null;
            if (sel.name == "crawler") {
                if (tile.x == crawlerMinTile) {
                    wall = 'W';
                } else if (tile.x == crawlerMaxTile) {
                    wall = 'E';
                } else if (tile.y == crawlerMinTile) {
                    wall = 'N';
                } else if (tile.y == crawlerMaxTile) {
                    wall = 'S';
                } else {
                    return false;
                }
            }

            let unit = createUnit(sel.name, { x: tile.getCenterX(), y: tile.getCenterY() }, this, wall);
            sceneUnits[unit.id] = unit;
            playerUnits.add(unit.gameObj);
            console.log("using resources");
            useResources(sel.price);
            return true;
        }
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

    handleRoomComplete() {
        roomComplete = true;
        setResources(200);
        this.physics.world.removeCollider(playerBulletsCollider);
        this.physics.world.removeCollider(playerBulletsOverlap);
        this.physics.world.removeCollider(shipBulletsCollider);
        this.physics.world.removeCollider(shipBulletsOverlap);
        playerBullets.destroy(true);
        shipBullets.destroy(true);
        //this.scene.restart();
    }

    handleRoomFailed() {
        roomComplete = true;
        setResources(200);
        this.physics.world.removeCollider(playerBulletsCollider);
        this.physics.world.removeCollider(playerBulletsOverlap);
        this.physics.world.removeCollider(shipBulletsCollider);
        this.physics.world.removeCollider(shipBulletsOverlap);
        playerBullets.destroy(true);
        shipBullets.destroy(true);
        //this.scene.restart();
    }

    update(time, delta) {
        if (setupTimeRemainingMs > 0) {
            // Still counting down until ship spawns
            setupTimeRemainingMs -= delta;
            setTimeUntilSpawnMs(setupTimeRemainingMs);
            if (setupTimeRemainingMs <= 0) {
                this.spawnShipUnit();
            }
        } else if (!roomComplete) {
            // Remove units from sceneUnits when they are destroyed
            Object.keys(sceneUnits).forEach(id => {
                if (!sceneUnits[id].gameObj.body) {
                    let name = sceneUnits[id].name;
                    console.log("Deleting unit " + name);
                    delete sceneUnits[id];
                    if (name == "ship") {
                        setShipActive(false);
                    } else if (name == "target") {
                        setTargetActive(false);
                    }
                }
            });

            Object.keys(sceneUnits).forEach(id => {
                // Pass in graphics for some debugging (the arcade physics debug property must be set to true)
                move.moveUnit(sceneUnits[id], this.getUnitTarget(sceneUnits[id]), roomMap, delta, null /*graphics*/);
            });
            Object.keys(sceneUnits).forEach(id => {
                weapon.updateUnitWeapon(sceneUnits[id], this.getUnitTarget(sceneUnits[id]), delta, this);
            });
            updateFrameOverlaps();

            // Reload room on victory/failure
            //TODO maintain resources between rooms in some way
            if (!isTargetActive()) { // Failure
                this.handleRoomFailed();
            } else if (!isShipActive()) { // Victory
                this.handleRoomComplete();
            }
        } else {
            //TODO room complete - countdown until loading next room or restarting on failure
        }
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
        }
        return target;
    }
}