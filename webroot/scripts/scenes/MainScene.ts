import { backgroundColor } from "../util/Util";

export class MainScene extends Phaser.Scene {
    constructor() {
        super({
            key: "MainScene"
        });
    }

    preload() {
        this.load.image("sample", "assets/sprites/sample.png");
    }

    addImage(x: number, y: number, name: string) {
        this.add.image(x, y, name);
    }

    create() {
        this.cameras.main.setBackgroundColor(backgroundColor);
        this.addImage(400, 300, "sample");
    }

    update() {
    }
}