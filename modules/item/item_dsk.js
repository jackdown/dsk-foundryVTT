import ActorDSK from "../actor/actor_dsk.js"
import DSKStatusEffects from "../status/status_effects.js"
import AdvantageRulesDSK from "../system/advantage-rules.js"
import DiceDSK from "../system/dicedsk.js"
import DSKUtility from "../system/dsk_utility.js"
import DSK from "../system/config.js"
import DSKCombatDialog from "../dialog/dialog-combat-dsk.js"
import RuleChaos from "../system/rule_chaos.js"
import SpecialabilityRulesDSK from "../system/specialability-rules.js"
import DPS from "../system/derepositioningsystem.js"
import CreatureType from "../system/creature-type.js"
const { duplicate, mergeObject, getProperty } = foundry.utils

export default class ItemDSK extends Item{
    static defaultImages(type, subtype = ""){
        const key = `${type}${subtype}`
        return {
            effectwrapper: "icons/svg/aura.svg",
            information: "systems/dsk/icons/categories/DSK-Auge.webp",
            ammunition: "systems/dsk/icons/categories/arrow.webp",
            equipment: "systems/dsk/icons/categories/equipment.webp",
            advantage: "systems/dsk/icons/categories/advantage.webp",
            disadvantage: "systems/dsk/icons/categories/disadvantage.webp",
            specialability: "systems/dsk/icons/categories/specialability.webp",
            combatskill: "systems/dsk/icons/categories/combatskill.webp",
            ahnengabe: "systems/dsk/icons/categories/ahnengabe.webp",
            armor: "systems/dsk/icons/categories/armor.webp",
            rangeweapon: "systems/dsk/icons/categories/rangeweapon.webp",
            meleeweapon: "systems/dsk/icons/categories/meleeweapon.webp",
            ahnengeschenk: "systems/dsk/icons/categories/ahnengeschenk.webp",
            culture: "systems/dsk/icons/categories/culture.webp",
            profession: "systems/dsk/icons/categories/profession.webp",
            poison: "systems/dsk/icons/categories/poison.webp",
            trait: "systems/dsk/icons/categories/trait.webp",
            consumable: "systems/dsk/icons/categories/consumable.webp",
        }[key]
    }

    static defaultIcon(data) {
        if (!data.img || data.img == "") {
            data.img = this.defaultImages(data.type) || "systems/dsk/icons/blank.webp"
        }
    }

    setupEffect(ev, options = {}, tokenId) {
        return ItemDSK.getSubClass(this.type).setupDialog(ev, options, this, tokenId)
    }

    async itemTest({ testData, cardOptions }, options = {}) {
        testData = await DiceDSK.rollDices(testData, cardOptions)
        let result = await DiceDSK.rollTest(testData)

        result.postFunction = "itemTest"

        if (game.user.targets.size) {
            cardOptions.isOpposedTest = testData.opposable
            const opposed = ` - ${game.i18n.localize("dsk.Opposed")}`
            if (cardOptions.isOpposedTest && cardOptions.title.match(opposed + "$") != opposed) cardOptions.title += opposed
        }

        if (!options.suppressMessage) DiceDSK.renderRollCard(cardOptions, result, options.rerenderMessage)

        return { result, cardOptions }
    }

    static attackStatEffect(situationalModifiers, value) {
        if (value != 0) {
            situationalModifiers.push({
                name: game.i18n.localize("dsk.statuseffects"),
                value,
                selected: true,
            })
        }
    }

    static prepareRangeAttack(situationalModifiers, actor, data, source, tokenId, combatskills, currentAmmo = undefined) {
        situationalModifiers.push(
            ...AdvantageRulesDSK.getVantageAsModifier(actor, game.i18n.localize("dsk.LocalizedIDs.restrictedSenseSight"), -2)
        )
        this.getCombatSkillModifier(actor, source, situationalModifiers)

        const targetSize = this.getTargetSizeAndModifier(actor, source, situationalModifiers, data)

        const defenseMalus = Number(actor.system.rangeStats.defenseMalus) * -1
        if (defenseMalus != 0) {
            situationalModifiers.push({
                name: `${game.i18n.localize("dsk.statuseffects")} - ${game.i18n.localize("dsk.MODS.defenseMalus")}`,
                value: defenseMalus,
                type: "defenseMalus",
                selected: true,
            })
        }

        const rangeOptions = {...DSK.rangeWeaponModifiers }
        delete rangeOptions[
            AdvantageRulesDSK.hasVantage(actor, game.i18n.localize("dsk.LocalizedIDs.senseOfRange")) ? "long" : "rangesense"
        ]
        if (!SpecialabilityRulesDSK.hasAbility(actor, game.i18n.localize("dsk.LocalizedIDs.extremeShot"))) delete rangeOptions["extreme"]
        const drivingArcher = SpecialabilityRulesDSK.hasAbility(actor, game.i18n.localize("dsk.LocalizedIDs.drivingArcher"))
        const mountedOptions = drivingArcher ? duplicate(DSK.drivingArcherOptions) : duplicate(DSK.mountedRangeOptions)
        let finalMountedOptions = {}
        for(let key of Object.keys(mountedOptions)){
            finalMountedOptions[`${game.i18n.localize('mountedRangeOptions.' + key)} (${mountedOptions[key]})`] = mountedOptions[key]
        }

        mergeObject(data, {
            rangeOptions,
            rangeDistance: Object.keys(rangeOptions)[DPS.distanceModifier(game.canvas.tokens.get(tokenId), source, currentAmmo)],
            sizeOptions: DSK.rangeSizeCategories,
            visionOptions: DSK.rangeVision,
            mountedOptions: finalMountedOptions,
            shooterMovementOptions: DSK.shooterMovementOptions,
            targetMovementOptions: DSK.targetMomevementOptions,
            targetSize,
            combatSpecAbs: combatskills,
            aimOptions: DSK.aimOptions,
        })
    }

