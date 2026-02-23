
/**
 * fatwa.js – صفحة الفتاوى النصية (محسنة مع أيقونة الطي وتحسينات)
 * تعديل: إضافة أيقونة للإشارة إلى حالة الطي، وتحسين عرض التاريخ والجواب الفارغ.
 */
(function() {
    'use strict';

    // ========== الإعدادات ==========
    const DATA_FILE = 'fatwas_clean.json';
    const CATEGORIES_FILE = 'categories.json';
    const ITEMS_PER_PAGE = 158;
    const DEBOUNCE_DELAY = 300;

    let allFatwas = [];
    let filteredFatwas = [];
    let categoryMap = {};
    let searchTerm = '';
    let activeCategory = 'الكل';
    let allTags = ['الكل'];
    let currentPage = 1;
    let isLoading = false;

    const categoriesContainer = document.getElementById('categoriesContainer');
    const fatwaGrid = document.getElementById('fatwaGrid');
    const searchInput = document.getElementById('searchInput');
    const paginationContainer = document.getElementById('paginationContainer');
    const loadingIndicator = document.getElementById('loadingIndicator');

    if (!categoriesContainer || !fatwaGrid) {
        console.error('العناصر الأساسية غير موجودة');
        return;
    }

    // إنشاء عداد النتائج إذا لم يكن موجوداً
    if (!document.getElementById('resultsCount')) {
        const statsDiv = document.createElement('div');
        statsDiv.id = 'resultsCount';
        statsDiv.className = 'results-count';
        searchInput?.parentNode?.insertBefore(statsDiv, searchInput.nextSibling);
    }

    // إنشاء مؤشر التحميل إذا لم يكن موجوداً
    if (!loadingIndicator) {
        const indicator = document.createElement('div');
        indicator.id = 'loadingIndicator';
        indicator.className = 'loading-spinner';
        indicator.style.display = 'none';
        indicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحميل...';
        fatwaGrid.parentNode.insertBefore(indicator, fatwaGrid);
    }

    // إضافة الأنماط اللازمة
    function addStyles() {
        const styleId = 'fatwa-custom-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .fatwa-card {
                cursor: pointer;
                transition: all 0.2s ease;
                position: relative;
            }
            .fatwa-card.collapsed .fatwa-body {
                display: none;
            }
            .fatwa-card:not(.collapsed) .fatwa-body {
                display: block;
            }
            .fatwa-card:hover {
                background-color: #f9f9f9;
                border-color: #c0c0c0;
            }
            .fatwa-header {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .fatwa-header .expand-icon {
                margin-left: auto;
                font-size: 1.2rem;
                transition: transform 0.2s;
            }
            .fatwa-card:not(.collapsed) .expand-icon {
                transform: rotate(180deg);
            }
            .loading-spinner {
                text-align: center;
                padding: 20px;
                color: #666;
            }
            .no-answer {
                color: #999;
                font-style: italic;
            }
        `;
        document.head.appendChild(style);
    }

    // ========== دوال مساعدة ==========
    function debounce(fn, delay) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    function normalizeForSearch(text) {
        if (!text) return '';
        return text
            .toLowerCase()
            .replace(/[إأآا]/g, 'ا')
            .replace(/ى/g, 'ي')
            .replace(/ة/g, 'ه')
            .replace(/\s+/g, ' ')
            .trim();
    }

    async function loadCategories() {
        try {
            const response = await fetch(CATEGORIES_FILE);
            if (!response.ok) return {};
            const cats = await response.json();
            const map = {};
            cats.forEach(cat => {
                const id = cat.id || cat.term_id;
                if (id) map[id.toString()] = cat.name;
            });
            return map;
        } catch (e) {
            console.warn('لم يتم تحميل ملف التصنيفات:', e);
            return {};
        }
    }

    function showLoading() {
        isLoading = true;
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        fatwaGrid.style.opacity = '0.5';
    }

    function hideLoading() {
        isLoading = false;
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        fatwaGrid.style.opacity = '1';
    }

    async function fetchFatwas() {
        showLoading();
        try {
            const [fatwasResponse, categoryMapData] = await Promise.all([
                fetch(DATA_FILE),
                loadCategories()
            ]);

            if (!fatwasResponse.ok) throw new Error(`فشل تحميل الفتاوى (${fatwasResponse.status})`);
            const fatwasData = await fatwasResponse.json();

            if (!Array.isArray(fatwasData)) throw new Error('بيانات الفتاوى غير متوقعة');

            // إزالة التكرارات
            const seenIds = new Set();
            const uniqueFatwasData = [];
            fatwasData.forEach(item => {
                if (item.id && !seenIds.has(item.id)) {
                    seenIds.add(item.id);
                    uniqueFatwasData.push(item);
                }
            });

            window.categoryMap = categoryMapData;

            allFatwas = uniqueFatwasData.map(item => {
                let tags = item.tags || [];
                if (!Array.isArray(tags)) tags = [tags];

                return {
                    id: item.id,
                    title: item.title || '',
                    question: item.question || '',
                    answer: item.answer || '',
                    mufti: item.mufti || '',
                    date: item.date ? new Date(item.date).toLocaleDateString('ar-EG') : '',
                    tags: tags,
                    link: item.link || '#',
                    questionNorm: normalizeForSearch(item.question || ''),
                    answerNorm: normalizeForSearch(item.answer || ''),
                    muftiNorm: normalizeForSearch(item.mufti || ''),
                    titleNorm: normalizeForSearch(item.title || '')
                };
            });

            const tagSet = new Set();
            allFatwas.forEach(f => {
                f.tags.forEach(t => {
                    const tagName = window.categoryMap[t] || t;
                    tagSet.add(tagName);
                });
            });
            allTags = ['الكل', ...Array.from(tagSet)];

            filteredFatwas = [...allFatwas];
            renderCategories();
            applyFilters();
        } catch (error) {
            console.error(error);
            fatwaGrid.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h3>خطأ في التحميل</h3><p>${error.message}</p></div>`;
        } finally {
            hideLoading();
        }
    }

    function renderCategories() {
        categoriesContainer.innerHTML = allTags.map(cat => `
            <button class="category-btn ${cat === activeCategory ? 'active' : ''}" data-category="${cat}">${cat}</button>
        `).join('');
    }

    function applyFilters() {
        const normalizedSearch = normalizeForSearch(searchTerm);

        filteredFatwas = allFatwas.filter(fatwa => {
            const matchesSearch = normalizedSearch === '' || 
                fatwa.questionNorm.includes(normalizedSearch) ||
                fatwa.answerNorm.includes(normalizedSearch) ||
                fatwa.muftiNorm.includes(normalizedSearch) ||
                fatwa.titleNorm.includes(normalizedSearch);
            
            const matchesCategory = activeCategory === 'الكل' || 
                fatwa.tags.some(t => {
                    const tagName = window.categoryMap[t] || t;
                    return tagName === activeCategory;
                });
            
            return matchesSearch && matchesCategory;
        });

        currentPage = 1;
        document.getElementById('resultsCount').textContent = `📊 ${filteredFatwas.length} فتوى`;
        renderPage();
    }

    function renderPage() {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        const pageFatwas = filteredFatwas.slice(start, end);
        renderFatwas(pageFatwas);
        renderPagination();
    }

    function handleCardClick(e) {
        const card = e.target.closest('.fatwa-card');
        if (!card) return;

        if (e.target.closest('a')) {
            return;
        }

        card.classList.toggle('collapsed');
    }

    function getPreviewText(fatwa) {
        if (fatwa.title && fatwa.title.trim() !== '') {
            return fatwa.title;
        } else {
            const question = fatwa.question || 'لا يوجد سؤال';
            return question.length > 100 ? question.substring(0, 100) + '…' : question;
        }
    }

    function renderFatwas(fatwas) {
        if (fatwas.length === 0) {
            fatwaGrid.innerHTML = `<div class="empty-state"><i class="fas fa-search"></i><h3>لا توجد نتائج</h3><p>حاول بكلمات أخرى</p></div>`;
            return;
        }

        fatwaGrid.innerHTML = fatwas.map(f => {
            const tagNames = f.tags.map(t => window.categoryMap[t] || t);
            const previewText = getPreviewText(f);
            const answerText = f.answer ? f.answer : '<span class="no-answer">لم يرد جواب بعد</span>';
            const dateText = f.date || 'غير محدد';
            const muftiText = f.mufti || 'غير محدد';

            return `
            <div class="fatwa-card collapsed" data-id="${f.id}">
                <div class="fatwa-header">
                    <span class="fatwa-id">#${f.id}</span>
                    <h3 class="fatwa-title">${previewText}</h3>
                    <i class="fas fa-chevron-down expand-icon"></i>
                </div>
                <div class="fatwa-body">
                    ${f.question ? `
                    <div class="fatwa-question-box">
                        <strong>السؤال:</strong>
                        <p>${f.question}</p>
                    </div>
                    ` : ''}
                    <div class="fatwa-answer-box">
                        <strong>الجواب:</strong>
                        <p>${answerText}</p>
                    </div>
                    <div class="fatwa-meta">
                        <span><i class="fas fa-user"></i> ${muftiText}</span>
                        <span><i class="fas fa-calendar"></i> ${dateText}</span>
                    </div>
                    <div class="fatwa-tags">
                        ${tagNames.map(t => `<span class="tag">${t}</span>`).join('')}
                    </div>
                    ${f.link !== '#' ? `<a href="${f.link}" target="_blank" class="fatwa-link">عرض المصدر</a>` : ''}
                </div>
            </div>
        `}).join('');

        fatwaGrid.removeEventListener('click', handleCardClick);
        fatwaGrid.addEventListener('click', handleCardClick);
    }

    function renderPagination() {
        if (!paginationContainer) return;
        const totalPages = Math.ceil(filteredFatwas.length / ITEMS_PER_PAGE);
        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        let buttons = '';
        buttons += `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">‹</button>`;
        
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
                buttons += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
            } else if (i === currentPage - 3 || i === currentPage + 3) {
                buttons += `<button class="page-btn dots" disabled>...</button>`;
            }
        }
        
        buttons += `<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">›</button>`;
        
        paginationContainer.innerHTML = buttons;
    }

    window.changePage = function(page) {
        if (page < 1 || page > Math.ceil(filteredFatwas.length / ITEMS_PER_PAGE)) return;
        currentPage = page;
        renderPage();
        fatwaGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    function setupEvents() {
        if (searchInput) {
            searchInput.addEventListener('input', debounce((e) => {
                searchTerm = e.target.value;
                applyFilters();
            }, DEBOUNCE_DELAY));
        }

        categoriesContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.category-btn');
            if (!btn) return;
            
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeCategory = btn.dataset.category;
            applyFilters();
        });
    }

    window.initFatwaPage = function() {
        addStyles();
        fetchFatwas();
        setupEvents();
    };
})();
