// Note: this assumes the target is stationary
// See https://gamedev.stackexchange.com/questions/52988/implementing-a-homing-missile
// and https://gamedev.stackexchange.com/questions/17313/how-does-one-prevent-homing-missiles-from-orbiting-their-targets
// Based on a (possibly moving) body, a stationary target, and the max acceleration of the body, 
// calculate the direction the body should accelerate to hit the target.
export function homingDirection(body : Phaser.Physics.Arcade.Body, target: Phaser.Math.Vector2, maxAcc: number): Phaser.Math.Vector2 {
    // Have to make a copy of things so they don't get modified outside the method
    let t = new Phaser.Math.Vector2(target);

    let dirToImpact = t.subtract(body.center);
    if (body.velocity.equals(Phaser.Math.Vector2.ZERO)) {
        return dirToImpact;
    }
    // Again make a copy here so the actual body isn't modified
    let relativeTargetVel = new Phaser.Math.Vector2(body.velocity).negate();

    // Component of relative target velocity towards the body
    let v = new Phaser.Math.Vector2(relativeTargetVel).negate().dot(dirToImpact.normalize());

    // Time estimate for impact
    let eta = (-v / maxAcc) + Math.sqrt(Math.pow(v, 2) / Math.pow(maxAcc, 2) + (2 * dirToImpact.length() / maxAcc));

    // Estimate impact position, and aim towards it
    let impactPos = relativeTargetVel.scale(eta).add(target);
    return impactPos.subtract(body.center).normalize();
}