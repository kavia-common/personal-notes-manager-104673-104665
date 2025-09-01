import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import {
  listNotes,
  listTags,
  listNotesByTag,
  getNote,
  createNote,
  updateNote,
  deleteNote,
} from "./services/NotesService";

// Utility to extract a short preview snippet from content
function makePreview(text, len = 90) {
  if (!text) return "";
  const cleaned = text.replace(/\n+/g, " ").trim();
  return cleaned.length > len ? cleaned.slice(0, len) + "…" : cleaned;
}

// PUBLIC_INTERFACE
export default function App() {
  /**
   * Notes app main component.
   * Provides:
   * - Top navigation (brand + actions)
   * - Sidebar with tags/categories
   * - Notes list panel (with search)
   * - Note editor panel (create, update, delete)
   * Supports REST API via NotesService or local mode using localStorage.
   */
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState([]);
  const [tags, setTags] = useState([]);
  const [activeTag, setActiveTag] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState({ title: "", content: "", tags: [] });
  const [dirty, setDirty] = useState(false);

  // Load tags and notes
  const refreshTags = async () => {
    try {
      const t = await listTags();
      setTags(t);
    } catch (e) {
      console.error(e);
    }
  };

  const refreshNotes = async () => {
    setLoading(true);
    try {
      let data = [];
      if (activeTag) {
        data = await listNotesByTag(activeTag);
      } else if (query.trim()) {
        data = await listNotes(query.trim());
      } else {
        data = await listNotes();
      }
      setNotes(data);
      // Maintain selection if possible
      if (selectedId) {
        const stillExists = data.find((n) => n.id === selectedId);
        if (!stillExists) {
          setSelectedId(data[0]?.id || null);
        }
      } else {
        setSelectedId(data[0]?.id || null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await refreshTags();
      await refreshNotes();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to tag or query changes
  useEffect(() => {
    (async () => {
      await refreshNotes();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTag, query]);

  // Load editor when selection changes
  useEffect(() => {
    (async () => {
      if (!selectedId) {
        setEditor({ title: "", content: "", tags: [] });
        setDirty(false);
        return;
      }
      const n = await getNote(selectedId);
      if (n) {
        setEditor({ title: n.title || "", content: n.content || "", tags: n.tags || [] });
        setDirty(false);
      }
    })();
  }, [selectedId]);

  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedId) || null,
    [notes, selectedId]
  );

  // Handlers
  const handleNew = async () => {
    try {
      const n = await createNote({ title: "Untitled", content: "", tags: [] });
      await refreshTags();
      await refreshNotes();
      setSelectedId(n.id);
    } catch (e) {
      console.error(e);
      alert("Failed to create note");
    }
  };

  const handleSave = async () => {
    try {
      if (selectedId) {
        await updateNote(selectedId, {
          title: editor.title?.trim() || "Untitled",
          content: editor.content || "",
          tags: editor.tags || [],
        });
      } else {
        const n = await createNote({
          title: editor.title?.trim() || "Untitled",
          content: editor.content || "",
          tags: editor.tags || [],
        });
        setSelectedId(n.id);
      }
      await refreshTags();
      await refreshNotes();
      setDirty(false);
    } catch (e) {
      console.error(e);
      alert("Failed to save note");
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!window.confirm("Delete this note? This cannot be undone.")) return;
    try {
      await deleteNote(selectedId);
      await refreshTags();
      await refreshNotes();
      setEditor({ title: "", content: "", tags: [] });
      setDirty(false);
    } catch (e) {
      console.error(e);
      alert("Failed to delete note");
    }
  };

  const handleEditorChange = (field, value) => {
    setEditor((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const handleTagsInput = (val) => {
    // Accept comma-separated tags, trim and deduplicate
    const parts = val
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const uniq = Array.from(new Set(parts));
    handleEditorChange("tags", uniq);
  };

  const tagInputValue = useMemo(() => (editor.tags || []).join(", "), [editor.tags]);

  return (
    <div className="app-shell">
      {/* Top Navigation */}
      <div className="navbar">
        <div className="brand">
          <div className="brand-badge" aria-hidden="true" />
          Notes
        </div>
        <div className="nav-actions">
          <input
            className="input"
            type="search"
            placeholder="Search notes…"
            value={query}
            onChange={(e) => {
              setActiveTag(""); // clear tag filter when searching
              setQuery(e.target.value);
            }}
            aria-label="Search notes"
          />
          <button className="btn btn-primary" onClick={handleNew} aria-label="Create note">
            + New
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="main">
        {/* Sidebar for tags */}
        <aside className="sidebar">
          <h3>Tags</h3>
          <div style={{ marginBottom: 8 }}>
            <button
              className={`tag ${!activeTag ? "active" : ""}`}
              onClick={() => setActiveTag("")}
            >
              All
            </button>
          </div>
          <div>
            {tags.length === 0 ? (
              <div className="empty">No tags yet</div>
            ) : (
              tags.map((t) => (
                <button
                  key={t}
                  className={`tag ${activeTag === t ? "active" : ""}`}
                  onClick={() => {
                    setQuery(""); // clear search when selecting tag
                    setActiveTag(t);
                  }}
                >
                  #{t}
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Content: list + editor */}
        <div className="content">
          {/* Notes list */}
          <section className="panel list-panel">
            <div className="card">
              <div className="search-row">
                <input
                  className="input"
                  type="search"
                  placeholder="Filter list…"
                  value={query}
                  onChange={(e) => {
                    setActiveTag("");
                    setQuery(e.target.value);
                  }}
                />
              </div>
              <div>
                {loading ? (
                  <div className="empty">Loading…</div>
                ) : notes.length === 0 ? (
                  <div className="empty">No notes found</div>
                ) : (
                  notes.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => setSelectedId(n.id)}
                      className={`note-item ${selectedId === n.id ? "active" : ""}`}
                      role="button"
                      aria-label={`Open note ${n.title}`}
                    >
                      <div className="note-title">{n.title || "Untitled"}</div>
                      <div className="note-meta">
                        {n.updatedAt ? new Date(n.updatedAt).toLocaleString() : ""}
                        {n.tags?.length ? " · " + n.tags.map((t) => `#${t}`).join(" ") : ""}
                      </div>
                      <div className="note-preview">{makePreview(n.content)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* Editor */}
          <section className="panel editor-panel">
            <div className="card">
              <div style={{ display: "grid", gap: 10 }}>
                <input
                  className="editor-title"
                  placeholder="Title"
                  value={editor.title}
                  onChange={(e) => handleEditorChange("title", e.target.value)}
                />
                <textarea
                  className="editor-textarea"
                  placeholder="Write your note here…"
                  rows={16}
                  value={editor.content}
                  onChange={(e) => handleEditorChange("content", e.target.value)}
                />
                <div>
                  <input
                    className="tag-input"
                    placeholder="Tags (comma separated)"
                    value={tagInputValue}
                    onChange={(e) => handleTagsInput(e.target.value)}
                  />
                  <div className="helper" style={{ marginTop: 6 }}>
                    Example: work, personal, ideas
                  </div>
                </div>
              </div>

              <div className="editor-actions">
                <div className="helper">
                  {selectedNote?.updatedAt
                    ? `Last updated ${new Date(selectedNote.updatedAt).toLocaleString()}`
                    : "Unsaved"}
                  {dirty ? " • Unsaved changes" : ""}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {selectedId && (
                    <button className="btn btn-danger" onClick={handleDelete}>
                      Delete
                    </button>
                  )}
                  <button className="btn btn-primary" onClick={handleSave}>
                    {selectedId ? "Save" : "Create"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
