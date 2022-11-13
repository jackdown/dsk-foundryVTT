import ItemDSK from "../item/item_dsk.js";
import DSKStatusEffects from "../status/status_effects.js";
import AdvantageRulesDSK from "../system/advantage-rules.js";
import DSK from "../system/config.js";
import DiceDSK from "../system/dicedsk.js";
import DSKSoundEffect from "../system/dsk-soundeffect.js";
import DSKUtility from "../system/dsk_utility.js";
import RuleChaos from "../system/rule_chaos.js";
import { tinyNotification } from "../system/view_helper.js";
import OpposedDSK from "../system/opposeddsk.js";
import SpecialabilityRulesDSK from "../system/specialability-rules.js";

export default class ActorDSK extends Actor {
    static async create(data, options) {
        if (data instanceof Array || data.items) return await super.create(data, options);

        if (!data.img || data.img == "icons/svg/mystery-man.svg") data.img = "icons/svg/mystery-man-black.svg";

        data.items = await DSKUtility.allSkills();

        return await super.create(data, options);
    }

    prepareDerivedData() {
        const data = this.system;
        try {
            data.canAdvance = this.type == "character"

            for (let ch of Object.values(data.characteristics)) {
                ch.value = ch.initial + ch.advances + (ch.modifier || 0) + ch.gearmodifier;
                ch.cost = game.i18n.format("dsk.advancementCost", {
                    cost: DSKUtility._calculateAdvCost(ch.initial + ch.advances, "Eig"),
                });
                ch.refund = game.i18n.format("dsk.refundCost", {
                    cost: DSKUtility._calculateAdvCost(ch.initial + ch.advances, "Eig", 0),
                });
            }

            if (data.canAdvance) {
                data.details.experience.current = data.details.experience.total - data.details.experience.spent;
            }

            if (this.type == "character" || this.type == "npc") {
                data.stats.LeP.current = data.stats.LeP.initial + data.characteristics.ko.value * 2;
                data.stats.AeP.current = (!data.guidevalue || data.guidevalue == "-") ? 0 : ActorDSK._attrFromCharacteristic(data.guidevalue, data)
                data.stats.sk.value =
                    (data.stats.sk.initial || 0) +
                    Math.round((data.characteristics.mu.value + data.characteristics.kl.value + data.characteristics.in.value) / 3) - 10;
                data.stats.zk.value =
                    (data.stats.zk.initial || 0) +
                    Math.round((data.characteristics.ko.value + data.characteristics.ko.value + data.characteristics.kk.value) / 3) - 10;
                data.stats.ini.value =
                    Math.round((data.characteristics.mu.value + data.characteristics.ge.value) / 2) +
                    (data.stats.ini.modifier || 0);
            }

            if (this.type == "creature") {
                data.stats.LeP.current = data.stats.LeP.initial;
                data.stats.AeP.current = data.stats.AeP.initial;
                data.stats.ini.value = data.stats.ini.current + (data.stats.ini.modifier || 0);
            }

            data.stats.schips.max =
                Number(data.stats.schips.current) + Number(data.stats.schips.modifier) + data.stats.schips.gearmodifier

            data.stats.regeneration.LePmax =
                data.stats.regeneration.LePTemp + data.stats.regeneration.LePMod + data.stats.regeneration.LePgearmodifier;
            data.stats.regeneration.AePmax =
                data.stats.regeneration.AePTemp + data.stats.regeneration.AePMod + data.stats.regeneration.AePgearmodifier;

            data.stats.LeP.max = Math.round(
                (data.stats.LeP.current + data.stats.LeP.modifier + data.stats.LeP.advances) * data.stats.LeP.multiplier +
                data.stats.LeP.gearmodifier
            );
            data.stats.AeP.max =
                data.stats.AeP.current +
                data.stats.AeP.modifier +
                data.stats.AeP.advances +
                data.stats.AeP.gearmodifier;

            data.stats.gs.max = data.stats.gs.initial + (data.stats.gs.modifier || 0) + data.stats.gs.gearmodifier;
            data.stats.sk.max =
                data.stats.sk.value + data.stats.sk.modifier + data.stats.sk.gearmodifier;
            data.stats.zk.max =
                data.stats.zk.value + data.stats.zk.modifier + data.stats.zk.gearmodifier;

            let encumbrance = 0
            data.stats.ini.value += data.stats.ini.gearmodifier - Math.min(4, encumbrance);
            const baseInit = Number((0.01 * data.stats.ini.value).toFixed(2));
            data.stats.ini.value *= data.stats.ini.multiplier || 1;
            data.stats.ini.value = Math.round(data.stats.ini.value) + baseInit;


        } catch (error) {
            console.error("Something went wrong with preparing actor data: " + error + error.stack);
            ui.notifications.error(game.i18n.format("dsk.DSKError.PreparationError", { name: this.name }) + error + error.stack);
        }
    }

    static _calculateCombatSkillValues(i, actorData) {
        i = ActorDSK._calculatePW(i, actorData)
        i.system.attack = i.PW
        if (i.system.weapontype == "melee") {
            i.system.parry = Math.round(i.PW * 0.25);
        } else {
            i.system.parry = 0;
        }
        i.cost = game.i18n.format("dsk.advancementCost", {
            cost: DSKUtility._calculateAdvCost(i.system.level, i.system.StF),
        });
        return i;
    }

