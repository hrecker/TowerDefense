import { backgroundColor } from "../util/Util";
import * as move from "../units/Movement";
import * as weapon from "../units/Weapon";
import { Unit, loadUnitJson, createUnit } from "../model/Units";

let ship: Unit;
let roomBlocks: Phaser.Tilemaps.TilemapLayer;
let targetSprite: Phaser.GameObjects.Image;
// Nav mesh for units to get around the current room
let navMesh;
let sceneUnits: { [id: number]: Unit } = {};

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
        let turret1 = createUnit("turret", {x: 300, y: 300}, this);
        let turret2 = createUnit("turret", {x: 300, y: 500}, this);
        sceneUnits[turret1.id] = turret1;
        sceneUnits[turret2.id] = turret2;

        this.physics.add.collider(roomBlocks, ship.gameObj);

        navMesh = this["navMeshPlugin"].buildMeshFromTiled("mesh", navMeshLayer, 8);
        // Visualize the underlying navmesh
        //navMesh.enableDebug(); 
        /*navMesh.debugDrawMesh({
          drawCentroid: true,
          drawBounds: true,
          drawNeighbors: true,
          drawPortals: false
        });*/

        targetSprite = this.add.image(-1000, -1000, "target");

        this.input.on('pointerdown', (pointer) => {
            if (ship.gameObj.body) {
                move.updateUnitTarget(ship, navMesh, pointer);
                targetSprite.setPosition(pointer.x, pointer.y);
            } else {
                targetSprite.setVisible(false);
            }
        });
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
        Object.keys(sceneUnits).forEach(id => {
            if (sceneUnits[id].gameObj.body) {
                move.moveUnit(sceneUnits[id]);
            }
        });
        Object.keys(sceneUnits).forEach(id => {
            let targetUnit;
            if (sceneUnits[id].playerOwned) {
                targetUnit = ship;
            }
            //TODO targeting for the ship
            weapon.updateUnitWeapon(sceneUnits[id], targetUnit, delta, this);
        });
    }
}