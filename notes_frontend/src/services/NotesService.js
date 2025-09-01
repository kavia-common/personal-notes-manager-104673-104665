//
// PUBLIC_INTERFACE
// NotesService provides an abstraction layer over data storage for notes.
// It can operate in two modes:
// 1. Direct (Local) mode using browser localStorage
// 2. API mode using REST endpoints (configure via REACT_APP_API_BASE_URL)
//
// Each public function is documented and can be swapped seamlessly by consumers.
//
const STORAGE_KEY = "notes_app_data_v1";

// Utility to generate simple unique IDs
const genId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// Decide if we use API mode based on environment variable
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "";
const useApi = Boolean(API_BASE_URL);

// Helpers for local storage
function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = { notes: [], tags: [] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(raw);
  } catch {
    return { notes: [], tags: [] };
  }
}

function writeStore(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// PUBLIC_INTERFACE
export async function listNotes(query = "") {
  /**
   * List all notes, optionally filtered by a search query.
   * - query: string to match against title, content, or tags
   * Returns: Promise<Note[]>
   * Note: Note shape: { id, title, content, tags: string[], updatedAt, createdAt }
   */
  if (useApi) {
    const res = await fetch(`${API_BASE_URL}/notes?query=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error("Failed to fetch notes");
    return res.json();
  }
  const store = readStore();
  if (!query) return store.notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const q = query.toLowerCase();
  return store.notes
    .filter((n) => {
      const inTitle = n.title.toLowerCase().includes(q);
      const inContent = n.content.toLowerCase().includes(q);
      const inTags = (n.tags || []).some((t) => t.toLowerCase().includes(q));
      return inTitle || inContent || inTags;
    })
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

// PUBLIC_INTERFACE
export async function getNote(id) {
  /**
   * Get a single note by id.
   * Returns: Promise<Note | null>
   */
  if (useApi) {
    const res = await fetch(`${API_BASE_URL}/notes/${id}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("Failed to fetch note");
    return res.json();
  }
  const store = readStore();
  return store.notes.find((n) => n.id === id) || null;
}

// PUBLIC_INTERFACE
export async function createNote({ title, content, tags = [] }) {
  /**
   * Create a new note.
   * Params: { title: string, content: string, tags: string[] }
   * Returns: Promise<Note>
   */
  if (useApi) {
    const res = await fetch(`${API_BASE_URL}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, tags }),
    });
    if (!res.ok) throw new Error("Failed to create note");
    return res.json();
  }
  const store = readStore();
  const now = new Date().toISOString();
  const note = { id: genId(), title: title || "Untitled", content: content || "", tags, createdAt: now, updatedAt: now };
  store.notes.unshift(note);
  // maintain tags list
  const tagSet = new Set(store.tags);
  tags.forEach((t) => t && tagSet.add(t));
  store.tags = Array.from(tagSet).sort();
  writeStore(store);
  return note;
}

// PUBLIC_INTERFACE
export async function updateNote(id, { title, content, tags = [] }) {
  /**
   * Update an existing note by id.
   * Params: id: string, fields: { title?: string, content?: string, tags?: string[] }
   * Returns: Promise<Note>
   */
  if (useApi) {
    const res = await fetch(`${API_BASE_URL}/notes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, tags }),
    });
    if (!res.ok) throw new Error("Failed to update note");
    return res.json();
  }
  const store = readStore();
  const idx = store.notes.findIndex((n) => n.id === id);
  if (idx === -1) throw new Error("Note not found");
  const prev = store.notes[idx];
  const now = new Date().toISOString();
  const next = {
    ...prev,
    title: title ?? prev.title,
    content: content ?? prev.content,
    tags: tags ?? prev.tags,
    updatedAt: now,
  };
  store.notes[idx] = next;
  // update tags list
  const tagSet = new Set(store.tags);
  (next.tags || []).forEach((t) => t && tagSet.add(t));
  store.tags = Array.from(tagSet).sort();
  writeStore(store);
  return next;
}

// PUBLIC_INTERFACE
export async function deleteNote(id) {
  /**
   * Delete a note by id.
   * Returns: Promise<void>
   */
  if (useApi) {
    const res = await fetch(`${API_BASE_URL}/notes/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete note");
    return;
  }
  const store = readStore();
  store.notes = store.notes.filter((n) => n.id !== id);
  writeStore(store);
}

// PUBLIC_INTERFACE
export async function listTags() {
  /**
   * List known tags. In API mode, fetches from /tags, otherwise aggregates from local notes.
   * Returns: Promise<string[]>
   */
  if (useApi) {
    const res = await fetch(`${API_BASE_URL}/tags`);
    if (!res.ok) throw new Error("Failed to fetch tags");
    return res.json();
  }
  const store = readStore();
  if (store.tags && store.tags.length) return store.tags;
  const tags = Array.from(
    new Set(
      store.notes.flatMap((n) => n.tags || [])
    )
  ).sort();
  store.tags = tags;
  writeStore(store);
  return tags;
}

// PUBLIC_INTERFACE
export async function listNotesByTag(tag) {
  /**
   * List notes for a specific tag.
   * Returns: Promise<Note[]>
   */
  if (useApi) {
    const res = await fetch(`${API_BASE_URL}/notes?tag=${encodeURIComponent(tag)}`);
    if (!res.ok) throw new Error("Failed to fetch notes by tag");
    return res.json();
  }
  const store = readStore();
  return store.notes
    .filter((n) => (n.tags || []).includes(tag))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}
