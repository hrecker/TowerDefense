import 'phaser';
import PhaserNavMeshPlugin from "phaser-navmesh";

import { LoadingScene } from "./scenes/LoadingScene";
import { RoomScene } from "./scenes/RoomScene";
import { RoomUIScene } from "./scenes/RoomUIScene";

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
        LoadingScene,
        RoomScene,
        RoomUIScene
    ]
};

new Phaser.Game(config);
