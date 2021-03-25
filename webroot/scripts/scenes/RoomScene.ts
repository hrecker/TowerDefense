import { backgroundColor } from "../util/Util";
import * as move from "../units/Movement";
import * as weapon from "../units/Weapon";
import { Unit, createUnit, handleUnitHit, updateFrameOverlaps } from "../model/Units";
import { getShopSelection } from "../state/UIState";
import { setTimeUntilSpawnMs, setShipActive } from "../state/RoomState";
import { getResources, useResources } from "../state/ResourceState";

let ship: Unit;
let roomTarget: Unit; // Target the ship is trying to destroy
let roomMap: Phaser.Tilemaps.Tilemap;
let roomBlocks: Phaser.Tilemaps.TilemapLayer;
let lastShipPos: Phaser.Math.Vector2;
let lastRoomTargetPos: Phaser.Math.Vector2;
//let graphics;
// Nav mesh for units to get around the current room
let navMesh;
let sceneUnits: { [id: number]: Unit } = {};
let playerUnits: Phaser.Physics.Arcade.Group;
let shipUnits: Phaser.Physics.Arcade.Group;

//TODO vary by room or level?
const initialSetupTimeMs = 5000;
let setupTimeRemainingMs = initialSetupTimeMs;
let shipSpawnPos = { x: 200, y: 200 }
let shipSpawnSprite: Phaser.GameObjects.Image;

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
        setTimeUntilSpawnMs(setupTimeRemainingMs);
        //graphics = this.add.graphics();

        // Room tiles
        roomMap = this.make.tilemap({ key: "room1" });
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
        sceneUnits = [];
        roomTarget = createUnit("target", {x: 400, y: 500}, this);
        sceneUnits[roomTarget.id] = roomTarget;

        playerUnits = this.physics.add.group(roomTarget.gameObj);
        shipUnits = this.physics.add.group();

        this.physics.add.collider(roomBlocks, shipUnits);
        //TODO future units that don't collide with blocks
        this.physics.add.collider(roomBlocks, playerUnits);
        this.physics.add.overlap(shipUnits, playerUnits, handleUnitHit, null, this);

        navMesh = this["navMeshPlugin"].buildMeshFromTiled("mesh", navMeshLayer, 8);
        move.setRoomNavmesh(navMesh);
        // Visualize the underlying navmesh
        //navMesh.enableDebug(); 
        /*navMesh.debugDrawMesh({
          drawCentroid: true,
          drawBounds: true,
          drawNeighbors: true,
          drawPortals: false
        });*/

        this.input.on('pointerdown', (pointer) => {
            if (!this.createUnitFromShopSelection(pointer)) {
                console.log("Unable to place this unit here");
            }
        });
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

    getRoomBlocks() {
        return roomBlocks;
    }

    getUnit(id: number) {
        if (!id) {
            return null;
        }
        return sceneUnits[id];
    }

    update(time, delta) {
        if (setupTimeRemainingMs > 0) {
            // Still counting down until ship spawns
            setupTimeRemainingMs -= delta;
            setTimeUntilSpawnMs(setupTimeRemainingMs);
            if (setupTimeRemainingMs <= 0) {
                this.spawnShipUnit();
            }
        } else {
            // Remove units from sceneUnits when they are destroyed
            Object.keys(sceneUnits).forEach(id => {
                if (!sceneUnits[id].gameObj.body) {
                    console.log("Deleting unit " + sceneUnits[id].name);
                    if (sceneUnits[id].name == "ship") {
                        setShipActive(false);
                    }
                    delete sceneUnits[id];
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