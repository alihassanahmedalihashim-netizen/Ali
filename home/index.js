/**
 * index.js – الصفحة الرئيسية (نسخة متكاملة مع جلب آخر 5 كتب من JSON)
 * التعديلات:
 * - عرض آخر 5 كتب من ملف ziydia_books_detailed.json بدلاً من Google Drive.
 * - مدة التبديل بين بطاقات الكتب 3 ثوانٍ.
 * - عرض الكتب بنفس تصميم البطاقات مع صورة الغلاف أو أيقونة بديلة.
 */
(function() {
    // شريط التمرير الذهبي
    const marqueeInner = document.getElementById('marquee-inner');
    if (marqueeInner) {
        marqueeInner.innerHTML += marqueeInner.innerHTML;
    }

    // زر "اقرأ المزيد"
    const readMoreBtn = document.getElementById('readMoreBtn');
    const extraContent = document.getElementById('extraContent');
    if (readMoreBtn && extraContent) {
        readMoreBtn.addEventListener('click', () => {
            const isHidden = !extraContent.classList.contains('show');
            extraContent.classList.toggle('show', isHidden);
            readMoreBtn.innerHTML = isHidden ? '<i class="fas fa-chevron-up"></i> اقرأ أقل' : '<i class="fas fa-chevron-down"></i> اقرأ المزيد';
        });
    }

    // دالة جلب آخر 5 كتب من ملف JSON
    async function fetchLatestBooksFromJSON() {
        const track = document.getElementById('booksTrack');
        if (!track) return;

        track.innerHTML = '<div class="loading-spinner" style="text-align:center; padding:40px;"><i class="fas fa-spinner fa-spin"></i> جاري تحميل الكتب...</div>';

        try {
            const response = await fetch('ziydia_books_detailed.json'); // نفس مسار ملف المكتبة
            if (!response.ok) throw new Error(`فشل تحميل الكتب (${response.status})`);
            const books = await response.json();

            if (!Array.isArray(books) || books.length === 0) {
                track.innerHTML = '<div class="error-message"><i class="fas fa-exclamation-circle"></i> لا توجد كتب</div>';
                return;
            }

            // ترتيب الكتب تنازلياً (نفترض أن الترتيب في الملف تصاعدي حسب الإضافة)
            const sorted = [...books].reverse(); // أحدث كتاب أولاً
            const latest = sorted.slice(0, 5); // آخر 5 كتب

            track.innerHTML = '';
            latest.forEach(book => {
                const card = document.createElement('div');
                card.className = 'card-single';

                // صورة الغلاف أو أيقونة افتراضية
                const coverHtml = book.coverUrl 
                    ? `<img src="${book.coverUrl}" alt="${book.title}" loading="lazy" onerror="this.onerror=null; this.style.display='none'; this.parentNode.innerHTML+='<div class=\\'book-icon\\' style=\\'font-size:4rem; text-align:center;\\'>📖</div>';">`
                    : `<div class="book-icon" style="font-size:4rem; text-align:center;">📖</div>`;

                // رابط الكتاب (إذا لم يوجد url نستخدم #)
                const bookUrl = book.url || '#';

                card.innerHTML = `
                    <div style="position: relative;">
                        ${coverHtml}
                    </div>
                    <div style="font-weight: bold; font-size: 1.2rem; color: var(--primary-dark); margin: 10px 0 5px; text-align: center;">
                        ${book.title || 'بدون عنوان'}
                    </div>
                    <div style="font-size: 0.9rem; color: var(--text-soft); text-align: center; margin-bottom: 10px;">
                        ${book.author || 'غير معروف'}
                        ${book.deathYear ? ` (ت: ${book.deathYear})` : ''}
                    </div>
                    <div style="margin-top: auto; display: flex; gap: 8px; justify-content: center;">
                        <a href="${bookUrl}" target="_blank" class="btn btn-primary btn-sm" style="flex:1; text-decoration:none;">قراءة</a>
                    </div>
                `;
                track.appendChild(card);
            });
        } catch (error) {
            console.error('خطأ في جلب الكتب:', error);
            track.innerHTML = `<div class="error-message">❌ ${error.message}</div>`;
        }
    }

    async function fetchYouTubeVideos() {
        const track = document.getElementById('videoTrack');
        if (!track) return;
        track.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> جاري تحميل الفيديوهات...</div>';

        try {
            const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${CONFIG.YOUTUBE_CHANNEL_ID}&key=${CONFIG.YOUTUBE_API_KEY}`;
            const channelRes = await fetch(channelUrl);
            const channelData = await channelRes.json();
            if (!channelData.items?.length) throw new Error('القناة غير موجودة');
            const uploadsId = channelData.items[0].contentDetails.relatedPlaylists.uploads;

            const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=3&playlistId=${uploadsId}&key=${CONFIG.YOUTUBE_API_KEY}`;
            const playlistRes = await fetch(playlistUrl);
            const playlistData = await playlistRes.json();
            if (!playlistData.items?.length) throw new Error('لا توجد فيديوهات');

            track.innerHTML = '';
            playlistData.items.forEach(item => {
                const video = item.snippet;
                const videoId = video.resourceId.videoId;
                const thumb = video.thumbnails.medium?.url || 'https://via.placeholder.com/320x180?text=لا+توجد+صورة';
                const card = document.createElement('div');
                card.className = 'card-single';
                card.setAttribute('data-href', `https://www.youtube.com/watch?v=${videoId}`);
                card.addEventListener('click', () => window.open(card.dataset.href, '_blank'));

                card.innerHTML = `
                    <img src="${thumb}" alt="${video.title}" loading="lazy" onerror="this.src='https://via.placeholder.com/320x180?text=خطأ+في+الصورة'">
                    <h3>${video.title.length > 60 ? video.title.substring(0, 60) + '…' : video.title}</h3>
                `;
                track.appendChild(card);
            });
        } catch (error) {
            track.innerHTML = `<div class="error-message">❌ ${getErrorMessage(error)}</div>`;
        }
    }

    // دالة جلب آخر 5 فتاوى (كما كانت)
    async function fetchLatestFatwas() {
        const track = document.getElementById('fatwaTrack');
        if (!track) return;
        track.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> جاري تحميل الفتاوى...</div>';

        try {
            const response = await fetch('fatwas_clean.json');
            if (!response.ok) throw new Error(`فشل تحميل الفتاوى (${response.status})`);
            const fatwas = await response.json();

            if (!Array.isArray(fatwas) || fatwas.length === 0) {
                track.innerHTML = '<div class="error-message">لا توجد فتاوى</div>';
                return;
            }

            const sorted = [...fatwas].sort((a, b) => (b.id || 0) - (a.id || 0));
            const latest = sorted.slice(0, 5);

            track.innerHTML = '';
            latest.forEach(fatwa => {
                const card = document.createElement('div');
                card.className = 'card-single';
                card.setAttribute('data-href', 'fatwa.html');
                card.addEventListener('click', () => window.location.href = card.dataset.href);

                const title = fatwa.title && fatwa.title.trim() !== '' 
                    ? fatwa.title 
                    : (fatwa.question ? fatwa.question.substring(0, 60) + '…' : 'فتوى بدون عنوان');
                
                const question = fatwa.question || '';
                const shortQuestion = question.length > 80 ? question.substring(0, 80) + '…' : question;

                const answer = fatwa.answer || 'لم يرد جواب بعد';
                const shortAnswer = answer.length > 100 ? answer.substring(0, 100) + '…' : answer;

                card.innerHTML = `
                    <div style="font-weight: bold; font-size: 1.2rem; color: var(--primary-dark); margin-bottom: 8px; text-align: center;">
                        ${title}
                    </div>
                    ${shortQuestion ? `<div style="font-size: 0.9rem; color: var(--text-soft); margin-bottom: 8px; background: var(--primary-soft); padding: 6px; border-radius: 8px;">${shortQuestion}</div>` : ''}
                    <div style="font-size: 0.9rem; color: var(--text-soft); background: var(--card-bg); padding: 8px; border-radius: 8px; border: 1px solid var(--border-light);">
                        ${shortAnswer}
                    </div>
                    <div style="margin-top: 10px; display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted);">
                        <span>👤 ${fatwa.mufti || 'غير محدد'}</span>
                        <span>📅 ${fatwa.date || ''}</span>
                    </div>
                `;
                track.appendChild(card);
            });
        } catch (error) {
            console.error('خطأ في جلب الفتاوى:', error);
            track.innerHTML = `<div class="error-message">❌ ${error.message}</div>`;
        }
    }

    // دالة تهيئة السلايدر
    function initSingleSlider(trackId, prevId, nextId, pauseId, intervalDuration = 5000) {
        const track = document.getElementById(trackId);
        const prevBtn = document.getElementById(prevId);
        const nextBtn = document.getElementById(nextId);
        const pauseBtn = document.getElementById(pauseId);
        if (!track || !prevBtn || !nextBtn || !pauseBtn) return;

        const cards = track.children;
        if (cards.length === 0) return;

        let currentIndex = 0;
        let autoPlayInterval;
        let paused = false;

        function updatePosition() {
            const container = track.parentElement;
            const containerWidth = container.offsetWidth;
            track.style.transform = `translateX(-${currentIndex * containerWidth}px)`;
        }

        function next() {
            currentIndex = (currentIndex + 1) % cards.length;
            updatePosition();
        }

        function prev() {
            currentIndex = (currentIndex - 1 + cards.length) % cards.length;
            updatePosition();
        }

        function startAutoPlay() {
            if (autoPlayInterval) clearInterval(autoPlayInterval);
            autoPlayInterval = setInterval(() => {
                if (!paused) next();
            }, intervalDuration);
        }

        prevBtn.addEventListener('click', () => { prev(); startAutoPlay(); });
        nextBtn.addEventListener('click', () => { next(); startAutoPlay(); });

        pauseBtn.addEventListener('click', () => {
            paused = !paused;
            pauseBtn.innerHTML = paused ? '<i class="fas fa-play"></i> تشغيل' : '<i class="fas fa-pause"></i> إيقاف';
        });

        window.addEventListener('resize', updatePosition);
        setTimeout(updatePosition, 100);
        startAutoPlay();
    }

    window.initIndexPage = function() {
        // تشغيل جميع السلايدرات بعد تحميل بياناتها
        Promise.all([
            fetchYouTubeVideos(),
            fetchLatestBooksFromJSON(), // الآن من JSON بدلاً من Drive
            fetchLatestFatwas()
        ]).then(() => {
            initSingleSlider('videoTrack', 'prevVideo', 'nextVideo', 'pauseVideoBtn', CONFIG.SLIDER_INTERVAL || 5000);
            // مدة الكتب 3 ثوانٍ
            initSingleSlider('booksTrack', 'prevBook', 'nextBook', 'pauseBooksBtn', 3000);
            initSingleSlider('fatwaTrack', 'prevFatwa', 'nextFatwa', 'pauseFatwaBtn', 3000);
        }).catch(err => {
            console.error('خطأ في تحميل أحد العناصر:', err);
        });
    };
})();