    async addCondition(effect, value = 1, absolute = false, auto = true) {
        return await DSKStatusEffects.addCondition(this, effect, value, absolute, auto)
    }

    async removeCondition(effect, value = 1, auto = true, absolute = false) {
        return DSKStatusEffects.removeCondition(this, effect, value, auto, absolute)
    }

    hasCondition(conditionKey) {
        return DSKStatusEffects.hasCondition(this, conditionKey)
    }

    static async _onCreateOperation(documents, operation, user) {
        for(let doc of documents) {
            if(doc.actor)
                await ActorDSK.postUpdateConditions(doc.actor)
        }
        return super._onCreateOperation(documents, operation, user);
      }

    static async _onUpdateOperation(documents, operation, user) {
        for(let doc of documents) {
            if(doc.actor)
                await ActorDSK.postUpdateConditions(doc.actor)
        }
        return super._onUpdateOperation(documents, operation, user);
    }

    static async _onDeleteOperation(documents, operation, user) {
        for(let doc of documents) {
            if(doc.actor)
                await ActorDSK.postUpdateConditions(doc.actor)
        }
        return super._onDeleteOperation(documents, operation, user);
    }

    static prepareMeleeAttack(situationalModifiers, actor, data, source, combatskills, wrongHandDisabled) {
        let targetWeaponSize = "short"
        game.user.targets.forEach((target) => {
            if (target.actor) {
                const defWeapon = target.actor.items.filter((x) => {
                    return (
                        (x.type == "meleeweapon" && x.system.worn.value) ||
                        (x.type == "trait" && x.system.traitType == "meleeAttack" && x.system.pa)
                    )
                })
                if (defWeapon.length > 0) targetWeaponSize = defWeapon[0].system.rw

            }
        })
        
        const targetSize = this.getTargetSizeAndModifier(actor, source, situationalModifiers, data)
        this.getCombatSkillModifier(actor, source, situationalModifiers)

        const defenseMalus = Number(actor.system.meleeStats.defenseMalus) * -1
        if (defenseMalus != 0) {
            situationalModifiers.push({
                name: `${game.i18n.localize("dsk.statuseffects")} - ${game.i18n.localize("dsk.MODS.defenseMalus")}`,
                value: defenseMalus,
                type: "defenseMalus",
                selected: true,
            })
        }

        mergeObject(data, {
            visionOptions: DSK.meleeRangeVision(),
            weaponSizes: DSK.meleeRanges,
            melee: true,
            showAttack: true,
            targetWeaponSize,
            combatSpecAbs: combatskills,
            meleeSizeOptions: DSK.meleeSizeCategories,
            targetSize,
            constricted: actor.hasCondition("constricted"),
            wrongHandDisabled,
            offHand: !wrongHandDisabled && getProperty(source, "system.worn.offHand"),
        })
    }

    static parseValueType(name, val) {
        let type = ""
        if (/^\*/.test(val)) {
            type = "*"
            val = val.substring(1).replace(",", ".")
        }
        return {
            name,
            value: Number(val),
            type,
        }
    }

    static getSpecAbModifiers(html, mode) {
        let res = []
        for (let k of html.find(".specAbs")) {
            let step = Number($(k).attr("data-step"))
            if (step > 0) {
                const val = mode == "attack" ? $(k).attr("data-atbonus") : $(k).attr("data-pabonus")
                const reducedVal = val.split(",").reduce((prev, cur) => {
                    return prev + Number(cur)
                }, 0)
                res.push({
                    name: $(k).find("a").text(),
                    value: isNaN(reducedVal) ? Number(val.replace("*", "")) : Number(reducedVal) * step,
                    damageBonus: $(k).attr("data-tpbonus"),
                    dmmalus: $(k).attr("data-dmmalus") * step,
                    step: step,
                    specAbId: $(k).attr("data-id"),
                    type: /^\*/.test(val) ? "*" : undefined,
                })
            }
        }
        return res
    }

    static getTargetSizeAndModifier(actor, source, situationalModifiers, data){
        let targetSize = "average"
        let vw = 0
        game.user.targets.forEach((target) => {
            if (target.actor) {
                const size = getProperty(target.actor, "system.details.size")
                if(size) targetSize = size

                CreatureType.addCreatureTypeModifiers(target.actor, source, situationalModifiers, actor)
                vw = Math.max(vw, target.actor.system.maxDefense.parry)
            }
        })
        data.vw = vw
        return targetSize
    }

    static getCombatSkillModifier(actor, source, situationalModifiers) {
        if (source.type == "trait") return

        const combatskill = actor.items.find((x) => x.type == "combatskill" && x.name == source.system.combatskill)

        for (let ef of combatskill.effects) {
            for (let change of ef.changes) {
                switch (change.key) {
                    case "system.rangeStats.defenseMalus":
                    case "system.meleeStats.defenseMalus":
                        situationalModifiers.push({
                            name: `${combatskill.name} - ${game.i18n.localize("dsk.MODS.defenseMalus")}`,
                            value: change.value * -1,
                            type: "defenseMalus",
                            selected: true,
                        })
                        break
                }
            }
        }
    }

