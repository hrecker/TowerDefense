import { backgroundColor } from "../util/Util";
import * as move from "../units/Movement";
import * as weapon from "../units/Weapon";
import { Unit, createUnit, handleUnitHit, updateFrameOverlaps } from "../model/Units";

let ship: Unit;
let roomTarget: Unit; // Target the ship is trying to destroy
let roomMap: Phaser.Tilemaps.Tilemap;
let roomBlocks: Phaser.Tilemaps.TilemapLayer;
let crosshairSprite: Phaser.GameObjects.Image;
let lastShipPos: Phaser.Math.Vector2;
//let graphics;
// Nav mesh for units to get around the current room
let navMesh;
let sceneUnits: { [id: number]: Unit } = {};
let playerUnits: Phaser.Physics.Arcade.Group;
let shipUnits: Phaser.Physics.Arcade.Group;

export class RoomScene extends Phaser.Scene {
    constructor() {
        super({
            key: "RoomScene"
        });
    }

    create() {
        console.log("RoomScene starting");
        this.cameras.main.setBackgroundColor(backgroundColor);
        //graphics = this.add.graphics();

        // Room tiles
        roomMap = this.make.tilemap({ key: "room1" });
        const tileset = roomMap.addTilesetImage("OneBlock", "block");
        roomBlocks = roomMap.createLayer(0, tileset);
        let navMeshLayer = roomMap.getObjectLayer("navmesh");
        roomBlocks.setCollisionByProperty({ collides: true });

        // Units
        sceneUnits = [];
        ship = createUnit("ship", {x: 200, y: 200}, this);
        sceneUnits[ship.id] = ship;
        roomTarget = createUnit("target", {x: 400, y: 500}, this);
        sceneUnits[roomTarget.id] = roomTarget;
        let turret1 = createUnit("turret", {x: 300, y: 300}, this);
        let turret2 = createUnit("turret", {x: 300, y: 500}, this);
        let chaser1 = createUnit("chaser", {x: 100, y: 400}, this);
        let chaser2 = createUnit("chaser", {x: 200, y: 550}, this);
        let crawler1 = createUnit("crawler", {x: 48, y: 48}, this, 'N');
        let crawler2 = createUnit("crawler", {x: 560, y: 300}, this, 'E');
        let crawler3 = createUnit("crawler", {x: 100, y: 560}, this, 'S');
        let crawler4 = createUnit("crawler", {x: 48, y: 400}, this, 'W');
        sceneUnits[turret1.id] = turret1;
        sceneUnits[turret2.id] = turret2;
        sceneUnits[chaser1.id] = chaser1;
        sceneUnits[chaser2.id] = chaser2;
        sceneUnits[crawler1.id] = crawler1;
        sceneUnits[crawler2.id] = crawler2;
        sceneUnits[crawler3.id] = crawler3;
        sceneUnits[crawler4.id] = crawler4;

        playerUnits = this.physics.add.group([turret1.gameObj, turret2.gameObj, chaser1.gameObj, chaser2.gameObj, crawler1.gameObj, crawler2.gameObj, crawler3.gameObj, crawler4.gameObj, roomTarget.gameObj]);
        shipUnits = this.physics.add.group(ship.gameObj);

        this.physics.add.collider(roomBlocks, shipUnits);
        this.physics.add.collider(roomBlocks, [crawler1.gameObj, crawler2.gameObj, crawler3.gameObj, crawler4.gameObj]);
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

        move.updateUnitTarget(ship, roomTarget.gameObj.body.center, 10000);

        crosshairSprite = this.add.image(-1000, -1000, "crosshair");

        this.input.on('pointerdown', (pointer) => {
            if (ship.gameObj.body) {
                move.updateUnitTarget(ship, pointer, 10000);
                crosshairSprite.setPosition(pointer.x, pointer.y);
            } else {
                crosshairSprite.setVisible(false);
            }
        });
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
        // Remove units from sceneUnits when they are destroyed
        Object.keys(sceneUnits).forEach(id => {
            if (!sceneUnits[id].gameObj.body) {
                console.log("Deleting unit " + sceneUnits[id].name);
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
            if (targetUnit.name == "ship") {
                lastShipPos = target;
            }
        } else if (unit.playerOwned) {
            target = lastShipPos;
        } else {
            target = crosshairSprite.getCenter();
        }
        return target;
    }
}