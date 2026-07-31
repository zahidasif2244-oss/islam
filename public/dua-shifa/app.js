/**
 * دعا اور شفا - Shared JavaScript
 * Backend integration (Mock), Auth, Dark Mode, Utilities
 */

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
    DEFAULT_REDIRECT: 'login.html',
    ADMIN_PAGES: ['post_dashboard.html', 'category_dashboard.html', 'create_post.html']
};

// ============================================================================
// Initialize Backend (Firebase)
// ============================================================================

const firebaseConfig = {
    apiKey: "AIzaSyD6lJRyGvfPY38rxtadFjnLzcgRFGKbbPg",
    authDomain: "shifa-f9ec6.firebaseapp.com",
    projectId: "shifa-f9ec6",
    databaseURL: "https://shifa-f9ec6-default-rtdb.asia-southeast1.firebasedatabase.app",
    storageBucket: "shifa-f9ec6.firebasestorage.app",
    messagingSenderId: "124626532829",
    appId: "1:124626532829:web:14e486114bb8af7fb3de34",
    measurementId: "G-EXQDFE394C"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// Backend Initialization Waiter
async function waitForBackend() {
    return new Promise((resolve) => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            unsubscribe();
            resolve(user);
        });
    });
}

// ============================================================================
// Authentication
// ============================================================================

