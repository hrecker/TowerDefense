import { ModType } from "../model/Mods";
import { hasMod, Unit } from "../model/Units";
import { RoomScene } from "../scenes/RoomScene";

export const projectileNames = ["playerBullet", "shipBullet"];
//TODO make this modifiable in some way?
const bulletSpeed = 100;
const bulletLifetimeMs = 10000;
const shotgunSpreadRadians = 1.0;

/** Update weapon control for a unit for one frame (call each frame in the update method of a scene) */
export function updateUnitWeapon(unit: Unit, target: Phaser.Math.Vector2, delta: number, scene: RoomScene) {
    if (unit.currentWeaponDelay > 0) {
        unit.currentWeaponDelay -= delta;
    } else if (target) {
        let targets = [];
        switch (unit.weapon) {
            case "peaShooter":
                targets.push(target);
                break;
            case "straightShooter":
                targets.push(unit.gameObj.body.center.clone().add(
                    Phaser.Math.Vector2.RIGHT.clone().rotate(unit.gameObj.rotation)));
                break;
            case "shotgun":
                let targetVector = target.clone().subtract(unit.gameObj.body.center);
                //TODO mods for number of projectiles
                for (let i = 0; i < 3; i++) {
                    // Rotate the target vector a random amount for some bullet spread
                    let randomRot = Math.random() * shotgunSpreadRadians - shotgunSpreadRadians / 2;
                    targets.push(targetVector.clone().rotate(randomRot).add(unit.gameObj.body.center));
                }
                break;
        }
        targets.forEach(target => {
            if (unit.playerOwned) {
                firePlayerBullet(unit, target, scene);
            } else {
                fireShipBullet(unit, target, scene);
            }
        });
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
    if (hasMod(unit, ModType.PROJECTILE_SCALE)) {
        bullet.setScale(unit.mods[ModType.PROJECTILE_SCALE][0].props.projectileScale);
    }
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