    applyActiveEffects() {
        const overrides = {};

        const changes = this.effects.reduce((changes, e) => {
            if (e.disabled) return changes;

            let multiply = 1
            if (e.origin) {
                const id = e.origin.match(/[^.]+$/)[0];
                const item = this.items.get(id);
                if (item) {
                    let apply = true;

                    switch (item.type) {
                        case "meleeweapon":
                        case "rangeweapon":
                        case "armor":
                            apply = item.system.worn.value;
                            break;
                        case "equipment":
                            apply = !item.system.worn.wearable || (item.system.worn.wearable && item.system.worn.value)
                            break;
                        case "ammunition":
                        case "combatskill":
                        case "poison":
                        case "ahnengabe":
                        case "ahnengeschenk":
                            apply = false;
                            break;
                        case "specialability":
                            apply = item.system.category != "combat" || [2, 3].includes(item.system.subcategory);
                            multiply = Number(item.system.level) || 1
                            break
                        case "advantage":
                        case "disadvantage":
                            multiply = Number(item.system.level) || 1
                            break;
                    }
                    e.notApplicable = !apply;

                    if (!apply) return changes;
                }
            }

            for (let i = 0; i < multiply; i++) {
                changes.push(
                    ...e.changes.map((c) => {
                        c = foundry.utils.duplicate(c);
                        c.effect = e;
                        c.priority = c.priority ? c.priority : c.mode * 10;
                        return c;
                    })
                )
            }
            return changes
        }, []);
        changes.sort((a, b) => a.priority - b.priority);

        for (let change of changes) {
            const result = change.effect.apply(this, change);
            if (result !== null) overrides[change.key] = result;
        }

        this.overrides = foundry.utils.expandObject(overrides);
    }

    prepareBaseData() {
        const system = this.system;

        mergeObject(system, {
            skillModifiers: {
                FP: [],
                step: [],
                QL: [],
                TPM: [],
                FW: [],
                botch: 20,
                crit: 1,
                global: [],
                conditional: {
                  AsPCost: [],
                  KaPCost: [],
                },
                feature: {
                  FP: [],
                  step: [],
                  QL: [],
                  TPM: [],
                  FW: [],
                  KaPCost: [],
                  AsPCost: [],
                },
                ...["ahnengabe", "skill"].reduce((prev, x) => {
                  prev[x] = {
                    FP: [],
                    step: [],
                    QL: [],
                    TPM: [],
                    FW: [],
                  };
                  return prev;
                }, {}),
              },
            repeatingEffects: {
                startOfRound: {
                    LeP: [],
                    AeP: []
                },
            },
            aepModifier: 0,
            stats: {
                initiative: {
                    multiplier: 1,
                },
                LeP: {
                    multiplier: 1,
                },
                regeneration: {
                    LePgearmodifier: 0,
                    AePgearmodifier: 0,
                },
            },
            status: {
                encumbered: 0,
                stunned: 0,
                feared: 0,
                inpain: 0,
                selfconfidence: 0
            },
            spellStats: {
                damage: "0",
            },
            meleeStats: {
                parry: 0,
                attack: 0,
                damage: "0",
                defenseMalus: 0,
                botch: 20,
                crit: 1,
            },
            rangeStats: {
                attack: 0,
                damage: "0",
                defenseMalus: 0,
                botch: 20,
                crit: 1,
            },
            totalArmor: 0,
            carryModifier: 0,

        })
        for (const k of Object.values(system.stats)) k.gearmodifier = 0;

        for (let ch of Object.values(system.characteristics)) ch.gearmodifier = 0
    }

    prepareSheet(sheetInfo) {
        let preData = duplicate(this);
        let preparedData = { system: {} };
        mergeObject(preparedData, this.prepareItems(sheetInfo));
        if (preparedData.canAdvance) {
            const attrs = ["LeP", "AeP"];
            for (const k of attrs) {
                mergeObject(preparedData.system, {
                    stats: {
                        [k]: {
                            cost: game.i18n.format("dsk.advancementCost", {
                                cost: DSKUtility._calculateAdvCost(preData.system.stats[k].advances, "D"),
                            }),
                            refund: game.i18n.format("dsk.refundCost", {
                                cost: DSKUtility._calculateAdvCost(preData.system.stats[k].advances, "D", 0),
                            }),
                        },
                    },
                });
            }
        }

        return preparedData;
    }

    _perpareItemAdvancementCost(item) {
        item.cost = game.i18n.format("dsk.advancementCost", {
            cost: DSKUtility._calculateAdvCost(item.system.level, item.system.StF),
        });
        item.refund = game.i18n.format("dsk.refundCost", {
            cost: DSKUtility._calculateAdvCost(item.system.level, item.system.StF, 0),
        });
        item.canAdvance = this.system.canAdvance;
        return item;
    }

