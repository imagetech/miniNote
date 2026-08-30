(() => {
  const STORAGE_KEY = "mininote-board-v1";
  const viewport = document.querySelector("#viewport");
  const world = document.querySelector("#world");
  const notesLayer = document.querySelector("#notes");
  const titleInput = document.querySelector("#board-title");
  const breadcrumbs = document.querySelector("#breadcrumbs");
  const saveStatus = document.querySelector("#save-status");
  const zoomLabel = document.querySelector("#zoom-label");
  const imageInput = document.querySelector("#image-input");
  const dropOverlay = document.querySelector("#drop-overlay");
  const projectInput = document.querySelector("#project-input");
  const imageViewer = document.querySelector("#image-viewer");
  const viewerImage = document.querySelector("#viewer-image");
  const viewerTitle = document.querySelector("#viewer-title");
  const viewerSize = document.querySelector("#viewer-size");
  const boardCreator = document.querySelector("#board-creator");
  const boardCreatorForm = document.querySelector("#board-creator-form");
  const newBoardTitle = document.querySelector("#new-board-title");
  const boardParentName = document.querySelector("#board-parent-name");
  const storageFolderStatus = document.querySelector("#storage-folder-status");
  const imageUrls = new Map();
  let viewerUrl = null;

  const presetBoards = [
    { id: "characters", title: "Characters", icon: "♟", x: 70, y: 70, parentBoardId: "project" },
    { id: "settings", title: "Settings", icon: "⌂", x: 360, y: 70, parentBoardId: "project" },
    { id: "shots", title: "Shots", icon: "▣", x: 70, y: 270, parentBoardId: "project" },
    { id: "storyboard", title: "Storyboard", icon: "▤", x: 360, y: 270, parentBoardId: "project" },
  ];

  function createFreshProjectState() {
    return {
      title: "Project",
      currentBoardId: "project",
      boards: presetBoards.map(board => ({ ...board })),
      boardViews: {},
      view: { x: 180, y: 110, zoom: 1 },
      images: [],
      notes: [
        { id: crypto.randomUUID(), boardId: "project", x: 690, y: 70, color: "yellow", text: "Welcome to your AI project.\n\nOpen a reference board to start collecting material." },
      ],
    };
  }

  const starterState = createFreshProjectState();

  let state = loadState();
  let selectedId = null;
  let spacePressed = false;
  let gesture = null;
  let saveTimer = null;
  let folderSaveTimer = null;
  let directoryHandle = null;
  let dragDepth = 0;

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && Array.isArray(saved.notes) && saved.view) return normalizeState(saved);
    } catch (_) {}
    return starterState;
  }

  function normalizeState(saved) {
    saved.images ||= [];
    saved.currentBoardId ||= "project";
    saved.boardViews ||= {};
    saved.boards ||= [];
    for (const preset of presetBoards) {
      if (!saved.boards.some(board => board.id === preset.id)) saved.boards.push({ ...preset });
    }
    saved.notes.forEach(note => { note.boardId ||= "project"; });
    saved.images.forEach(image => { image.boardId ||= "project"; });
    if (!saved.title || saved.title === "My first board") saved.title = "Project";
    if (saved.currentBoardId !== "project" && !saved.boards.some(board => board.id === saved.currentBoardId)) saved.currentBoardId = "project";
    return saved;
  }

  function scheduleSave() {
    saveStatus.textContent = "Saving…";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      saveStatus.textContent = "Saved locally";
      scheduleFolderSave();
    }, 180);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
  }

  function applyView() {
    world.style.transform = `translate(${state.view.x}px, ${state.view.y}px) scale(${state.view.zoom})`;
    zoomLabel.textContent = `${Math.round(state.view.zoom * 100)}%`;
  }

  function renderNotes() {
    for (const url of imageUrls.values()) URL.revokeObjectURL(url);
    imageUrls.clear();
    notesLayer.replaceChildren();
    for (const board of state.boards.filter(board => board.parentBoardId === state.currentBoardId)) renderBoardCard(board);
    for (const note of state.notes.filter(note => note.boardId === state.currentBoardId)) {
      const card = document.createElement("article");
      card.className = `note${note.id === selectedId ? " selected" : ""}`;
      card.dataset.id = note.id;
      card.dataset.color = note.color || "paper";
      card.style.transform = `translate(${note.x}px, ${note.y}px)`;
      card.innerHTML = `
        <div class="note-handle" aria-label="Drag note">
          <span class="drag-dots">···</span>
          <button class="delete-note" type="button" aria-label="Delete note">×</button>
        </div>
        <textarea aria-label="Note text" placeholder="Write something…"></textarea>`;
      const textarea = card.querySelector("textarea");
      textarea.value = note.text;
      textarea.addEventListener("input", () => {
        note.text = textarea.value;
        scheduleSave();
      });
      textarea.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
        selectNote(note.id);
      });
      card.querySelector(".note-handle").addEventListener("pointerdown", (event) => startNoteDrag(event, note));
      card.querySelector(".delete-note").addEventListener("pointerdown", event => event.stopPropagation());
      card.querySelector(".delete-note").addEventListener("click", () => deleteNote(note.id));
      notesLayer.append(card);
    }
    for (const image of state.images.filter(image => image.boardId === state.currentBoardId)) renderImageCard(image);
  }

  function renderBoardCard(board) {
    const card = document.createElement("article");
    const itemCount = state.notes.filter(note => note.boardId === board.id).length + state.images.filter(image => image.boardId === board.id).length;
    const childCount = state.boards.filter(child => child.parentBoardId === board.id).length;
    card.className = `board-card${board.id === selectedId ? " selected" : ""}`;
    card.dataset.id = board.id;
    card.dataset.board = board.id;
    card.style.transform = `translate(${board.x}px, ${board.y}px)`;
    card.innerHTML = `
      <div class="note-handle" aria-label="Drag board">
        <span class="drag-dots">···</span>
      </div>
      <button class="board-card-body" type="button" aria-label="Open ${escapeHtml(board.title)} board">
        <span class="board-icon">${board.icon}</span>
        <span class="board-card-copy">
          <strong>${escapeHtml(board.title)}</strong>
          <span>${itemCount} reference${itemCount === 1 ? "" : "s"}${childCount ? ` · ${childCount} board${childCount === 1 ? "" : "s"}` : ""}</span>
          <small>Open board →</small>
        </span>
      </button>`;
    const body = card.querySelector(".board-card-body");
    body.addEventListener("click", event => { event.stopPropagation(); openBoard(board.id); });
    card.querySelector(".note-handle").addEventListener("pointerdown", event => startCardDrag(event, board, "boards"));
    notesLayer.append(card);
  }

  function currentBoardTitle() {
    if (state.currentBoardId === "project") return state.title;
    return state.boards.find(board => board.id === state.currentBoardId)?.title || "Board";
  }

  function renderBoardChrome() {
    titleInput.value = currentBoardTitle();
    breadcrumbs.replaceChildren();
    const chain = [];
    const visited = new Set();
    let cursorId = state.currentBoardId;
    while (cursorId !== "project" && !visited.has(cursorId)) {
      visited.add(cursorId);
      const board = state.boards.find(item => item.id === cursorId);
      if (!board) break;
      chain.unshift(board);
      cursorId = board.parentBoardId || "project";
    }
    const projectButton = document.createElement("button");
    projectButton.type = "button";
    projectButton.textContent = state.title;
    projectButton.addEventListener("click", () => openBoard("project"));
    breadcrumbs.append(projectButton);
    chain.forEach((board, index) => {
      const separator = document.createElement("span");
      separator.textContent = "/";
      const isCurrent = index === chain.length - 1;
      const crumb = document.createElement(isCurrent ? "span" : "button");
      crumb.textContent = board.title;
      if (!isCurrent) {
        crumb.type = "button";
        crumb.addEventListener("click", () => openBoard(board.id));
      }
      breadcrumbs.append(separator, crumb);
    });
    document.querySelectorAll("[data-board-link]").forEach(button => {
      const board = state.boards.find(item => item.id === button.dataset.boardLink);
      if (board) button.querySelector("strong").textContent = board.title;
      button.dataset.active = String(button.dataset.boardLink === state.currentBoardId);
    });
  }

  function openBoard(boardId) {
    if (boardId === state.currentBoardId) return;
    state.boardViews[state.currentBoardId] = { ...state.view };
    state.currentBoardId = boardId;
    state.view = state.boardViews[boardId] ? { ...state.boardViews[boardId] } : { x: 180, y: 110, zoom: 1 };
    selectedId = null;
    renderBoardChrome();
    applyView();
    renderNotes();
    scheduleSave();
  }

  async function openImageStore() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("mininote-media", 2);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("images")) request.result.createObjectStore("images");
        if (!request.result.objectStoreNames.contains("settings")) request.result.createObjectStore("settings");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function putImageBlob(id, blob) {
    const db = await openImageStore();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("images", "readwrite");
      tx.objectStore("images").put(blob, id);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }

  async function getImageBlob(id) {
    const db = await openImageStore();
    return new Promise((resolve, reject) => {
      const request = db.transaction("images").objectStore("images").get(id);
      request.onsuccess = () => { db.close(); resolve(request.result); };
      request.onerror = () => { db.close(); reject(request.error); };
    });
  }

  async function removeImageBlob(id) {
    const db = await openImageStore();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("images", "readwrite");
      tx.objectStore("images").delete(id);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }

  async function clearImageStore() {
    const db = await openImageStore();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("images", "readwrite");
      tx.objectStore("images").clear();
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }

  async function putSetting(key, value) {
    const db = await openImageStore();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("settings", "readwrite");
      tx.objectStore("settings").put(value, key);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }

  async function getSetting(key) {
    const db = await openImageStore();
    return new Promise((resolve, reject) => {
      const request = db.transaction("settings").objectStore("settings").get(key);
      request.onsuccess = () => { db.close(); resolve(request.result); };
      request.onerror = () => { db.close(); reject(request.error); };
    });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  function dataUrlToBlob(dataUrl) {
    const match = /^data:([^;,]+)?(;base64)?,(.*)$/.exec(dataUrl);
    if (!match || !match[2]) throw new Error("Invalid embedded image data");
    const bytes = Uint8Array.from(atob(match[3]), character => character.charCodeAt(0));
    return new Blob([bytes], { type: match[1] || "application/octet-stream" });
  }

  function safeProjectName() {
    return (state.title || "project").trim().replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "") || "project";
  }

  async function buildProjectBundle() {
    const images = await Promise.all(state.images.map(async image => {
      const blob = await getImageBlob(image.id);
      if (!blob) throw new Error(`Missing image: ${image.name || image.id}`);
      return { id: image.id, name: image.name || "image", type: blob.type, data: await blobToDataUrl(blob) };
    }));
    return {
      type: "mininote-project",
      version: 1,
      exportedAt: new Date().toISOString(),
      state,
      images,
    };
  }

  function updateFolderStatus(message) {
    storageFolderStatus.textContent = message;
  }

  async function restoreStorageFolder() {
    if (!("showDirectoryPicker" in window)) {
      updateFolderStatus("Chrome or Edge required");
      return;
    }
    try {
      directoryHandle = await getSetting("project-directory") || null;
      if (!directoryHandle) return;
      const permission = await directoryHandle.queryPermission({ mode: "readwrite" });
      updateFolderStatus(permission === "granted" ? `Autosaving to ${directoryHandle.name}` : `Reconnect ${directoryHandle.name}`);
    } catch (error) {
      console.warn("Stored folder could not be restored", error);
      directoryHandle = null;
      updateFolderStatus("Choose an autosave folder");
    }
  }

  async function chooseStorageFolder() {
    if (!("showDirectoryPicker" in window)) {
      updateFolderStatus("Not supported in this browser");
      return;
    }
    try {
      if (directoryHandle) {
        const currentPermission = await directoryHandle.queryPermission({ mode: "readwrite" });
        if (currentPermission === "granted") {
          updateFolderStatus(`Autosaving to ${directoryHandle.name}`);
          await writeProjectToFolder(true);
          return;
        }
        if (currentPermission !== "granted") {
          const renewed = await directoryHandle.requestPermission({ mode: "readwrite" });
          if (renewed === "granted") {
            updateFolderStatus(`Autosaving to ${directoryHandle.name}`);
            await writeProjectToFolder(true);
            return;
          }
        }
      }
      const selected = await window.showDirectoryPicker({ id: "mininote-projects", mode: "readwrite" });
      directoryHandle = selected;
      await putSetting("project-directory", selected);
      updateFolderStatus(`Autosaving to ${selected.name}`);
      await writeProjectToFolder(true);
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Folder selection failed", error);
        updateFolderStatus("Folder access failed");
      }
    }
  }

  function scheduleFolderSave() {
    if (!directoryHandle) return;
    clearTimeout(folderSaveTimer);
    folderSaveTimer = setTimeout(() => writeProjectToFolder(false), 1200);
  }

  async function writeProjectToFolder(showStatus) {
    if (!directoryHandle) return;
    try {
      const permission = await directoryHandle.queryPermission({ mode: "readwrite" });
      if (permission !== "granted") {
        updateFolderStatus(`Reconnect ${directoryHandle.name}`);
        return;
      }
      updateFolderStatus(`Saving to ${directoryHandle.name}…`);
      const bundle = await buildProjectBundle();
      const fileHandle = await directoryHandle.getFileHandle(`${safeProjectName()}.mininote.json`, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(bundle, null, 2));
      await writable.close();
      updateFolderStatus(`Autosaving to ${directoryHandle.name}`);
      if (showStatus) {
        saveStatus.textContent = "Saved to folder";
        setTimeout(() => { saveStatus.textContent = "Saved locally"; }, 1800);
      }
    } catch (error) {
      console.error("Folder autosave failed", error);
      updateFolderStatus("Folder save failed");
    }
  }

  async function saveProjectToDisk() {
    saveStatus.textContent = "Preparing project…";
    try {
      const bundle = await buildProjectBundle();
      const file = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${safeProjectName()}.mininote.json`;
      link.hidden = true;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      saveStatus.textContent = "Project downloaded";
      setTimeout(() => { saveStatus.textContent = "Saved locally"; }, 1800);
    } catch (error) {
      console.error("Project export failed", error);
      saveStatus.textContent = "Export failed";
    }
  }

  async function loadProjectFromDisk(file) {
    try {
      const bundle = JSON.parse(await file.text());
      if (bundle?.type !== "mininote-project" || bundle.version !== 1 || !bundle.state || !Array.isArray(bundle.state.notes) || !Array.isArray(bundle.images)) {
        throw new Error("This is not a supported MiniNote project file");
      }
      const restoredImages = bundle.images.map(image => {
        if (!image.id || typeof image.data !== "string") throw new Error("The project contains invalid image data");
        return { id: image.id, blob: dataUrlToBlob(image.data) };
      });
      if (!confirm(`Load “${bundle.state.title || "Project"}”? This will replace the project currently open in this browser.`)) return;
      saveStatus.textContent = "Loading project…";
      await clearImageStore();
      for (const image of restoredImages) await putImageBlob(image.id, image.blob);
      state = normalizeState(bundle.state);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      selectedId = null;
      renderBoardChrome();
      applyView();
      renderNotes();
      scheduleFolderSave();
      saveStatus.textContent = "Project loaded";
      setTimeout(() => { saveStatus.textContent = "Saved locally"; }, 1800);
    } catch (error) {
      console.error("Project import failed", error);
      saveStatus.textContent = error.message || "Import failed";
    }
  }

  async function startNewProject() {
    const approved = confirm("Start a new project? The project currently stored in this browser will be cleared. Save it to disk first if you may need it later.");
    if (!approved) return;
    saveStatus.textContent = "Creating project…";
    try {
      clearTimeout(saveTimer);
      await clearImageStore();
      for (const url of imageUrls.values()) URL.revokeObjectURL(url);
      imageUrls.clear();
      if (viewerUrl) closeImageViewer();
      state = createFreshProjectState();
      selectedId = null;
      gesture = null;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      renderBoardChrome();
      applyView();
      renderNotes();
      scheduleFolderSave();
      saveStatus.textContent = "New project ready";
      setTimeout(() => { saveStatus.textContent = "Saved locally"; }, 1800);
    } catch (error) {
      console.error("Could not create a new project", error);
      saveStatus.textContent = "Couldn’t create project";
    }
  }

  async function clearCurrentBoard() {
    const boardTitle = currentBoardTitle();
    const referenceCount = state.notes.filter(note => note.boardId === state.currentBoardId).length + state.images.filter(image => image.boardId === state.currentBoardId).length;
    if (!referenceCount) {
      saveStatus.textContent = "Board is already empty";
      setTimeout(() => { saveStatus.textContent = "Saved locally"; }, 1500);
      return;
    }
    const approved = confirm(`Clear “${boardTitle}”? This will permanently remove its ${referenceCount} reference${referenceCount === 1 ? "" : "s"}. Other boards will not be changed.`);
    if (!approved) return;
    saveStatus.textContent = "Clearing board…";
    try {
      const removedImages = state.images.filter(image => image.boardId === state.currentBoardId);
      for (const image of removedImages) await removeImageBlob(image.id);
      state.notes = state.notes.filter(note => note.boardId !== state.currentBoardId);
      state.images = state.images.filter(image => image.boardId !== state.currentBoardId);
      selectedId = null;
      renderNotes();
      scheduleSave();
      saveStatus.textContent = "Board cleared";
      setTimeout(() => { saveStatus.textContent = "Saved locally"; }, 1800);
    } catch (error) {
      console.error("Could not clear board", error);
      saveStatus.textContent = "Couldn’t clear board";
    }
  }

  function closeTopMenus() {
    document.querySelectorAll(".top-menu[open]").forEach(menu => { menu.open = false; });
  }

  function renderImageCard(image) {
    const card = document.createElement("article");
    card.className = `image-card${image.id === selectedId ? " selected" : ""}`;
    card.dataset.id = image.id;
    card.style.width = `${image.width || 300}px`;
    card.style.transform = `translate(${image.x}px, ${image.y}px)`;
    card.innerHTML = `
      <div class="note-handle" aria-label="Drag image">
        <span class="drag-dots">···</span>
        <button class="delete-note" type="button" aria-label="Delete image">×</button>
      </div>
      <div class="image-frame"><span class="image-loading">Loading image…</span></div>
      <input class="image-caption" aria-label="Image caption" placeholder="Add a caption…" />`;
    const caption = card.querySelector(".image-caption");
    caption.value = image.caption || "";
    caption.addEventListener("input", () => { image.caption = caption.value; scheduleSave(); });
    caption.addEventListener("pointerdown", event => { event.stopPropagation(); selectNote(image.id); });
    card.querySelector(".note-handle").addEventListener("pointerdown", event => startCardDrag(event, image, "images"));
    card.querySelector(".delete-note").addEventListener("pointerdown", event => event.stopPropagation());
    card.querySelector(".delete-note").addEventListener("click", () => deleteImage(image.id));
    card.querySelector(".image-frame").addEventListener("dblclick", event => {
      event.stopPropagation();
      openImageViewer(image);
    });
    notesLayer.append(card);
    getImageBlob(image.id).then(blob => {
      if (!blob || !card.isConnected) return;
      const url = URL.createObjectURL(blob);
      imageUrls.set(image.id, url);
      const img = document.createElement("img");
      img.src = url;
      img.alt = image.caption || image.name || "Board image";
      card.querySelector(".image-frame").replaceChildren(img);
    }).catch(() => { card.querySelector(".image-loading").textContent = "Image unavailable"; });
  }

  function selectNote(id) {
    selectedId = id;
    document.querySelectorAll(".note, .image-card, .board-card").forEach(card => card.classList.toggle("selected", card.dataset.id === id));
  }

  function addNoteAt(clientX, clientY, focus = true) {
    const point = screenToWorld(clientX, clientY);
    const colors = ["paper", "yellow", "rose", "blue"];
    const note = { id: crypto.randomUUID(), boardId: state.currentBoardId, x: point.x - 120, y: point.y - 30, color: colors[state.notes.length % colors.length], text: "" };
    state.notes.push(note);
    selectedId = note.id;
    renderNotes();
    scheduleSave();
    if (focus) notesLayer.querySelector(`[data-id="${note.id}"] textarea`).focus();
  }

  function addNestedBoard() {
    boardParentName.textContent = currentBoardTitle();
    newBoardTitle.value = "";
    boardCreator.showModal();
    setTimeout(() => newBoardTitle.focus(), 0);
  }

  function createNestedBoard(title) {
    const rect = viewport.getBoundingClientRect();
    const point = screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const board = {
      id: crypto.randomUUID(),
      title: title.trim().slice(0, 80),
      icon: "◇",
      x: Math.round(point.x - 125),
      y: Math.round(point.y - 70),
      parentBoardId: state.currentBoardId,
    };
    state.boards.push(board);
    selectedId = board.id;
    renderNotes();
    scheduleSave();
  }

  function deleteNote(id) {
    state.notes = state.notes.filter(note => note.id !== id);
    if (selectedId === id) selectedId = null;
    renderNotes();
    scheduleSave();
  }

  async function deleteImage(id) {
    state.images = state.images.filter(image => image.id !== id);
    if (selectedId === id) selectedId = null;
    const url = imageUrls.get(id);
    if (url) URL.revokeObjectURL(url);
    imageUrls.delete(id);
    renderNotes();
    scheduleSave();
    await removeImageBlob(id).catch(() => {});
  }

  async function openImageViewer(image) {
    const blob = await getImageBlob(image.id).catch(() => null);
    if (!blob) return;
    if (viewerUrl) URL.revokeObjectURL(viewerUrl);
    viewerUrl = URL.createObjectURL(blob);
    viewerTitle.textContent = image.caption || image.name || "Image";
    viewerSize.textContent = "Loading resolution…";
    viewerImage.onload = () => {
      viewerSize.textContent = `${viewerImage.naturalWidth} × ${viewerImage.naturalHeight}px`;
    };
    viewerImage.src = viewerUrl;
    imageViewer.showModal();
  }

  function closeImageViewer() {
    imageViewer.close();
    viewerImage.removeAttribute("src");
    if (viewerUrl) URL.revokeObjectURL(viewerUrl);
    viewerUrl = null;
  }

  async function addImageFile(file, clientX, clientY, index = 0) {
    if (!file?.type?.startsWith("image/")) return;
    const id = crypto.randomUUID();
    const point = screenToWorld(clientX + index * 26, clientY + index * 26);
    const image = { id, boardId: state.currentBoardId, x: Math.round(point.x - 150), y: Math.round(point.y - 30), width: 300, name: file.name || "Pasted image", caption: "" };
    try {
      await putImageBlob(id, file);
      state.images.push(image);
      selectedId = id;
      renderNotes();
      scheduleSave();
    } catch (error) {
      saveStatus.textContent = "Couldn’t save image";
      console.error("Image storage failed", error);
    }
  }

  function addImageFiles(files, clientX, clientY) {
    [...files].filter(file => file.type.startsWith("image/")).forEach((file, index) => addImageFile(file, clientX, clientY, index));
  }

  function screenToWorld(clientX, clientY) {
    const rect = viewport.getBoundingClientRect();
    return {
      x: (clientX - rect.left - state.view.x) / state.view.zoom,
      y: (clientY - rect.top - state.view.y) / state.view.zoom,
    };
  }

  function startNoteDrag(event, note) {
    startCardDrag(event, note, "notes");
  }

  function startCardDrag(event, item, collection) {
    if (event.button !== 0 || event.target.closest("button")) return;
    event.preventDefault();
    event.stopPropagation();
    selectNote(item.id);
    gesture = { type: "card", collection, id: item.id, startX: event.clientX, startY: event.clientY, noteX: item.x, noteY: item.y, dropBoardId: null };
    viewport.setPointerCapture(event.pointerId);
  }

  function startPan(event) {
    if (event.button === 1 || (event.button === 0 && spacePressed)) {
      event.preventDefault();
      selectedId = null;
      selectNote(null);
      gesture = { type: "pan", startX: event.clientX, startY: event.clientY, viewX: state.view.x, viewY: state.view.y };
      viewport.classList.add("is-panning");
      viewport.setPointerCapture(event.pointerId);
    } else if (event.button === 0 && !event.target.closest(".note, .image-card, .board-card")) {
      selectedId = null;
      selectNote(null);
    }
  }

  viewport.addEventListener("pointerdown", startPan);
  viewport.addEventListener("pointermove", event => {
    if (!gesture) return;
    if (gesture.type === "pan") {
      state.view.x = gesture.viewX + event.clientX - gesture.startX;
      state.view.y = gesture.viewY + event.clientY - gesture.startY;
      applyView();
    } else {
      const note = state[gesture.collection].find(item => item.id === gesture.id);
      if (!note) return;
      note.x = Math.round(gesture.noteX + (event.clientX - gesture.startX) / state.view.zoom);
      note.y = Math.round(gesture.noteY + (event.clientY - gesture.startY) / state.view.zoom);
      notesLayer.querySelector(`[data-id="${note.id}"]`).style.transform = `translate(${note.x}px, ${note.y}px)`;
      if (gesture.collection === "notes" || gesture.collection === "images") {
        gesture.dropBoardId = null;
        document.querySelectorAll(".board-card").forEach(card => {
          const rect = card.getBoundingClientRect();
          const isTarget = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
          card.classList.toggle("drop-target", isTarget);
          if (isTarget) gesture.dropBoardId = card.dataset.id;
        });
      }
    }
  });
  viewport.addEventListener("pointerup", () => {
    if (gesture) {
      if (gesture.type === "card" && gesture.dropBoardId) {
        const item = state[gesture.collection].find(item => item.id === gesture.id);
        if (item) {
          item.boardId = gesture.dropBoardId;
          item.x = 80;
          item.y = 80;
          selectedId = null;
        }
        renderNotes();
      }
      scheduleSave();
    }
    document.querySelectorAll(".board-card.drop-target").forEach(card => card.classList.remove("drop-target"));
    gesture = null;
    viewport.classList.remove("is-panning");
  });
  viewport.addEventListener("pointercancel", () => {
    document.querySelectorAll(".board-card.drop-target").forEach(card => card.classList.remove("drop-target"));
    gesture = null;
    viewport.classList.remove("is-panning");
  });
  viewport.addEventListener("dblclick", event => {
    if (!event.target.closest(".note, .image-card, .board-card, button, input")) addNoteAt(event.clientX, event.clientY);
  });
  viewport.addEventListener("wheel", event => {
    event.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const oldZoom = state.view.zoom;
    const nextZoom = Math.min(2.5, Math.max(.35, oldZoom * Math.exp(-event.deltaY * .0012)));
    const worldX = (mouseX - state.view.x) / oldZoom;
    const worldY = (mouseY - state.view.y) / oldZoom;
    state.view.x = mouseX - worldX * nextZoom;
    state.view.y = mouseY - worldY * nextZoom;
    state.view.zoom = nextZoom;
    applyView();
    scheduleSave();
  }, { passive: false });

  function zoomBy(factor) {
    const rect = viewport.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const oldZoom = state.view.zoom;
    const nextZoom = Math.min(2.5, Math.max(.35, oldZoom * factor));
    state.view.x = centerX - ((centerX - state.view.x) / oldZoom) * nextZoom;
    state.view.y = centerY - ((centerY - state.view.y) / oldZoom) * nextZoom;
    state.view.zoom = nextZoom;
    applyView();
    scheduleSave();
  }

  document.querySelector("#add-note").addEventListener("click", () => {
    closeTopMenus();
    const rect = viewport.getBoundingClientRect();
    addNoteAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
  });
  document.querySelector("#save-project").addEventListener("click", () => { closeTopMenus(); saveProjectToDisk(); });
  document.querySelector("#new-project").addEventListener("click", () => { closeTopMenus(); startNewProject(); });
  document.querySelector("#load-project").addEventListener("click", () => { closeTopMenus(); projectInput.click(); });
  document.querySelector("#storage-folder").addEventListener("click", () => {
    closeTopMenus();
    chooseStorageFolder();
  });
  document.querySelector("#clear-board").addEventListener("click", () => {
    closeTopMenus();
    clearCurrentBoard();
  });
  document.querySelectorAll("[data-board-link]").forEach(button => {
    button.addEventListener("click", () => {
      closeTopMenus();
      openBoard(button.dataset.boardLink);
    });
  });
  projectInput.addEventListener("change", () => {
    const file = projectInput.files[0];
    if (file) loadProjectFromDisk(file);
    projectInput.value = "";
  });
  document.querySelector("#close-viewer").addEventListener("click", closeImageViewer);
  imageViewer.addEventListener("click", event => {
    if (event.target === imageViewer) closeImageViewer();
  });
  imageViewer.addEventListener("cancel", event => {
    event.preventDefault();
    closeImageViewer();
  });
  document.querySelector("#add-image").addEventListener("click", () => {
    closeTopMenus();
    imageInput.click();
  });
  document.querySelector("#add-board").addEventListener("click", () => {
    closeTopMenus();
    addNestedBoard();
  });
  boardCreatorForm.addEventListener("submit", event => {
    event.preventDefault();
    const title = newBoardTitle.value.trim();
    if (!title) return;
    boardCreator.close();
    createNestedBoard(title);
  });
  document.querySelector("#cancel-board").addEventListener("click", () => boardCreator.close());
  boardCreator.addEventListener("click", event => {
    if (event.target === boardCreator) boardCreator.close();
  });
  imageInput.addEventListener("change", () => {
    const rect = viewport.getBoundingClientRect();
    addImageFiles(imageInput.files, rect.left + rect.width / 2, rect.top + rect.height / 2);
    imageInput.value = "";
  });
  viewport.addEventListener("dragenter", event => {
    if (![...event.dataTransfer.types].includes("Files")) return;
    event.preventDefault();
    dragDepth += 1;
    dropOverlay.classList.add("visible");
  });
  viewport.addEventListener("dragover", event => {
    if (![...event.dataTransfer.types].includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  });
  viewport.addEventListener("dragleave", event => {
    event.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) dropOverlay.classList.remove("visible");
  });
  viewport.addEventListener("drop", event => {
    event.preventDefault();
    dragDepth = 0;
    dropOverlay.classList.remove("visible");
    addImageFiles(event.dataTransfer.files, event.clientX, event.clientY);
  });
  window.addEventListener("paste", event => {
    if (event.target.matches("textarea, input")) return;
    const images = [...event.clipboardData.items]
      .filter(item => item.kind === "file" && item.type.startsWith("image/"))
      .map(item => item.getAsFile())
      .filter(Boolean);
    if (!images.length) return;
    event.preventDefault();
    const rect = viewport.getBoundingClientRect();
    addImageFiles(images, rect.left + rect.width / 2, rect.top + rect.height / 2);
  });
  document.querySelector("#zoom-in").addEventListener("click", () => zoomBy(1.2));
  document.querySelector("#zoom-out").addEventListener("click", () => zoomBy(1 / 1.2));
  zoomLabel.addEventListener("click", () => {
    state.view.zoom = 1;
    applyView();
    scheduleSave();
  });
  titleInput.addEventListener("input", () => {
    if (state.currentBoardId === "project") state.title = titleInput.value;
    else {
      const board = state.boards.find(board => board.id === state.currentBoardId);
      if (board) board.title = titleInput.value;
    }
    renderBoardChrome();
    scheduleSave();
  });
  window.addEventListener("keydown", event => {
    if (event.key === "Escape" && imageViewer.open) {
      event.preventDefault();
      closeImageViewer();
      return;
    }
    if (event.key === "Escape") closeTopMenus();
    if (event.code === "Space" && !event.target.matches("textarea, input")) {
      spacePressed = true;
      event.preventDefault();
    }
    if ((event.key === "Delete" || event.key === "Backspace") && selectedId && !event.target.matches("textarea, input")) {
      if (state.images.some(image => image.id === selectedId)) deleteImage(selectedId);
      else deleteNote(selectedId);
    }
  });
  window.addEventListener("keyup", event => { if (event.code === "Space") spacePressed = false; });
  window.addEventListener("blur", () => { spacePressed = false; });
  document.addEventListener("pointerdown", event => {
    if (!event.target.closest(".top-menu")) closeTopMenus();
  });
  document.querySelectorAll(".top-menu").forEach(menu => {
    menu.addEventListener("toggle", () => {
      if (!menu.open) return;
      document.querySelectorAll(".top-menu[open]").forEach(other => { if (other !== menu) other.open = false; });
    });
  });

  renderBoardChrome();
  applyView();
  renderNotes();
  restoreStorageFolder();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch(error => {
        console.error("Offline support could not start", error);
      });
    });
  }
})();
