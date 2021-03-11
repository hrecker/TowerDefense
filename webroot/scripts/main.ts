import 'phaser';
import PhaserNavMeshPlugin from "phaser-navmesh";

import { MainScene } from "./scenes/MainScene";

var config: Phaser.Types.Core.GameConfig = {
    width: 800,
    height: 608,
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
    plugins: {
        scene: [
            {
                key: "PhaserNavMeshPlugin",
                plugin: PhaserNavMeshPlugin,
                mapping: "navMeshPlugin",
                start: true
            }
        ]
    },
    scene: [
        MainScene
    ]
};

new Phaser.Game(config);
