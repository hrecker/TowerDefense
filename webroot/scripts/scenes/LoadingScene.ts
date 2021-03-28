import { loadUnitJson } from "../model/Units";

// Load json and assets
export class LoadingScene extends Phaser.Scene {
    constructor() {
        super({
            key: "LoadingScene"
        });
    }

    preload() {
        // Load sprites
        this.load.image("ship", "assets/sprites/ship.png");
        this.load.image("turret", "assets/sprites/turret.png");
        this.load.image("chaser", "assets/sprites/chaser.png");
        this.load.image("crawler", "assets/sprites/crawler.png");
        this.load.image("playerBullet", "assets/sprites/playerBullet.png");
        this.load.image("shipBullet", "assets/sprites/shipBullet.png");
        this.load.image("target", "assets/sprites/target.png");
        this.load.image("block", "assets/sprites/block.png");

        // Load room tilemaps
        this.load.json("rooms", "assets/rooms/rooms.json");
        this.load.tilemapTiledJSON("room1", "assets/rooms/room1.json");
        this.load.tilemapTiledJSON("room2", "assets/rooms/room2.json");
        this.load.tilemapTiledJSON("room3", "assets/rooms/room3.json");

        // Load json
        this.load.json("units", "assets/units/units.json");
    }

    create() {
        console.log("Loading scene starting, asset loading complete");
        loadUnitJson(this.cache.json.get("units"));
        this.scene.start("RoomScene")
                  .start("RoomUIScene")
                  .stop();
    }
}