import DSKUtility from "./dsk_utility.js"
const { getProperty } = foundry.utils

Hooks.once("ready", async() => {
    if (!CreatureType.creatureData) {
        const r = await fetch(`systems/dsk/lazy/creaturetype/${game.i18n.lang}.json`)
        CreatureType.creatureData = await r.json()
        CreatureType.magical = game.i18n.localize("dsk.WEAPON.magical")
        CreatureType.clerical = game.i18n.localize("dsk.WEAPON.clerical")
        CreatureType.silverPlated = game.i18n.localize("dsk.WEAPON.silverPlated")
        game.dsk.apps.CreatureType = CreatureType
    }
})

const isNotEmpty = (str) => {
    return !(!str || str.length === 0)
}

export default class CreatureType {
    static creatureData
    static magical
    static clerical

    constructor(creatureClass) {
        this.creatureClass = creatureClass
        this.spellImmunities = []
        this.poisonImmunity = false
        this.diseaseImmunity = false
    }

    static detectCreatureType(actor) {
        const creatureClass = actor.system.details.species
        const types = Object.keys(CreatureType.creatureData.types).filter((x) => creatureClass.indexOf(x) >= 0)
        return types.map((x) => this.getClass(CreatureType.creatureData.types[x], creatureClass))
    }

    static getClass(type, creatureClass){
        const cl = {
            "DemonType": DemonType,
            "ChimeraType": ChimeraType,
            "DaimonidType": DaimonidType,
            "DragonType": DragonType,
            "ElementalType": ElementalType,
            "FairyType": FairyType,
            "GhostType": GhostType,
            "GolemType": GolemType,
            "HomunculiType": HomunculiType,
            "IntelligentCreatureType": IntelligentCreatureType,
            "PlantType": PlantType,
            "AnimalType": AnimalType,
            "UndeadType": UndeadType,
            "SupernaturalType": SupernaturalType,
            "MagicalConstructType": MagicalConstructType,
            "WerCreatureType": WerCreatureType,
            "VampireType": VampireType
        }[type]
        return new cl(creatureClass)
    }

    static creatureTypeName(actor){
        if(actor.type == "creature"){
            const creatureClass = actor.system.species
            return Object.keys(CreatureType.creatureData.types).filter((x) => creatureClass.indexOf(x) >= 0)[0]
        }
        else
            return actor.system.details.species
    }

    static addCreatureTypeModifiers(actorData, source, situationalModifiers, attacker) {
        const creatureTypes = CreatureType.detectCreatureType(actorData)
        const isSpell = ["spell", "ceremony", "liturgy", "ritual"].includes(source.type)
        for (let k of creatureTypes) {
            const modifiers = k.damageModifier(source)
            if (isSpell) {
                for (let mod of modifiers) {
                    mod.armorPen = k.spellResistanceModifier(actorData)
                }
            }
            situationalModifiers.push(...modifiers)
        }
        situationalModifiers.push(...this.creatureBonusDamage(actorData, attacker))
        CreatureType.addVulnerabilitiesToSource(actorData, source, situationalModifiers)
    }

    static addVulnerabilitiesToSource(actorData, source, situationalModifiers) {
        const vulnerabilities = getProperty(actorData, "system.vulnerabilities")
        if (vulnerabilities) {
            if (["meleeweapon", "rangeweapon"].includes(source.type)) {
                const toCombatskills = getProperty(vulnerabilities, "combatskill")

                toCombatskills.reduce((prev, x) => {
                    if (x.target == source.system.combatskill) {
                        const isBonus = /\*/.test(x.value) ? Number(x.value.replace("*", "")) > 1 : Number(x.value) > 0
                        const key = isBonus ? "WEAPON.vulnerableTo" : "WEAPON.resistantTo"
                        situationalModifiers.push(
                            ...CreatureType.buildDamageMod(
                                `${game.i18n.format(key, { name: source.system.combatskill })} (${x.source})`,
                                x.value
                            )
                        )
                    }
                }, situationalModifiers)
            }
        }
    }

    ignoredCondition(condition) {
        return false
    }
    damageModifier(attackItem) {
        return []
    }
    static creatureBonusDamage(actor, attacker) {
        const bonusModifiers = []
        const creatureClass = actor.system.details.species
        const mods = getProperty(attacker, "system.creatureBonus")
        for (let mod of mods) {
            if (creatureClass.indexOf(mod.target) >= 0)
                bonusModifiers.push(...this.buildDamageMod(mod.source, mod.value, true))
        }
        return bonusModifiers
    }

