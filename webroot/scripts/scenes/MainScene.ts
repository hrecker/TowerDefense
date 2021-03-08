import { backgroundColor } from "../util/Util";
import { homingDirection } from "../units/Movement";

let ship : Phaser.Types.Physics.Arcade.ImageWithDynamicBody;
let target : Phaser.Math.Vector2;
let shipPath : Phaser.Geom.Point[];
let currentPathIndex = 0;
let targetSprite : Phaser.GameObjects.Image;
let navMesh;
const shipMaxSpeed = 300;
const shipAcceleration = 1000;
const shipMaxAngularVelocity = 0.1;
// How close the ship needs to be before it has officially "made it" to a node
const pathDistanceCheck = 16;

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

    setPathTarget(x: number, y: number) {
        shipPath = navMesh.findPath(
            { x: ship.body.center.x, y: ship.body.center.y }, 
            { x: x, y: y });
        if (shipPath) {
            currentPathIndex = 1;
            this.setTarget(shipPath[currentPathIndex]);
        } else {
            console.log("Couldn't find a path!");
            this.setTarget({x: x, y: y});
        }
    }

    setTarget(t: Phaser.Types.Math.Vector2Like) {
        target = new Phaser.Math.Vector2(t.x, t.y);
        targetSprite.setPosition(target.x, target.y);
    }

    updatePathTarget() {
        // Don't need to update the target if we're at the end of the current path
        if (!shipPath || currentPathIndex >= shipPath.length - 1) {
            return;
        }

        // If ship has reached a node, aim for the next one
        let dist = ship.body.center.distance(new Phaser.Math.Vector2(shipPath[currentPathIndex]));
        if (dist <= pathDistanceCheck) {
            currentPathIndex++;
            this.setTarget(shipPath[currentPathIndex]);
        }
    }

    create() {
        this.cameras.main.setBackgroundColor(backgroundColor);

        // Room tiles
        const roomMap = this.make.tilemap({ key: "room1" });
        const tileset = roomMap.addTilesetImage("OneBlock", "block");
        let blockLayer = roomMap.createLayer(0, tileset);
        let navMeshLayer = roomMap.getObjectLayer("navmesh");
        blockLayer.setCollisionByProperty({ collides: true });

        // Ship
        ship = this.addPhysicsImage(200, 200, "ship");
        ship.body.setCircle(10, 6, 6);
        //ship.setBodySize(12, 12);
        //ship.
        ship.body.setMaxSpeed(shipMaxSpeed);

        this.physics.add.collider(blockLayer, ship);
        //this.physics.add.co

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
        //this.setPathTarget(300, 300);

        this.input.on('pointerdown', (pointer) => {
            this.setPathTarget(pointer.x, pointer.y);
        });
    }

    update() {
        if (!target) {
            return;
        }

        // Get direction ship should move to hit target
        let homingDir = homingDirection(ship.body, target, shipAcceleration);
        let targetAngle = homingDir.clone().add(ship.body.center);

        // Rotate towards the target
        let angleBetween = Phaser.Math.Angle.BetweenPoints(ship.body.center, targetAngle);
        ship.setRotation(Phaser.Math.Angle.RotateTo(ship.rotation, angleBetween, shipMaxAngularVelocity));

        // Accelerate towards the target
        ship.setAcceleration(homingDir.x * shipAcceleration, homingDir.y * shipAcceleration);

        // Update path
        this.updatePathTarget();
    }
}