import 'phaser';

import { MainScene } from "./scenes/MainScene";

var config: Phaser.Types.Core.GameConfig = {
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
            debug: true
        }
    },
    scene: [
        MainScene
    ]
};

new Phaser.Game(config);
