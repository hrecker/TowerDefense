import { Unit } from "../model/Units";
import { RoomScene } from "../scenes/RoomScene";

export const projectileNames = ["playerBullet", "shipBullet"];
//TODO make this modifiable in some way?
const bulletSpeed = 100;
const bulletLifetimeMs = 10000;

/** Update weapon control for a unit for one frame (call each frame in the update method of a scene) */
export function updateUnitWeapon(unit: Unit, target: Phaser.Math.Vector2, delta: number, scene: RoomScene) {
    if (unit.currentWeaponDelay > 0) {
        unit.currentWeaponDelay -= delta;
    } else if (target) {
        //TODO different weapons
        switch (unit.weapon) {
            case "peaShooter":
                if (unit.playerOwned) {
                    firePlayerBullet(unit, target, scene);
                } else {
                    fireShipBullet(unit, target, scene);
                }
                break;
            case "straightShooter":
                if (unit.playerOwned) {
                    firePlayerBullet(unit,
                        unit.gameObj.body.center.clone().add(
                            Phaser.Math.Vector2.RIGHT.clone().rotate(unit.gameObj.rotation)), scene);
                } else {
                    fireShipBullet(unit,
                        unit.gameObj.body.center.clone().add(
                            Phaser.Math.Vector2.RIGHT.clone().rotate(unit.gameObj.rotation)), scene);
                }
                break;
        }
        unit.currentWeaponDelay = unit.weaponDelay;
    }
}

let bulletId = 0;
function createBullet(bulletName: string, unit: Unit, target: Phaser.Math.Vector2, scene: RoomScene, bulletGroup: Phaser.Physics.Arcade.Group) {
    //TODO arcade physics group for bullets rather than destroying them and creating new ones?
    let bullet = scene.physics.add.image(unit.gameObj.body.center.x, unit.gameObj.body.center.y, bulletName);
    bulletGroup.add(bullet);
    bullet.setData("isBullet", true);
    bullet.setData("id", bulletId);
    bullet.setData("playerOwned", unit.playerOwned);
    //TODO any worry about hitting max int here...?
    bulletId++;
    //TODO different body sizes for different bullets
    bullet.body.setCircle(8);
    bullet.setName(bulletName);
    let bulletVel = target.clone().subtract(unit.gameObj.body.center).normalize().scale(bulletSpeed);
    bullet.setVelocity(bulletVel.x, bulletVel.y);
    // Destroy bullet after enough time passes for it to go off screen, just in case something weird happens
    scene.time.delayedCall(bulletLifetimeMs, () => bullet.destroy());
    return bullet;
}

function firePlayerBullet(unit: Unit, target: Phaser.Math.Vector2, scene: RoomScene) {
    createBullet("playerBullet", unit, target, scene, scene.getPlayerBulletGroup());
}

function fireShipBullet(unit: Unit, target: Phaser.Math.Vector2, scene: RoomScene) {
    createBullet("shipBullet", unit, target, scene, scene.getShipBulletGroup());
}