const Auth = {
    // Check if user is authenticated
    async checkSession() {
        return auth.currentUser;
    },

    // Require auth - redirect if not logged in
    async requireAuth() {
        return new Promise((resolve) => {
            const unsubscribe = auth.onAuthStateChanged((user) => {
                unsubscribe();
                if (!user) {
                    window.location.href = CONFIG.DEFAULT_REDIRECT;
                    resolve(null);
                } else {
                    resolve(user);
                }
            });
        });
    },

    // Redirect if already logged in
    async redirectIfAuthenticated(redirectUrl = 'post_dashboard.html') {
        return new Promise((resolve) => {
            const unsubscribe = auth.onAuthStateChanged((user) => {
                unsubscribe();
                if (user) {
                    window.location.href = redirectUrl;
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
        });
    },

    // Login with email/password
    async login(email, password) {
        try {
            console.log('Attempting login for:', email);
            const result = await auth.signInWithEmailAndPassword(email, password);
            console.log('Login successful:', result.user.email);
            return { data: { user: result.user }, error: null };
        } catch (error) {
            console.error('Login error code:', error.code);
            console.error('Login error message:', error.message);

            let message = 'برائے مہربانی درست ای میل اور پاس ورڈ درج کریں';
            if (error.code === 'auth/user-not-found') {
                message = 'اس ای میل کے ساتھ کوئی صارف نہیں ملا';
            } else if (error.code === 'auth/wrong-password') {
                message = 'پاس ورڈ درست نہیں ہے';
            } else if (error.code === 'auth/too-many-requests') {
                message = 'بہت زیادہ ناکام کوششیں، براہ کرم تھوڑی دیر بعد کوشش کریں';
            } else if (error.code === 'auth/network-request-failed') {
                message = 'انٹرنیٹ کنکشن کا مسئلہ ہے';
            }

            return { data: null, error: { message, code: error.code } };
        }
    },

    // Logout
    async logout() {
        await auth.signOut();
        window.location.href = 'login.html';
    },

    // Get current user
    async getUser() {
        return auth.currentUser;
    }
};

// ============================================================================
// Dark Mode
// ============================================================================

const Theme = {
    STORAGE_KEY: 'theme',

    // Initialize dark mode
    init() {
        console.log('Theme.init() called');
        const savedTheme = localStorage.getItem(this.STORAGE_KEY);
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        console.log('Saved theme:', savedTheme, 'Prefers dark:', prefersDark);

        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            document.documentElement.classList.add('dark');
            console.log('Dark mode enabled');
        } else {
            document.documentElement.classList.remove('dark');
            console.log('Light mode enabled');
        }

        this.setupToggle();
        this.updateIcon();
    },

    // Setup toggle button
    setupToggle() {
        const toggleBtn = document.getElementById('darkModeToggle');
        if (!toggleBtn) {
            console.warn('Dark mode toggle button not found');
            return;
        }

        // Prevent multiple listeners
        if (toggleBtn.dataset.listenerAdded) return;

        console.log('Setting up dark mode toggle');

        toggleBtn.addEventListener('click', () => {
            console.log('Dark mode toggle clicked');
            const isDark = document.documentElement.classList.toggle('dark');
            localStorage.setItem(this.STORAGE_KEY, isDark ? 'dark' : 'light');

            console.log('Dark mode:', isDark);
            this.updateIcon();
        });

        toggleBtn.dataset.listenerAdded = 'true';
    },

    // Update icon based on current mode
    updateIcon() {
        const toggleBtn = document.getElementById('darkModeToggle');
        if (!toggleBtn) return;

        const icon = toggleBtn.querySelector('.material-symbols-outlined');
        if (icon) {
            const isDark = document.documentElement.classList.contains('dark');
            icon.textContent = isDark ? 'dark_mode' : 'light_mode';
            console.log('Icon updated to:', icon.textContent);
        }
    },

    // Check if dark mode is active
    isDark() {
        return document.documentElement.classList.contains('dark');
    }
};

// Helper to handle dates from RTDB and map schema variations
const fromRTDB = (data) => {
    if (!data) return data;
    const result = { ...data };

    // Map schema variations (for data manually added in console)
    if (result.image && !result.image_url) result.image_url = result.image;
    if (result.category && (typeof result.category === 'string') && (!result.categories || !result.categories.name)) {
        result.categories = { name: result.category };
    }
    if (result.createdAt && !result.created_at) result.created_at = result.createdAt;
    if (result.date && !result.created_at) result.created_at = result.date;

    Object.keys(result).forEach(key => {
        if (typeof result[key] === 'number' && result[key] > 1000000000000) {
            result[key] = new Date(result[key]).toISOString();
        }
    });
    return result;
};

// ============================================================================
// Categories API
// ============================================================================

const Categories = {
    // Get all categories
    async getAll(status = 'active') {
        try {
            const snapshot = await db.ref('categories').once('value');
            const data = [];
            snapshot.forEach(child => {
                const item = child.val();
                if (!status || item.status === status) {
                    data.push({ id: child.key, ...item });
                }
            });
            return { data: data.sort((a, b) => a.name.localeCompare(b.name)), error: null };
        } catch (error) {
            console.error('Error getting categories:', error);
            return { data: [], error };
        }
    },

    // Get single category
    async getById(id) {
        try {
            const snapshot = await db.ref('categories/' + id).once('value');
            if (snapshot.exists()) {
                return { data: { id: snapshot.key, ...snapshot.val() }, error: null };
            }
            return { data: null, error: { message: 'زمرہ نہیں ملا' } };
        } catch (error) {
            return { data: null, error };
        }
    },

    // Create category
    async create(categoryData) {
        try {
            const newRef = db.ref('categories').push();
            const data = {
                ...categoryData,
                user_id: auth.currentUser?.uid || 'anonymous',
                created_at: firebase.database.ServerValue.TIMESTAMP
            };
            await newRef.set(data);
            return { data: [{ id: newRef.key, ...data }], error: null };
        } catch (error) {
            return { data: null, error };
        }
    },

    // Update category
    async update(id, categoryData) {
        try {
            await db.ref('categories/' + id).update(categoryData);
            return { error: null };
        } catch (error) {
            return { error };
        }
    },

    // Delete category
    async delete(id) {
        try {
            await db.ref('categories/' + id).remove();
            return { error: null };
        } catch (error) {
            return { error };
        }
    },

    // Populate select dropdown
    populateSelect(selectElement, categories, includeEmpty = true) {
        if (!selectElement) return;

        let html = includeEmpty ? '<option value="">زمرہ منتخب کریں</option>' : '';
        html += categories.map(c =>
            `<option value="${c.id}">${c.name}</option>`
        ).join('');

        selectElement.innerHTML = html;
    }
};

// ============================================================================
// Posts API
// ============================================================================

const Posts = {
    // Get all posts
    async getAll(filter = 'all') {
        try {
            const snapshot = await db.ref('posts').once('value');
            const data = [];
            snapshot.forEach(child => {
                const item = fromRTDB(child.val());
                const status = item.status || 'published'; // Default to published
                if (filter === 'all' || status === filter) {
                    data.push({ id: child.key, ...item, status });
                }
            });
            return { data: data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)), error: null };
        } catch (error) {
            console.error('Error getting posts:', error);
            return { data: [], error };
        }
    },

    // Get post by ID
    async getById(id) {
        try {
            const snapshot = await db.ref('posts/' + id).once('value');
            if (snapshot.exists()) {
                return { data: { id: snapshot.key, ...fromRTDB(snapshot.val()) }, error: null };
            }
            return { data: null, error: { message: 'پوسٹ نہیں ملی' } };
        } catch (error) {
            return { data: null, error };
        }
    },

    // Create post
    async create(postData) {
        try {
            if (!postData.categories || !postData.categories.name) {
                if (postData.category_id) {
                    const snapshot = await db.ref('categories/' + postData.category_id).once('value');
                    postData.categories = { name: snapshot.exists() ? snapshot.val().name : 'عام' };
                } else {
                    postData.categories = { name: 'عام' };
                }
            }

            const newRef = db.ref('posts').push();
            const data = {
                ...postData,
                user_id: auth.currentUser?.uid || 'anonymous',
                created_at: firebase.database.ServerValue.TIMESTAMP
            };
            await newRef.set(data);

            // Get fresh data to return correct timestamp formatted
            const freshSnapshot = await newRef.once('value');
            return { data: [{ id: newRef.key, ...fromRTDB(freshSnapshot.val()) }], error: null };
        } catch (error) {
            console.error('Error creating post:', error);
            return { data: null, error };
        }
    },

    // Update post
    async update(id, postData) {
        try {
            if (postData.category_id && (!postData.categories || !postData.categories.name)) {
                const snapshot = await db.ref('categories/' + postData.category_id).once('value');
                postData.categories = { name: snapshot.exists() ? snapshot.val().name : 'عام' };
            }

            await db.ref('posts/' + id).update(postData);
            return { error: null };
        } catch (error) {
            return { error };
        }
    },

    // Delete post
    async delete(id) {
        try {
            await db.ref('posts/' + id).remove();
            return { error: null };
        } catch (error) {
            return { error };
        }
    },

    // Get post stats
    async getStats() {
        try {
            const snapshot = await db.ref('posts').once('value');
            let total = 0, published = 0, draft = 0, archived = 0;
            snapshot.forEach(child => {
                const p = child.val();
                total++;
                if (p.status === 'published') published++;
                else if (p.status === 'draft') draft++;
                else if (p.status === 'archived') archived++;
            });
            return { data: { total, published, draft, archived }, error: null };
        } catch (error) {
            return { data: null, error };
        }
    }
};

