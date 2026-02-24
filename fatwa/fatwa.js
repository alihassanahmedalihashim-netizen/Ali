 /**
 * fatwa.js – صفحة الفتاوى النصية (نسخة نهائية)
 * الملف fatwas_clean.json موجود في نفس مجلد fatwa.html (الجذر)
 * @version 2.3
 */
(function() {
    'use strict';

    // ========== الإعدادات ==========
    const DATA_FILE = 'fatwas_clean.json'; // الملف في نفس المجلد (الجذر)
    const ITEMS_PER_PAGE = 158;
    const DEBOUNCE_DELAY = 300;

    let allFatwas = [];
    let filteredFatwas = [];
    let searchTerm = '';
    let activeCategory = 'الكل';
    let allTags = ['الكل'];
    let currentPage = 1;
    let isLoading = false;

    // العناصر الرئيسية
    const categoriesContainer = document.getElementById('categoriesContainer');
    const fatwaGrid = document.getElementById('fatwaGrid');
    const searchInput = document.getElementById('searchInput');
    const paginationContainer = document.getElementById('paginationContainer');
    let loadingIndicator = document.getElementById('loadingIndicator');

    if (!categoriesContainer || !fatwaGrid) {
        console.error('العناصر الأساسية غير موجودة في الصفحة');
        return;
    }

    // إنشاء عداد النتائج إذا لم يكن موجوداً
    if (!document.getElementById('resultsCount')) {
        const statsDiv = document.createElement('div');
        statsDiv.id = 'resultsCount';
        statsDiv.className = 'results-count';
        if (searchInput && searchInput.parentNode) {
            searchInput.parentNode.insertBefore(statsDiv, searchInput.nextSibling);
        }
    }

    // إنشاء مؤشر التحميل إذا لم يكن موجوداً
    if (!loadingIndicator) {
        loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'loadingIndicator';
        loadingIndicator.className = 'loading-spinner';
        loadingIndicator.style.display = 'none';
        loadingIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحميل...';
        if (fatwaGrid.parentNode) {
            fatwaGrid.parentNode.insertBefore(loadingIndicator, fatwaGrid);
        }
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

    // دوال مساعدة
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

    // عرض رسالة خطأ واضحة
    function showError(message) {
        fatwaGrid.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h3>خطأ في التحميل</h3><p>${message}</p><button class="btn btn-primary" onclick="location.reload()">إعادة المحاولة</button></div>`;
    }

    // تحميل الفتاوى
    async function fetchFatwas() {
        showLoading();
        try {
            console.log('جاري تحميل الفتاوى من:', DATA_FILE);
            const response = await fetch(DATA_FILE, { cache: 'no-cache' }); // منع التخزين المؤقت
            if (!response.ok) throw new Error(`فشل تحميل الفتاوى (${response.status} ${response.statusText})`);
            
            const fatwasData = await response.json();
            console.log('تم تحميل البيانات، عدد العناصر:', fatwasData.length);

            if (!Array.isArray(fatwasData)) throw new Error('بيانات الفتاوى غير متوقعة (ليست مصفوفة)');

            // إزالة التكرارات بناءً على id
            const seenIds = new Set();
            const uniqueFatwasData = [];
            fatwasData.forEach(item => {
                if (item.id && !seenIds.has(item.id)) {
                    seenIds.add(item.id);
                    uniqueFatwasData.push(item);
                }
            });

            // تجهيز الفتاوى
            allFatwas = uniqueFatwasData.map(item => {
                let tags = item.tags || [];
                if (!Array.isArray(tags)) tags = [tags];

                // معالجة التاريخ بشكل آمن
                let dateStr = '';
                if (item.date) {
                    try {
                        const d = new Date(item.date);
                        if (!isNaN(d.getTime())) {
                            dateStr = d.toLocaleDateString('ar-EG');
                        } else {
                            dateStr = 'غير محدد';
                        }
                    } catch {
                        dateStr = 'غير محدد';
                    }
                }

                return {
                    id: item.id,
                    title: item.title || '',
                    question: item.question || '',
                    answer: item.answer || '',
                    mufti: item.mufti || '',
                    date: dateStr,
                    tags: tags.filter(t => t && t.trim() !== ''),
                    questionNorm: normalizeForSearch(item.question || ''),
                    answerNorm: normalizeForSearch(item.answer || ''),
                    muftiNorm: normalizeForSearch(item.mufti || ''),
                    titleNorm: normalizeForSearch(item.title || '')
                };
            });

            // استخراج التصنيفات من بيانات الفتاوى
            const tagSet = new Set();
            allFatwas.forEach(f => {
                f.tags.forEach(t => tagSet.add(t));
            });
            allTags = ['الكل', ...Array.from(tagSet).sort()];

            filteredFatwas = [...allFatwas];
            renderCategories();
            applyFilters();

        } catch (error) {
            console.error('خطأ في تحميل الفتاوى:', error);
            console.error('المسار المستخدم:', DATA_FILE);
            showError(error.message);
        } finally {
            hideLoading();
        }
    }

    // عرض التصنيفات
    function renderCategories() {
        categoriesContainer.innerHTML = allTags.map(cat => `
            <button class="category-btn ${cat === activeCategory ? 'active' : ''}" data-category="${cat}">${cat}</button>
        `).join('');
    }

    // تطبيق التصفية
    function applyFilters() {
        const normalizedSearch = normalizeForSearch(searchTerm);

        filteredFatwas = allFatwas.filter(fatwa => {
            const matchesSearch = normalizedSearch === '' || 
                fatwa.questionNorm.includes(normalizedSearch) ||
                fatwa.answerNorm.includes(normalizedSearch) ||
                fatwa.muftiNorm.includes(normalizedSearch) ||
                fatwa.titleNorm.includes(normalizedSearch);
            
            const matchesCategory = activeCategory === 'الكل' || 
                fatwa.tags.includes(activeCategory);
            
            return matchesSearch && matchesCategory;
        });

        currentPage = 1;
        const resultsCountEl = document.getElementById('resultsCount');
        if (resultsCountEl) {
            resultsCountEl.textContent = `📊 ${filteredFatwas.length} فتوى`;
        }
        renderPage();
    }

    // عرض الصفحة الحالية
    function renderPage() {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        const pageFatwas = filteredFatwas.slice(start, end);
        renderFatwas(pageFatwas);
        renderPagination();
    }

    // التعامل مع النقر على البطاقة (expand/collapse)
    function handleCardClick(e) {
        const card = e.target.closest('.fatwa-card');
        if (!card) return;
        if (e.target.closest('a')) return;
        card.classList.toggle('collapsed');
    }

    // نص المعاينة
    function getPreviewText(fatwa) {
        if (fatwa.title && fatwa.title.trim() !== '') {
            return fatwa.title;
        } else {
            const question = fatwa.question || 'لا يوجد سؤال';
            return question.length > 100 ? question.substring(0, 100) + '…' : question;
        }
    }

    // عرض الفتاوى
    function renderFatwas(fatwas) {
        if (fatwas.length === 0) {
            fatwaGrid.innerHTML = `<div class="empty-state"><i class="fas fa-search"></i><h3>لا توجد نتائج</h3><p>حاول بكلمات أخرى</p></div>`;
            return;
        }

        fatwaGrid.innerHTML = fatwas.map(f => {
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
                        ${f.tags.map(t => `<span class="tag">${t}</span>`).join('')}
                    </div>
                </div>
            </div>
        `}).join('');

        fatwaGrid.removeEventListener('click', handleCardClick);
        fatwaGrid.addEventListener('click', handleCardClick);

        // بعد بناء البطاقات، تحقق من وجود id في الرابط
        scrollToFatwaFromURL();
    }

    // عرض أزرار التصفح
    function renderPagination() {
        if (!paginationContainer) return;
        const totalPages = Math.ceil(filteredFatwas.length / ITEMS_PER_PAGE);
        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        let buttons = '';
        buttons += `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="window.changePage(${currentPage - 1})">‹</button>`;
        
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
                buttons += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="window.changePage(${i})">${i}</button>`;
            } else if (i === currentPage - 3 || i === currentPage + 3) {
                buttons += `<button class="page-btn dots" disabled>...</button>`;
            }
        }
        
        buttons += `<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="window.changePage(${currentPage + 1})">›</button>`;
        
        paginationContainer.innerHTML = buttons;
    }

    // تغيير الصفحة (دالة عامة)
    window.changePage = function(page) {
        if (page < 1 || page > Math.ceil(filteredFatwas.length / ITEMS_PER_PAGE)) return;
        currentPage = page;
        renderPage();
        fatwaGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // إعداد الأحداث
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

    // ========== دوال الانتقال إلى فتوى محددة من الرابط ==========
    function getFatwaIdFromURL() {
        const params = new URLSearchParams(window.location.search);
        return params.get('id');
    }

    function scrollToFatwaById(fatwaId) {
        if (!fatwaId) return;
        // ننتظر قليلاً حتى يتم عرض البطاقات في DOM
        setTimeout(() => {
            const targetCard = document.querySelector(`.fatwa-card[data-id="${fatwaId}"]`);
            if (targetCard) {
                // إزالة خاصية المطوي (collapsed) لفتح البطاقة
                targetCard.classList.remove('collapsed');
                // التمرير إلى البطاقة
                targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // تمييز البطاقة بشكل مؤقت (اختياري)
                targetCard.style.transition = 'background 0.5s';
                targetCard.style.background = '#fff3cd';
                setTimeout(() => {
                    targetCard.style.background = '';
                }, 2000);
            } else {
                console.log('لم يتم العثور على الفتوى رقم:', fatwaId);
            }
        }, 300);
    }

    function scrollToFatwaFromURL() {
        const fatwaId = getFatwaIdFromURL();
        if (fatwaId) {
            scrollToFatwaById(fatwaId);
        }
    }

    // الدالة الرئيسية لتهيئة الصفحة
    window.initFatwaPage = function() {
        addStyles();
        fetchFatwas();
        setupEvents();
    };

    // استدعاء الدالة تلقائياً عند تحميل الصفحة
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFatwaPage);
    } else {
        initFatwaPage();
    }
})();
