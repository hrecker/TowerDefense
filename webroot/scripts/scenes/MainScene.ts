import { backgroundColor } from "../util/Util";

let ship : Phaser.Types.Physics.Arcade.ImageWithDynamicBody;
let target : Phaser.Math.Vector2;
let targetSprite : Phaser.GameObjects.Image;
const shipMaxSpeed = 300;
const shipAcceleration = 1000;
const shipMaxAngularVelocity = 0.2;

export class MainScene extends Phaser.Scene {
    constructor() {
        super({
            key: "MainScene"
        });
    }

    preload() {
        this.load.image("ship", "assets/sprites/ship.png");
        this.load.image("target", "assets/sprites/target.png");
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
        targetSprite = this.add.image(-1000, -1000, "target");
        ship = this.addPhysicsImage(400, 300, "ship");
        ship.body.setMaxSpeed(shipMaxSpeed);
        this.setTarget(600, 300);

        this.input.on('pointerdown', (pointer) => {
            this.setTarget(pointer.x, pointer.y);
        });
    }

    update() {
        // Rotate towards the target
        let angleBetween = Phaser.Math.Angle.BetweenPoints(ship.body.center, target);
        ship.setRotation(Phaser.Math.Angle.RotateTo(ship.rotation, angleBetween, shipMaxAngularVelocity));

        // Accelerate in the direction the ship is facing
        let right = new Phaser.Math.Vector2(1, 0);
        let direction = right.rotate(Phaser.Math.Angle.Normalize(ship.rotation));
        ship.setAcceleration(direction.x * shipAcceleration, direction.y * shipAcceleration);
    }
}