    static buildCombatSpecAbs(actor, categories, toSearch, mode) {
        let searchFilter
        if (toSearch) {
            toSearch.push(game.i18n.localize("dsk.LocalizedIDs.all"))
            toSearch = toSearch.map((x) => x.toLowerCase())
            searchFilter = (x, toSearch) => {
                return (
                    x.system.combatskills
                    .split(/;|,/)
                    .map((x) => x.trim().toLowerCase())
                    .filter((y) => toSearch.includes(y.replace(/ \([a-zA-Z äüöÄÖÜ]*\)/, ""))).length > 0
                )
            }
        } else
            searchFilter = () => { return true }

        const combatSpecAbs = actor.items.filter((x) => {
            return (
                x.type == "specialability" &&
                categories.includes(x.system.category) &&
                x.system.effect != "" &&
                searchFilter(x, toSearch)
            )
        })

        let combatskills = []
        const at = game.i18n.localize("dsk.LocalizedAbilityModifiers.at")
        const tp = game.i18n.localize("dsk.LocalizedAbilityModifiers.tp")
        const pa = game.i18n.localize("dsk.LocalizedAbilityModifiers.pa")
        const dm = game.i18n.localize("dsk.LocalizedAbilityModifiers.dm")

        if (mode == "attack") {
            for (let com of combatSpecAbs) {
                const effects = ItemDSK.parseEffect(com.system.effect, actor)
                const atbonus = effects[at] || 0
                const tpbonus = effects[tp] || 0
                const dmmalus = effects[dm] || 0
                if (atbonus != 0 || tpbonus != 0 || dmmalus != 0 || com.effects.size > 0) {
                    const subCategory = game.i18n.localize(DSK.combatSkillSubCategories[com.system.subcategory])
                    combatskills.push({
                        name: com.name,
                        atbonus,
                        tpbonus,
                        dmmalus,
                        label: `${at}: ${atbonus}, ${tp}: ${tpbonus}, ${dm}: ${dmmalus}`,
                        steps: com.system.level,
                        category: {
                            id: com.system.subcategory,
                            css: `ab_${com.system.subcategory}`,
                            name: subCategory,
                        },
                        id: com.id,
                        actor: actor.id,
                    })
                }
            }
        } else {
            for (let com of combatSpecAbs) {
                const effects = ItemDSK.parseEffect(com.system.effect, actor)
                const pabonus = effects[pa] || 0
                if (pabonus != 0) {
                    const subCategory = game.i18n.localize(DSK.combatSkillSubCategories[com.system.subcategory])
                    combatskills.push({
                        name: com.name,
                        pabonus,
                        tpbonus: 0,
                        dmmalus: 0,
                        label: `${pa}: ${pabonus}`,
                        steps: com.system.level,
                        category: {
                            id: com.system.category.sub,
                            css: `ab_${com.system.subcategory}`,
                            name: subCategory,
                        },
                        id: com.id,
                        actor: actor.id,
                    })
                }
            }
        }
        return combatskills
    }

    _setupCardOptions(template, title, tokenId) {
        const speaker = ChatMessage.getSpeaker()
        return {
            speaker: {
                alias: speaker.alias,
                scene: speaker.scene,
            },
            flags: {
                img: speaker.token ? canvas.tokens.get(speaker.token).document.img : this.img,
            },
            title,
            template,
        }
    }

    static getSkZkModifier(data, source) {
        let skMod = []
        let zkMod = []

        const hasSpellResistance = ["ahnengabe"].includes(source.type) && source.system.effectFormula.trim() == ""
        if (game.user.targets.size) {
            game.user.targets.forEach((target) => {
                if (target.actor) {
                    let spellResistance = 0
                    if (hasSpellResistance) {
                        const creatureTypes = CreatureType.detectCreatureType(target.actor)
                        spellResistance = creatureTypes.reduce((sum, x) => {
                            return sum + x.spellResistanceModifier(target.actor)
                        }, 0)
                    }

                    skMod.push(target.actor.system.stats.sk.max * -1 - spellResistance)
                    zkMod.push(target.actor.system.stats.zk.max * -1 - spellResistance)
                }
            })
        }

        mergeObject(data, {
            SKModifier: skMod.length > 0 ? Math.min(...skMod) : 0,
            ZKModifier: zkMod.length > 0 ? Math.min(...zkMod) : 0
        })
    }

    static async create(data, options) {
        this.defaultIcon(data)
        return await super.create(data, options)
    }

    static changeChars(source, ch1, ch2) {
        source.system.characteristic1 = ch1
        source.system.characteristic2 = ch2
    }

    static getSubClass(type) {
        return game.dsk.config.ItemSubClasses[type] || ItemDSK
    }

    static areEquals(item, item2) {
        if (item.type != item2.type) return false

        return ItemDSK.getSubClass(item.type).checkEquality(item, item2)
    }

    static checkEquality(item, item2) {
        return (
            item2.type == item.type && item.name == item2.name && item.system.description.value == item2.system.description.value
        )
    }

    static setupDialog(ev, options, item, actor, tokenId) {
        return null
    }

    static buildSpeaker(actor, tokenId) {
        return {
            token: tokenId,
            actor: actor ? actor.id : undefined,
            scene: canvas.scene ? canvas.scene.id : null,
        }
    }

    static async stackItems(stackOn, newItem, actor) {
        return await ItemDSK.getSubClass(stackOn.type).combineItem(stackOn, newItem, actor)
    }

    static async combineItem(item1, item2, actor) {
        item1 = duplicate(item1)
        item1.system.quantity += item2.system.quantity
        return await actor.updateEmbeddedDocuments("Item", [item1])
    }

    static _chatLineHelper(key, val) {
        return `<b>${game.i18n.localize(key)}</b>: ${val ? val : "-"}`
    }

