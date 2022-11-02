export function setupKeybindings() {    
    game.keybindings.register("dsa5", "combatTrackerNext", {
        name: "COMBAT.TurnNext",
        hint: game.i18n.localize("COMBAT.TurnNext"),
        editable: [{ key: "KeyN" }],
        onDown: () => combatTurn("nextTurn")
    })
    game.keybindings.register("dsa5", "combatTrackerPrevious", {
        name: "COMBAT.TurnPrev",
        hint: game.i18n.localize("COMBAT.TurnPrev"),
        editable: [{ key: "KeyV" }],
        onDown: () => combatTurn("previousTurn")
    })
}

const combatTurn = (mode) => {
    game.combat?.combatant?.isOwner && game.combat[mode]()
}
