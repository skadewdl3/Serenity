import emitter, { type RecentFile } from "./events";

const RECENTS_KEY = "recentFiles";

function getRecents(): RecentFile[] {
    try {
        const recentsRaw = localStorage.getItem(RECENTS_KEY);
        return recentsRaw ? JSON.parse(recentsRaw) : [];
    } catch (e) {
        console.error("Failed to load or parse recent files from localStorage", e);
        return [];
    }
}

function saveRecents(recents: RecentFile[]) {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(recents));
}

function createRecentsEntry(file: RecentFile) {
    const recents = getRecents();
    const existingIndex = recents.findIndex((f) => f.path === file.path);

    if (existingIndex !== -1) {
        // Move to top
        recents.splice(existingIndex, 1);
    }

    recents.unshift(file);
    saveRecents(recents);
}

function editRecentsEntry(file: Partial<RecentFile> & { path: string }) {
    const recents = getRecents();
    const existingIndex = recents.findIndex((f) => f.path === file.path);

    if (existingIndex !== -1) {
        recents[existingIndex] = { ...recents[existingIndex], ...file };
        saveRecents(recents);
    }
}

function deleteRecentsEntry(path: string) {
    let recents = getRecents();
    recents = recents.filter((f) => f.path !== path);
    saveRecents(recents);
}

emitter.on("createRecentsEntry", createRecentsEntry);
emitter.on("editRecentsEntry", editRecentsEntry);
emitter.on("deleteRecentsEntry", deleteRecentsEntry);