    static setupSubClasses() {
        game.dsk.config.ItemSubClasses = {
            meleeweapon: ItemMeleeweapon,
            rangeweapon: ItemRangeweapon,
            armor: ItemArmor,
            ammunition: ItemAmmunition,
            equipment: ItemEquipment,
            species: ItemSpecies,
            culture: ItemCulture,
            profession: ItemProfession,
            advantage: ItemAdvantage,
            disadvantage: ItemDisadvantage,
            specialability: ItemSpecialability,
            ahnengeschenk: ItemAhnengeschenk,
            ahnengabe: ItemAhnengabe,
            poison: ItemPoison,
            skill: ItemSkill,
            combatskill: ItemCombatskill,
            effectwrapper: ItemEffectwrapper,
            information: ItemInformation,
            trait: ItemTrait,
            consumable: ItemConsumable
        }
    }

    static hasSchips(actor){
        return getProperty(actor.system, "stats.schips.value") > 0
    }

    async postItem() {
        ItemDSK.getSubClass(this.type)._postItem(this)
    }

    static parseEffect(effect, actor) {
        let itemModifiers = {}
        let regex = new RegExp(game.i18n.localize("dsk.CHARAbbrev.GS"), "gi")
        for (let mod of effect.split(/,|;/).map((x) => x.trim())) {
            let vals = mod.replace(/(\s+)/g, " ").trim().split(" ")
            vals[0] = vals[0].replace(regex, actor.system.stats.gs.max)
            if (vals.length == 2) {
                if (!isNaN(vals[0]) ||
                    /(=)?[+-]\d([+-]\d)?/.test(vals[0]) ||
                    /(=)?\d[dDwW]\d/.test(vals[0]) ||
                    /=\d+/.test(vals[0]) ||
                    /\*\d(\.\d)*/.test(vals[0])
                ) {
                    if (itemModifiers[vals[1].toLowerCase()] == undefined) {
                        itemModifiers[vals[1].toLowerCase()] = [vals[0]]
                    } else {
                        itemModifiers[vals[1].toLowerCase()].push(vals[0])
                    }
                }
            }
        }
        return itemModifiers
    }

    static chatData(data, name) {
        return []
    }

    static async _postItem(item) {
        let chatData = duplicate(item)
        
        const detailsObfuscated = getProperty(chatData, "system.obfuscation.details")
        const descriptionObfuscated = getProperty(chatData, "system.obfuscation.description")
        
        mergeObject(chatData, {
            properties: detailsObfuscated ? [] : ItemDSK.getSubClass(item.type).chatData(duplicate(chatData.system), item.name),
            descriptionObfuscated
        })

        chatData.hasPrice = ("price" in chatData.system) && !detailsObfuscated
        if (chatData.hasPrice) {
            chatData.properties.push(`<b>${game.i18n.localize("dsk.price")}</b>: ${chatData.system.price}`)
        }

        if (item.pack) chatData.itemLink = item.link

        if (chatData.img.includes("/blank.webp")) chatData.img = null

        const html = await renderTemplate("systems/dsk/templates/chat/post-item.html", chatData)
        const chatOptions = DSKUtility.chatDataSetup(html)
        ChatMessage.create(chatOptions)
    }
}

class ItemInformation extends ItemDSK {
    static async _postItem(item){
        const html = await renderTemplate("systems/dsk/templates/chat/informationRequestRoll.html", {item})
        const chatOptions = DSKUtility.chatDataSetup(html)
        ChatMessage.create(chatOptions)
    }
}

class ItemEffectwrapper extends ItemDSK {
    
}

class ItemTrait extends ItemDSK {
    static chatData(data, name) {
        let res = []
        switch (data.traitType) {
            case "meleeAttack":
                res = [
                    this._chatLineHelper("dsk.ABBR.AW", data.at),
                    this._chatLineHelper("dsk.damage", data.damage),
                    this._chatLineHelper("dsk.range", data.rw),
                ]
                break
            case "rangeAttack":
                res = [
                    this._chatLineHelper("dsk.ABBR.AW", data.at),
                    this._chatLineHelper("dsk.damage", data.damage),
                    this._chatLineHelper("dsk.range", data.rw),
                    this._chatLineHelper("dsk.reloadTime", data.lz),
                ]
                break
            case "armor":
                res = [this._chatLineHelper("dsk.protection", data.damage)]
                break
           
        }

        return res
    }

    static getSituationalModifiers(situationalModifiers, actor, data, source, tokenId) {
        source = DSKUtility.toObjectIfPossible(source)
        const traitType = source.system.traitType
        const combatskills = ItemDSK.buildCombatSpecAbs(actor, ["Combat", "animal"], undefined, data.mode)

        if (data.mode == "attack" && traitType == "meleeAttack") {
            this.prepareMeleeAttack(situationalModifiers, actor, data, source, combatskills, false)
        } else if (data.mode == "attack" && traitType == "rangeAttack") {
            this.prepareRangeAttack(situationalModifiers, actor, data, source, tokenId, combatskills)
        } 

        this.attackStatEffect(
            situationalModifiers,
            Number(actor.system[traitType == "meleeAttack" ? "meleeStats" : "rangeStats"][data.mode])
        )
    }