    static _prepareRangeWeapon(item, ammunitions, combatskills, actor) {
        let skill = combatskills.find((i) => i.name == item.system.combatskill);
        item.calculatedRange = item.system.rw;
    
        let currentAmmo;
        if (skill) {
         item.attack = Number(skill.system.attack)  //+ Number(item.system.aw);

   
          if (item.system.ammunitionType != "-") {
            if (!ammunitions) ammunitions = actorData.inventory.ammunition.items;
            item.ammo = ammunitions.filter((x) => x.system.ammunitionType == item.system.ammunitionType);
    
            currentAmmo = ammunitions.find((x) => x._id == item.system.currentAmmo);
            if (currentAmmo) {
              const rangeMultiplier = Number(currentAmmo.system.rangeMultiplier) || 1;
              item.calculatedRange = item.calculatedRange
                .split("/")
                .map((x) => Math.round(Number(x) * rangeMultiplier))
                .join("/");
              item.attack += Number(currentAmmo.system.atmod) || 0;
              if (currentAmmo.system.ammunitiongroup.value == "mag") {
                item.ammoMax = currentAmmo.system.mag.max;
                item.ammoCurrent = currentAmmo.system.mag.value;
              }
            }
          }
          item.LZ = ActorDSK.calcLZ(item, actor);
          if (item.LZ > 0) ActorDSK.buildReloadProgress(item);
        } else {
          ui.notifications.error(
            game.i18n.format("dsk.DSKError.unknownCombatSkill", {
              skill: item.system.combatskill,
              item: item.name,
            })
          );
        }
    
        return this._parseDmg(item, currentAmmo);
      }

    static _prepareMeleeWeapon(item, combatskills, actorData, wornWeapons = null) {
        let skill = combatskills.find((i) => i.name == item.system.combatskill);
        if (skill) {
          item.attack = Number(skill.system.attack) + Number(item.system.aw);
          item.parry = skill.system.parry + Number(item.system.vw) +
            (item.system.combatskill == game.i18n.localize("dsk.LocalizedIDs.Shields") ? Number(item.system.vw) : 0);
    
          item.yieldedTwoHand = RuleChaos.isYieldedTwohanded(item)
          if (!item.yieldedTwoHand) {
            if (!wornWeapons)
              wornWeapons = duplicate(actorData.items).filter(
                (x) => x.type == "meleeweapon" && x.system.worn.value && x._id != item._id && !RuleChaos.isYieldedTwohanded(x)
              );
    
            if (wornWeapons.length > 0) {
              item.parry += Math.max(...wornWeapons.map((x) => x.system.vwoffhand));
              item.attack += Math.max(...wornWeapons.map((x) => x.system.awoffhand));
            }
          }
    
          let extra = 0
          if (item.system.worn.wrongGrip) {
            if (item.yieldedTwoHand) {
              item.parry -= 1
              extra += 1
            }
          }
    
          item = this._parseDmg(item);

          if (extra > 0) {
            item.extraDamage = extra;
            item.damageAdd = Roll.safeEval(item.damageAdd + " + " + Number(extra));
            item.damageAdd = (item.damageAdd > 0 ? "+" : "") + item.damageAdd;
          }
        } else {
          ui.notifications.error(
            game.i18n.format("dsk.DSKError.unknownCombatSkill", {
              skill: item.system.combatskill,
              item: item.name,
            })
          );
        }
        
        return item;
      }

      static _parseDmg(item, modification = undefined) {
        let parseDamage = new Roll(item.system.tp.replace(/[Ww]/g, "d"), { async: false });
    
        let damageDie = "",
          damageTerm = "",
          lastOperator = "+";
        for (let k of parseDamage.terms) {
          if (k.faces) damageDie = k.number + "d" + k.faces;
          else if (k.operator) lastOperator = k.operator;
          else if (k.number) damageTerm += Number(`${lastOperator}${k.number}`);
        }
        if (modification) {
          let damageMod = getProperty(modification, "system.damageMod");
          if (Number(damageMod)) damageTerm += `+${Number(damageMod)}`;
          else if (damageMod)
            item.damageBonusDescription = `, ${damageMod} ${game.i18n.localize("CHARAbbrev.damage")} ${modification.name}`;
        }
        if (damageTerm) damageTerm = Roll.safeEval(damageTerm);
    
        item.damagedie = damageDie ? damageDie : "0d6";
        item.damageAdd = damageTerm != "" ? (Number(damageTerm) >= 0 ? "+" : "") + damageTerm : "";
    
        return item;
      }

      static calcLZ(item, actor) {
        let factor = 1;
        let modifier = 0;
        if (item.system.combatskill == game.i18n.localize("dsk.LocalizedIDs.Throwing Weapons"))
          modifier = SpecialabilityRulesDSK.abilityStep(actor, game.i18n.localize("dsk.LocalizedIDs.quickdraw")) * -1;
        else if (
          item.system.combatskill == game.i18n.localize("dsk.LocalizedIDs.Crossbows") &&
          SpecialabilityRulesDSK.hasAbility(
            actor,
            `${game.i18n.localize("dsk.LocalizedIDs.quickload")} (${game.i18n.localize("dsk.LocalizedIDs.Crossbows")})`
          )
        )
          factor = 0.5;
        else {
          modifier =
          SpecialabilityRulesDSK.abilityStep(
              actor,
              `${game.i18n.localize("dsk.LocalizedIDs.quickload")} (${game.i18n.localize(item.system.combatskill)})`
            ) * -1;
        }
    
        let reloadTime = `${item.system.lz}`.split("/");
        if (item.system.ammunitionType == "mag") {
          let currentAmmo = actor.items.find((x) => x.id == item.system.currentAmmo || x._id == item.system.currentAmmo);
          let reloadType = 0;
          if (currentAmmo) {
            currentAmmo =  DSKUtility.toObjectIfPossible(currentAmmo)
            if (currentAmmo.system.mag.value <= 0) reloadType = 1;
          }
          reloadTime = reloadTime[reloadType] || reloadTime[0];
        } else {
          reloadTime = reloadTime[0];
        }
    
        return Math.max(0, Math.round(Number(reloadTime) * factor) + modifier);
      }

