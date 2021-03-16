import { backgroundColor } from "../util/Util";
import * as move from "../units/Movement";
import * as weapon from "../units/Weapon";
import { Unit, createUnit, handleUnitHit, updateFrameOverlaps } from "../model/Units";

let ship: Unit;
let roomTarget: Unit; // Target the ship is trying to destroy
let roomMap: Phaser.Tilemaps.Tilemap;
let roomBlocks: Phaser.Tilemaps.TilemapLayer;
let crosshairSprite: Phaser.GameObjects.Image;
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
        sceneUnits[turret1.id] = turret1;
        sceneUnits[turret2.id] = turret2;

        playerUnits = this.physics.add.group([turret1.gameObj, turret2.gameObj, roomTarget.gameObj]);
        shipUnits = this.physics.add.group(ship.gameObj);

        this.physics.add.collider(roomBlocks, shipUnits);
        this.physics.add.overlap(shipUnits, playerUnits, handleUnitHit, null, this);

        navMesh = this["navMeshPlugin"].buildMeshFromTiled("mesh", navMeshLayer, 8);
        // Visualize the underlying navmesh
        //navMesh.enableDebug(); 
        /*navMesh.debugDrawMesh({
          drawCentroid: true,
          drawBounds: true,
          drawNeighbors: true,
          drawPortals: false
        });*/

        move.updateUnitTarget(ship, navMesh, roomTarget.gameObj.body.center);

        crosshairSprite = this.add.image(-1000, -1000, "crosshair");

        this.input.on('pointerdown', (pointer) => {
            if (ship.gameObj.body) {
                move.updateUnitTarget(ship, navMesh, pointer);
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
            move.moveUnit(sceneUnits[id], roomMap, null /*graphics*/);
        });
        Object.keys(sceneUnits).forEach(id => {
            let targetUnit: Unit;
            if (sceneUnits[id].playerOwned) {
                targetUnit = ship;
            } else if (roomTarget.gameObj.body) {
                targetUnit = roomTarget;
            }
            let target;
            if (targetUnit && targetUnit.gameObj.body) {
                target = targetUnit.gameObj.body.center;
            } else {
                target = crosshairSprite.getCenter();
            }
            weapon.updateUnitWeapon(sceneUnits[id], target, delta, this);
        });
        updateFrameOverlaps();
    }
}