export const backgroundColor = "#222222";

export function vector2Str(vector: Phaser.Types.Math.Vector2Like) {
    return "(" + vector.x + ", " + vector.y + ")";
}

export function flickerGameObject(scene: Phaser.Scene, obj: Phaser.GameObjects.Components.Tint) {
    scene.tweens.addCounter({
        from: 50,
        to: 255,
        duration: 200,
        onUpdate: function (tween)
        {
            const value = Math.floor(tween.getValue());
            obj.setTint(Phaser.Display.Color.GetColor(value, value, value));
        }
    });
}