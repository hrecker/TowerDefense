import { ModType } from "../model/Mods";
import { hasMod, Unit } from "../model/Units";
import { RoomScene } from "../scenes/RoomScene";
import { getNewId } from "../state/IdState";

export const projectileNames = ["playerBullet", "shipBullet", "playerExplosion", "shipExplosion"];
//TODO make this modifiable in some way?
const bulletSpeed = 100;
const bulletLifetimeMs = 10000;
const explosionLifetimeMs = 1200;
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
            case "zapper":
                createExplosion(unit.playerOwned, unit.gameObj.body.center, scene, "zapperExplosion", explosionLifetimeMs / 2);
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

function createBullet(bulletName: string, unit: Unit, target: Phaser.Math.Vector2, scene: RoomScene, bulletGroup: Phaser.Physics.Arcade.Group) {
    //TODO object pool for bullets rather than destroying them and creating new ones?
    let bullet = scene.physics.add.image(unit.gameObj.body.center.x, unit.gameObj.body.center.y, bulletName);
    bulletGroup.add(bullet);
    // ghost projectiles pass through obstacles, so don't add them to the projectile physics group
    if (!hasMod(unit, ModType.GHOST_PROJECTILES)) {
        scene.getProjectileGroup().add(bullet);
    }
    if (hasMod(unit, ModType.EXPLODING_PROJECTILES)) {
        bullet.setData("exploding", true);
    }
    bullet.setData("isBullet", true);
    bullet.setData("id", getNewId());
    bullet.setData("playerOwned", unit.playerOwned);
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

export function createExplosion(playerOwned: boolean, position: Phaser.Math.Vector2, scene: RoomScene, explosionName?: string, lifetimeMs?: number) {
    let bulletGroup;
    if (playerOwned) {
        bulletGroup = scene.getPlayerBulletGroup();
        if (!explosionName) {
            explosionName = "playerExplosion";
        }
    } else {
        bulletGroup = scene.getShipBulletGroup();
        if (!explosionName) {
            explosionName = "shipExplosion";
        }
    }

    let explosion = scene.physics.add.image(position.x, position.y, explosionName);
    bulletGroup.add(explosion);
    explosion.setData("isAOE", true);
    explosion.setData("id", getNewId());
    explosion.setData("playerOwned", playerOwned);
    explosion.setAlpha(0.3);
    explosion.body.setCircle(32);
    explosion.setName(explosionName);
    // Destroy explosion after some time passes
    if (!lifetimeMs) {
        lifetimeMs = explosionLifetimeMs;
    }
    scene.time.delayedCall(lifetimeMs, () => explosion.destroy());
    return explosion;
}