    spellImmunity(spell) {
        return this.spellImmunities.some((x) => spell.includes(x))
    }
    spellArmorModifier(actorData) {
        return 0
    }
    poisonImmunity() {
        return this.poisonImmunity
    }
    diseaseImmunity() {
        return this.diseaseImmunity
    }
    spellResistanceModifier(actorData) {
        return 0
    }
    static buildDamageMod(name, value, selected = true) {
        return [{
            name,
            value,
            selected,
            type: "dmg",
            source: game.i18n.localize('dsk.target')
        } ]
    }

    weaponAttributes(attackItem) {
        return getProperty(attackItem, "system.effect.attributes") || ""
    }

    getTypeByClass(className) {
        return Object.keys(CreatureType.creatureData.types).find((key) => CreatureType.creatureData.types[key] === className)
    }

    isAttackItem(attackItem) {
        return ["meleeweapon", "trait", "rangeweapon"].includes(attackItem.type) && isNotEmpty(this.weaponAttributes(attackItem))
    }

    attributesRegex(attackItem) {
        const attributes = this.weaponAttributes(attackItem)
        return new RegExp(
            `(${attributes
                .split(",")
                .map((x) => DSKUtility.escapeRegex(x.split("(")[0].trim()))
                .join("|")})`,
            "i"
        )
    }
}

class VulnerableToLifeGods extends CreatureType {
    damageModifier(attackItem) {
        if (this.isAttackItem(attackItem)) {
            const regex = this.attributesRegex(attackItem)
            for (const god of CreatureType.creatureData.godOfLife) {
                const name = `${CreatureType.clerical} (${god})`
                if (regex.test(name)) return CreatureType.buildDamageMod(name, "*2")
            }
        }
        return super.damageModifier(attackItem)
    }
}

class ChimeraType extends VulnerableToLifeGods {}

class DaimonidType extends CreatureType {
    constructor(creatureClass) {
        super(creatureClass)
        this.spellImmunities = ["Influence", "Transformation"].map((x) => game.i18n.localize(`Features.${x}`))
    }
    damageModifier(attackItem) {
        if (this.isAttackItem(attackItem)) {
            const regex = this.attributesRegex(attackItem)
            if (regex.test(CreatureType.clerical)) return CreatureType.buildDamageMod(CreatureType.clerical, "*2")
        }
        return super.damageModifier(attackItem)
    }
}

class DragonType extends CreatureType {}

class DemonType extends CreatureType {
    constructor(creatureClass) {
        super(creatureClass)
        this.spellImmunities = ["Influence", "Transformation", "Healing", "Illusion"].map((x) =>
            game.i18n.localize(`Features.${x}`)
        )
        this.poisonImmunity = true
        this.diseaseImmunity = true
    }
    damageModifier(attackItem) {
        if (this.isAttackItem(attackItem)) {
            const regex = this.attributesRegex(attackItem)
            if (regex.test(CreatureType.clerical))
                return CreatureType.buildDamageMod(
                    `${CreatureType.clerical} (${CreatureType.creatureData.opposingGod})`,
                    "*2",
                    false
                )

            if (regex.test(CreatureType.magical)) return super.damageModifier(attackItem)
        } else if (["spell", "ceremony", "liturgy", "ritual"].includes(attackItem.type)) {
            return super.damageModifier(attackItem)
        }
        return CreatureType.buildDamageMod(this.getTypeByClass("DemonType"), "*0.5")
    }
    spellArmorModifier(actorData) {
        return Number(actorData.system.stats.soulpower.max)
    }
    spellResistanceModifier(actorData) {
        return Number(actorData.system.stats.soulpower.max)
    }
    ignoredCondition(condition) {
        return true
    }
}

class ElementalType extends CreatureType {
    constructor(creatureClass) {
        super(creatureClass)
        this.poisonImmunity = true
        this.diseaseImmunity = true
    }
    damageModifier(attackItem) {
        if (this.isAttackItem(attackItem)) {
            const regex = this.attributesRegex(attackItem)
            if (regex.test(CreatureType.magical)) return super.damageModifier(attackItem)
        } else if (["spell", "ceremony", "liturgy", "ritual"].includes(attackItem.type)) {
            return CreatureType.buildDamageMod(this.getTypeByClass("ElementalType"), "*1")
        }
        return CreatureType.buildDamageMod(this.getTypeByClass("ElementalType"), "*0.5")
    }
    spellArmorModifier(actorData) {
        return Number(actorData.system.stats.soulpower.max)
    }
    spellResistanceModifier(actorData) {
        return Number(actorData.system.stats.soulpower.max)
    }
    ignoredCondition(condition) {
        return true
    }
}

class FairyType extends CreatureType {
    constructor(creatureClass) {
        super(creatureClass)
        this.spellImmunities = ["Illusion"].map((x) => game.i18n.localize(`Features.${x}`))
        this.poisonImmunity = true
        this.diseaseImmunity = true
    }
}

