let currentResources = 0;
let currentResourcesCallbacks = [];

export function useResources(used: number) {
    setResources(currentResources - used);
}

export function setResources(resources: number) {
    if (currentResources == resources) {
        return;
    }
    currentResources = resources;
    if (currentResources < 0) {
        currentResources = 0;
    }
    currentResourcesCallbacks.forEach(callback => 
        callback.callback(getResources(), callback.scene));
}

export function getResources(): number {
    return currentResources;
}

export function addCurrentResourcesListener(callback, scene) {
    currentResourcesCallbacks.push({ 
        callback: callback,
        scene: scene
    });
}