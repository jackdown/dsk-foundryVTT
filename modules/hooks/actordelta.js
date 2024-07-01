import ActorDSK from "../actor/actor_dsk.js";

export function setActorDelta() {
    const oldUpdate = ActorDelta._onUpdateOperation
    ActorDelta._onUpdateOperation = async (documents, operation, user) => {
        for (let doc of documents) {
            await ActorDSK.postUpdateConditions(doc.syntheticActor)
        }
        return oldUpdate(documents, operation, user);
    }

    const oldCreate = ActorDelta._onCreateOperation
    ActorDelta._onCreateOperation = async (documents, operation, user) => {
        for (let doc of documents) {
            await ActorDSK.postUpdateConditions(doc.syntheticActor)
        }
        return oldCreate(documents, operation, user);
    }
}