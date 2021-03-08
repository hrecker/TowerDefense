import 'phaser';
import PhaserNavMeshPlugin from "phaser-navmesh";

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
    plugins: {
        scene: [
            {
                key: "PhaserNavMeshPlugin", // Key to store the plugin class under in cache
                plugin: PhaserNavMeshPlugin, // Class that constructs plugins
                mapping: "navMeshPlugin", // Property mapping to use for the scene, e.g. this.navMeshPlugin
                start: true
            }
        ]
    },
    scene: [
        MainScene
    ]
};

new Phaser.Game(config);
