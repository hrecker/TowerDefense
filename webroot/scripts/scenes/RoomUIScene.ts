import { Unit, getUnitsJsonProperties } from "../model/Units";
import { setShopSelection, addShopMessageListener, setShopMessage } from "../state/UIState";
import { addTimerMsListener, addRoomStatusListener, RoomStatus, 
    getActiveShipMods, addShipModListener, addShipWeaponListener, getActiveShipWeapon, getRoomScene, getRoomStatus, isRoomShopBuffActive, addRoomShopBuff, addRoomResetListener } from "../state/RoomState";
import { getResources, addCurrentResourcesListener, addResources } from "../state/ResourceState";
import { createGlobalMod, ModType } from "../model/Mods";

const unitSelectionBoxWidth = 192;
const shopSelectionBoxDefaultColor = 0x6400b5;
const shopSelectionBoxHighlightColor = 0x8a57b3;
const modIconAlpha = 0.8;

let unitSelectionCenterX;
let activeShopSelectionIndex = -1;
let shopSelectionBoxes: Phaser.GameObjects.Rectangle[];
let purchasableUnits: Unit[];
let currentResourcesText: Phaser.GameObjects.Text;
let roomStatusText: Phaser.GameObjects.Text;
let timerText: Phaser.GameObjects.Text;
let shopMessageText: Phaser.GameObjects.Text;
let shopMessageTextHideEvent: Phaser.Time.TimerEvent;

let shipWeaponIcon: Phaser.GameObjects.Image;
let shipModIcons: Phaser.GameObjects.Image[] = [];
let shipModTooltipBackground: Phaser.GameObjects.Rectangle;
let shipModTooltipText: Phaser.GameObjects.Text;
let shipModTooltip: Phaser.GameObjects.Group;

