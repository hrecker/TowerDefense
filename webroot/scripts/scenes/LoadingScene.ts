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
        this.load.image("block", "assets/sprites/block.png");
        this.load.image("chaser", "assets/sprites/chaser.png");
        this.load.image("crawler", "assets/sprites/crawler.png");
        this.load.image("laser", "assets/sprites/laser.png");
        this.load.image("playerBullet", "assets/sprites/playerBullet.png");
        this.load.image("playerExplosion", "assets/sprites/playerExplosion.png");
        this.load.image("shield", "assets/sprites/shield.png");
        this.load.image("ship", "assets/sprites/ship.png");
        this.load.image("shipBullet", "assets/sprites/shipBullet.png");
        this.load.image("shipExplosion", "assets/sprites/shipExplosion.png");
        this.load.image("spikeball", "assets/sprites/spikeball.png");
        this.load.image("target", "assets/sprites/target.png");
        this.load.image("turret", "assets/sprites/turret.png");
        this.load.image("zapper", "assets/sprites/zapper.png");
        this.load.image("zapperExplosion", "assets/sprites/zapperExplosion.png");
        
        // UI images
        this.load.image("DAMAGE_BUFF", "assets/sprites/mods/damage_buff.png");
        this.load.image("DODGE_ENEMIES", "assets/sprites/mods/dodge_enemies.png");
        this.load.image("EXPLODING_PROJECTILES", "assets/sprites/mods/exploding_projectiles.png");
        this.load.image("HEALTH_BUFF", "assets/sprites/mods/health_buff.png");
        this.load.image("GHOST_PROJECTILES", "assets/sprites/mods/ghost_projectiles.png");
        this.load.image("PROJECTILE_SCALE", "assets/sprites/mods/projectile_scale.png");
        this.load.image("TARGET_ENEMIES", "assets/sprites/mods/target_enemies.png");

        this.load.image("laser_icon", "assets/sprites/weapons/laser.png");
        this.load.image("peaShooter_icon", "assets/sprites/weapons/peaShooter.png");
        this.load.image("shotgun_icon", "assets/sprites/weapons/shotgun.png");

        // Load room tilemaps
        this.load.json("rooms", "assets/rooms/rooms.json");
        this.load.tilemapTiledJSON("room1", "assets/rooms/room1.json");
        this.load.tilemapTiledJSON("room2", "assets/rooms/room2.json");
        this.load.tilemapTiledJSON("room3", "assets/rooms/room3.json");

        // Load json
        this.load.json("buffs", "assets/units/buffs.json");
        this.load.json("shipMods", "assets/units/shipMods.json");
        this.load.json("shipWeapons", "assets/units/shipWeapons.json");
        this.load.json("units", "assets/units/units.json");
    }

    create() {
        loadUnitJson(this.cache.json.get("units"));
        this.scene.start("RoomScene")
                  .start("RoomUIScene")
                  .stop();
    }
}