// ============================================================================
// UI Utilities
// ============================================================================

const UI = {
    // Show toast notification
    toast(message, type = 'info', duration = 3000) {
        // Remove existing toasts
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        document.body.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.style.transform = 'translateY(0)';
            toast.style.opacity = '1';
        });

        // Remove after duration
        setTimeout(() => {
            toast.style.transform = 'translateY(100%)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    // Confirm dialog
    confirm(message) {
        return window.confirm(message);
    },

    // Set loading state on button
    setButtonLoading(button, loadingText = 'انتظار کریں...') {
        button.disabled = true;
        button.dataset.originalHtml = button.innerHTML;
        button.innerHTML = `<span class="material-symbols-outlined animate-spin">refresh</span><span>${loadingText}</span>`;
    },

    // Reset button state
    resetButton(button) {
        button.disabled = false;
        if (button.dataset.originalHtml) {
            button.innerHTML = button.dataset.originalHtml;
        }
    },

    // Toggle element visibility
    toggle(elementId, show) {
        const element = document.getElementById(elementId);
        if (!element) return;

        if (show) {
            element.classList.remove('hidden');
        } else {
            element.classList.add('hidden');
        }
    },

    // Format date to Urdu locale
    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('ur-PK');
    },

    // Format status text
    formatStatus(status) {
        const statusMap = {
            'published': 'شائع شدہ',
            'draft': 'ڈرافٹ',
            'archived': 'محفوظ',
            'active': 'فعال',
            'inactive': 'غیر فعال'
        };
        return statusMap[status] || status;
    },

    // Get status badge class
    getStatusClass(status) {
        const classMap = {
            'published': 'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-900/20 dark:text-green-400',
            'draft': 'bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-900/20 dark:text-orange-400',
            'archived': 'bg-slate-50 text-slate-600 ring-slate-500/10 dark:bg-slate-400/10 dark:text-slate-400',
            'active': 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
            'inactive': 'bg-slate-50 text-slate-600 dark:bg-slate-400/10 dark:text-slate-400'
        };
        return classMap[status] || '';
    }
};