class GhostType extends CreatureType {
    constructor(creatureClass) {
        super(creatureClass)
        this.spellImmunities = ["Illusion", "Healing", "Telekinesis", "Transformation"].map((x) =>
            game.i18n.localize(`Features.${x}`)
        )
        this.poisonImmunity = true
        this.diseaseImmunity = true
    }
    damageModifier(attackItem) {
        if (this.isAttackItem(attackItem)) {
            let regex = this.attributesRegex(attackItem)
            for (const god of CreatureType.creatureData.godOfDeath) {
                const name = `${CreatureType.clerical} (${god})`
                if (regex.test(name)) return []
            }
            regex = this.attributesRegex(attackItem)

            if (regex.test(CreatureType.clerical)) return CreatureType.buildDamageMod(CreatureType.clerical, "*0.5")
            if (regex.test(CreatureType.magical)) return CreatureType.buildDamageMod(CreatureType.magical, "*0.5")
        } else if (["spell", "ceremony", "liturgy", "ritual"].includes(attackItem.type)) {
            return CreatureType.buildDamageMod(CreatureType.magical, "*0.5")
        }
        return CreatureType.buildDamageMod(this.getTypeByClass("GhostType"), "*0")
    }
    ignoredCondition(condition) {
        return !["feared", "inpain", "confused"].includes(condition)
    }
}

class GolemType extends VulnerableToLifeGods {
    constructor(creatureClass) {
        super(creatureClass)
        this.spellImmunities = ["Transformation"].map((x) => game.i18n.localize(`Features.${x}`))
        this.poisonImmunity = true
        this.diseaseImmunity = true
    }
    ignoredCondition(condition) {
        return !["confused", "paralysed"].includes(condition)
    }
}

class HomunculiType extends VulnerableToLifeGods {
    constructor(creatureClass) {
        super(creatureClass)
        this.spellImmunities = ["Healing"].map((x) => game.i18n.localize(`Features.${x}`))
    }
    ignoredCondition(condition) {
        return !["inpain", "encumbered", "stunned", "feared", "paralysed", "confused"].includes(condition)
    }
}

class IntelligentCreatureType extends CreatureType {}

class PlantType extends CreatureType {}

class AnimalType extends CreatureType {}

class UndeadType extends CreatureType {
    constructor(creatureClass) {
        super(creatureClass)
        this.spellImmunities = ["Influence", "Healing", "Illusion"].map((x) => game.i18n.localize(`Features.${x}`))
        this.poisonImmunity = true
        this.diseaseImmunity = true
    }
    damageModifier(attackItem) {
        if (this.isAttackItem(attackItem)) {
            const regex = this.attributesRegex(attackItem)
            for (const god of CreatureType.creatureData.godOfDeath) {
                const name = `${CreatureType.clerical} (${god})`
                if (regex.test(name)) return CreatureType.buildDamageMod(name, "*2")
            }
        }
        return super.damageModifier(attackItem)
    }
    ignoredCondition(condition) {
        return !["paralysed"].includes(condition)
    }
}

class SupernaturalType extends CreatureType {}

class MagicalConstructType extends CreatureType {
    constructor(creatureClass) {
        super(creatureClass)
        this.spellImmunities = ["Transformation"].map((x) => game.i18n.localize(`Features.${x}`))
        this.poisonImmunity = true
        this.diseaseImmunity = true
    }
    ignoredCondition(condition) {
        return !["stunned", "feared", "paralysed", "confused"].includes(condition)
    }
}

class WerCreatureType extends CreatureType {
    damageModifier(attackItem) {
        if (this.isAttackItem(attackItem)) {
            const regex = this.attributesRegex(attackItem)
            if (regex.test(CreatureType.silverPlated)) return CreatureType.buildDamageMod(this.getTypeByClass("WerCreatureType"), "*2")
        }else if (["spell", "ceremony", "liturgy", "ritual"].includes(attackItem.type)) {
            return super.damageModifier(attackItem)
        }
        return CreatureType.buildDamageMod(this.getTypeByClass("WerCreatureType"), "*0.5")
    }
}

class VampireType extends CreatureType {
    damageModifier(attackItem) {
        if (["spell", "ceremony", "liturgy", "ritual"].includes(attackItem.type)) {
            return super.damageModifier(attackItem)
        }
        return CreatureType.buildDamageMod(this.getTypeByClass("VampireType"), "*0.5")
    }
}

//TODO where are the type descriptions for animals, intelligent creatures, supernatural and plants
//TODO spell immunity message
//TODO poison & disease immunity message