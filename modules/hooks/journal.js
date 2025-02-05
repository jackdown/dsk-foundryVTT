import DSKStatusEffects from "../status/status_effects.js";
import DSKChatAutoCompletion from "../system/chat_autocompletion.js";
import DSK from "../system/config.js";
import { bindImgToCanvasDragStart } from "./imgTileDrop.js";

export function setupJournal(){
    Hooks.on("getJournalSheetHeaderButtons", (sheet, buttons) => {
        if (!sheet.document.sceneNote) return

        buttons.unshift({
            class: "panMapNote",
            icon: "fas fa-map-pin",
            onclick: async() => sheet.document.panToNote()
        })
    })

    Hooks.on("renderJournalSheet", (obj, html, data) => {
        html.find(".close").attr("data-tooltip", game.i18n.localize("dsk.SHEET.Close"));
        html.find(".entry-image").attr("data-tooltip", game.i18n.localize("dsk.SHEET.imageView"));
        html.find(".entry-text").attr("data-tooltip", game.i18n.localize("dsk.SHEET.textView"));
        html.find(".share-image").attr("data-tooltip", game.i18n.localize("dsk.SHEET.showToPlayers"));
        html.find(".import").attr("data-tooltip", game.i18n.localize("dsk.SHEET.import"));
        html.find(".panMapNote").attr("data-tooltip", game.i18n.localize("dsk.SHEET.panMapNote"));
    })

    Hooks.on("renderJournalPageSheet", (obj, html, data) => {
        DSKChatAutoCompletion.bindRollCommands(html)
        DSKStatusEffects.bindButtons(html)
        html.find('img').mousedown(ev => { if (ev.button == 2) game.dsk.apps.DSKUtility.showArtwork({ name: obj.name, uuid: "", img: $(ev.currentTarget).attr("src") }) })
        bindImgToCanvasDragStart(html)
    })  
}

export async function increaseFontSize(element){
    const index = game.settings.get("dsk", "journalFontSizeIndex")
    let newIndex = index + 1
    if(newIndex == DSK.journalFontSizes.length + 1) {
        newIndex = 0
        await game.settings.set("dsk", "journalFontSizeIndex", newIndex)
        element.css("fontSize", "")
        tinyNotification(game.i18n.format('dsk.CHATNOTIFICATION.fontsize', { size: "Default " }))
    } else {
        await game.settings.set("dsk", "journalFontSizeIndex", newIndex)
        setOuterFontSize(element)
    }
}

function setOuterFontSize(element){
    const index = game.settings.get("dsk", "journalFontSizeIndex")
    const size = DSK.journalFontSizes[index - 1] || 14;
    tinyNotification(game.i18n.format('dsk.CHATNOTIFICATION.fontsize', { size }))
    element.css("fontSize", `${size}px`)
}