// ============================================================================
// Search Utilities
// ============================================================================

const Search = {
    // Filter table rows
    filterTable(searchInputId, tableBodyId) {
        const input = document.getElementById(searchInputId);
        const tbody = document.getElementById(tableBodyId);
        if (!input || !tbody) return;

        input.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const rows = tbody.querySelectorAll('tr');

            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(term) ? '' : 'none';
            });
        });
    },

    // Generic array filter
    filterArray(array, searchTerm, keys = ['name', 'title']) {
        if (!searchTerm) return array;

        const term = searchTerm.toLowerCase();
        return array.filter(item => {
            return keys.some(key => {
                const value = item[key];
                return value && value.toString().toLowerCase().includes(term);
            });
        });
    }
};

// ============================================================================
// Image Utilities
// ============================================================================

const ImageUtils = {
    // Preview image from URL
    preview(url, imgElementId) {
        const img = document.getElementById(imgElementId);
        if (!img) return;

        if (url) {
            img.src = url;
            img.classList.remove('hidden');
            img.onerror = () => {
                img.classList.add('hidden');
                UI.toast('تصویر لوڈ نہیں ہو سکی', 'error');
            };
        } else {
            img.classList.add('hidden');
        }
    },

    // Validate image URL
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }
};

// ============================================================================
// Form Utilities
// ============================================================================

const Forms = {
    // Get form data as object
    getData(formId) {
        const form = document.getElementById(formId);
        if (!form) return {};

        const formData = new FormData(form);
        const data = {};

        for (let [key, value] of formData.entries()) {
            data[key] = value;
        }

        return data;
    },

    // Set form data from object
    setData(formId, data) {
        const form = document.getElementById(formId);
        if (!form) return;

        Object.keys(data).forEach(key => {
            const input = form.querySelector(`[name="${key}"], #${key}`);
            if (input) {
                input.value = data[key] || '';
            }
        });
    },

    // Reset form
    reset(formId) {
        const form = document.getElementById(formId);
        if (form) form.reset();
    },

    // Validate required fields
    validate(formId) {
        const form = document.getElementById(formId);
        if (!form) return false;

        const required = form.querySelectorAll('[required]');
        let valid = true;

        required.forEach(field => {
            if (!field.value.trim()) {
                valid = false;
                field.classList.add('border-red-500');
            } else {
                field.classList.remove('border-red-500');
            }
        });

        return valid;
    }
};

// ============================================================================
// URL Utilities
// ============================================================================

const URLUtils = {
    // Get query parameter
    getParam(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    },

    // Set query parameter
    setParam(name, value) {
        const url = new URL(window.location);
        url.searchParams.set(name, value);
        window.history.pushState({}, '', url);
    },

    // Remove query parameter
    removeParam(name) {
        const url = new URL(window.location);
        url.searchParams.delete(name);
        window.history.pushState({}, '', url);
    }
};

// ============================================================================
// Data Export Utilities
// ============================================================================

