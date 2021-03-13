import { Unit, handleProjectileHit } from "../model/Units";

//TODO make this modifiable in some way?
const bulletSpeed = 100;
const bulletLifetimeMs = 10000;

/** Update weapon control for a unit for one frame (call each frame in the update method of a scene) */
export function updateUnitWeapon(unit: Unit, target: Unit, delta: number, scene: Phaser.Scene) {
    if (unit.currentWeaponDelay > 0) {
        unit.currentWeaponDelay -= delta;
    } else if (target && target.gameObj.body) {
        switch (unit.weapon) {
            case "machineGun":
                //TODO
                break;
            case "peaShooter":
                //TODO
                firePlayerBullet(unit, target, scene);
                break;
        }
        unit.currentWeaponDelay = unit.weaponDelay;
    }
}

function firePlayerBullet(unit: Unit, target: Unit, scene: Phaser.Scene) {
    //TODO arcade physics group for bullets rather than destroying them and creating new ones?
    //TODO collision with the player
    let bullet = scene.physics.add.image(unit.gameObj.body.center.x, unit.gameObj.body.center.y, "playerBullet");
    bullet.setName("playerBullet");
    let bulletVel = target.gameObj.body.center.clone().subtract(unit.gameObj.body.center).normalize().scale(bulletSpeed);
    bullet.setVelocity(bulletVel.x, bulletVel.y);
    // Destroy on touching geometry
    scene.physics.add.collider(bullet, scene.getRoomBlocks(), () => bullet.destroy());
    // Handle hit on target
    scene.physics.add.overlap(bullet, target.gameObj, handleProjectileHit, null, scene);
    // Destroy bullet after enough time passes for it to go off screen
    scene.time.delayedCall(bulletLifetimeMs, () => bullet.destroy());
}