    static setupDialog(ev, options, item, actor, tokenId) {
        let mode = options["mode"]
        let title = item.name + " " + game.i18n.localize("dsk." + mode + "test")
        mergeObject(item.system,{
            characteristic1: "attack",
            characteristic2: "attack",
        })
        let testData = {
            opposable: true,
            source: item,
            mode,
            extra: {
                actor: actor.toObject(false),
                options,
                speaker: ItemDSK.buildSpeaker(actor, tokenId),
            },
        }
        const multipleDefenseValue = RuleChaos.multipleDefenseValue(actor, item.toObject())
        let data = {
            rollMode: options.rollMode,
            mode,
            hasSchips: this.hasSchips(actor),
            defenseCountString: game.i18n.format("dsk.defenseCount", { malus: -1 * multipleDefenseValue }),
        }

        const traitType = getProperty(item, "system.traitType")

        let situationalModifiers = actor ? DSKStatusEffects.getRollModifiers(actor, item, { mode }) : []
        this.getSituationalModifiers(situationalModifiers, actor, data, item, tokenId)
        data["situationalModifiers"] = situationalModifiers

        let dialogOptions = {
            title,
            template: "/systems/dsk/templates/dialog/combatskill-enhanced-dialog.html",
            data,
            callback: (html, options = {}) => {
                if (traitType == "meleeAttack") {
                    DSKCombatDialog.resolveMeleeDialog(testData, cardOptions, html, actor, options, multipleDefenseValue, mode)
                } else {
                    DSKCombatDialog.resolveRangeDialog(testData, cardOptions, html, actor, options, multipleDefenseValue)
                }
                if(testData.situationalModifiers.some(x => x.name == game.i18n.localize("dsk.schips"))) actor.reduceSchips(0)

                testData.isRangeDefense = data.isRangeDefense
                Hooks.call("callbackDialogCombatDSK", testData, actor, html, item, tokenId)
                return { testData, cardOptions }
            },
        }

        let cardOptions = actor._setupCardOptions("systems/dsk/templates/chat/roll/combatskill-card.html", title, tokenId)

        return DiceDSK.setupDialog({ dialogOptions, testData, cardOptions })
    }
}

class ItemConsumable extends ItemDSK {
    static chatData(data, name) {
        let res = [
            this._chatLineHelper("dsk.consumable.effect", data[`effect${data.qs}`]),
            this._chatLineHelper("dsk.consumable.ingredients", data.ingredients),
        ]

        return res
    }    

    static consumablePrice(item) {
        const prices = `${item.system.price}`.split(";")
        return Number(prices[[item.system.qs]] || prices[0])
    }
}

class ItemMeleeweapon extends ItemDSK{
    static chatData(data, name) {
        let res = [
            this._chatLineHelper("dsk.damage", data.tp),
            this._chatLineHelper("dsk.ABBR.awvw", `${data.aw} / ${data.vw}`),
            this._chatLineHelper("TYPES.Item.combatskill", data.combatskill),
            this._chatLineHelper("dsk.range", game.i18n.localize(`dsk.Range.${data.rw}`)),
        ]

        return res
    }

    static getSituationalModifiers(situationalModifiers, actor, data, source) {
        let wrongHandDisabled = AdvantageRulesDSK.hasVantage(actor, game.i18n.localize("dsk.LocalizedIDs.ambidextrous"))
        source = DSKUtility.toObjectIfPossible(source)

        let toSearch = [source.system.combatskill]
        let combatskills = ItemDSK.buildCombatSpecAbs(actor, ["Combat"], toSearch, data.mode)

        if (data.mode == "attack") {
            this.prepareMeleeAttack(situationalModifiers, actor, data, source, combatskills, wrongHandDisabled)
        }

        this.attackStatEffect(situationalModifiers, Number(actor.system.meleeStats[data.mode]))
    }

    static setupDialog(ev, options, item, actor, tokenId) {
        let mode = options.mode
        let title = item.name + " " + game.i18n.localize("dsk." + mode + "test")

        const skill = actor.items.find(x => x.type == "combatskill" && x.name == item.system.combatskill)
        mergeObject(item.system,{
            characteristic1: skill.system.characteristic1,
            characteristic2: skill.system.characteristic2,
        })
        let testData = {
            opposable: true,
            source: item,
            mode,
            extra: {
                actor: actor.toObject(false),
                options,
                speaker: ItemDSK.buildSpeaker(actor, tokenId),
            },
        }
        const multipleDefenseValue = RuleChaos.multipleDefenseValue(actor, testData.source);
        let data = {
            rollMode: options.rollMode,
            mode,
            hasSchips: this.hasSchips(actor),
            defenseCountString: game.i18n.format("dsk.defenseCount", { malus: -1 * multipleDefenseValue }),
        }
        let situationalModifiers = actor ? DSKStatusEffects.getRollModifiers(actor, item, { mode }) : []
        this.getSituationalModifiers(situationalModifiers, actor, data, item)
        data["situationalModifiers"] = situationalModifiers

        let dialogOptions = {
            title,
            template: "/systems/dsk/templates/dialog/combatskill-enhanced-dialog.html",
            data,
            callback: (html, options = {}) => {
                DSKCombatDialog.resolveMeleeDialog(testData, cardOptions, html, actor, options, multipleDefenseValue, mode)
                if(testData.situationalModifiers.some(x => x.name == game.i18n.localize("dsk.schips"))) actor.reduceSchips(0)

                Hooks.call("callbackDialogCombatDSK", testData, actor, html, item, tokenId)
                testData.isRangeDefense = data.isRangeDefense
                return { testData, cardOptions }
            },
        }

        let cardOptions = actor._setupCardOptions("systems/dsk/templates/chat/roll/combatskill-card.html", title, tokenId)

        return DiceDSK.setupDialog({ dialogOptions, testData, cardOptions })
    }
}

class ItemRangeweapon extends ItemDSK{
    static chatData(data, name) {
        let res = [
            this._chatLineHelper("dsk.damage", data.tp),
            this._chatLineHelper("TYPES.Item.combatskill", data.combatskill),
            this._chatLineHelper("dsk.range", data.rw),
        ]

        return res
    }

