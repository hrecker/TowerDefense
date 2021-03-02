import 'phaser';

import { MainScene } from "./scenes/MainScene";

var config: Phaser.Types.Core.GameConfig = {
    width: 800,
    height: 600,
    physics: {
        default: 'arcade'
    },
    scene: [
        MainScene
    ]
};

new Phaser.Game(config);