    _setOnUseEffect(item) {
        if (getProperty(item, "flags.dsk.onUseEffect")) item.OnUseEffect = true;
    }

    static _attrFromCharacteristic(char, actorData) {
        return actorData.characteristics[char].value
    }

    static _calculatePW(item, actorData) {
        item.PW = ActorDSK._attrFromCharacteristic(item.system.characteristic1, actorData) + ActorDSK._attrFromCharacteristic(item.system.characteristic2, actorData) + 5 + (item.system.level || 0)
        return item
    }

    static buildReloadProgress(item) {
        const progress = item.system.reloadTimeprogress / item.LZ;
        item.title = game.i18n.format("dsk.WEAPON.loading", {
          status: `${item.system.reloadTimeprogress}/${item.LZ}`,
        });
        item.progress = `${item.system.reloadTimeprogress}/${item.LZ}`;
        if (progress >= 1) {
          item.title = game.i18n.localize("dsk.WEAPON.loaded");
        }
        this.progressTransformation(item, progress);
      }

      static progressTransformation(item, progress) {
        if (progress >= 0.5) {
          item.transformRight = "181deg";
          item.transformLeft = `${Math.round(progress * 360 - 179)}deg`;
        } else {
          item.transformRight = `${Math.round(progress * 360 + 1)}deg`;
          item.transformLeft = 0;
        }
      }