    static getSituationalModifiers(situationalModifiers, actor, data, _source, tokenId) {
        if (data.mode == "attack") {
            const source = DSKUtility.toObjectIfPossible(_source)

            const toSearch = [source.system.combatskill]
            const combatskills = ItemDSK.buildCombatSpecAbs(actor, ["Combat"], toSearch, data.mode)
            let currentAmmo = actor.items.get(source.system.currentAmmo)

            if (currentAmmo) {
                currentAmmo = currentAmmo.toObject(false)
                const poison = getProperty(currentAmmo.flags, "dsk.poison")
                if (poison) mergeObject(_source.flags, { dsk: { poison } })
            }

            this.prepareRangeAttack(situationalModifiers, actor, data, source, tokenId, combatskills, currentAmmo)

            if (currentAmmo) {
                if (currentAmmo.system.atmod) {
                    situationalModifiers.push({
                        name: `${currentAmmo.name} - ${game.i18n.localize("dsk.atmod")}`,
                        value: currentAmmo.system.atmod,
                        selected: true,
                        specAbId: source.system.currentAmmo,
                    })
                }
                if (currentAmmo.system.damageMod || currentAmmo.system.armorMod) {
                    const dmgMod = {
                        name: `${currentAmmo.name} - ${game.i18n.localize("dsk.MODS.damage")}`,
                        value: currentAmmo.system.damageMod.replace(/wWD/g, "d") || 0,
                        type: "dmg",
                        selected: true,
                        specAbId: source.system.currentAmmo,
                    }
                    if (currentAmmo.system.armorMod) dmgMod["armorPen"] = currentAmmo.system.armorMod
                    situationalModifiers.push(dmgMod)
                }
                if(currentAmmo.effects.length){
                    situationalModifiers.push({
                        name: `${currentAmmo.name} - ${game.i18n.localize("dsk.effect")}`,
                        value: 1,
                        type: game.i18n.localize('dsk.effect'),
                        selected: true,
                        specAbId: source.system.currentAmmo,
                    })
                }
            }
        }
        this.attackStatEffect(situationalModifiers, Number(actor.system.rangeStats[data.mode]))
    }

    static async checkAmmunitionState(item, testData, actor, mode) {
        let hasAmmo = true
        if (mode != "damage") {
            let itemData = item.system
            if (itemData.ammunitionType == "infinite") {
                //Dont count ammo
            } else if (itemData.ammunitionType == "-") {
                testData.extra.ammo = duplicate(item)
                hasAmmo = testData.extra.ammo.system.quantity > 0
            } else {
                const ammoItem = actor.items.get(itemData.currentAmmo)
                if (ammoItem) {
                    testData.extra.ammo = ammoItem.toObject()
                    if (itemData.ammunitionType == "mag") {
                        hasAmmo = testData.extra.ammo.system.quantity > 1 || (testData.extra.ammo.system.mag.value > 0 && testData.extra.ammo.system.quantity > 0)

                    } else {
                        hasAmmo = testData.extra.ammo.system.quantity > 0
                    }
                } else {
                    hasAmmo = false
                }
            }
            if(!hasAmmo && actor.type == "creature") hasAmmo = true
        }
        if (!hasAmmo) ui.notifications.error("dsk.DSKError.NoAmmo", { localize: true })

        return hasAmmo
    }

    static async setupDialog(ev, options, item, actor, tokenId) {
        let mode = options.mode
        let title = item.name + " " + game.i18n.localize("dsk." + mode + "test")
        const skill = actor.items.find(x => x.type == "combatskill" && x.name == item.system.combatskill)
        mergeObject(item.system,{
            characteristic1: skill.system.characteristic1,
            characteristic2: skill.system.characteristic2,
        })
        let testData = {
            opposable: true,
            source: item,
            mode,
            extra: {
                actor: actor.toObject(false),
                options,
                speaker: ItemDSK.buildSpeaker(actor, tokenId),
            },
        }

        if (!(await this.checkAmmunitionState(item, testData, actor, mode))) return

        const multipleDefenseValue = RuleChaos.multipleDefenseValue(actor, testData.source);
        let data = {
            rollMode: options.rollMode,
            mode,
            hasSchips: this.hasSchips(actor),
            defenseCountString: game.i18n.format("dsk.defenseCount", { malus: -1 * multipleDefenseValue }),
        }
        let situationalModifiers = actor ? DSKStatusEffects.getRollModifiers(actor, item, { mode }) : []
        this.getSituationalModifiers(situationalModifiers, actor, data, item, tokenId)
        data["situationalModifiers"] = situationalModifiers

        let dialogOptions = {
            title,
            template: "/systems/dsk/templates/dialog/combatskill-enhanced-dialog.html",
            data,
            callback: (html, options = {}) => {
                DSKCombatDialog.resolveRangeDialog(testData, cardOptions, html, actor, options, multipleDefenseValue)
                if(testData.situationalModifiers.some(x => x.name == game.i18n.localize("dsk.schips"))) actor.reduceSchips(0)
                
                Hooks.call("callbackDialogCombatDSK", testData, actor, html, item, tokenId)
                return { testData, cardOptions }
            },
        }

        let cardOptions = actor._setupCardOptions("systems/dsk/templates/chat/roll/combatskill-card.html", title, tokenId)

        return DiceDSK.setupDialog({ dialogOptions, testData, cardOptions })
    }
}

class ItemArmor extends ItemDSK{
    static chatData(data, name) {
        let properties = [
            this._chatLineHelper("dsk.protection", data.rs)
        ]

        return properties
    }
}