const DataExport = {
    downloadJSON(data, filename) {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    async exportPosts() {
        const { data: posts, error } = await Posts.getAll('all');
        if (error) {
            UI.toast('پوسٹس ایکسپورٹ کرنے میں خرابی', 'error');
            return;
        }
        const exportData = posts.map(p => ({
            title: p.title,
            category_id: p.category_id || '',
            categories: p.categories || { name: '' },
            status: p.status || 'draft',
            excerpt: p.excerpt || '',
            image_url: p.image_url || '',
            audio_url: p.audio_url || '',
            content: p.content || '',
            created_at: p.created_at || new Date().toISOString()
        }));
        this.downloadJSON(exportData, `posts-export-${new Date().toISOString().slice(0, 10)}.json`);
        UI.toast(`${exportData.length} پوسٹس ایکسپورٹ ہو گئیں`, 'success');
    },

    async exportCategories() {
        const { data: categories, error } = await Categories.getAll();
        if (error) {
            UI.toast('زمرہ جات ایکسپورٹ کرنے میں خرابی', 'error');
            return;
        }
        const exportData = categories.map(c => ({
            name: c.name,
            description: c.description || '',
            status: c.status || 'active',
            created_at: c.created_at || new Date().toISOString()
        }));
        this.downloadJSON(exportData, `categories-export-${new Date().toISOString().slice(0, 10)}.json`);
        UI.toast(`${exportData.length} زمرہ جات ایکسپورٹ ہو گئے`, 'success');
    }
};

// ============================================================================
// Data Import Utilities
// ============================================================================

const DataImport = {
    openFileDialog(accept = '.json') {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = accept;
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) { resolve(null); return; }
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const data = JSON.parse(event.target.result);
                        resolve(data);
                    } catch {
                        UI.toast('فائل فارمیٹ درست نہیں ہے', 'error');
                        resolve(null);
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        });
    },

    async importPosts() {
        const data = await this.openFileDialog();
        if (!data) return;
        if (!Array.isArray(data)) {
            UI.toast('براہ کرم پوسٹس کی ایک درست JSON array منتخب کریں', 'error');
            return;
        }

        const total = data.length;
        let imported = 0;
        UI.toast(`${total} پوسٹس امپورٹ ہو رہی ہیں...`, 'info');

        for (const item of data) {
            const postData = {
                title: item.title || 'بغیر عنوان',
                category_id: item.category_id || '',
                categories: item.categories || { name: 'عام' },
                status: item.status || 'draft',
                excerpt: item.excerpt || '',
                image_url: item.image_url || '',
                audio_url: item.audio_url || '',
                content: item.content || ''
            };
            const { error } = await Posts.create(postData);
            if (!error) imported++;
        }

        UI.toast(`${imported}/${total} پوسٹس امپورٹ ہو گئیں`, imported === total ? 'success' : 'error');
        if (window.loadPosts) window.loadPosts();
    },

    async importCategories() {
        const data = await this.openFileDialog();
        if (!data) return;
        if (!Array.isArray(data)) {
            UI.toast('براہ کرم زمرہ جات کی ایک درست JSON array منتخب کریں', 'error');
            return;
        }

        const total = data.length;
        let imported = 0;
        UI.toast(`${total} زمرہ جات امپورٹ ہو رہے ہیں...`, 'info');

        for (const item of data) {
            const catData = {
                name: item.name || 'بغیر نام',
                description: item.description || '',
                status: item.status || 'active'
            };
            const { error } = await Categories.create(catData);
            if (!error) imported++;
        }

        UI.toast(`${imported}/${total} زمرہ جات امپورٹ ہو گئے`, imported === total ? 'success' : 'error');
        if (window.loadCategories) window.loadCategories();
    }
};

// ============================================================================
// Initialize on DOM Ready
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize theme first (no async needed)
    Theme.init();

    // Log initialization
    console.log('دعا اور شفا - App initialized');
});

// Export to window for global access
window.waitForBackend = waitForBackend;
window.Auth = Auth;
window.Theme = Theme;
window.Categories = Categories;
window.Posts = Posts;
window.UI = UI;
window.Search = Search;
window.ImageUtils = ImageUtils;
window.Forms = Forms;
window.URLUtils = URLUtils;
window.DataExport = DataExport;
window.DataImport = DataImport;