    prepareItems(sheetInfo) {
        let actorData = this.toObject(false)
        let combatskills = [];
        let advantages = [];
        let disadvantages = [];
        let information = []
        let armor = [];
        let rangeweapons = [];
        let meleeweapons = [];
        let wornweapons = [];
        let availableAmmunition = [];
        let schips = [];
        const specAbs = Object.fromEntries(Object.keys(DSK.specialAbilityCategories).map((x) => [x, []]));

        const magic = {
            hasSpells: true, //this.system.isMage,
            ahnengabe: [],
            ahnengeschenk: []
        };

        let skills = {
            body: [],
            social: [],
            knowledge: [],
            trade: []
        };

        const inventory = {
            meleeweapons: {
                items: [],
                show: false,
                dataType: "meleeweapon",
            },
            rangeweapons: {
                items: [],
                show: false,
                dataType: "rangeweapon",
            },
            armor: {
                items: [],
                show: false,
                dataType: "armor",
            },
            ammunition: {
                items: [],
                show: false,
                dataType: "ammunition",
            },
            poison: {
                items: [],
                show: false,
                dataType: "poison",
            },
        };

        for (let t in DSK.equipmentTypes) {
            inventory[t] = {
                items: [],
                show: false,
                dataType: t,
            };
        }

        inventory["misc"].show = true;

        for (let i = 1; i <= Number(actorData.system.stats.schips.max); i++) {
            schips.push({
                value: i,
                cssClass: i <= Number(actorData.system.stats.schips.value) ? "fullSchip" : "emptySchip",
            });
        }

        let containers = new Map();
        for (let container of actorData.items.filter((x) => x.type == "equipment" && x.system.category == "bags")) {
            containers.set(container._id, []);
        }

        actorData.items = actorData.items.sort((a, b) => {
            return a.name.localeCompare(b.name);
        });

        let totalArmor = actorData.system.totalArmor || 0;
        let totalWeight = 0;

        for (let i of this.items) {
            try {
                let parent_id = getProperty(i, "system.parent_id");
                if (i.type == "ammunition") availableAmmunition.push(ActorDSK._prepareitemStructure(i));

                if (parent_id && parent_id != i._id) {
                    if (containers.has(parent_id)) {
                        containers.get(parent_id).push(i);
                        continue;
                    }
                }
                if (sheetInfo.details && sheetInfo.details.includes(i._id)) i.detailed = "shown";

                switch (i.type) {
                    case "skill":
                        skills[i.system.group].push(ActorDSK._calculatePW(this._perpareItemAdvancementCost(i, actorData.system), actorData.system));
                        break;
                    case "information":
                        information.push(i)
                        break
                    case "ahnengabe":
                        magic[i.type].push(ActorDSK._calculatePW(this._perpareItemAdvancementCost(i), actorData.system));
                        break
                    case "ahnengeschenk":
                        magic[i.type].push(i);
                        break;
                    case "combatskill":
                        combatskills.push(ActorDSK._calculateCombatSkillValues(this._perpareItemAdvancementCost(i, actorData.system), actorData.system));
                        break;
                    case "ammunition":
                        i.weight = parseFloat((i.system.weight * i.system.quantity).toFixed(3));
                        inventory.ammunition.items.push(ActorDSK.prepareMag(i));
                        inventory.ammunition.show = true;
                        totalWeight += Number(i.weight);
                        break;
                    case "meleeweapon":
                        i.weight = parseFloat((i.system.weight * i.system.quantity).toFixed(3));
                        i.toggleValue = getProperty(i.system, "worn.value") || false;
                        i.toggle = true;
                        this._setOnUseEffect(i);
                        inventory.meleeweapons.items.push(ActorDSK._prepareitemStructure(i));
                        inventory.meleeweapons.show = true;
                        if (i.toggleValue) wornweapons.push(i);
                        totalWeight += Number(i.weight);
                        break;
                    case "rangeweapon":
                        i.weight = parseFloat((i.system.weight * i.system.quantity).toFixed(3));
                        i.toggleValue = getProperty(i.system, "worn.value") || false;
                        i.toggle = true;
                        this._setOnUseEffect(i);
                        inventory.rangeweapons.items.push(ActorDSK._prepareitemStructure(i));
                        inventory.rangeweapons.show = true;
                        totalWeight += Number(i.weight);
                        break;
                    case "armor":
                        i.toggleValue = getProperty(i.system, "worn.value") || false;
                        inventory.armor.items.push(ActorDSK._prepareitemStructure(i));
                        inventory.armor.show = true;
                        i.toggle = true;
                        this._setOnUseEffect(i);
                        i.weight = parseFloat((i.system.weight * i.system.quantity).toFixed(3));
                        totalWeight += parseFloat(
                            (
                                i.system.weight * (i.toggleValue ? Math.max(0, i.system.quantity - 1) : i.system.quantity.value)
                            ).toFixed(3)
                        );

                        if (i.system.worn.value) {
                            totalArmor += Number(i.system.rs);
                            armor.push(i);
                        }
                        break;
                    case "poison":
                        i.weight = parseFloat((i.system.weight * i.system.quantity).toFixed(3));
                        inventory["poison"].items.push(i);
                        inventory["poison"].show = true;
                        totalWeight += Number(i.weight);
                        break;
                    case "equipment":
                        i.weight = parseFloat((i.system.weight * i.system.quantity).toFixed(3));
                        i.toggle = getProperty(i, "system.worn.wearable") || false;

                        if (i.toggle) i.toggleValue = getProperty(i.system, "worn.value") || false

                        this._setOnUseEffect(i);
                        inventory[i.system.category].items.push(ActorDSK._prepareitemStructure(i));
                        inventory[i.system.category].show = true;
                        totalWeight += Number(i.weight);
                        break;
                    case "advantage":
                        this._setOnUseEffect(i);
                        advantages.push(i);
                        break;
                    case "disadvantage":
                        this._setOnUseEffect(i);
                        disadvantages.push(i);
                        break;
                    case "specialability":
                        this._setOnUseEffect(i);
                        specAbs[i.system.category].push(i);
                        break;
                }
            }
            catch (error) {
                this._itemPreparationError(i, error);
            }
        }

        for (let elem of inventory.bags.items) {
            totalWeight += this._setBagContent(elem, containers);
        }

        for (let wep of inventory.rangeweapons.items) {
            try {
                if (wep.system.worn.value) rangeweapons.push(ActorDSK._prepareRangeWeapon(wep, availableAmmunition, combatskills, this));
            } catch (error) {
                this._itemPreparationError(wep, error);
            }
        }

        for (let wep of wornweapons) {
            try {
                meleeweapons.push(
                    ActorDSK._prepareMeleeWeapon(
                        wep,
                        combatskills,
                        actorData,
                        wornweapons.filter((x) => x._id != wep._id && !RuleChaos.isYieldedTwohanded(x))
                    )
                );
            } catch (error) {
                this._itemPreparationError(wep, error);
            }
        }

        const carrycapacity = actorData.system.characteristics.kk.value * 2 + actorData.system.carryModifier;
        totalWeight = parseFloat(totalWeight.toFixed(3));

        let guidevalues = duplicate(DSK.characteristics);
        guidevalues["-"] = "-";

        return {
            totalWeight,
            armorSum: totalArmor,
            carrycapacity,
            wornRangedWeapons: rangeweapons,
            guidevalues,
            wornMeleeWeapons: meleeweapons,
            advantages,
            disadvantages,
            specAbs,
            information,
            combatskills,
            wornArmor: armor,
            inventory,
            canAdvance: this.system.canAdvance,
            sheetLocked: actorData.system.sheetLocked,
            magic,
            allSkillsLeft: {
                body: skills.body,
                social: skills.social
            },
            allSkillsRight: {
                knowledge: skills.knowledge,
                trade: skills.trade
            },
            schips
        }
    }

    setupWeapon(item, mode, options, tokenId) {
        options["mode"] = mode;
        return ItemDSK.getSubClass(item.type).setupDialog(null, options, item, this, tokenId);
      }

    setupSpell(spell, options = {}, tokenId) {
        return ItemDSK.getSubClass(spell.type).setupDialog(null, options, spell, this, tokenId);
      }

    static _prepareitemStructure(item) {
        const enchants = getProperty(item, "flags.dsk.enchantments");
        if (enchants && enchants.length > 0) {
            item.enchantClass = "rar";
        } else if (item.effects.length > 0) {
            item.enchantClass = "common"
        }
        return item;
    }

