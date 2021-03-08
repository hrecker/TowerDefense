import { backgroundColor } from "../util/Util";
import { homingDirection } from "../units/Movement";

let ship : Phaser.Types.Physics.Arcade.ImageWithDynamicBody;
let target : Phaser.Math.Vector2;
let targetSprite : Phaser.GameObjects.Image;
const shipMaxSpeed = 300;
const shipAcceleration = 1000;
const shipMaxAngularVelocity = 0.1;

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
    }

    addPhysicsImage(x: number, y: number, name: string) {
        return this.physics.add.image(x, y, name);
    }

    setTarget(x: number, y: number) {
        target = new Phaser.Math.Vector2(x, y);
        targetSprite.setPosition(target.x, target.y);
    }

    create() {
        this.cameras.main.setBackgroundColor(backgroundColor);

        // Walls
        let floor = this.add.tileSprite(304, 592, 608, 32, "block");
        let ceiling = this.add.tileSprite(304, 16, 608, 32, "block");
        let left = this.add.tileSprite(16, 304, 32, 544, "block");
        let right = this.add.tileSprite(592, 304, 32, 544, "block");
        let walls = this.physics.add.staticGroup([floor, ceiling, left, right]);

        // Room tiles
        const roomMap = this.make.tilemap({ key: "room1" });
        const tileset = roomMap.addTilesetImage("OneBlock", "block");
        let blockLayer = roomMap.createLayer(0, tileset, 32, 32);
        blockLayer.setCollisionByProperty({ collides: true });

        // Ship
        ship = this.addPhysicsImage(200, 200, "ship");
        ship.body.setMaxSpeed(shipMaxSpeed);

        this.physics.add.collider(walls, ship);
        this.physics.add.collider(blockLayer, ship);

        targetSprite = this.add.image(-1000, -1000, "target");
        this.setTarget(400, 400);

        this.input.on('pointerdown', (pointer) => {
            this.setTarget(pointer.x, pointer.y);
        });
    }

    update() {
        // Get direction ship should move to hit target
        let homingDir = homingDirection(ship.body, target, shipAcceleration);
        let targetAngle = homingDir.clone().add(ship.body.center);

        // Rotate towards the target
        let angleBetween = Phaser.Math.Angle.BetweenPoints(ship.body.center, targetAngle);
        ship.setRotation(Phaser.Math.Angle.RotateTo(ship.rotation, angleBetween, shipMaxAngularVelocity));

        // Accelerate towards the target
        ship.setAcceleration(homingDir.x * shipAcceleration, homingDir.y * shipAcceleration);
    }
}