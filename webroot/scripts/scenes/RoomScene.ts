import { backgroundColor } from "../util/Util";
import * as move from "../units/Movement";
import * as weapon from "../units/Weapon";
import { handleUnitHit, handleProjectileHit, updateFrameOverlaps, handleProjectileHitGeometry } from "../units/Collision";
import * as ai from "../units/AI";
import { Unit, createUnit, destroyUnit} from "../model/Units";
import { ModType, createUnitMod, purgeExpiredMods, purgeGlobalMods, createGlobalMod } from "../model/Mods";
import { addShopSelectionListener, getShopSelection, setInvalidUnitPlacementReason,  } from "../state/UIState";
import { setTimerMs, setRoomStatus, getRoomStatus, RoomStatus, getActiveShipMods, getActiveShipWeapon, setRoomScene, clearRoomShopBuffs, resetRoom } from "../state/RoomState";
import { setResources, getResources, addResources } from "../state/ResourceState";

let ship: Unit;
let roomNum = 1;
let roomTarget: Unit; // Target the ship is trying to destroy
let roomMap: Phaser.Tilemaps.Tilemap;
let roomBlocks: Phaser.Tilemaps.TilemapLayer;
let roomReward: number;
//TODO remove in prod build
let graphics;
// Nav mesh for units to get around the current room
let navMesh;
let sceneUnits: { [id: number]: Unit } = {};
let playerUnits: Phaser.Physics.Arcade.Group;
let shipUnits: Phaser.Physics.Arcade.Group;
let playerBullets: Phaser.Physics.Arcade.Group;
let shipBullets: Phaser.Physics.Arcade.Group;
let projectiles: Phaser.Physics.Arcade.Group;
let projectilesRoomCollider;
let playerBulletsOverlap;
let shipBulletsOverlap;
let unitOverlap;

let lastInvalidPlacementReason: string = "";
let shopSelectionHover: Phaser.GameObjects.Image;