let buffIcons: Phaser.GameObjects.Image[] = [];
let buffTooltipBackground: Phaser.GameObjects.Rectangle;
let buffTooltipText: Phaser.GameObjects.Text;
let buffTooltip: Phaser.GameObjects.Group;

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
        addRoomResetListener(this.onRoomReset, this);

        let shopBackground = this.add.rectangle(unitSelectionCenterX, this.game.renderer.height / 2, 
            unitSelectionBoxWidth, this.game.renderer.height, 0x000000);
        shopBackground.setInteractive();
        shopBackground.on("pointerdown", () => {
            this.clearShopSelection();
        });

        currentResourcesText = this.add.text(unitSelectionCenterX, 15, getResources().toString()).setOrigin(0.5);
        addCurrentResourcesListener(this.updateCurrentResourcesText, this);
        this.updateCurrentResourcesText(getResources());

        roomStatusText = this.add.text(unitSelectionCenterX, this.game.renderer.height - 80, "Status Text", { fontSize: "18px" }).setOrigin(0.5);
        timerText = this.add.text(unitSelectionCenterX, this.game.renderer.height - 40, "99:99", { fontSize: "32px" }).setOrigin(0.5);
        addTimerMsListener(this.updateTimerText, this);
        addRoomStatusListener(this.updateRoomStatus, this);
        this.updateRoomStatus(RoomStatus.COUNTDOWN);

        shopMessageText = this.add.text(unitSelectionCenterX, this.game.renderer.height - 130, "Shop message", { fontSize: "16px" }).setOrigin(0.5);
        shopMessageText.setWordWrapWidth(unitSelectionBoxWidth - 20);
        shopMessageText.setVisible(false);
        addShopMessageListener(this.showShopMessage, this);

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

        // Buff menu
        buffTooltipBackground = this.add.rectangle(unitSelectionCenterX, this.game.renderer.height - 172, unitSelectionBoxWidth - 10, 24, 0xc4c4c4, 1);
        buffTooltipText = this.add.text(unitSelectionCenterX, this.game.renderer.height - 172, "Sample text", { color: "#000" }).setOrigin(0.5);
        buffTooltip = this.add.group([buffTooltipBackground, buffTooltipText]);
        buffTooltip.setVisible(false);
        let buffMargin = 60;
        let buffNames = Object.keys(this.cache.json.get("buffs"));
        let firstBuffX = unitSelectionCenterX - 60;
        for (let i = 0; i < buffNames.length; i++) {
            let buffIcon = this.add.image(firstBuffX + (buffMargin * i), this.game.renderer.height - 230, buffNames[i]);
            buffIcons.push(buffIcon);
            this.add.text(firstBuffX + (buffMargin * i), this.game.renderer.height - 195, this.cache.json.get("buffs")[buffNames[i]]["price"]).setOrigin(0.5);
            buffIcon.setInteractive();
            buffIcon.on("pointerover", () => {
                buffTooltip.setVisible(true);
                buffTooltipText.setText(this.cache.json.get("buffs")[buffNames[i]]["tooltip"]);
                buffTooltipBackground.displayWidth = buffTooltipText.width + 4;
            });
            buffIcon.on("pointerout", () => {
                buffTooltip.setVisible(false);
            });
            buffIcon.on("pointerdown", () => {
                // Apply the buff
                // Check that room is active and there are enough resources
                if (getRoomStatus() == RoomStatus.DEFEAT || getRoomStatus() == RoomStatus.VICTORY) {
                    setShopMessage("Room is no longer active!");
                    return;
                }
                // Prevent multiple of one buff in same room
                if (isRoomShopBuffActive(buffNames[i])) {
                    setShopMessage("Buff already active!");
                    return;
                }
                let price = this.cache.json.get("buffs")[buffNames[i]]["price"];
                if (price > getResources()) {
                    setShopMessage("Need more resources!");
                    return;
                }
                addResources(-price);
                createGlobalMod(true, ModType[buffNames[i]], this.cache.json.get("buffs")[buffNames[i]]["props"], getRoomScene());
                addRoomShopBuff(buffNames[i]);
                buffIcon.setAlpha(0.25);
            });
        }

        // Weapon icon
        shipWeaponIcon = this.add.image(32, 32, getActiveShipWeapon() + "_icon").setAlpha(modIconAlpha);
        shipWeaponIcon.setInteractive();
        shipWeaponIcon.on("pointerover", () => {
            shipModTooltip.setVisible(true);
            shipModTooltipText.setText(this.cache.json.get("shipWeapons")[getActiveShipWeapon()]["tooltip"]);
            shipModTooltipBackground.displayWidth = shipModTooltipText.width + 2;
        });
        shipWeaponIcon.on("pointerout", () => {
            shipModTooltip.setVisible(false);
        });
        addShipWeaponListener(this.setShipWeaponIcon, this);

        // Mod icons
        this.setShipModIcons(getActiveShipMods());
        shipModTooltipBackground = this.add.rectangle(8, 64, 400, 24, 0xc4c4c4, 1).setOrigin(0, 0);
        shipModTooltipText = this.add.text(10, 68, "Sample text", { color: "#000" }).setOrigin(0, 0);
        shipModTooltip = this.add.group([shipModTooltipBackground, shipModTooltipText]);
        shipModTooltip.setVisible(false);
        addShipModListener(this.setShipModIcons, this);
    }

    onRoomReset() {
        buffIcons.forEach(buffIcon => {
            buffIcon.setAlpha(1);
        })
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

    showShopMessage(message: string, scene: Phaser.Scene) {
        if (message != "") {
            shopMessageText.setVisible(true);
            shopMessageText.setText(message);
            if (shopMessageTextHideEvent) {
                shopMessageTextHideEvent.remove();
            }
            // Hide after a couple seconds
            shopMessageTextHideEvent = scene.time.delayedCall(3000, () => {
                shopMessageText.setVisible(false);
            });
        }
    }

    setShipModIcons(activeMods: string[]) {
        let max = Math.max(activeMods.length, shipModIcons.length);
        for (let i = 0; i < max; i++) {
            if (i < activeMods.length) {
                if (i < shipModIcons.length) {
                    shipModIcons[i].setTexture(activeMods[i]).setVisible(true);
                } else {
                    let newIcon = this.add.image(88 + (56 * i), 32, activeMods[i]).setAlpha(modIconAlpha);
                    newIcon.setInteractive();
                    newIcon.on("pointerover", () => {
                        shipModTooltip.setVisible(true);
                        shipModTooltipText.setText(this.cache.json.get("shipMods")[getActiveShipMods()[i]]["tooltip"]);
                        shipModTooltipBackground.displayWidth = shipModTooltipText.width + 2;
                    });
                    newIcon.on("pointerout", () => {
                        shipModTooltip.setVisible(false);
                    });
                    shipModIcons.push(newIcon);
                }
            } else if (i < shipModIcons.length) {
                shipModIcons[i].setVisible(false);
            }
        }
    }

    setShipWeaponIcon(activeWeapon) {
        shipWeaponIcon.setTexture(activeWeapon + "_icon");
    }
}