    async checkEnoughXP(cost) {
        if (!this.system.canAdvance) return true;
        if (isNaN(cost) || cost == null) return true;

        if (Number(this.system.details.experience.total) - Number(this.system.details.experience.spent) >= cost) {
            return true;
        } else if (Number(this.system.details.experience.total == 0)) {
            let template = `<p>${game.i18n.localize("dsk.DSKError.zeroXP")}</p><label>${game.i18n.localize(
                "dsk.APValue"
            )}: </label><input type="number" name="APsel" value="150"/>`;
            let newXp = 0;
            let result = false;

            [result, newXp] = await new Promise((resolve, reject) => {
                new Dialog({
                    title: game.i18n.localize("dsk.DSKError.NotEnoughXP"),
                    content: template,
                    default: "yes",
                    buttons: {
                        Yes: {
                            icon: '<i class="fa fa-check"></i>',
                            label: game.i18n.localize("dsk.yes"),
                            callback: (dlg) => {
                                resolve([true, dlg.find('[name="APsel"]')[0].value]);
                            },
                        },
                        cancel: {
                            icon: '<i class="fas fa-times"></i>',
                            label: game.i18n.localize("dsk.cancel"),
                            callback: () => {
                                resolve([false, 0]);
                            },
                        },
                    },
                }).render(true);
            });
            if (result) {
                await this.update({ "system.details.experience.total": Number(newXp) });
                return true;
            }
        }
        ui.notifications.error(game.i18n.localize("dsk.DSKError.NotEnoughXP"));
        return false;
    }

    getSkillModifier(name, sourceType) {
        let result = [];
        const keys = ["FP", "step", "QL", "TPM", "FW"];
        for (const k of keys) {
          const type = k == "step" ? "" : k;
          result.push(
            ...this.system.skillModifiers[k]
              .filter((x) => x.target == name)
              .map((f) => {
                return {
                  name: f.source,
                  value: f.value,
                  type,
                };
              })
          );
          if (this.system.skillModifiers[sourceType]) {
            result.push(
              ...this.system.skillModifiers[sourceType][k].map((f) => {
                return {
                  name: f.source,
                  value: f.value,
                  type,
                };
              })
            );
          }
        }
        return result;
      }

    setupSkill(skill, options = {}, tokenId) {
        return ItemDSK.getSubClass(skill.type).setupDialog(null, options, skill, this, tokenId);
      }

    static prepareMag(item) {
        if (item.system.ammunitiongroup == "mag") {
            item.structureMax = item.system.mag.max;
            item.structureCurrent = item.system.mag.value;
        }
        return item;
    }

    async _updateAPs(APValue, dataUpdate = {}) {
        if (this.system.canAdvance) {
            if (!isNaN(APValue) && !(APValue == null)) {
                const ap = Number(APValue);
                dataUpdate["system.details.experience.spent"] = Number(this.system.details.experience.spent) + ap;
                await this.update(dataUpdate);
                const msg = game.i18n.format(ap > 0 ? "dsk.advancementCost" : "dsk.refundCost", { cost: Math.abs(ap) });
                tinyNotification(msg);
            } else {
                ui.notifications.error(game.i18n.localize("dsk.DSKError.APUpdateError"));
            }
        }
    }

    setupCharacteristic(characteristicId, options = {}, tokenId) {
        let char = this.system.characteristics[characteristicId];
        let title = game.i18n.localize(`dsk.characteristics.${characteristicId}.name`) + " " + game.i18n.localize("dsk.probe");
    
        let testData = {
          opposable: false,
          source: {
            type: "char",
            system: {
                characteristic1: characteristicId,
                characteristic2: characteristicId
            },
          },
          extra: {
            characteristicId,
            actor: this.toObject(false),
            options,
            speaker: ItemDSK.buildSpeaker(this, tokenId)
          },
        };
    
        let dialogOptions = {
          title,
          template: "/systems/dsk/templates/dialog/characteristic-dialog.html",
          data: {
            rollMode: options.rollMode,
            modifier: options.modifier || 0,
          },
          callback: (html, options = {}) => {
            cardOptions.rollMode = html.find('[name="rollMode"]').val();
            testData.situationalModifiers = ActorDSK._parseModifiers(html);
            mergeObject(testData.extra.options, options);
            return { testData, cardOptions };
          },
        };
    
        let cardOptions = this._setupCardOptions("systems/dsk/templates/chat/roll/characteristic-card.html", title, tokenId);
    
        return DiceDSK.setupDialog({ dialogOptions, testData, cardOptions });
      }

      _setupCardOptions(template, title, tokenId) {
        const token = game.canvas.tokens.get(tokenId)
        let cardOptions = {
          speaker: {
            alias: token ? token.name : this.prototypeToken.name,
            actor: this.id,
          },
          title,
          template,
          flags: {
            img: this.prototypeToken.randomImg ? this.img : this.prototypeToken.img,
          },
        };
        if (this.token) {
          cardOptions.speaker.alias = this.token.name;
          cardOptions.speaker.token = this.token.id;
          cardOptions.speaker.scene = canvas.scene.id;
          cardOptions.flags.img = this.token.img;
        } else {
          let speaker = ChatMessage.getSpeaker();
          if (speaker.actor == this.id) {
            cardOptions.speaker.alias = speaker.alias;
            cardOptions.speaker.token = speaker.token;
            cardOptions.speaker.scene = speaker.scene;
            cardOptions.flags.img = speaker.token ? canvas.tokens.get(speaker.token).img : cardOptions.flags.img;
          }
        }
        return cardOptions;
      }