//TODO vary by room or level?
const transitionTimeMs = 2000;
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
        resetRoom(this);
        this.cameras.main.setBackgroundColor(backgroundColor);
        this.startRoom("room" + roomNum);
        shopSelectionHover = this.add.image(-1000, -1000, "target");
        shopSelectionHover.setAlpha(0.5);
        addShopSelectionListener(this.updateShopSelectionHover, this);
        this.updateShopSelectionHover(getShopSelection());
        this.input.on('pointerdown', (pointer) => {
            if (this.canPlaceShopSelection(pointer)) {
                this.createUnitFromShopSelection(pointer);
            } else {
                setInvalidUnitPlacementReason(lastInvalidPlacementReason);
            }
        });
    }

    // Create a physics group for units that does not reset drag when adding to the group
    createUnitPhysicsGroup() {
        let group = this.physics.add.group();
        delete group.defaults.setDragX;
        delete group.defaults.setDragY;
        return group;
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
        timerRemainingMs = transitionTimeMs;
        setTimerMs(timerRemainingMs);
        graphics = this.add.graphics();

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

        playerUnits = this.createUnitPhysicsGroup();
        playerUnits.add(roomTarget.gameObj);
        shipUnits = this.createUnitPhysicsGroup();

        if (playerBullets) {
            playerBullets.destroy(true);
        }
        playerBullets = this.physics.add.group();
        if (shipBullets) {
            shipBullets.destroy(true);
        }
        shipBullets = this.physics.add.group();
        if (projectiles) {
            projectiles.destroy(true);
        }
        projectiles = this.physics.add.group();

        // Handle projectiles hitting geometry
        if (projectilesRoomCollider) {
            this.physics.world.removeCollider(projectilesRoomCollider);
        }
        //TODO create a separate group for objects that should be destroyed on hitting geometry, to allow for bullets that pass through
        //TODO for bouncing bullets, just use a mod that removes the destroy line in these colliders.
        projectilesRoomCollider = this.physics.add.collider(projectiles, this.getRoomBlocks(), handleProjectileHitGeometry, null, this);
        
        // Handle bullet hit on units
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

        //TODO number of mods based on level/room?
        ai.randomizeShipWeapon(this);
        ai.randomizeShipMods(getActiveShipWeapon(), 1, this);
    }

    spawnShipUnit() {
        shipSpawnSprite.destroy();
        ship = createUnit("ship", shipSpawnSprite.getCenter(), this);
        // Add a 1-second "infinitely" strong shield so the player can't always cheese the ship by
        // dumping a bunch of units on the spawn point
        createUnitMod(ship, ModType.SHIELD, { duration: 1000, shieldStrength: 10000, attachSprite: "shield" }, this);
        // Activate any randomly chosen mods
        getActiveShipMods().forEach(modName => {
            createUnitMod(ship, ModType[modName], this.cache.json.get("shipMods")[modName]["props"], this);
        });
        // Set properties based on randomly chosen weapon
        //TODO similar separate props like mods do here, if there end up being more weapon properties to set
        ship.weapon = getActiveShipWeapon();
        ship.weaponDelay = this.cache.json.get("shipWeapons")[ship.weapon]["weaponDelay"];
        sceneUnits[ship.id] = ship;
        shipUnits.add(ship.gameObj);
        move.updateUnitTarget(ship, roomTarget.gameObj.body.center, 10000);
        setRoomStatus(RoomStatus.ACTIVE);
    }

    canPlaceShopSelection(position: Phaser.Types.Math.Vector2Like) {
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
            if (!tile || (tile && tile.collides)) {
                lastInvalidPlacementReason = "Can't place unit here!";
                return false;
            }

            // Check if the tile is a valid place to put a crawler
            //TODO handle other unit names that attach to walls
            if (sel.name == "crawler") {
                if (roomMap.getLayer("wallspawns").data[tile.y][tile.x].index == -1) {
                    lastInvalidPlacementReason = "Crawlers must be adjacent to a wall!";
                    return false;
                }
            }
            return true;
        }
        lastInvalidPlacementReason = "Need more resources!";
        return false;
    }

    createUnitFromShopSelection(position: Phaser.Types.Math.Vector2Like) {
        let sel = getShopSelection();
        let tile = roomMap.getTileAtWorldXY(position.x, position.y, true);
        let wall = null;
        // Crawlers snap to nearest wall
        //TODO handle other unit names that attach to walls
        if (sel.name == "crawler") {
            wall = move.findCrawlerWall(roomMap, tile, position);
        }
        let unit = createUnit(sel.name, { x: tile.getCenterX(), y: tile.getCenterY() }, this, wall);
        sceneUnits[unit.id] = unit;
        playerUnits.add(unit.gameObj);
        addResources(-sel.price);
    }

    updateShopSelectionHover(selection: Unit) {
        if (selection) {
            shopSelectionHover.setTexture(selection.name)
        }
    }

    getSceneUnits() {
        return sceneUnits;
    }

    getShip() {
        return ship;
    }

    getRoomTarget() {
        return roomTarget;
    }

    getLastShipPos() {
        return lastShipPos;
    }

    getLastTargetPos() {
        return lastTargetPos;
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

    getProjectileGroup() {
        return projectiles;
    }

    getRoomMap() {
        return roomMap;
    }

    getRoomBlocks() {
        return roomBlocks;
    }

    getUnit(id: number) {
        if (!id || !(id in sceneUnits)) {
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
            move.moveUnit(sceneUnits[id], ai.getUnitTarget(sceneUnits[id], this), this, delta, graphics);
        });
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
                    weapon.updateUnitWeapon(sceneUnits[id], ai.getTargetPos(sceneUnits[id], ai.getUnitTarget(sceneUnits[id], this), this), delta, this);
                });
                // Track units overlapping for dealing damage
                updateFrameOverlaps();

                lastShipPos = ship.gameObj.body.center.clone();
                lastTargetPos = roomTarget.gameObj.body.center.clone();
            }
        }

        // Show preview of shop selection
        let visible = false;
        if (this.canPlaceShopSelection(this.input.activePointer)) {
            let tile = roomMap.getTileAtWorldXY(this.input.activePointer.x, this.input.activePointer.y, true);
            if (tile) {
                visible = true;
                shopSelectionHover.setPosition(tile.getCenterX(), tile.getCenterY());
                //TODO handle other units that attach to walls
                if (getShopSelection().name == "crawler") {
                    let wall = move.findCrawlerWall(roomMap, tile, this.input.activePointer);
                    switch (wall) {
                        case 'W':
                            shopSelectionHover.setRotation(0);
                            break;
                        case 'N':
                            shopSelectionHover.setRotation(Math.PI / 2);
                            break;
                        case 'E':
                            shopSelectionHover.setRotation(Math.PI);
                            break;
                        case 'S':
                            shopSelectionHover.setRotation(3 * Math.PI / 2);
                            break;
                    }
                } else {
                    shopSelectionHover.setRotation(0);
                }
            }
        } 
        shopSelectionHover.setVisible(visible);
    }
}