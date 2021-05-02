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

// https://stackoverflow.com/questions/7158654/how-to-get-random-elements-from-an-array?noredirect=1&lq=1
export function getRandomArrayElements(arr, count) {
    var shuffled = arr.slice(0), i = arr.length, min = i - count, temp, index;
    while (i-- > min) {
        index = Math.floor((i + 1) * Math.random());
        temp = shuffled[index];
        shuffled[index] = shuffled[i];
        shuffled[i] = temp;
    }
    return shuffled.slice(min);
}