      static _parseModifiers(html, search) {
        let res = [];
        html.find('[name="situationalModifiers"] option:selected').each(function () {
          const val = $(this).val();
          let data = {
            name: $(this).text().trim().split("[")[0],
            value: isNaN(val) ? val : Number(val),
            type: $(this).attr("data-type"),
          };
          if (data.type == "dmg") {
            data.damageBonus = data.value;
            data.value = 0;
          }
          if ($(this).attr("data-specAbId")) data.specAbId = $(this).attr("data-specAbId");
          if ($(this).attr("data-armorPen")) data.armorPen = $(this).attr("data-armorPen");
    
          res.push(data);
        });
        res.push({
          name: game.i18n.localize("dsk.manual"),
          value: Number(html.find('[name="testModifier"]').val()),
          type: "",
        });
        return res;
      }

      async consumeAmmunition(testData) {
        if (testData.extra.ammo && !testData.extra.ammoDecreased) {
          testData.extra.ammoDecreased = true;
    
          if (testData.extra.ammo._id) {
            let ammoUpdate = { _id: testData.extra.ammo._id };
            if (testData.extra.ammo.system.ammunitionType == "mag") {
              if (testData.extra.ammo.system.mag.value <= 0) {
                testData.extra.ammo.system.quantity--;
                ammoUpdate["system.quantity"] = testData.extra.ammo.system.quantity;
                ammoUpdate["system.mag.value"] = testData.extra.ammo.system.mag.max - 1;
              } else {
                ammoUpdate["system.mag.value"] = testData.extra.ammo.system.mag.value - 1;
              }
            } else {
              testData.extra.ammo.system.quantity--;
              ammoUpdate["system.quantity"] = testData.extra.ammo.system.quantity;
            }
            await this.updateEmbeddedDocuments("Item", [ammoUpdate, { _id: testData.source._id, "system.reloadTimeprogress": 0 }]);
          }
        } else if (
          (testData.source.type == "rangeweapon" ||
            (testData.source.type == "trait" && testData.source.system.traitType.value == "rangeAttack")) &&
          !testData.extra.ammoDecreased
        ) {
          testData.extra.ammoDecreased = true;
          await this.updateEmbeddedDocuments("Item", [{ _id: testData.source._id, "system.reloadTimeprogress": 0 }]);
        } else if (["ahnengabe"].includes(testData.source.type) && testData.extra.speaker.token != "emptyActor") {
          await this.updateEmbeddedDocuments("Item", [
            {
              _id: testData.source._id,
              "system.castingTime.progress": 0,
              "system.castingTime.modified": 0,
            },
          ]);
        }
      }

      async basicTest({ testData, cardOptions }, options = {}) {
        testData = await DiceDSK.rollDices(testData, cardOptions);
        let result = await DiceDSK.rollTest(testData);
    
        if (testData.extra.options.other) {
          if (!result.other) result.other = [];
    
          result.other.push(...testData.extra.options.other);
        }
    
        result.postFunction = "basicTest";
    
        if (game.user.targets.size) {
          cardOptions.isOpposedTest = testData.opposable;
          const opposed = ` - ${game.i18n.localize("dsk.Opposed")}`;
          if (cardOptions.isOpposedTest && cardOptions.title.match(opposed + "$") != opposed) cardOptions.title += opposed;
        }
    
        await this.consumeAmmunition(testData);
    
        if (!options.suppressMessage) {
          const msg = await DiceDSK.renderRollCard(cardOptions, result, options.rerenderMessage);
          await OpposedDSK.handleOpposedTarget(msg);
          result.messageId = msg.id;
        }
    
        return { result, cardOptions, options };
      }

    tokenScrollingText(texts) {
        const tokens = this.isToken ? [this.token?.object] : this.getActiveTokens(true);
        for (let t of tokens) {
            if (!t) continue;

            let index = 0;
            for (let k of texts) {
                canvas.interface.createScrollingText(t.center, k.value, {
                    anchor: index,
                    direction: k.value > 0 ? 2 : 1,
                    fontSize: game.settings.get("dsk", "scrollingFontsize"),
                    stroke: k.stroke,
                    strokeThickness: 1,
                    jitter: 0.25,
                    duration: 1000,
                });

                index += 1;
            }
        }
    }

    async _preUpdate(data, options, user) {
        await super._preUpdate(data, options, user);

        const statusText = {
            LeP: 0x8b0000,
            AeP: 0x0b0bd9
        };
        const scolls = [];
        for (let key of Object.keys(statusText)) {
            const value = getProperty(data, `system.stats.${key}.value`);
            if (value)
                scolls.push({
                    value: value - this.system.stats[key].value,
                    stroke: statusText[key],
                });
        }
        if (scolls.length) this.tokenScrollingText(scolls);
    }

