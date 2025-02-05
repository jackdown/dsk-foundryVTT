import DPS from "../system/derepositioningsystem.js";
const { getProperty } = foundry.utils

export function initTokenHook() {
    Token.prototype.drawEffects = async function() {
        this.effects.renderable = false;
        this.effects.removeChildren().forEach(c => c.destroy());
        this.effects.bg = this.effects.addChild(new PIXI.Graphics());
        this.effects.overlay = null;

        let hasOverlay = false;
        const activeEffects = this.actor ? await this.actor.actorEffects() : []        

        const promises = [];
        for ( const effect of activeEffects ) {
            if ( !effect.img ) continue;
            if ( effect.getFlag("core", "overlay") && !hasOverlay ) {
                promises.push(this._drawOverlay(effect.img, effect.tint));
                hasOverlay = true;
            }
            else promises.push(this._drawEffect(effect.img, effect.tint, getProperty(effect, "flags.dsk.value")));
        }
        await Promise.allSettled(promises);

        this.effects.renderable = true;
        this.renderFlags.set({refreshEffects: true});
    }

    Token.prototype._refreshEffects = function() {
        let i = 0;
        const w = Math.round(canvas.dimensions.size / 10) * 2;
        const rows = Math.floor(this.document.height * 5);
        const bg = this.effects.bg.clear().beginFill(0x000000, 0.40).lineStyle(1.0, 0x000000);
        for ( const effect of this.effects.children ) {
          if ( effect === bg ) continue;
          if ( effect.isCounter) continue

          // Overlay effect
          if ( effect === this.effects.overlay ) {
            const {width, height} = this.getSize();
            const size = Math.min(width * 0.6, height * 0.6);
            effect.width = effect.height = size;
            effect.position = this.getCenterPoint({x: 0, y: 0});
            effect.anchor.set(0.5, 0.5);
          }

          // Status effect
          else {
            effect.width = effect.height = w;
            effect.x = Math.floor(i / rows) * w;
            effect.y = (i % rows) * w;
            bg.drawRoundedRect(effect.x + 1, effect.y + 1, w - 2, w - 2, 2);

            if(effect.counter > 1 && !effect.counterDrawn){
                let textEffect = game.dsk.config.effectTextStyle
                let color = game.settings.get("dsk", "statusEffectCounterColor")
                textEffect._fill = /^#[0-9A-F]+$/.test(color) ? color : "#000000"
                let text = this.effects.addChild(new PreciseText(effect.counter, textEffect))
                text.x = effect.x;
                text.y = effect.y;
                text.isCounter = true
                effect.counterDrawn = true
            }
            i++;
          }
        }
    }

    Token.prototype._drawEffect = async function(src, tint, value) {
        if ( !src ) return;
        const tex = await loadTexture(src, {fallback: "icons/svg/hazard.svg"});
        const icon = new PIXI.Sprite(tex);
        icon.tint = tint ?? 0xFFFFFF;
        icon.counter = value
        return this.effects.addChild(icon);
    }

    const defaulTokenLeftClick2 = Token.prototype._onClickLeft2
    const isMerchant = (actor) => {
        if (!actor) return false

        return ["merchant", "loot"].includes(getProperty(actor.system, "merchant.merchantType"))
    }

    Token.prototype._onClickLeft2 = function(event) {
        const distanceAccessible = game.user.isGM || !game.settings.get("dsk", "enableDPS") || !isMerchant(this.actor) || DPS.inDistance(this)

        if (!distanceAccessible)
            return ui.notifications.warn('dsk.DSKError.notInRangeToLoot', { localize: true })

        defaulTokenLeftClick2.call(this, event)
    }
}