export class MainScene extends Phaser.Scene {
    constructor() {
        super({
            key: "MainScene"
        });
    }

    create() {
        this.cameras.main.setBackgroundColor("#4287f5");
    }

    update() {
    }
}