    _itemPreparationError(item, error) {
        console.error("Something went wrong with preparing item " + item.name + ": " + error);
        console.warn(error);
        console.warn(item);
        ui.notifications.error("Something went wrong with preparing item " + item.name + ": " + error);
    }

    _setBagContent(elem, containers, topLevel = true) {
        let totalWeight = 0;
        if (containers.has(elem._id)) {
            elem.children = [];
            let bagweight = 0;
            if (!elem.toggleValue && topLevel) totalWeight -= elem.weight;

            for (let child of containers.get(elem._id)) {
                child.weight = Number(parseFloat((child.system.weight * child.system.quantity).toFixed(3)));
                bagweight += child.weight;
                elem.children.push(ActorDSK._prepareitemStructure(ActorDSK._prepareConsumable(child)));
                if (containers.has(child._id)) {
                    bagweight += this._setBagContent(child, containers, false);
                }
            }
            if (elem.toggleValue || !topLevel) totalWeight += bagweight;
            elem.bagweight = `${bagweight.toFixed(3)}/${elem.system.capacity || 0}`;
        }
        return totalWeight;
    }

    async applyDamage(amount) {
        const newVal = Math.min(this.system.stats.LeP.max, this.system.stats.LeP.value - amount);
        await this.update({ "system.stats.LeP.value": newVal });
    }

    async applyRegeneration(LeP, AeP) {
        const update = {
            "system.stats.LeP.value": Math.min(this.system.stats.LeP.max, this.system.stats.LeP.value + (LeP || 0)),
            "system.stats.AeP.value": Math.min(
                this.system.stats.AeP.max,
                this.system.stats.AeP.value + (AeP || 0)
            ),
        };
        await this.update(update);
    }

    async applyMana(amount) {

        const newVal = Math.min(this.system.stats.AeP.max, this.system.stats.AeP.value - amount);
        if (newVal >= 0) {
            await this.update({ [`data.stats.AeP.value`]: newVal });
            return true
        } else {
            ui.notifications.error(game.i18n.localize(`dsk.DSKError.NotEnoughAeP`));
            return false
        }
    }

    async actorEffects() {
        const allowedEffects = ["dead"];
        const isAllowedToSeeEffects =
            game.user.isGM || this.testUserPermission(game.user, "OBSERVER") || !(await game.settings.get("dsk", "hideEffects"));

        return isAllowedToSeeEffects
            ? this.effects.filter((x) => {
                return (
                    !x.disabled &&
                    !x.notApplicable &&
                    (game.user.isGM || !x.getFlag("dsk", "hidePlayers")) &&
                    !x.getFlag("dsk", "hideOnToken") &&
                    (x.origin == this.uuid || !x.origin)
                );
            })
            : this.effects.filter((x) => allowedEffects.includes(x.getFlag("core", "statusId")));
    }

    async _preCreate(data, options, user) {
        await super._preCreate(data, options, user);
        let update = {};

        if (!data.img) update.img = "icons/svg/mystery-man-black.svg";

        if (data.type == "character") {
            mergeObject(update, {
                prototypeToken: {
                    sight: { enabled: true },
                    actorLink: true,
                },
            });
        }
        this.updateSource(update);
    }

    async markDead(dead) {
        const tokens = this.getActiveTokens();

        for (let token of tokens) {
            if (token.combatant) await token.combatant.update({ defeated: dead });
        }
    }

    async _dependentEffects(statusId, effect, delta) {
        const effectData = duplicate(effect);
    
        if (effectData.flags.dsk.value == 4) {
          if (statusId == "inpain")
            await this.initResistPainRoll()
          else if (["encumbered", "stunned", "feared", "confused", "trance"].includes(statusId))
            await this.addCondition("incapacitated");
          else if (statusId == "paralysed")
            await this.addCondition("rooted");
          else if (["drunken", "exhaustion"].includes(statusId)) {
            await this.addCondition("stunned");
            await this.removeCondition(statusId);
          }
        }
    
        if (statusId == "dead" && game.combat) await this.markDead(true);
    
        if (statusId == "unconscious") await this.addCondition("prone");
    
        if (
          delta > 0 &&
          statusId == "inpain" &&
          !this.hasCondition("bloodrush") &&
          AdvantageRulesDSK.hasVantage(this, game.i18n.localize("dsk.LocalizedIDs.frenzy"))
        ) {
          await this.addCondition("bloodrush");
          const msg = DSKUtility.replaceConditions(
            `${game.i18n.format("CHATNOTIFICATION.gainsBloodrush", {
              character: "<b>" + this.name + "</b>",
            })}`
          );
          ChatMessage.create(DSKUtility.chatDataSetup(msg));
        }
      }

    async addCondition(effect, value = 1, absolute = false, auto = true) {
        if (effect == "bleeding") return await RuleChaos.bleedingMessage(this);
    
        return await DSKStatusEffects.addCondition(this, effect, value, absolute, auto);
      }

    async removeCondition(effect, value = 1, auto = true, absolute = false) {
        return await DSKStatusEffects.removeCondition(this, effect, value, auto, absolute);
    }
    
    hasCondition(conditionKey) {
        return DSKStatusEffects.hasCondition(this, conditionKey);
    }
}