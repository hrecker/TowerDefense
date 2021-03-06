import 'phaser';

import { MainScene } from "./scenes/MainScene";

var config: Phaser.Types.Core.GameConfig = {
    width: 800,
    height: 608,
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