class ItemAmmunition extends ItemDSK{
    static chatData(data, name) {
        return [this._chatLineHelper("dsk.ammunitionType", game.i18n.localize(`dsk.ammunition.${data.ammunitionType}`))]
    }
}

class ItemEquipment extends ItemDSK{
    static chatData(data, name) {
        return [this._chatLineHelper("dsk.equipmentType", game.i18n.localize(`dsk.Equipment.${data.category}`))]
    }
}

class ItemSpecies extends ItemDSK{

}

class ItemCulture extends ItemDSK{

}

class ItemProfession extends ItemDSK{

}

class ItemAdvantage extends ItemDSK{
    static chatData(data, name) {
        return [this._chatLineHelper("dsk.rule", data.rule)]
    }
}

class ItemDisadvantage extends ItemAdvantage{

}

class ItemSpecialability extends ItemDSK{
    static chatData(data, name) {
        return [this._chatLineHelper("dsk.rule", data.rule)]
    }
}

class ItemAhnengeschenk extends ItemDSK{

}

class ItemAhnengabe extends ItemDSK{
    static chatData(data, name) {
        return [
            this._chatLineHelper("dsk.AeP", data.AeP),
            this._chatLineHelper("dsk.distribution", data.distribution),
            this._chatLineHelper("dsk.duration", data.duration),
            this._chatLineHelper("dsk.range", data.range),
            this._chatLineHelper("dsk.targetCategory", data.targetCategory)
        ]
    }

    static async getCallbackData(testData, html, actor) {
        testData.testDifficulty = 0
        testData.situationalModifiers = ActorDSK._parseModifiers(html)
        ActorDSK.schipsModifier(html, testData.situationalModifiers)
        if(testData.situationalModifiers.some(x => x.name == game.i18n.localize("dsk.schips"))) actor.reduceSchips(0)

        const formData = new FormDataExtended(html.find('form')[0]).object
        testData.calculatedSpellModifiers = {
            castingTime: html.find(".castingTime").text(),
            cost: html.find(".aspcost").text(),
            reach: html.find(".reach").text()
        }
        testData.situationalModifiers.push({
            name: game.i18n.localize("dsk.removeGesture"),
            value: Number(formData.removeGesture) || 0,
        }, {
            name: game.i18n.localize("dsk.removeFormula"),
            value: Number(formData.removeFormula) || 0,
        }, {
            name: game.i18n.localize("dsk.zkModifier"),
            value: formData.zkModifier || 0,
        }, {
            name: game.i18n.localize("dsk.skModifier"),
            value: formData.skModifier || 0,
        })
        testData.extensions = ItemAhnengabe.getSpecAbModifiers(html)
        testData.advancedModifiers = {
            chars: [0, 1].map((x) => formData[`ch${x}`]),
            fws: formData.fw,
            qls: formData.qs,
        }
        ItemDSK.changeChars(testData.source, ...[0, 1].map((x) => formData[`characteristics${x}`]))
    }

    static getSpecAbModifiers(html) {
        let res = []
        for (let k of html.find(".specAbs.active")) {
            res.push({name: k.dataset.name, title: k.dataset.tooltip, uuid: k.dataset.uuid})
        }
        return res
    }

    static getSituationalModifiers(situationalModifiers, actor, data, source) {
        situationalModifiers.push(
            ...AdvantageRulesDSK.getVantageAsModifier(actor, game.i18n.localize("dsk.LocalizedIDs.magicalAttunement"), 1, true),
            ...AdvantageRulesDSK.getVantageAsModifier(
                actor,
                game.i18n.localize("dsk.LocalizedIDs.magicalRestriction"), -1,
                true
            ),
            ...AdvantageRulesDSK.getVantageAsModifier(actor, game.i18n.localize("dsk.LocalizedIDs.boundToArtifact"), -1, true),
            //...this.attackSpellMalus(source)
        )

        if (game.user.targets.size) {
            game.user.targets.forEach((target) => {
                if (target.actor) CreatureType.addCreatureTypeModifiers(target.actor, source, situationalModifiers, actor)
            })
        }
        situationalModifiers.push(...actor.getSkillModifier(source.name, source.type))
        for (const thing of actor.system.skillModifiers.global) {
            situationalModifiers.push({ name: thing.source, value: thing.value })
        }

        this.getSkZkModifier(data, source)
    }

    static setupDialog(ev, options, spell, actor, tokenId) {
        let sheet = "ahnen"

        let title = spell.name + " " + game.i18n.localize(`dsk.probe`)  + (options.subtitle || "")

        let testData = {
            opposable: !!spell.system.effectFormula,
            source: spell,
            extra: {
                actor: actor.toObject(false),
                options,
                speaker: ItemDSK.buildSpeaker(actor, tokenId),
            },
            advancedModifiers: {
                chars: [0, 0],
                fws: 0,
                qls: 0,
            }
        }

        let data = {
            rollMode: options.rollMode,
            hasSKModifier: spell.system.resist == "sk",
            hasZKModifier: spell.system.resist == "zk",
            spellReach: spell.system.range,
            hasSchips: this.hasSchips(actor),
            characteristics: [1, 2].map((x) => spell.system[`characteristic${x}`]),
        }

        let situationalModifiers = actor ? DSKStatusEffects.getRollModifiers(actor, spell) : []
        this.getSituationalModifiers(situationalModifiers, actor, data, spell)
        data.situationalModifiers = situationalModifiers

        let dialogOptions = {
            title,
            template: `/systems/dsk/templates/dialog/${sheet}-enhanced-dialog.html`,
            data,
            callback: async(html, options = {}) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val()
                await this.getCallbackData(testData, html, actor)
                mergeObject(testData.extra.options, options)
                return { testData, cardOptions }
            },
        }

