import ItemDSK from "../item/item_dsk.js"
import DSKUtility from "./dsk_utility.js"
const { getProperty } = foundry.utils

export default class DSKInitializer extends Dialog {
    constructor(title, content, module, lang = "") {
        let data = {
            title: title,
            content: content,
            buttons: {
                initialize: {
                    label: game.i18n.localize("dsk.initialize"),
                    callback: async() => {
                        if (this.lock) return
                        await this.initialize()
                    }
                },
                cancel: {
                    label: game.i18n.localize("dsk.cancel"),
                    callback: async() => {
                        if (this.lock) return
                        await this.dontInitialize()
                    }
                }
            }
        }
        super(data)
        this.module = module
        this.lang = lang
        this.folders = {}
        this.journals = {}
        this.scenes = {}
        this.actors = {}
        this.lock = false
    }

    async initialize() {
        this.lock = true
        let initButton = $(this._element).find('.initialize')
        initButton.prepend('<i class="fas fa-spinner fa-spin"></i>')
        let bookData = {}
        try {
            if (game.settings.settings.has(`${this.module}.initialized`))
                await game.settings.set(this.module, "initialized", true)
        } catch {}

        try {
            await fetch(`modules/${this.module}/adventure${this.lang}.json`).then(async r => r.json()).then(async json => {
                bookData = json
            })
        } catch {
            try {
                await fetch(`modules/${this.module}/adventure.json`).then(async r => r.json()).then(async json => {
                    bookData = json
                })
            } catch {
                console.warn(`Could not find book data for ${this.module} import.`)
            }
        }

        await fetch(`modules/${this.module}/initialization${this.lang}.json`).then(async r => r.json()).then(async json => {
            let foldersToCreate = json.folders
            if (foldersToCreate) {
                let head = await this.getFolderForType("JournalEntry")
                let headReplace = json.folders[0].name
                if (head) {
                    this.folders[head.name] = head
                    json.folders.shift()
                }
                let createdFolders = await Folder.create(foldersToCreate)
                if (!Array.isArray(createdFolders))
                    createdFolders = [createdFolders]
                for (let folder of createdFolders)
                    this.folders[folder.name] = folder;

                const updates = []
                for (let folder in this.folders) {
                    const flag = this.folders[folder].getFlag("dsk", "parent")
                    let parent = flag == headReplace ? game.i18n.localize(`${this.module}.name`) : flag
                    if (parent) {
                        updates.push({ _id: this.folders[folder].id, parent: this.folders[parent].id })
                    }
                }
                await Folder.updateDocuments(updates)
            }
            if (json.items) {
                let head = await this.getFolderForType("Item")
                let itemsToCreate = []
                let itemsToUpdate = []
                for (let k of json.items) {
                    k.folder = head.id
                    let existingItem = game.items.find(x => x.name == k.name && x.folder?.id == head.id)
                    if (existingItem) {
                        k._id = existingItem.id
                        itemsToUpdate.push(k)
                    } else {
                        itemsToCreate.push(k)
                    }
                }
                await ItemDSK.create(itemsToCreate)
                await ItemDSK.updateDocuments(itemsToUpdate)
            }
            if(json.playlists){
                let head = await this.getFolderForType("Playlist")
                let itemsToCreate = []
                let itemsToUpdate = []
                let playlist = game.packs.get(json.playlists)
                let entries = (await playlist.getDocuments()).map(x => x.toObject())
                for(let k of entries){
                    k.folder = head.id
                    let existingItem = game.playlists.find(x => x.name == k.name && x.folder?.id == head.id)
                    if (existingItem) {
                        k._id = existingItem._id
                        itemsToUpdate.push(k)
                    } else {
                        itemsToCreate.push(k)
                    }
                }
                
                await Playlist.create(itemsToCreate, { keepId: true })
                await Playlist.updateDocuments(itemsToUpdate)
            }
            if (json.scenes) {
                let head = await this.getFolderForType("Scene")
                let scene = game.packs.get(json.scenes)
                let entries = (await scene.getDocuments()).map(x => x.toObject())
                let journal = game.packs.get(json.journal)
                let journs = (await journal.getDocuments()).map(x => x.toObject())
                let journHead = await this.getFolderForType("JournalEntry")
                let scenesToCreate = []
                let scenesToUpdate = []
                let finishedIds = new Map()
                let resetAll = false

                for (let entry of entries) {
                    let resetScene = resetAll
                    let found = game.scenes.find(x => x.name == entry.name && x.folder?.id == head.id)
                    if (!resetAll && found) {
                        [resetScene, resetAll] = await new Promise((resolve, reject) => {
                            new Dialog({
                                title: game.i18n.localize("dsk.Book.sceneReset"),
                                content: game.i18n.format("dsk.Book.sceneResetDescription", { name: entry.name }),
                                default: 'Yes',
                                buttons: {
                                    Yes: {
                                        icon: '<i class="fa fa-check"></i>',
                                        label: game.i18n.localize("dsk.yes"),
                                        callback: () => {
                                            resolve([true, false])
                                        }
                                    },
                                    all: {
                                        icon: '<i class="fa fa-check"></i>',
                                        label: game.i18n.localize("dsk.LocalizedIDs.all"),
                                        callback: () => {
                                            resolve([true, true])
                                        }
                                    },
                                    cancel: {
                                        icon: '<i class="fas fa-times"></i>',
                                        label: game.i18n.localize("dsk.cancel"),
                                        callback: () => {
                                            resolve([false, false])
                                        }
                                    }
                                },
                                close: () => { resolve([false, false]) }
                            }).render(true)
                        })
                    }
                    if (found && !resetScene) {
                        this.scenes[found.name] = found
                        continue
                    }

                    entry.folder = head.id
                    for (let n of entry.notes) {
                        try {
                            let journ = journs.find(x => x.flags.dsk.initId == n.entryId)
                            if (!(finishedIds.has(journ._id))) {
                                const parent = getProperty(journ, "flags.dsk.parent")
                                let parenthead = journHead
                                if (this.folders[parent]) {
                                    parenthead = this.folders[parent]
                                } else if (parent) {
                                    parenthead = await this.getFolderForType("JournalEntry", journHead.id, parent, 0, getProperty(journ, "flags.dsk.foldercolor") || "")
                                }

                                journ.folder = parenthead.id

                                let existingJourn = game.journal.find(x => x.name == journ.name && x.folder?.id == parenthead.id && x.flags.dsk.initId == n.entryId)
                                if (existingJourn) {
                                    await existingJourn.update(journ)
                                    finishedIds.set(journ._id, existingJourn.id)
                                } else {
                                    let createdEntries = await JournalEntry.create(journ)
                                    finishedIds.set(journ._id, createdEntries.id)
                                }

                            }

                            n.entryId = finishedIds.get(journ._id)
                        } catch (e) {
                            console.warn(`Could not initialize Scene Notes for scene :${entry.name}` + e)
                        }
                    }
                    if (!found) scenesToCreate.push(entry)
                    else {
                        entry._id = found.id
                        scenesToUpdate.push(entry)
                    }
                }
                let createdEntries = await Scene.create(scenesToCreate, { dskInit: true })
                for (let entry of createdEntries) {
                    this.scenes[entry.name] = entry;
                    const thumb = await entry.createThumbnail()
                    await entry.update({thumb: thumb.thumb})
                }
                //await Scene.update(scenesToUpdate)
                //TODO this does not properly update walls?
                for (let entry of scenesToUpdate) {
                    let scene = game.scenes.get(entry._id)
                    await scene.update(entry)
                    this.scenes[entry.name] = game.scenes.get(entry._id);
                }

                if (json.initialScene) {
                    const initialScene = this.scenes[json.initialScene]
                    await game.settings.set("core", NotesLayer.TOGGLE_SETTING, true)
                    await initialScene.activate()
                    await initialScene.update({ navigation: true })

                }
            }
            if (json.actors) {
                let head = await this.getFolderForType("Actor")
                let actor = game.packs.get(json.actors)
                let entries = (await actor.getDocuments()).map(x => x.toObject())
                let entriesToCreate = []
                let entriesToUpdate = []
                let actorFolders = new Map()
                let sort = 0
                if (getProperty(bookData, "chapters")) {
                    
                    for (const chapter of bookData.chapters) {
                        for (const subChapter of chapter.content) {
                            if (subChapter.actors) {
                                let subChapterHasActors = false
                                for (const act of subChapter.actors) {
                                    if (!actorFolders.has(act)) {
                                        actorFolders.set(act, subChapter.name)
                                        subChapterHasActors = true
                                    }
                                }
                                if (subChapterHasActors) {
                                    await this.getFolderForType("Actor", head.id, subChapter.name, sort)
                                    sort += 1
                                }
                            }
                        }
                    }
                }
                for (let entry of entries) {
                    const parentFolder = actorFolders.has(entry.name) ? await this.getFolderForType("Actor", head.id, actorFolders.get(entry.name)) : head

                    entry.folder = parentFolder.id
                    if (entry._id) delete entry._id

                    let existingActor = game.actors.find(x => x.name == entry.name && [head.id, parentFolder.id].includes(x.folder?.id))
                    if (existingActor) {
                        entry._id = existingActor.id
                        await existingActor.deleteEmbeddedDocuments("Item", existingActor.items.map(x => x.id))
                        entriesToUpdate.push(entry)
                    } else {
                        entriesToCreate.push(entry)
                    }
                }
                let createdEntries = await Actor.create(entriesToCreate)

                await Actor.updateDocuments(entriesToUpdate)
                for (let entry of createdEntries) {
                    this.actors[entry.name] = entry;
                }
            }

        })
        this.lock = false
        initButton.find("i").remove()
        ui.notifications.info("dsk.initComplete", { localize: true })
        await this.close()
    }

    async dontInitialize() {
        if (game.settings.settings.has(`${this.module}.initialized`))
            await game.settings.set(this.module, "initialized", true)

        ui.notifications.info("dsk.initSkipped", { localize: true })
        await this.close()
    }

    submit(button) {
        try {
            if (button.callback) button.callback(this.options.jQuery ? this.element : this.element[0]);
        } catch (err) {
            ui.notifications.error(err);
            throw new Error(err);
        }
    }

    async getFolderForType(documentType, parent = null, folderName = null, sort = 0, color = "") {
        if (!folderName) folderName = game.i18n.localize(`${this.module}.name`)

        return DSKUtility.getFolderForType(documentType, parent, folderName, sort, color)
    }
}