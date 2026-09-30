/**
 * Nexus Contacts — Modern Contact Management Application
 * Features:
 * - Real-time Firestore sync with resilient LocalStorage fallback
 * - Card View (Grid) and Table View with seamless switching
 * - High-speed instant search & category filtering
 * - Direct Actions: Call, WhatsApp, Email, Star/Favorite
 * - Avatar creation with initials gradient fallback & canvas photo optimizer
 * - CSV export
 * - Non-blocking custom toast system & modern confirmation dialogs
 * - Safe XSS prevention
 */

// ==========================================================================
// 1. Firebase Configuration & Initialization
// ==========================================================================
const firebaseConfig = {
    apiKey: "AIzaSyCkDIQ1DynjW_A2zZCu9cWbRu-fm8j0n0g",
    authDomain: "mycontacts-915c4.firebaseapp.com",
    projectId: "mycontacts-915c4",
    storageBucket: "mycontacts-915c4.firebasestorage.app",
    messagingSenderId: "559735451455",
    appId: "1:559735451455:web:949dce1fc576555b156d8a",
    measurementId: "G-B9P3QDGE6B"
};

let db = null;
let isFirebaseOnline = false;
const COLLECTION_NAME = "contacts";
const LOCAL_STORAGE_KEY = "nexus_contacts_cache";

// Try initializing Firebase
try {
    if (typeof firebase !== 'undefined') {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        db = firebase.firestore();
    }
} catch (err) {
    console.warn("Firebase initialization skipped or failed:", err);
}

// Sample mock data for instant preview when offline or fresh
const DEFAULT_CONTACTS = [
    {
        id: "mock-1",
        name: "Sarah Jenkins",
        mobile: "+1 (555) 382-9912",
        email: "sarah.jenkins@designcraft.io",
        category: "Work",
        details: "Principal Product Designer at DesignCraft. Leads mobile UX.",
        imageUrl: "",
        isFavorite: true,
        createdAt: new Date().toISOString()
    },
    {
        id: "mock-2",
        name: "Alexander Vance",
        mobile: "+1 (555) 720-4109",
        email: "alex.vance@techhorizon.co",
        category: "Work",
        details: "Senior Cloud Architect. AWS & Kubernetes specialist.",
        imageUrl: "",
        isFavorite: false,
        createdAt: new Date().toISOString()
    },
    {
        id: "mock-3",
        name: "Elena Rostova",
        mobile: "+1 (555) 831-2940",
        email: "elena.r@familycircle.net",
        category: "Family",
        details: "Cousin. Birthday: 14th November. Lives in Seattle.",
        imageUrl: "",
        isFavorite: true,
        createdAt: new Date().toISOString()
    },
    {
        id: "mock-4",
        name: "David Kim",
        mobile: "+1 (555) 492-8173",
        email: "david.kim@gmail.com",
        category: "Personal",
        details: "Weekend hiking & tennis partner.",
        imageUrl: "",
        isFavorite: false,
        createdAt: new Date().toISOString()
    }
];

// ==========================================================================
// 2. Application State & DOM References
// ==========================================================================
let allContacts = [];
let currentFilter = "all";
let currentSearchTerm = "";
let currentView = localStorage.getItem("nexus_view_mode") || "grid"; // "grid" | "list" | "table"
let showImages = localStorage.getItem("nexus_show_images") !== "false";
let editingContactId = null;
let currentImageBase64 = "";
let pendingDeleteId = null;

// DOM Elements
const syncStatusEl = document.getElementById("sync-status");
const gridViewEl = document.getElementById("grid-view");
const listViewEl = document.getElementById("list-view");
const tableViewEl = document.getElementById("table-view");
const contactsBodyEl = document.getElementById("contacts-body");
const emptyStateEl = document.getElementById("empty-state");
const searchInput = document.getElementById("search-input");
const searchClearBtn = document.getElementById("search-clear");
const filterChipsContainer = document.getElementById("filter-chips");
const viewGridBtn = document.getElementById("view-grid-btn");
const viewListBtn = document.getElementById("view-list-btn");
const viewTableBtn = document.getElementById("view-table-btn");
const toggleImagesBtn = document.getElementById("toggle-images-btn");
const toggleImagesText = document.getElementById("toggle-images-text");

// Stat elements
const statTotalEl = document.getElementById("stat-total");
const statFavoritesEl = document.getElementById("stat-favorites");
const statWorkEl = document.getElementById("stat-work");
const statPersonalEl = document.getElementById("stat-personal");

// Modal elements
const contactModal = document.getElementById("contact-modal");
const contactForm = document.getElementById("contact-form");
const modalTitle = document.getElementById("modal-title");
const modalSubtitle = document.getElementById("modal-subtitle");
const openAddBtn = document.getElementById("open-add-btn");
const emptyAddBtn = document.getElementById("empty-add-btn");
const modalCloseBtn = document.getElementById("modal-close");
const modalCancelBtn = document.getElementById("modal-cancel");
const saveBtn = document.getElementById("save-btn");

