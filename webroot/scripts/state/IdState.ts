export type WithId = {
    id: number;
}

let currentId = 0;

//TODO any worry about hitting max int here...?
export function getNewId() {
    currentId++;
    return currentId;
}