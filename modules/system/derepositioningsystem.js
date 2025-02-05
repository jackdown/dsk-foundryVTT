const { getProperty } = foundry.utils

export default class DPS {
    static rangeFinder(tokenSource, tokenTarget) {
        const gridSize = canvas.scene.grid.size
        const ray = new Ray(tokenSource, tokenTarget)
        const tileDistance = ray.distance / gridSize
        const distance = tileDistance * canvas.scene.grid.distance
        const elevation = Math.abs((getProperty(tokenSource, "document.elevation") || 0) - (getProperty(tokenTarget, "document.elevation") || 0))
        const distanceSum = Math.hypot(distance, elevation)
        return {
            elevation,
            distance,
            distanceSum,
            tileDistance,
            unit: canvas.scene.grid.units
        }
    }

    static inDistance(toToken) {
        for (let token of canvas.scene.tokens) {
            if (token.isOwner && this.rangeFinder(toToken, token.object).tileDistance <= 2) return true
        }
        return false
    }

    static distanceModifier(tokenSource, rangeweapon, currentAmmo) {
        if (!game.settings.get("dsk", "enableDPS") || !tokenSource) return 1

        let maxDist = {}
        for (let target of game.user.targets) {
            const dist = DPS.rangeFinder(tokenSource, target)
            if ((maxDist.distanceSum || 0) < dist.distanceSum) maxDist = dist
        }

        if (maxDist.unit == game.i18n.localize("dsk.gridUnits")) {
            const rangeMultiplier = Number(getProperty(currentAmmo, "system.rangeMultiplier")) || 1
            const rangeBands = rangeweapon.system.rw.split("/").map(x => Number(x) * rangeMultiplier)
            let index = 0
            while (index < 2 && rangeBands[index] < maxDist.distanceSum) { index++ }

            return index
        } else {
            return 1
        }
    }

    static initDoorMinDistance() {
        const originalDoorControl = DoorControl.prototype._onMouseDown
        DoorControl.prototype._onMouseDown = function(event) {
            if (!game.user.isGM && game.settings.get("dsk", "enableDPS")) {
                if (!DPS.inDistance(this))
                    return ui.notifications.warn('dsk.DSKError.notInRangeToLoot', { localize: true })
            }
            return originalDoorControl.apply(this, arguments)
        }
    }

}