import { backgroundColor } from "../util/Util";
import * as move from "../units/Movement";
import * as weapon from "../units/Weapon";
import { Unit, loadUnitJson, createUnit, handleUnitHit, updateFrameOverlaps } from "../model/Units";

let ship: Unit;
let target: Unit;
let roomBlocks: Phaser.Tilemaps.TilemapLayer;
let crosshairSprite: Phaser.GameObjects.Image;
// Nav mesh for units to get around the current room
let navMesh;
let sceneUnits: { [id: number]: Unit } = {};
let playerUnits: Phaser.Physics.Arcade.Group;
let shipUnits: Phaser.Physics.Arcade.Group;

export class MainScene extends Phaser.Scene {
    constructor() {
        super({
            key: "MainScene"
        });
    }

    preload() {
        this.load.image("ship", "assets/sprites/ship.png");
        this.load.image("turret", "assets/sprites/turret.png");

        this.load.image("playerBullet", "assets/sprites/playerBullet.png");
        this.load.image("shipBullet", "assets/sprites/shipBullet.png");

        this.load.image("crosshair", "assets/sprites/crosshair.png");
        this.load.image("target", "assets/sprites/target.png");
        this.load.image("block", "assets/sprites/block.png");

        this.load.tilemapTiledJSON("room1", "assets/rooms/room1.json");
        this.load.json("units", "assets/units/units.json");
    }

    create() {
        this.cameras.main.setBackgroundColor(backgroundColor);
        loadUnitJson(this.cache.json.get("units"));

        // Room tiles
        const roomMap = this.make.tilemap({ key: "room1" });
        const tileset = roomMap.addTilesetImage("OneBlock", "block");
        roomBlocks = roomMap.createLayer(0, tileset);
        let navMeshLayer = roomMap.getObjectLayer("navmesh");
        roomBlocks.setCollisionByProperty({ collides: true });

        // Units
        sceneUnits = [];
        ship = createUnit("ship", {x: 200, y: 200}, this);
        sceneUnits[ship.id] = ship;
        target = createUnit("target", {x: 400, y: 250}, this);
        sceneUnits[target.id] = target;
        let turret1 = createUnit("turret", {x: 300, y: 300}, this);
        let turret2 = createUnit("turret", {x: 300, y: 500}, this);
        sceneUnits[turret1.id] = turret1;
        sceneUnits[turret2.id] = turret2;

        playerUnits = this.physics.add.group([turret1.gameObj, turret2.gameObj, target.gameObj]);
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

        move.updateUnitTarget(ship, navMesh, target.gameObj.body.center);

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
            move.moveUnit(sceneUnits[id]);
        });
        Object.keys(sceneUnits).forEach(id => {
            let targetUnit;
            if (sceneUnits[id].playerOwned) {
                targetUnit = ship;
            } else {
                targetUnit = target;
            }
            weapon.updateUnitWeapon(sceneUnits[id], targetUnit, delta, this);
        });
        updateFrameOverlaps();
    }
}