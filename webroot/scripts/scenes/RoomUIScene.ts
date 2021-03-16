import { getUnitsJsonProperties } from "../model/Units";
import { setShopSelection } from "../state/UIState";

const unitSelectionBoxWidth = 192;
const shopSelectionBoxDefaultColor = 0x6400b5;
const shopSelectionBoxHighlightColor = 0x8a57b3;

let unitSelectionCenterX;
let activeShopSelectionIndex = -1;
let shopSelectionBoxes: Phaser.GameObjects.Rectangle[];
let purchasableUnits;

// UI displayed over RoomScene
export class RoomUIScene extends Phaser.Scene {
    constructor() {
        super({
            key: "RoomUIScene"
        });
    }

    preload() {
        unitSelectionCenterX = this.game.renderer.width - unitSelectionBoxWidth / 2;
    }

    create() {
        console.log("RoomUIScene starting");
        let shopBackground = this.add.rectangle(unitSelectionCenterX, this.game.renderer.height / 2, 
            unitSelectionBoxWidth, this.game.renderer.height, 0x000000);
        shopBackground.setInteractive();
        shopBackground.on("pointerdown", () => {
            this.clearShopSelection();
        });

        purchasableUnits = getUnitsJsonProperties((unit) => unit.purchasable);
        shopSelectionBoxes = []
        for (let i = 0; i < purchasableUnits.length; i++) {
            let selectionBox = this.add.rectangle(unitSelectionCenterX, 36 + i * 64, 
                unitSelectionBoxWidth - 20, 58, 0x6400b5);
            shopSelectionBoxes.push(selectionBox);
            selectionBox.setInteractive();
            selectionBox.on("pointerdown", () => {
                this.selectShopItem(i);
            });
            this.add.text(unitSelectionCenterX, 32 + i * 64, purchasableUnits[i].name).setOrigin(0.5);
        }
    }

    selectShopItem(index) {
        if (index == activeShopSelectionIndex) {
            // Deselect if the same selection is clicked again
            this.clearShopSelection();
        } else {
            if (activeShopSelectionIndex >= 0) {
                shopSelectionBoxes[activeShopSelectionIndex].fillColor = shopSelectionBoxDefaultColor;
            }
            activeShopSelectionIndex = index;
            shopSelectionBoxes[index].fillColor = shopSelectionBoxHighlightColor;
            setShopSelection(purchasableUnits[index].name);
        }
    }

    clearShopSelection() {
        if (activeShopSelectionIndex >= 0) {
            shopSelectionBoxes[activeShopSelectionIndex].fillColor = shopSelectionBoxDefaultColor;
        }
        setShopSelection(null);
        activeShopSelectionIndex = -1;
    }
}