// Form fields
const nameInput = document.getElementById("name");
const mobileInput = document.getElementById("mobile");
const emailInput = document.getElementById("email");
const categorySelect = document.getElementById("category");
const favoriteInput = document.getElementById("favorite");
const detailsInput = document.getElementById("details");
const imageFileInput = document.getElementById("image");
const imagePreview = document.getElementById("image-preview");
const avatarPlaceholder = document.getElementById("avatar-placeholder");
const removeImageBtn = document.getElementById("remove-image-btn");

// Delete confirmation modal elements
const deleteModal = document.getElementById("delete-modal");
const deleteContactName = document.getElementById("delete-contact-name");
const deleteCancelBtn = document.getElementById("delete-cancel-btn");
const deleteConfirmBtn = document.getElementById("delete-confirm-btn");

// Export button
const exportBtn = document.getElementById("export-btn");

// ==========================================================================
// 3. Initialization & Real-time Listeners
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    initApp();
    setupEventListeners();
});

function initApp() {
    updateViewButtons();
    updateImageToggleButton();
    updateSyncBadge("connecting", "Connecting...");

    if (!db) {
        enableLocalStorageMode("Firebase unavailable. Running locally.");
        return;
    }

    // Try listening to Firestore
    try {
        db.collection(COLLECTION_NAME).orderBy("name").onSnapshot((snapshot) => {
            isFirebaseOnline = true;
            updateSyncBadge("online", "Firebase Synced");
            
            const fetched = [];
            snapshot.forEach((doc) => {
                fetched.push({ id: doc.id, ...doc.data() });
            });

            allContacts = fetched;
            // Backup locally
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(allContacts));
            render();
        }, (error) => {
            console.warn("Firestore onSnapshot error:", error);
            enableLocalStorageMode("Local Mode (Firebase permission/network issue)");
        });
    } catch (err) {
        console.warn("Firestore error:", err);
        enableLocalStorageMode("Local Storage Mode");
    }
}

function enableLocalStorageMode(message) {
    isFirebaseOnline = false;
    updateSyncBadge("offline", "Local Mode");
    
    // Load from local storage or mock
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
        try {
            allContacts = JSON.parse(cached);
        } catch (e) {
            allContacts = [...DEFAULT_CONTACTS];
        }
    } else {
        allContacts = [...DEFAULT_CONTACTS];
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(allContacts));
    }
    
    render();
    if (message) {
        showToast(message, "info");
    }
}

function updateSyncBadge(status, text) {
    if (!syncStatusEl) return;
    syncStatusEl.className = "sync-badge " + status;
    const textEl = syncStatusEl.querySelector(".status-text");
    if (textEl) textEl.textContent = text;
}

// ==========================================================================
// 4. Rendering Engine
// ==========================================================================
function render() {
    updateStats();

    // Filter contacts based on search and category
    const filtered = allContacts.filter((contact) => {
        // Category / Favorite filter
        if (currentFilter === "favorite" && !contact.isFavorite) {
            return false;
        } else if (currentFilter !== "all" && currentFilter !== "favorite" && contact.category !== currentFilter) {
            return false;
        }

        // Search term filter
        if (currentSearchTerm) {
            const term = currentSearchTerm.toLowerCase();
            const nameMatch = (contact.name || "").toLowerCase().includes(term);
            const mobileMatch = (contact.mobile || "").toLowerCase().includes(term);
            const emailMatch = (contact.email || "").toLowerCase().includes(term);
            const detailsMatch = (contact.details || "").toLowerCase().includes(term);
            const catMatch = (contact.category || "").toLowerCase().includes(term);
            return nameMatch || mobileMatch || emailMatch || detailsMatch || catMatch;
        }

        return true;
    });

    // Check empty state
    if (filtered.length === 0) {
        gridViewEl.style.display = "none";
        if (listViewEl) listViewEl.style.display = "none";
        tableViewEl.style.display = "none";
        emptyStateEl.style.display = "flex";
        
        const emptyTitle = document.getElementById("empty-title");
        const emptySubtitle = document.getElementById("empty-subtitle");
        if (currentSearchTerm || currentFilter !== "all") {
            emptyTitle.textContent = "No matching contacts";
            emptySubtitle.textContent = "Try changing your search terms or filter selection.";
        } else {
            emptyTitle.textContent = "Your contact list is empty";
            emptySubtitle.textContent = "Add your first contact to get started with Nexus Contacts.";
        }
        return;
    }

    emptyStateEl.style.display = "none";

    // Manage image visibility class
    const appContainer = document.querySelector(".app-container") || document.body;
    if (showImages) {
        appContainer.classList.remove("hide-images");
    } else {
        appContainer.classList.add("hide-images");
    }

    if (currentView === "grid") {
        gridViewEl.style.display = "grid";
        if (listViewEl) listViewEl.style.display = "none";
        tableViewEl.style.display = "none";
        renderGridView(filtered);
    } else if (currentView === "list") {
        gridViewEl.style.display = "none";
        if (listViewEl) listViewEl.style.display = "flex";
        tableViewEl.style.display = "none";
        renderListView(filtered);
    } else {
        gridViewEl.style.display = "none";
        if (listViewEl) listViewEl.style.display = "none";
        tableViewEl.style.display = "block";
        renderTableView(filtered);
    }
}

