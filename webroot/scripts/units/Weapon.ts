import { ModType, weaponAndModCompatible } from "../model/Mods";
import { hasMod, Unit } from "../model/Units";
import { RoomScene } from "../scenes/RoomScene";
import { getNewId } from "../state/IdState";

export const projectileNames = ["playerBullet", "shipBullet", "playerExplosion", "shipExplosion", "zapperExplosion"];
//TODO make this modifiable in some way?
const bulletSpeed = 100;
const bulletLifetimeMs = 10000;
const explosionLifetimeMs = 1200;
const shotgunSpreadRadians = 1.0;

/** Update weapon control for a unit for one frame (call each frame in the update method of a scene) */
export function updateUnitWeapon(unit: Unit, target: Phaser.Math.Vector2, delta: number, scene: RoomScene) {
    if (unit.currentWeaponDelay > 0) {
        unit.currentWeaponDelay -= delta;

        // Track laser with ship movement
        if (unit.weapon == "laser" && unit.otherAttachements["laser"]) {
            let laserComponents: Phaser.Types.Physics.Arcade.ImageWithDynamicBody[] = unit.otherAttachements["laser"];
            let laserDir = Phaser.Math.Vector2.RIGHT.clone().rotate(unit.gameObj.rotation);
            laserComponents.forEach(component => {
                let offset = component.getData("offset");
                let newPos = laserDir.clone().scale(offset).add(unit.gameObj.body.center);
                component.setPosition(newPos.x, newPos.y);
                component.setRotation(unit.gameObj.rotation);
            });
        }
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
                createExplosion(unit.playerOwned, unit.gameObj.body.center, scene, 64, "zapperExplosion", explosionLifetimeMs / 2);
                break;
            case "laser":
                createLaser(unit, unit.gameObj.body.center, unit.gameObj.width / 3, unit.gameObj.rotation, scene);
                break;
        }
        targets.forEach(target => {
            createBullet(unit.playerOwned, unit.gameObj.body.center, scene, unit, target);
        });
        unit.currentWeaponDelay = unit.weaponDelay;
    }
}

function getBulletGroup(isPlayerOwned: boolean, scene: RoomScene) {
    if (isPlayerOwned) {
        return scene.getPlayerBulletGroup();
    } else {
        return scene.getShipBulletGroup();
    }
}

function getBulletName(isPlayerOwned: boolean) {
    if (isPlayerOwned) {
        return "playerBullet";
    } else {
        return "shipBullet";
    }
}

function createBullet(isPlayerOwned: boolean, position: Phaser.Math.Vector2, scene: RoomScene, unit?: Unit, target?: Phaser.Math.Vector2, 
        velocity?: Phaser.Math.Vector2, lifetimeMs?: number) {
    //TODO object pool for bullets rather than destroying them and creating new ones?
    let bullet = scene.physics.add.image(position.x, position.y, getBulletName(isPlayerOwned));
    getBulletGroup(isPlayerOwned, scene).add(bullet);
    // ghost projectiles pass through obstacles, so don't add them to the projectile physics group
    if (!hasMod(unit, ModType.GHOST_PROJECTILES) || !weaponAndModCompatible(unit.name, unit.weapon, ModType.GHOST_PROJECTILES, scene)) {
        scene.getProjectileGroup().add(bullet);
    }
    if (hasMod(unit, ModType.EXPLODING_PROJECTILES) && weaponAndModCompatible(unit.name, unit.weapon, ModType.EXPLODING_PROJECTILES, scene)) {
        bullet.setData("exploding", true);
    }
    bullet.setData("isBullet", true);
    bullet.setData("id", getNewId());
    bullet.setData("playerOwned", isPlayerOwned);
    bullet.body.setCircle(8);
    bullet.setName(getBulletName(isPlayerOwned));
    if (hasMod(unit, ModType.PROJECTILE_SCALE) && weaponAndModCompatible(unit.name, unit.weapon, ModType.PROJECTILE_SCALE, scene)) {
        bullet.setScale(unit.mods[ModType.PROJECTILE_SCALE][0].props.projectileScale);
    }
    if (!velocity) {
        velocity = target.clone().subtract(unit.gameObj.body.center).normalize().scale(bulletSpeed);
    }
    bullet.setVelocity(velocity.x, velocity.y);
    // Destroy bullet after enough time passes for it to go off screen, just in case something weird happens
    if (!lifetimeMs) {
        lifetimeMs = bulletLifetimeMs;
    }
    scene.time.delayedCall(lifetimeMs, () => bullet.destroy());
    return bullet;
}

