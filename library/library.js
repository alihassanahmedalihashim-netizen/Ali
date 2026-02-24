/**
 * library.js – صفحة المكتبة (تعتمد على ملف JSON فقط)
 * نسخة محسنة للسرعة مع تقليل حجم الصور
 * تم التعديل: إضافة SVG placeholder عند فشل تحميل الصور
 */
(function() {
    if (!document.getElementById('booksGrid')) return;

    // ==================== إعدادات ====================
    const DATA_PATH = 'ziydia_books_detailed.json'; // ملف JSON
    const BOOKS_PER_PAGE = 8; // تقليل عدد الكتب لكل صفحة لتحميل أسرع
    const CACHE_KEY = 'ziydia_books_cache';
    const CACHE_EXPIRY = 60 * 60 * 1000; // ساعة

    // ==================== الحالة ====================
    const state = {
        allBooks: [],
        authorsList: [],
        filteredBooks: [],
        currentView: 'books',
        currentAuthor: null,
        currentPage: 1,
        favorites: JSON.parse(localStorage.getItem('lib_favs') || '[]'),
        readingList: JSON.parse(localStorage.getItem('reading_list') || '[]')
    };

    // ==================== عناصر DOM ====================
    const DOM = {
        grid: document.getElementById('booksGrid'),
        searchInput: document.getElementById('searchInput'),
        categoryContainer: document.getElementById('categoryContainer'),
        booksCount: document.getElementById('booksCount'),
        progressFill: document.getElementById('progressFill'),
        noResults: document.getElementById('noResults'),
        refreshBtn: document.getElementById('refreshBtn'),
        loadMoreBtn: document.getElementById('loadMoreBtn'),
        loadMoreContainer: document.getElementById('loadMoreContainer'),
        viewToggleButtons: document.querySelectorAll('.view-toggle-btn')
    };

    // ==================== دوال مساعدة ====================
    const Utils = {
        updateProgress(percent) {
            if (DOM.progressFill) DOM.progressFill.style.width = `${percent}%`;
        },
        showError(message) {
            if (DOM.grid) {
                DOM.grid.innerHTML = `<div class="no-results"><i class="fas fa-exclamation-circle"></i><h3>خطأ</h3><p>${message}</p></div>`;
            }
            if (DOM.booksCount) DOM.booksCount.textContent = 'فشل التحميل';
            Utils.updateProgress(0);
        },
        showLoading(text = 'جاري تحميل الكتب...') {
            if (DOM.grid) {
                DOM.grid.innerHTML = `<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> ${text}</div>`;
            }
        },
        // توليد SVG placeholder بحجم صغير مع أول حرفين من العنوان
        generatePlaceholder(title) {
            const words = title.split(' ').filter(w => w.length > 0);
            let letters = '';
            if (words.length >= 2) {
                letters = words[0][0] + words[1][0];
            } else if (words.length === 1) {
                letters = words[0].substring(0, 2);
            } else {
                letters = 'كتاب';
            }
            letters = letters.toUpperCase();
            const colors = ['#016fae', '#01579b', '#4facfe', '#00b0c7', '#0288d1', '#039be5'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            // SVG صغير الحجم (200×250) لكنه سيعرض في حاوية صغيرة 160px
            return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='250' viewBox='0 0 200 250'%3E
                %3Crect width='200' height='250' fill='${color}'/%3E
                %3Ctext x='100' y='125' font-family='Tajawal, Arial' font-size='48' fill='white' text-anchor='middle' dominant-baseline='middle' font-weight='bold'%3E${letters}%3C/text%3E
            %3C/svg%3E`;
        }
    };

    // ==================== تحميل البيانات من JSON ====================
    async function fetchAllBooks() {
        Utils.showLoading();
        Utils.updateProgress(30);

        // التحقق من الكاش
        const cached = getWithExpiry(CACHE_KEY);
        if (cached) {
            console.log('استخدام الكاش');
            state.allBooks = cached.allBooks;
            state.authorsList = cached.authorsList;
            state.filteredBooks = [...state.allBooks];
            Utils.updateProgress(100);
            renderView();
            setTimeout(() => Utils.updateProgress(0), 500);
            return;
        }

        try {
            Utils.updateProgress(50);
            const response = await fetch(DATA_PATH);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            Utils.updateProgress(70);

            state.allBooks = data.map((item, index) => ({
                id: item.url.split('/').pop() || `book-${index}`,
                title: item.title,
                author: item.author,
                deathYear: item.deathYear,
                coverUrl: item.coverUrl,
                url: item.url,
                pdfUrl: item.pdfUrl
            }));

            // بناء قائمة المؤلفين
            const authorMap = new Map();
            state.allBooks.forEach(book => {
                const author = book.author;
                if (!authorMap.has(author)) {
                    authorMap.set(author, { name: author, count: 0, books: [] });
                }
                authorMap.get(author).count++;
                authorMap.get(author).books.push(book);
            });
            state.authorsList = Array.from(authorMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar'));

            setWithExpiry(CACHE_KEY, {
                allBooks: state.allBooks,
                authorsList: state.authorsList
            }, CACHE_EXPIRY);

            Utils.updateProgress(100);
            state.filteredBooks = [...state.allBooks];
            renderView();
            setTimeout(() => Utils.updateProgress(0), 500);
        } catch (error) {
            console.error('خطأ:', error);
            Utils.showError('حدث خطأ في تحميل المكتبة. تأكد من وجود ملف JSON.');
        }
    }

    // ==================== دوال العرض ====================
    function renderBooks() {
        let filtered = state.filteredBooks;
        if (state.currentAuthor) {
            filtered = filtered.filter(book => book.author === state.currentAuthor);
        }

        const endIndex = state.currentPage * BOOKS_PER_PAGE;
        const booksToShow = filtered.slice(0, endIndex);

        if (booksToShow.length === 0) {
            DOM.noResults?.classList.remove('d-none');
            DOM.grid.innerHTML = '';
            DOM.booksCount.textContent = 'لا توجد كتب';
            DOM.loadMoreContainer.style.display = 'none';
            return;
        }

        DOM.noResults?.classList.add('d-none');
        DOM.booksCount.textContent = `📚 عرض ${booksToShow.length} من ${filtered.length} كتاب`;

        DOM.grid.innerHTML = booksToShow.map((book, index) => {
            const isFav = state.favorites.includes(book.id);
            const isReading = state.readingList.includes(book.id);
            const deathYearHtml = book.deathYear ? `<span class="book-death">(ت: ${book.deathYear})</span>` : '';
            const safeTitle = book.title ? book.title.replace(/"/g, '&quot;') : 'بدون عنوان';
            // توليد placeholder للصورة (سيستخدم عند فشل التحميل)
            const placeholder = Utils.generatePlaceholder(book.title);

            return `
                <div class="col" style="animation-delay: ${index * 0.02}s">
                    <div class="book-card">
                        <div class="cover-container">
                            <img 
                                src="${book.coverUrl}" 
                                alt="${safeTitle}"
                                loading="lazy"
                                decoding="async"
                                data-placeholder="${placeholder}"
                                onerror="this.onerror=null; this.src = this.dataset.placeholder;"
                            >
                            <div class="book-overlay-btns">
                                <button class="mini-btn" data-action="toggleFav" data-id="${book.id}" title="المفضلة">
                                    <i class="${isFav ? 'fas text-danger' : 'far'} fa-heart"></i>
                                </button>
                                <button class="mini-btn" data-action="toggleReading" data-id="${book.id}" title="قائمة القراءة">
                                    <i class="${isReading ? 'fas text-warning' : 'far'} fa-bookmark"></i>
                                </button>
                                <button class="mini-btn" data-action="shareBook" data-id="${book.id}" data-title="${book.title}" title="مشاركة">
                                    <i class="fas fa-share-alt"></i>
                                </button>
                            </div>
                        </div>
                        <div class="book-info">
                            <span class="author-tag">${book.author}</span>
                            <h6 class="book-title" title="${safeTitle}">${book.title}</h6>
                            ${deathYearHtml}
                            <div class="book-footer">
                                <a href="${book.url}" target="_blank" class="btn btn-primary btn-sm w-100" rel="noopener noreferrer">
                                    <i class="fas fa-external-link-alt"></i> قراءة الكتاب
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        DOM.loadMoreContainer.style.display = filtered.length > endIndex ? 'block' : 'none';
    }

    function renderAuthors() {
        let filteredAuthors = state.authorsList;
        const term = DOM.searchInput?.value.toLowerCase().trim();
        if (term) {
            filteredAuthors = filteredAuthors.filter(a => a.name.toLowerCase().includes(term));
        }

        if (filteredAuthors.length === 0) {
            DOM.noResults?.classList.remove('d-none');
            DOM.grid.innerHTML = '';
            DOM.booksCount.textContent = 'لا يوجد مؤلفين';
            DOM.loadMoreContainer.style.display = 'none';
            return;
        }

        DOM.noResults?.classList.add('d-none');
        DOM.booksCount.textContent = `👤 عرض ${filteredAuthors.length} مؤلف`;

        DOM.grid.innerHTML = filteredAuthors.map((author, index) => `
            <div class="col" style="animation-delay: ${index * 0.02}s">
                <div class="author-card" data-action="showAuthorBooks" data-author="${author.name}">
                    <div class="author-avatar">
                        <i class="fas fa-user-graduate fa-3x"></i>
                    </div>
                    <h4 class="author-name">${author.name}</h4>
                    <p class="author-count">عدد الكتب: ${author.count}</p>
                    <button class="btn btn-outline btn-sm mt-2">عرض الكتب</button>
                </div>
            </div>
        `).join('');

        DOM.loadMoreContainer.style.display = 'none';
    }

    function renderView() {
        if (state.currentView === 'books') renderBooks();
        else renderAuthors();
    }

    // ==================== إدارة الأحداث ====================
    function setupEventDelegation() {
        DOM.grid.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;

            const action = target.dataset.action;
            const id = target.dataset.id;
            const title = target.dataset.title;

            switch (action) {
                case 'toggleFav':
                    if (state.favorites.includes(id)) {
                        state.favorites = state.favorites.filter(f => f !== id);
                        showToast('تمت الإزالة من المفضلة', 'info');
                    } else {
                        state.favorites.push(id);
                        showToast('تمت الإضافة إلى المفضلة', 'success');
                    }
                    localStorage.setItem('lib_favs', JSON.stringify(state.favorites));
                    renderView();
                    break;

                case 'toggleReading':
                    if (state.readingList.includes(id)) {
                        state.readingList = state.readingList.filter(r => r !== id);
                        showToast('تمت الإزالة من قائمة القراءة', 'info');
                    } else {
                        state.readingList.push(id);
                        showToast('تمت الإضافة إلى قائمة القراءة', 'success');
                    }
                    localStorage.setItem('reading_list', JSON.stringify(state.readingList));
                    renderView();
                    break;

                case 'shareBook':
                    const url = state.allBooks.find(b => b.id === id)?.url || '';
                    if (navigator.share) {
                        navigator.share({ title, url }).catch(console.error);
                    } else {
                        copyToClipboard(url);
                        showToast('تم نسخ الرابط', 'success');
                    }
                    break;

                case 'showAuthorBooks':
                    state.currentView = 'books';
                    state.currentAuthor = target.dataset.author;
                    state.filteredBooks = state.allBooks.filter(book => book.author === state.currentAuthor);
                    state.currentPage = 1;
                    DOM.viewToggleButtons.forEach(btn => btn.classList.remove('active'));
                    document.querySelector('[data-view="books"]')?.classList.add('active');
                    renderBooks();
                    break;
            }
        });
    }

    // ==================== التهيئة ====================
    window.initEliteLibraryPage = function() {
        fetchAllBooks();

        // إخفاء شريط التصنيفات (غير مستخدم)
        if (DOM.categoryContainer) {
            DOM.categoryContainer.style.display = 'none';
        }

        // البحث
        const handleSearch = debounce(() => {
            const term = DOM.searchInput?.value.toLowerCase().trim() || '';
            if (state.currentView === 'books') {
                state.filteredBooks = state.allBooks.filter(book =>
                    book.title.toLowerCase().includes(term) ||
                    book.author.toLowerCase().includes(term)
                );
                state.currentPage = 1;
                renderBooks();
            } else {
                renderAuthors(); // البحث يتم داخلياً
            }
        }, 300);

        DOM.searchInput?.addEventListener('input', handleSearch);

        // أزرار تبديل العرض
        DOM.viewToggleButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                DOM.viewToggleButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.currentView = btn.dataset.view;
                state.currentPage = 1;
                state.currentAuthor = null;
                if (state.currentView === 'books') {
                    state.filteredBooks = [...state.allBooks];
                }
                renderView();
            });
        });

        DOM.refreshBtn?.addEventListener('click', () => {
            localStorage.removeItem(CACHE_KEY);
            fetchAllBooks();
        });

        DOM.loadMoreBtn?.addEventListener('click', () => {
            state.currentPage++;
            renderBooks();
        });

        setupEventDelegation();
    };
})();

// ==================== دوال مساعدة عامة (من main.js) ====================
function getWithExpiry(key) {
    const itemStr = localStorage.getItem(key);
    if (!itemStr) return null;
    try {
        const item = JSON.parse(itemStr);
        if (Date.now() > item.expiry) {
            localStorage.removeItem(key);
            return null;
        }
        return item.value;
    } catch {
        return null;
    }
}

function setWithExpiry(key, value, ttl) {
    const now = Date.now();
    const item = { value, expiry: now + ttl };
    localStorage.setItem(key, JSON.stringify(item));
}

function debounce(fn, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

function showToast(msg, type) {
    if (window.showToast) {
        window.showToast(msg, type);
    } else {
        alert(msg);
    }
}

function copyToClipboard(text) {
    if (window.copyToClipboard) {
        window.copyToClipboard(text);
    } else {
        navigator.clipboard?.writeText(text).catch(() => {});
    }
}
