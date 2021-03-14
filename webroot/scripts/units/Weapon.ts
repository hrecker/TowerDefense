import { Unit, handleProjectileHit } from "../model/Units";
import { MainScene } from "../scenes/MainScene";

export const projectileNames = ["playerBullet", "shipBullet"];
//TODO make this modifiable in some way?
const bulletSpeed = 100;
const bulletLifetimeMs = 10000;

/** Update weapon control for a unit for one frame (call each frame in the update method of a scene) */
export function updateUnitWeapon(unit: Unit, target: Unit, delta: number, scene: MainScene) {
    if (unit.currentWeaponDelay > 0) {
        unit.currentWeaponDelay -= delta;
    } else if (target && target.gameObj.body) {
        //TODO different weapons
        switch (unit.weapon) {
            case "peaShooter":
                if (unit.playerOwned) {
                    firePlayerBullet(unit, target, scene);
                } else {
                    fireShipBullet(unit, target, scene);
                }
                break;
        }
        unit.currentWeaponDelay = unit.weaponDelay;
    }
}

function createBullet(bulletName: string, unit: Unit, target: Unit, scene: MainScene) {
    //TODO arcade physics group for bullets rather than destroying them and creating new ones?
    let bullet = scene.physics.add.image(unit.gameObj.body.center.x, unit.gameObj.body.center.y, bulletName);
    bullet.setName(bulletName);
    let bulletVel = target.gameObj.body.center.clone().subtract(unit.gameObj.body.center).normalize().scale(bulletSpeed);
    bullet.setVelocity(bulletVel.x, bulletVel.y);
    // Destroy on touching geometry
    scene.physics.add.collider(bullet, scene.getRoomBlocks(), () => bullet.destroy());
    // Destroy bullet after enough time passes for it to go off screen, just in case something weird happens
    scene.time.delayedCall(bulletLifetimeMs, () => bullet.destroy());
    return bullet;
}

function firePlayerBullet(unit: Unit, target: Unit, scene: MainScene) {
    let bullet = createBullet("playerBullet", unit, target, scene);
    // Handle hit on target
    scene.physics.add.overlap(bullet, scene.getShipUnits(), handleProjectileHit, null, scene);
}

function fireShipBullet(unit: Unit, target: Unit, scene: MainScene) {
    let bullet = createBullet("shipBullet", unit, target, scene);
    // Handle hit on target
    scene.physics.add.overlap(bullet, scene.getPlayerUnits(), handleProjectileHit, null, scene);
}