const defaultExplosionSize = 32;
export function createExplosion(playerOwned: boolean, position: Phaser.Math.Vector2, scene: RoomScene, size?: number, explosionName?: string, lifetimeMs?: number) {
    let bulletGroup = getBulletGroup(playerOwned, scene);
    if (!explosionName) {
        if (playerOwned) {
            explosionName = "playerExplosion";
        } else {
            explosionName = "shipExplosion";
        }
    }

    let explosion = scene.physics.add.image(position.x, position.y, explosionName);
    bulletGroup.add(explosion);
    explosion.setData("isAOE", true);
    explosion.setData("id", getNewId());
    explosion.setData("playerOwned", playerOwned);
    explosion.setAlpha(0.3);
    if (!size) {
        size = defaultExplosionSize;
    }
    explosion.body.setCircle(size);
    explosion.setName(explosionName);
    // Destroy explosion after some time passes
    if (!lifetimeMs) {
        lifetimeMs = explosionLifetimeMs;
    }
    scene.time.delayedCall(lifetimeMs, () => explosion.destroy());
    return explosion;
}

const laserScale = 25;
const laserLifetimeMs = 600;
export function createLaser(unit: Unit, position: Phaser.Math.Vector2, offset: number, angle: number, scene: RoomScene) {
    //TODO laser colors for each side
    let laserDir = Phaser.Math.Vector2.RIGHT.clone().rotate(angle);
    let laserOrigin = laserDir.clone().scale(offset).add(position);
    // Laser image is not connected to physics
    let laser = scene.add.image(laserOrigin.x, laserOrigin.y, "laser").setOrigin(0, 0.5);
    let laserComponents = [];
    laser.setRotation(angle);
    let yScale = 1;
    if (hasMod(unit, ModType.PROJECTILE_SCALE) && weaponAndModCompatible(unit.name, unit.weapon, ModType.PROJECTILE_SCALE, scene)) {
        yScale = unit.mods[ModType.PROJECTILE_SCALE][0].props.projectileScale;
    }
    laser.setScale(laserScale, yScale);
    laser.setData("isAOE", true);
    let laserId = getNewId();
    laser.setData("id", laserId);
    laser.setData("playerOwned", unit.playerOwned);
    laser.setData("offset", offset);
    laser.setAlpha(0.8);
    laserComponents.push(laser);
    scene.time.delayedCall(laserLifetimeMs, () => {
        laser.destroy();
        delete unit.otherAttachements["laser"];
    });

    // Laser is made up of a bunch of individual bullets. Arcade physics doesn't let you rotate rectangle colliders, so this is an alternative.
    for (let i = 0; i < laserScale; i++) {
        let bulletOffset = (i + 1) * 16;
        let bulletPos = laserOrigin.clone().add(laserDir.clone().scale(bulletOffset));
        let bullet = createBullet(unit.playerOwned, bulletPos, scene, unit, null, Phaser.Math.Vector2.ZERO, laserLifetimeMs);
        bullet.setData("isAOE", true);
        bullet.setData("id", laserId);
        bullet.setData("offset", offset + bulletOffset);
        bullet.setAlpha(0);
        laserComponents.push(bullet);
    }
    unit.otherAttachements["laser"] = laserComponents;
    return laser;
}