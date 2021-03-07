// Note: this assumes the target is stationary
// See https://gamedev.stackexchange.com/questions/52988/implementing-a-homing-missile
// and https://gamedev.stackexchange.com/questions/17313/how-does-one-prevent-homing-missiles-from-orbiting-their-targets
// Based on a (possibly moving) body, a stationary target, and the max acceleration of the body, 
// calculate the direction the body should accelerate to hit the target.
export function homingDirection(body : Phaser.Physics.Arcade.Body, target: Phaser.Math.Vector2, maxAcc: number): Phaser.Math.Vector2 {
    let dirToImpact = target.clone().subtract(body.center);
    let dirtoImpactNorm = dirToImpact.clone().normalize();
    if (body.velocity.equals(Phaser.Math.Vector2.ZERO)) {
        return dirtoImpactNorm;
    }
    // Get relative velocity of target from body's frame of reference
    let relativeTargetVel = body.velocity.clone().negate();

    // Component of relative target velocity towards the body
    let v = relativeTargetVel.clone().negate().dot(dirtoImpactNorm);

    // Time estimate for impact
    let eta = (-v / maxAcc) + Math.sqrt(Math.pow(v, 2) / Math.pow(maxAcc, 2) + (2 * dirToImpact.length() / maxAcc));

    // Estimate impact position, and aim towards it
    let impactPos = relativeTargetVel.scale(eta).add(target);
    return impactPos.subtract(body.center).normalize();
}