        let cardOptions = actor._setupCardOptions("systems/dsk/templates/chat/roll/spell-card.html", title, tokenId)

        return DiceDSK.setupDialog({ dialogOptions, testData, cardOptions })
    }
}

class ItemPoison extends ItemDSK{
    static chatData(data, name) {
        return [
            this._chatLineHelper("dsk.stepValue", data.level),
            this._chatLineHelper("dsk.poisonType", data.category),
            this._chatLineHelper("dsk.start", data.start),
            this._chatLineHelper("dsk.duration", data.duration),
            this._chatLineHelper("dsk.resistanceModifier", data.resist),
            this._chatLineHelper("dsk.effect", DSKUtility.replaceConditions(DSKUtility.replaceDies(data.effect))),
        ]
    }

    static getSituationalModifiers(situationalModifiers, actor, data, source) {
        source = DSKUtility.toObjectIfPossible(source)
        if (game.user.targets.size) {
            game.user.targets.forEach((target) => {
                if (target.actor)
                    situationalModifiers.push(
                        ...AdvantageRulesDSK.getVantageAsModifier(
                            target.actor,
                            game.i18n.localize("dsk.LocalizedIDs.poisonResistance"), -1,
                            false,
                            true
                        )
                    )
            })
        }
        this.getSkZkModifier(data, source)
        mergeObject(data, {
            hasSKModifier: source.system.resist == "SK",
            hasZKModifier: source.system.resist == "ZK",
        })
    }

    static setupDialog(ev, options, item, actor, tokenId) {
        let title = item.name + " " + game.i18n.localize("TYPES.Item." + item.type) + " " + game.i18n.localize("dsk.check")

        let testData = {
            opposable: false,
            source: item,
            extra: {
                options,
                speaker: ItemDSK.buildSpeaker(actor, tokenId),
            },
        }

        let data = {
            rollMode: options.rollMode,
        }

        let situationalModifiers = []
        this.getSituationalModifiers(situationalModifiers, actor, data, item)
        data.situationalModifiers = situationalModifiers

        let dialogOptions = {
            title,
            template: "/systems/dsk/templates/dialog/poison-dialog.html",
            data,
            callback: (html, options = {}) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val()
                testData.situationalModifiers = ActorDSK._parseModifiers(html)

                testData.situationalModifiers.push({
                    name: game.i18n.localize("zkModifier"),
                    value: html.find('[name="zkModifier"]').val() || 0,
                })
                testData.situationalModifiers.push({
                    name: game.i18n.localize("skModifier"),
                    value: html.find('[name="skModifier"]').val() || 0,
                })
                mergeObject(testData.extra.options, options)
                return { testData, cardOptions }
            },
        }

        let cardOptions = item._setupCardOptions(`systems/dsk/templates/chat/roll/${item.type}-card.html`, title, tokenId)

        return DiceDSK.setupDialog({ dialogOptions, testData, cardOptions })
    }
}

class ItemSkill extends ItemDSK{
    static getSituationalModifiers(situationalModifiers, actor, data, source) {
        situationalModifiers.push(
            ...actor.getSkillModifier(source.name, source.type)
        )

        for (const thing of actor.system.skillModifiers.global) {
            situationalModifiers.push({ name: thing.source, value: thing.value })
        }
    }

    static setupDialog(ev, options, skill, actor, tokenId) {
        let title = skill.name + " " + game.i18n.localize("dsk.probe") + (options.subtitle || "")
        let testData = {
            opposable: true,
            source: skill,
            extra: {
                actor: actor.toObject(false),
                options,
                speaker: ItemDSK.buildSpeaker(actor, tokenId),
            },
        }

        let data = {
            rollMode: options.rollMode,
            modifier: options.modifier || 0,
            difficultyLabels: DSK.skillDifficultyLabels,
            hasSchips: this.hasSchips(actor),
            characteristics: [1, 2].map((x) => skill.system[`characteristic${x}`]),
            situationalModifiers: actor ? DSKStatusEffects.getRollModifiers(actor, skill) : []
        }

        if(options.situationalModifiers) data.situationalModifiers.push(...options.situationalModifiers)
        this.getSituationalModifiers(data.situationalModifiers, actor, data, skill)

        let dialogOptions = {
            title,
            template: "/systems/dsk/templates/dialog/skill-dialog.html",
            data,
            callback: (html, options = {}) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val()
                testData.situationalModifiers = ActorDSK._parseModifiers(html)
                ActorDSK.schipsModifier(html, testData.situationalModifiers)
                if(testData.situationalModifiers.some(x => x.name == game.i18n.localize("dsk.schips"))) actor.reduceSchips(0)

                testData.testDifficulty = DSK.skillDifficultyModifiers[html.find('[name="testDifficulty"]').val()]
                testData.advancedModifiers = {
                    chars: [0, 1].map((x) => Number(html.find(`[name="ch${x}"]`).val())),
                    fws: Number(html.find(`[name="fw"]`).val()),
                    qls: Number(html.find(`[name="qs"]`).val()),
                }
                ItemDSK.changeChars(testData.source, ...[0, 1].map((x) => html.find(`[name="characteristics${x}"]`).val()))
                mergeObject(testData.extra.options, options)
                return { testData, cardOptions }
            },
        }

        let cardOptions = actor._setupCardOptions("systems/dsk/templates/chat/roll/skill-card.html", title, tokenId)

        return DiceDSK.setupDialog({ dialogOptions, testData, cardOptions })
    }
}

class ItemCombatskill extends ItemDSK{

}