function renderGridView(contacts) {
    gridViewEl.innerHTML = "";

    contacts.forEach((contact) => {
        const card = document.createElement("div");
        const catKey = (contact.category || "other").toLowerCase();
        card.className = `contact-card card-cat-${catKey}`;

        const categoryClass = getCategoryBadgeClass(contact.category);
        const avatarEl = createAvatarElement(contact.name, contact.imageUrl);

        // Sanitize for security
        const nameEscaped = escapeHtml(contact.name || "Unnamed Contact");
        const mobileEscaped = escapeHtml(contact.mobile || "");
        const emailEscaped = escapeHtml(contact.email || "");
        const detailsEscaped = escapeHtml(contact.details || "");
        const categoryEscaped = escapeHtml(contact.category || "General");
        const cleanPhone = (contact.mobile || "").replace(/[^0-9+]/g, "");

        card.innerHTML = `
            <div class="card-top">
                <div class="clickable-contact" onclick="openContactDetails('${contact.id}')" title="Tap to view, edit or delete" style="display: flex; align-items: center; gap: 14px; flex: 1; min-width: 0;">
                    ${avatarEl}
                    <div class="card-name-group">
                        <h4 class="contact-name" title="${nameEscaped}">${nameEscaped}</h4>
                        <span class="contact-tag ${categoryClass}">${categoryEscaped}</span>
                    </div>
                </div>
                <button class="fav-btn ${contact.isFavorite ? 'is-favorite' : ''}" 
                        title="${contact.isFavorite ? 'Remove from favorites' : 'Mark as favorite'}" 
                        onclick="toggleFavorite('${contact.id}', event)">
                    <svg viewBox="0 0 24 24" fill="${contact.isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                </button>
            </div>

            <div class="card-info">
                ${mobileEscaped ? `
                    <a href="tel:${cleanPhone}" class="info-row" title="Click to call">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                        </svg>
                        <span class="info-text">${mobileEscaped}</span>
                    </a>
                ` : ''}

                ${emailEscaped ? `
                    <a href="mailto:${emailEscaped}" class="info-row" title="Click to email">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                            <polyline points="22,6 12,13 2,6"/>
                        </svg>
                        <span class="info-text">${emailEscaped}</span>
                    </a>
                ` : ''}

                ${detailsEscaped ? `
                    <div class="card-notes" title="${detailsEscaped}">${detailsEscaped}</div>
                ` : ''}
            </div>

            <div class="card-actions">
                <div class="action-group-left">
                    ${mobileEscaped ? `
                        <a href="tel:${cleanPhone}" class="action-icon-btn btn-call" title="Call ${nameEscaped}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                            </svg>
                        </a>
                        <a href="https://wa.me/${cleanPhone.replace('+', '')}" target="_blank" rel="noopener noreferrer" class="action-icon-btn btn-whatsapp" title="WhatsApp Message">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                            </svg>
                        </a>
                    ` : ''}
                    ${emailEscaped ? `
                        <a href="mailto:${emailEscaped}" class="action-icon-btn btn-email" title="Send Email">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                <polyline points="22,6 12,13 2,6"/>
                            </svg>
                        </a>
                    ` : ''}
                </div>

                <div class="action-group-right" style="display: flex; gap: 6px;">
                    <button class="action-icon-btn btn-edit" onclick="openEditModal('${contact.id}')" title="Edit Contact">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="action-icon-btn btn-delete" onclick="promptDelete('${contact.id}')" title="Delete Contact">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        gridViewEl.appendChild(card);
    });
}

function renderListView(contacts) {
    if (!listViewEl) return;
    listViewEl.innerHTML = "";

    contacts.forEach((contact) => {
        const item = document.createElement("div");
        const catKey = (contact.category || "other").toLowerCase();
        item.className = `contact-list-item card-cat-${catKey}`;

        const categoryClass = getCategoryBadgeClass(contact.category);
        const avatarEl = createAvatarElement(contact.name, contact.imageUrl, "46px");

        const nameEscaped = escapeHtml(contact.name || "Unnamed Contact");
        const mobileEscaped = escapeHtml(contact.mobile || "");
        const emailEscaped = escapeHtml(contact.email || "");
        const detailsEscaped = escapeHtml(contact.details || "");
        const categoryEscaped = escapeHtml(contact.category || "General");
        const cleanPhone = (contact.mobile || "").replace(/[^0-9+]/g, "");

        item.innerHTML = `
            <div class="list-item-left">
                <div class="clickable-contact" onclick="openContactDetails('${contact.id}')" title="Tap to view, edit or delete" style="display: flex; align-items: center; gap: 14px; flex: 1; min-width: 0;">
                    ${avatarEl}
                    <div class="list-item-info">
                        <div class="list-item-header">
                            <span class="list-item-name" title="${nameEscaped}">${nameEscaped}</span>
                            <span class="contact-tag ${categoryClass}">${categoryEscaped}</span>
                        </div>
                        ${detailsEscaped ? `<span class="list-item-notes" title="${detailsEscaped}">${detailsEscaped}</span>` : ''}
                    </div>
                </div>
                <button class="fav-btn ${contact.isFavorite ? 'is-favorite' : ''}" 
                        style="padding: 2px;"
                        title="${contact.isFavorite ? 'Remove from favorites' : 'Mark as favorite'}" 
                        onclick="toggleFavorite('${contact.id}', event)">
                    <svg viewBox="0 0 24 24" fill="${contact.isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                </button>
            </div>

            <div class="list-item-middle">
                ${mobileEscaped ? `
                    <a href="tel:${cleanPhone}" class="info-row" style="padding:0;" title="Call">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                        </svg>
                        <span>${mobileEscaped}</span>
                    </a>
                ` : ''}

                ${emailEscaped ? `
                    <a href="mailto:${emailEscaped}" class="info-row" style="padding:0;" title="Email">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                            <polyline points="22,6 12,13 2,6"/>
                        </svg>
                        <span>${emailEscaped}</span>
                    </a>
                ` : ''}
            </div>

            <div class="list-item-actions">
                ${mobileEscaped ? `
                    <a href="tel:${cleanPhone}" class="action-icon-btn btn-call" title="Call">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                        </svg>
                    </a>
                    <a href="https://wa.me/${cleanPhone.replace('+', '')}" target="_blank" rel="noopener noreferrer" class="action-icon-btn btn-whatsapp" title="WhatsApp">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                        </svg>
                    </a>
                ` : ''}
                ${emailEscaped ? `
                    <a href="mailto:${emailEscaped}" class="action-icon-btn btn-email" title="Send Email">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                            <polyline points="22,6 12,13 2,6"/>
                        </svg>
                    </a>
                ` : ''}
                <button class="action-icon-btn btn-edit" onclick="openEditModal('${contact.id}')" title="Edit Contact">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </button>
                <button class="action-icon-btn btn-delete" onclick="promptDelete('${contact.id}')" title="Delete Contact">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        `;

        listViewEl.appendChild(item);
    });
}

function renderTableView(contacts) {
    contactsBodyEl.innerHTML = "";

    contacts.forEach((contact) => {
        const tr = document.createElement("tr");
        const categoryClass = getCategoryBadgeClass(contact.category);
        const avatarEl = createAvatarElement(contact.name, contact.imageUrl, "38px");

        const nameEscaped = escapeHtml(contact.name || "Unnamed Contact");
        const mobileEscaped = escapeHtml(contact.mobile || "—");
        const emailEscaped = escapeHtml(contact.email || "—");
        const detailsEscaped = escapeHtml(contact.details || "—");
        const categoryEscaped = escapeHtml(contact.category || "General");
        const cleanPhone = (contact.mobile || "").replace(/[^0-9+]/g, "");

        tr.innerHTML = `
            <td class="table-avatar-cell clickable-contact" onclick="openContactDetails('${contact.id}')" title="Tap to view, edit or delete">${avatarEl}</td>
            <td>
                <div class="table-user-cell clickable-contact" onclick="openContactDetails('${contact.id}')" title="Tap to view, edit or delete">
                    <span class="table-name">${nameEscaped}</span>
                    ${contact.isFavorite ? `<span style="color:var(--warning);" title="Favorite">★</span>` : ''}
                </div>
            </td>
            <td>
                ${contact.mobile ? `
                    <a href="tel:${cleanPhone}" class="info-row" style="padding:0;">${mobileEscaped}</a>
                ` : '—'}
            </td>
            <td>
                ${contact.email ? `
                    <a href="mailto:${emailEscaped}" class="info-row" style="padding:0;">${emailEscaped}</a>
                ` : '—'}
            </td>
            <td><span class="contact-tag ${categoryClass}">${categoryEscaped}</span></td>
            <td><span style="font-size:0.8rem; color:var(--text-muted);">${detailsEscaped}</span></td>
            <td style="text-align: right;">
                <div style="display: inline-flex; gap: 6px; justify-content: flex-end;">
                    <button class="action-icon-btn" onclick="openEditModal('${contact.id}')" title="Edit">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="action-icon-btn btn-delete" onclick="promptDelete('${contact.id}')" title="Delete">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </td>
        `;

        contactsBodyEl.appendChild(tr);
    });
}

function updateStats() {
    const total = allContacts.length;
    const favorites = allContacts.filter(c => c.isFavorite).length;
    const work = allContacts.filter(c => c.category === "Work").length;
    const personal = allContacts.filter(c => c.category === "Personal" || c.category === "Family").length;

    statTotalEl.textContent = total;
    statFavoritesEl.textContent = favorites;
    statWorkEl.textContent = work;
    statPersonalEl.textContent = personal;
}

// ==========================================================================
// 5. Avatar & Color Utilities
// ==========================================================================
function getInitials(name) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const GRADIENTS = [
    "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)",
    "linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #6366f1 100%)",
    "linear-gradient(135deg, #f43f5e 0%, #fb7185 50%, #fb923c 100%)",
    "linear-gradient(135deg, #10b981 0%, #14b8a6 50%, #06b6d4 100%)",
    "linear-gradient(135deg, #8b5cf6 0%, #c084fc 50%, #f472b6 100%)",
    "linear-gradient(135deg, #f59e0b 0%, #fbbf24 50%, #f97316 100%)",
    "linear-gradient(135deg, #0ea5e9 0%, #2dd4bf 100%)",
    "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)"
];

function getGradientForName(name) {
    let hash = 0;
    for (let i = 0; i < (name || "").length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % GRADIENTS.length;
    return GRADIENTS[index];
}

function createAvatarElement(name, imageUrl, customSize = null) {
    const sizeStyle = customSize ? `style="width:${customSize}; height:${customSize}; font-size:0.85rem;"` : '';
    if (imageUrl) {
        return `<img src="${imageUrl}" class="contact-avatar" alt="${escapeHtml(name)}" ${sizeStyle}>`;
    }
    const initials = getInitials(name);
    const gradient = getGradientForName(name);
    const style = customSize 
        ? `style="background:${gradient}; width:${customSize}; height:${customSize}; font-size:0.85rem;"`
        : `style="background:${gradient};"`;

    return `<div class="avatar-initials" ${style}>${initials}</div>`;
}

function getCategoryBadgeClass(category) {
    switch ((category || "").toLowerCase()) {
        case "work": return "tag-work";
        case "personal": return "tag-personal";
        case "family": return "tag-family";
        default: return "tag-other";
    }
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ==========================================================================
// 6. Modal & Form Handling
// ==========================================================================
function openAddModal() {
    editingContactId = null;
    currentImageBase64 = "";
    contactForm.reset();
    
    modalTitle.textContent = "Add New Contact";
    modalSubtitle.textContent = "Enter details for the new contact person";
    saveBtn.querySelector("span").textContent = "Save Contact";
    
    imagePreview.style.display = "none";
    imagePreview.src = "";
    avatarPlaceholder.style.display = "flex";
    removeImageBtn.style.display = "none";

    showModal();
    nameInput.focus();
}

function openEditModal(id) {
    const contact = allContacts.find(c => c.id === id);
    if (!contact) return;

    editingContactId = id;
    currentImageBase64 = contact.imageUrl || "";

    modalTitle.textContent = "Edit Contact";
    modalSubtitle.textContent = "Update contact profile details";
    saveBtn.querySelector("span").textContent = "Update Contact";

    nameInput.value = contact.name || "";
    mobileInput.value = contact.mobile || "";
    emailInput.value = contact.email || "";
    categorySelect.value = contact.category || "Personal";
    favoriteInput.checked = Boolean(contact.isFavorite);
    detailsInput.value = contact.details || "";

    if (contact.imageUrl) {
        imagePreview.src = contact.imageUrl;
        imagePreview.style.display = "block";
        avatarPlaceholder.style.display = "none";
        removeImageBtn.style.display = "inline-flex";
    } else {
        imagePreview.style.display = "none";
        imagePreview.src = "";
        avatarPlaceholder.style.display = "flex";
        removeImageBtn.style.display = "none";
    }

    showModal();
    nameInput.focus();
}

function showModal() {
    contactModal.classList.add("active");
    contactModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function closeModal() {
    contactModal.classList.remove("active");
    contactModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    editingContactId = null;
}

// Image File Processing
imageFileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        showToast("Please choose a valid image file", "error");
        return;
    }

    try {
        const base64 = await resizeImageToBase64(file, 400, 400, 0.75);
        currentImageBase64 = base64;
        imagePreview.src = base64;
        imagePreview.style.display = "block";
        avatarPlaceholder.style.display = "none";
        removeImageBtn.style.display = "inline-flex";
    } catch (err) {
        console.error("Image processing error:", err);
        showToast("Failed to process image.", "error");
    }
});

removeImageBtn.addEventListener("click", () => {
    currentImageBase64 = "";
    imageFileInput.value = "";
    imagePreview.src = "";
    imagePreview.style.display = "none";
    avatarPlaceholder.style.display = "flex";
    removeImageBtn.style.display = "none";
});

// Save Contact (Add or Update)
contactForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = nameInput.value.trim();
    const mobile = mobileInput.value.trim();
    const email = emailInput.value.trim();
    const category = categorySelect.value;
    const isFavorite = favoriteInput.checked;
    const details = detailsInput.value.trim();

    if (!name || !mobile) {
        showToast("Name and phone number are required.", "error");
        return;
    }

    const submitBtn = saveBtn;
    const originalText = submitBtn.querySelector("span").textContent;
    submitBtn.disabled = true;
    submitBtn.querySelector("span").textContent = "Saving...";

    const contactData = {
        name,
        mobile,
        email,
        category,
        isFavorite,
        details,
        imageUrl: currentImageBase64 || "",
        updatedAt: new Date().toISOString()
    };

    try {
        if (isFirebaseOnline && db) {
            if (editingContactId) {
                await db.collection(COLLECTION_NAME).doc(editingContactId).update(contactData);
                showToast("Contact updated successfully!", "success");
            } else {
                contactData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection(COLLECTION_NAME).add(contactData);
                showToast("Contact added successfully!", "success");
            }
        } else {
            // LocalStorage Mode
            if (editingContactId) {
                const index = allContacts.findIndex(c => c.id === editingContactId);
                if (index !== -1) {
                    allContacts[index] = { ...allContacts[index], ...contactData };
                }
                showToast("Contact updated locally!", "success");
            } else {
                const newContact = {
                    id: "local_" + Date.now(),
                    ...contactData,
                    createdAt: new Date().toISOString()
                };
                allContacts.unshift(newContact);
                showToast("Contact saved locally!", "success");
            }
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(allContacts));
            render();
        }

        closeModal();
    } catch (err) {
        console.error("Save error:", err);
        // Fallback to local save if Firebase failed mid-flight
        if (editingContactId) {
            const index = allContacts.findIndex(c => c.id === editingContactId);
            if (index !== -1) {
                allContacts[index] = { ...allContacts[index], ...contactData };
            }
        } else {
            allContacts.unshift({ id: "local_" + Date.now(), ...contactData, createdAt: new Date().toISOString() });
        }
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(allContacts));
        render();
        closeModal();
        showToast("Saved locally (Cloud connection failed).", "info");
    } finally {
        submitBtn.disabled = false;
        submitBtn.querySelector("span").textContent = originalText;
    }
});

// ==========================================================================
// 7. Favorite Toggle & Quick Actions
// ==========================================================================
async function toggleFavorite(id, event) {
    if (event) event.stopPropagation();

    const contact = allContacts.find(c => c.id === id);
    if (!contact) return;

    const newFavState = !contact.isFavorite;
    contact.isFavorite = newFavState;

    // Optimistic UI update
    render();

    try {
        if (isFirebaseOnline && db) {
            await db.collection(COLLECTION_NAME).doc(id).update({
                isFavorite: newFavState,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(allContacts));
        }
        showToast(newFavState ? "Marked as favorite ★" : "Removed from favorites", "info");
    } catch (err) {
        console.warn("Error updating favorite status:", err);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(allContacts));
    }
}

// ==========================================================================
// 8. Delete Confirmation Modal
// ==========================================================================
function promptDelete(id) {
    const contact = allContacts.find(c => c.id === id);
    if (!contact) return;

    pendingDeleteId = id;
    deleteContactName.textContent = `"${contact.name || 'this contact'}"`;
    deleteModal.classList.add("active");
    deleteModal.setAttribute("aria-hidden", "false");
}

function closeDeleteModal() {
    deleteModal.classList.remove("active");
    deleteModal.setAttribute("aria-hidden", "true");
    pendingDeleteId = null;
}

deleteCancelBtn.addEventListener("click", closeDeleteModal);

deleteConfirmBtn.addEventListener("click", async () => {
    if (!pendingDeleteId) return;

    const id = pendingDeleteId;
    closeDeleteModal();

    try {
        if (isFirebaseOnline && db) {
            await db.collection(COLLECTION_NAME).doc(id).delete();
            showToast("Contact deleted from cloud.", "success");
        } else {
            allContacts = allContacts.filter(c => c.id !== id);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(allContacts));
            render();
            showToast("Contact deleted.", "success");
        }
    } catch (err) {
        console.error("Delete error:", err);
        allContacts = allContacts.filter(c => c.id !== id);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(allContacts));
        render();
        showToast("Deleted locally.", "info");
    }
});

// ==========================================================================
// 8. Mobile Contact Details & Action Sheet
// ==========================================================================
function openContactDetails(id) {
    const contact = allContacts.find(c => c.id === id);
    if (!contact) return;

    const sheetModal = document.getElementById("contact-details-modal");
    const avatarWrap = document.getElementById("sheet-avatar-wrap");
    const nameEl = document.getElementById("sheet-name");
    const catEl = document.getElementById("sheet-category");
    const favBadge = document.getElementById("sheet-fav-badge");
    const callBtn = document.getElementById("sheet-call-btn");
    const whatsappBtn = document.getElementById("sheet-whatsapp-btn");
    const emailBtn = document.getElementById("sheet-email-btn");
    const phoneVal = document.getElementById("sheet-phone-val");
    const emailVal = document.getElementById("sheet-email-val");
    const detailsVal = document.getElementById("sheet-details-val");
    const editBtn = document.getElementById("sheet-edit-btn");
    const deleteBtn = document.getElementById("sheet-delete-btn");
    const closeBtn = document.getElementById("sheet-close-btn");

    if (!sheetModal) return;

    const cleanPhone = (contact.mobile || "").replace(/[^0-9+]/g, "");

    // Populate data
    avatarWrap.innerHTML = createAvatarElement(contact.name, contact.imageUrl, "80px");
    nameEl.textContent = contact.name || "Unnamed Contact";
    catEl.textContent = contact.category || "General";
    catEl.className = `contact-tag ${getCategoryBadgeClass(contact.category)}`;

    favBadge.style.display = contact.isFavorite ? "inline" : "none";

    // Direct Quick Communication
    if (cleanPhone) {
        callBtn.href = `tel:${cleanPhone}`;
        callBtn.style.display = "flex";
        whatsappBtn.href = `https://wa.me/${cleanPhone.replace('+', '')}`;
        whatsappBtn.style.display = "flex";
        phoneVal.textContent = contact.mobile;
    } else {
        callBtn.style.display = "none";
        whatsappBtn.style.display = "none";
        phoneVal.textContent = "—";
    }

    if (contact.email) {
        emailBtn.href = `mailto:${contact.email}`;
        emailBtn.style.display = "flex";
        emailVal.textContent = contact.email;
    } else {
        emailBtn.style.display = "none";
        emailVal.textContent = "—";
    }

    detailsVal.textContent = contact.details || "No notes added.";

    // Action buttons for Update & Delete
    editBtn.onclick = () => {
        closeContactDetails();
        openEditModal(contact.id);
    };

    deleteBtn.onclick = () => {
        closeContactDetails();
        promptDelete(contact.id);
    };

    closeBtn.onclick = closeContactDetails;

    sheetModal.classList.add("active");
    sheetModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function closeContactDetails() {
    const sheetModal = document.getElementById("contact-details-modal");
    if (!sheetModal) return;
    sheetModal.classList.remove("active");
    sheetModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}

// ==========================================================================
// 9. Export to CSV
// ==========================================================================
exportBtn.addEventListener("click", () => {
    if (allContacts.length === 0) {
        showToast("No contacts to export.", "error");
        return;
    }

    const headers = ["Name", "Mobile", "Email", "Category", "Favorite", "Details", "Created At"];
    const rows = allContacts.map(c => [
        `"${(c.name || '').replace(/"/g, '""')}"`,
        `"${(c.mobile || '').replace(/"/g, '""')}"`,
        `"${(c.email || '').replace(/"/g, '""')}"`,
        `"${(c.category || '').replace(/"/g, '""')}"`,
        c.isFavorite ? "Yes" : "No",
        `"${(c.details || '').replace(/"/g, '""')}"`,
        `"${(c.createdAt || '').toString()}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `nexus_contacts_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("Contacts exported to CSV!", "success");
});

// ==========================================================================
// 10. Search, Filters & View Switching
// ==========================================================================
function setupEventListeners() {
    // Open add modal
    openAddBtn.addEventListener("click", openAddModal);
    emptyAddBtn.addEventListener("click", openAddModal);
    modalCloseBtn.addEventListener("click", closeModal);
    modalCancelBtn.addEventListener("click", closeModal);

    // Click outside modal to close
    contactModal.addEventListener("click", (e) => {
        if (e.target === contactModal) closeModal();
    });
    deleteModal.addEventListener("click", (e) => {
        if (e.target === deleteModal) closeDeleteModal();
    });
    const sheetModal = document.getElementById("contact-details-modal");
    if (sheetModal) {
        sheetModal.addEventListener("click", (e) => {
            if (e.target === sheetModal) closeContactDetails();
        });
    }

    // Keyboard shortcuts: ESC closes modal, Ctrl+K focuses search
    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            if (contactModal.classList.contains("active")) closeModal();
            if (deleteModal.classList.contains("active")) closeDeleteModal();
            if (sheetModal && sheetModal.classList.contains("active")) closeContactDetails();
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
            e.preventDefault();
            searchInput.focus();
        }
    });

    // Search input
    searchInput.addEventListener("input", (e) => {
        currentSearchTerm = e.target.value.trim();
        searchClearBtn.style.display = currentSearchTerm ? "flex" : "none";
        render();
    });

    searchClearBtn.addEventListener("click", () => {
        searchInput.value = "";
        currentSearchTerm = "";
        searchClearBtn.style.display = "none";
        searchInput.focus();
        render();
    });

    // Category Filter Chips
    filterChipsContainer.addEventListener("click", (e) => {
        const chip = e.target.closest(".chip");
        if (!chip) return;

        filterChipsContainer.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");

        currentFilter = chip.dataset.category;
        render();
    });

    // Stat card quick filters
    document.querySelectorAll(".stat-card").forEach(card => {
        card.addEventListener("click", () => {
            const filter = card.dataset.filter;
            if (!filter) return;

            currentFilter = filter;
            filterChipsContainer.querySelectorAll(".chip").forEach(c => {
                c.classList.toggle("active", c.dataset.category === filter);
            });
            render();
        });
    });

    // View Switcher (Grid, List, Table)
    if (viewGridBtn) {
        viewGridBtn.addEventListener("click", () => {
            currentView = "grid";
            localStorage.setItem("nexus_view_mode", "grid");
            updateViewButtons();
            render();
        });
    }

    if (viewListBtn) {
        viewListBtn.addEventListener("click", () => {
            currentView = "list";
            localStorage.setItem("nexus_view_mode", "list");
            updateViewButtons();
            render();
        });
    }

    if (viewTableBtn) {
        viewTableBtn.addEventListener("click", () => {
            currentView = "table";
            localStorage.setItem("nexus_view_mode", "table");
            updateViewButtons();
            render();
        });
    }

    // Toggle Images (With / Without Image)
    if (toggleImagesBtn) {
        toggleImagesBtn.addEventListener("click", () => {
            showImages = !showImages;
            localStorage.setItem("nexus_show_images", showImages);
            updateImageToggleButton();
            showToast(showImages ? "Showing contact photos" : "Photos hidden (Clean compact mode)", "info");
            render();
        });
    }
}

function updateViewButtons() {
    if (viewGridBtn) viewGridBtn.classList.toggle("active", currentView === "grid");
    if (viewListBtn) viewListBtn.classList.toggle("active", currentView === "list");
    if (viewTableBtn) viewTableBtn.classList.toggle("active", currentView === "table");
}

function updateImageToggleButton() {
    if (!toggleImagesBtn || !toggleImagesText) return;
    if (showImages) {
        toggleImagesBtn.classList.remove("active-off");
        toggleImagesText.textContent = "With Images";
        toggleImagesBtn.title = "Photos are currently Visible. Click to hide photos.";
    } else {
        toggleImagesBtn.classList.add("active-off");
        toggleImagesText.textContent = "Without Images";
        toggleImagesBtn.title = "Photos are currently Hidden. Click to show photos.";
    }
}

// Table sort helper
let sortDirection = 1;
function handleSort(field) {
    if (field === "name") {
        allContacts.sort((a, b) => {
            const nameA = (a.name || "").toLowerCase();
            const nameB = (b.name || "").toLowerCase();
            return sortDirection * nameA.localeCompare(nameB);
        });
        sortDirection = -sortDirection;
        render();
    }
}

// ==========================================================================
// 11. Image Processing & Canvas Compression Helper
// ==========================================================================
function resizeImageToBase64(file, maxWidth, maxHeight, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round(height * (maxWidth / width));
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round(width * (maxHeight / height));
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL("image/jpeg", quality);
                resolve(dataUrl);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

// ==========================================================================
// 12. Toast Notification System
// ==========================================================================
function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    let iconSvg = "";
    if (type === "success") {
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === "error") {
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    } else {
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    toast.innerHTML = `
        <div class="toast-icon">${iconSvg}</div>
        <div class="toast-message">${escapeHtml(message)}</div>
    `;

    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    // Auto dismiss
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }, 3500);
}

// ==========================================================================
// 13. PWA Installation & Service Worker Registration
// ==========================================================================
let deferredInstallPrompt = null;
const installPwaBtn = document.getElementById("install-pwa-btn");

// Register Service Worker for offline capability & PWA installability
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js")
            .then((reg) => console.log("Nexus ServiceWorker registered:", reg.scope))
            .catch((err) => console.warn("ServiceWorker registration error:", err));
    });
}

// Android / Chrome Install Prompt
window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (installPwaBtn) {
        installPwaBtn.style.display = "inline-flex";
    }
});

if (installPwaBtn) {
    installPwaBtn.addEventListener("click", async () => {
        if (!deferredInstallPrompt) {
            showToast("To install, tap your browser menu (⋮) and select 'Install app' or 'Add to Home Screen'.", "info");
            return;
        }
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        if (outcome === "accepted") {
            showToast("Nexus Contacts is being installed on your device!", "success");
            installPwaBtn.style.display = "none";
        }
        deferredInstallPrompt = null;
    });
}

window.addEventListener("appinstalled", () => {
    showToast("Nexus Contacts installed successfully! Check your app drawer.", "success");
    if (installPwaBtn) installPwaBtn.style.display = "none";
});
