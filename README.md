# 📇 Nexus Contacts — Modern Contact Directory

A responsive, colorful contact manager web application with real-time Firebase Cloud Firestore sync and an offline LocalStorage fallback.

![Nexus Contacts](https://img.shields.io/badge/Status-Active-brightgreen)
![License](https://img.shields.io/badge/License-MIT-blue.svg)

---

## ✨ Features

- **🌈 Ultra-Vibrant Modern UI**: Aurora mesh gradient backgrounds, glassmorphic frosted cards, and category-themed gradient accents.
- **⚡ Dual-Engine Database**:
  - **Firebase Cloud Firestore**: Real-time multi-device cloud synchronization.
  - **Local Storage Fallback**: Seamless offline backup with automatic failover so the app works anywhere without crashing.
- **📐 3 Display View Modes**:
  - **Grid View**: Vibrant 2D card grid with glowing category accents.
  - **List View**: Streamlined horizontal rows for fast scanning.
  - **Table View**: Tabular spreadsheet layout with sortable headers.
- **🖼️ Image Display Toggle**: Instant switch between **"With Images"** and clean compact **"Without Images"** mode (preference saved in LocalStorage).
- **📱 100% Mobile Optimized**:
  - **One-Tap Action Sheet**: Tap any contact name or avatar on mobile to slide up the quick-action bottom sheet.
  - Large 42px+ thumb-friendly tap targets.
  - iOS Safari 16px auto-zoom prevention.
- **⚡ Instant Quick Actions**:
  - 📞 **Direct Phone Call** (`tel:`)
  - 💬 **WhatsApp Direct Chat** (`https://wa.me/`)
  - ✉️ **Email** (`mailto:`)
  - ⭐ **Favorites Star** toggle
  - ✏️ **Edit / Update Contact**
  - 🗑️ **Delete Contact** with safe confirmation modal
- **🔍 Real-Time Search & Filters**: Instant debounced search-as-you-type with category chips (*All, Favorites, Work, Personal, Family, Other*) and keyboard shortcut (`Ctrl+K`).
- **📥 CSV Export**: One-click contacts backup to standard CSV format.
- **🔒 Security**: Strictly sanitized output preventing Cross-Site Scripting (XSS).

---

## 🚀 Quick Start

### 1. Run Locally
You can open `index.html` directly in any web browser, or serve it locally:

```bash
# Using Python 3
python3 -m http.server 8080

# Using Node.js (npx)
npx serve .
```

Then visit `http://localhost:8080` in your browser.

---

## 🛠️ Tech Stack

- **HTML5** (Semantic markup, accessible modal dialogs)
- **CSS3** (CSS Custom Properties, Glassmorphism, Responsive Grid & Flexbox, Media Queries)
- **JavaScript ES6+** (Modular architecture, HTML5 Canvas image compression, XSS-safe DOM generation)
- **Firebase SDK 9.x Compat** (Cloud Firestore real-time listener & storage)
