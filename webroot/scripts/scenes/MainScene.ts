import { backgroundColor } from "../util/Util";
import * as move from "../units/Movement";
import { Unit, loadUnitJson, createUnit } from "../model/Units";

let ship : Unit;
let targetSprite : Phaser.GameObjects.Image;
// Nav mesh for units to get around the current room
let navMesh;

export class MainScene extends Phaser.Scene {
    constructor() {
        super({
            key: "MainScene"
        });
    }

    preload() {
        this.load.image("ship", "assets/sprites/ship.png");
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
        let blockLayer = roomMap.createLayer(0, tileset);
        let navMeshLayer = roomMap.getObjectLayer("navmesh");
        blockLayer.setCollisionByProperty({ collides: true });

        ship = createUnit("ship", this);

        this.physics.add.collider(blockLayer, ship.gameObj);

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
            move.updateUnitTarget(ship, navMesh, pointer);
            targetSprite.setPosition(pointer.x, pointer.y);
        });
    }

    update() {
        // TODO move all active units in the scene
        // TODO more movement types for units
        move.moveHomingUnit(ship);
    }
}