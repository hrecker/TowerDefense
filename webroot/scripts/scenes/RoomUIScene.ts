import { Unit, getUnitsJsonProperties } from "../model/Units";
import { setShopSelection } from "../state/UIState";
import { addTimerMsListener, addRoomStatusListener, getRoomStatus, RoomStatus } from "../state/RoomState";
import { getResources, addCurrentResourcesListener } from "../state/ResourceState";

const unitSelectionBoxWidth = 192;
const shopSelectionBoxDefaultColor = 0x6400b5;
const shopSelectionBoxHighlightColor = 0x8a57b3;

let unitSelectionCenterX;
let activeShopSelectionIndex = -1;
let shopSelectionBoxes: Phaser.GameObjects.Rectangle[];
let purchasableUnits: Unit[];
let currentResourcesText: Phaser.GameObjects.Text;
let roomStatusText: Phaser.GameObjects.Text;
let timerText: Phaser.GameObjects.Text;

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

        currentResourcesText = this.add.text(unitSelectionCenterX, 15, getResources().toString()).setOrigin(0.5);
        addCurrentResourcesListener(this.updateCurrentResourcesText, this);
        this.updateCurrentResourcesText(getResources());

        roomStatusText = this.add.text(unitSelectionCenterX, this.game.renderer.height - 100, "Status Text", { fontSize: "18px" }).setOrigin(0.5);
        timerText = this.add.text(unitSelectionCenterX, this.game.renderer.height - 50, "99:99", { fontSize: "32px" }).setOrigin(0.5);
        addTimerMsListener(this.updateTimerText, this);
        addRoomStatusListener(this.updateRoomStatus, this);
        this.updateRoomStatus(RoomStatus.COUNTDOWN);

        purchasableUnits = getUnitsJsonProperties((unit) => unit.purchasable);
        shopSelectionBoxes = []
        for (let i = 0; i < purchasableUnits.length; i++) {
            let selectionBox = this.add.rectangle(unitSelectionCenterX, 60 + i * 64,
                unitSelectionBoxWidth - 20, 58, 0x6400b5);
            shopSelectionBoxes.push(selectionBox);
            selectionBox.setInteractive();
            selectionBox.on("pointerdown", () => {
                this.selectShopItem(i);
            });
            this.add.text(unitSelectionCenterX, 44 + i * 64, purchasableUnits[i].name).setOrigin(0.5);
            this.add.text(unitSelectionCenterX, 64 + i * 64, purchasableUnits[i].price.toString()).setOrigin(0.5);
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
            setShopSelection(purchasableUnits[index]);
        }
    }

    clearShopSelection() {
        if (activeShopSelectionIndex >= 0) {
            shopSelectionBoxes[activeShopSelectionIndex].fillColor = shopSelectionBoxDefaultColor;
        }
        setShopSelection(null);
        activeShopSelectionIndex = -1;
    }

    updateCurrentResourcesText(resources: number) {
        currentResourcesText.setText(resources.toString());
    }

    updateTimerText(timerMs: number) {
        // Assumes no timer will be longer than 9 minutes 59 seconds
        let totalSeconds = Math.ceil(timerMs / 1000);
        let minutes = Math.floor(totalSeconds / 60);
        let seconds = (totalSeconds - (minutes * 60)).toString();
        if (seconds.length == 1) {
            seconds = `0${seconds}`;
        }
        timerText.setText(`${minutes}:${seconds}`);
    }

    updateRoomStatus(status: RoomStatus) {
        switch(status) {
            case RoomStatus.ACTIVE:
                roomStatusText.setText("Under attack!");
                break;
            case RoomStatus.COUNTDOWN:
                roomStatusText.setText("Ship incoming...");
                break;
            case RoomStatus.DEFEAT:
                roomStatusText.setText("Defense failed!");
                break;
            case RoomStatus.VICTORY:
                roomStatusText.setText("Room defended!");
                break;
        }
    }
}