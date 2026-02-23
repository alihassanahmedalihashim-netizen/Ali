
/**
 * index.js – الصفحة الرئيسية (نسخة متكاملة مع جلب الكتب والفتاوى)
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

    // معرف مجلد الكتب الرئيسي في Google Drive
    const DRIVE_BOOKS_FOLDER_ID = '1uz7TxlwSgIG3E3aC70Ly89z5F1fFIcu7';

    async function getAllFilesInFolderRecursively(folderId, accumulatedFiles = [], pageToken = null) {
        const query = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
        let url = `https://www.googleapis.com/drive/v3/files?q=${query}&key=${CONFIG.YOUTUBE_API_KEY}&fields=files(id,name,thumbnailLink,size,mimeType,modifiedTime,webViewLink,mimeType),nextPageToken`;
        if (pageToken) url += `&pageToken=${pageToken}`;

        const response = await fetchWithTimeout(url, {}, 10000);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);

        const data = await response.json();
        const items = data.files || [];

        const folders = items.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
        const files = items.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

        accumulatedFiles.push(...files);

        if (data.nextPageToken) {
            await getAllFilesInFolderRecursively(folderId, accumulatedFiles, data.nextPageToken);
        }

        for (const folder of folders) {
            await getAllFilesInFolderRecursively(folder.id, accumulatedFiles);
        }

        return accumulatedFiles;
    }

    function getBookIcon(mimeType) {
        if (mimeType?.includes('pdf')) return '📕';
        if (mimeType?.includes('epub')) return '📘';
        if (mimeType?.includes('document')) return '📗';
        return '📖';
    }

    async function fetchBooksFromDrive() {
        const track = document.getElementById('booksTrack');
        if (!track) return;

        track.innerHTML = '<div class="loading-spinner" style="text-align:center; padding:40px;"><i class="fas fa-spinner fa-spin"></i> جاري تحميل الكتب...</div>';

        try {
            const allFiles = await getAllFilesInFolderRecursively(DRIVE_BOOKS_FOLDER_ID);
            if (allFiles.length === 0) {
                track.innerHTML = '<div class="error-message"><i class="fas fa-exclamation-circle"></i> لا توجد كتب في هذا المجلد</div>';
                return;
            }

            track.innerHTML = '';
            allFiles.forEach(file => {
                const card = document.createElement('div');
                card.className = 'card-single';

                const iconChar = getBookIcon(file.mimeType);
                const viewUrl = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;
                const downloadUrl = `https://drive.google.com/uc?export=download&id=${file.id}`;

                card.innerHTML = `
                    <div class="book-icon">${iconChar}</div>
                    <div class="book-title">${file.name || 'بدون عنوان'}</div>
                    <div class="buttons">
                        <a href="${viewUrl}" target="_blank" class="btn btn-view">عرض</a>
                        <a href="${downloadUrl}" target="_blank" class="btn btn-download">تحميل</a>
                    </div>
                `;
                track.appendChild(card);
            });
        } catch (error) {
            console.error('فشل جلب الكتب:', error);
            track.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-circle"></i> ${getErrorMessage(error)}</div>`;
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

    // دالة جديدة لجلب آخر 3 فتاوى من ملف JSON
    async function fetchLatestFatwas() {
        const track = document.getElementById('fatwaTrack');
        if (!track) return;
        track.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> جاري تحميل الفتاوى...</div>';

        try {
            const response = await fetch('fatwas_clean.json'); // تأكد من المسار الصحيح
            if (!response.ok) throw new Error(`فشل تحميل الفتاوى (${response.status})`);
            const fatwas = await response.json();

            if (!Array.isArray(fatwas) || fatwas.length === 0) {
                track.innerHTML = '<div class="error-message">لا توجد فتاوى</div>';
                return;
            }

            // ترتيب تنازلي حسب id (الأحدث أولاً) - يمكن تعديله حسب الحقل المناسب
            const sorted = [...fatwas].sort((a, b) => (b.id || 0) - (a.id || 0));
            const latest = sorted.slice(0, 3); // آخر 3 فتاوى

            track.innerHTML = '';
            latest.forEach(fatwa => {
                const card = document.createElement('div');
                card.className = 'card-single';
                // عند النقر، انتقل إلى صفحة الفتاوى العامة (يمكن تعديل الرابط ليشمل معرف الفتوى)
                card.setAttribute('data-href', 'fatwa.html');
                card.addEventListener('click', () => window.location.href = card.dataset.href);

                // مقتطف السؤال
                const question = fatwa.question || 'لا يوجد سؤال';
                const shortQuestion = question.length > 80 ? question.substring(0, 80) + '…' : question;
                // مقتطف الجواب
                const answer = fatwa.answer || 'لم يرد جواب بعد';
                const shortAnswer = answer.length > 100 ? answer.substring(0, 100) + '…' : answer;

                card.innerHTML = `
                    <div style="font-size: 3rem; text-align: center; margin-bottom: 10px;">📄</div>
                    <div style="font-weight: bold; color: var(--primary-dark); margin-bottom: 8px;">${shortQuestion}</div>
                    <div style="font-size: 0.9rem; color: var(--text-soft); background: var(--primary-soft); padding: 8px; border-radius: 8px;">${shortAnswer}</div>
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

    function initSingleSlider(trackId, prevId, nextId, pauseId) {
        const track = document.getElementById(trackId);
        const prevBtn = document.getElementById(prevId);
        const nextBtn = document.getElementById(nextId);
        const pauseBtn = document.getElementById(pauseId);
        if (!track || !prevBtn || !nextBtn || !pauseBtn) return;

        const cards = track.children;
        if (cards.length === 0) return;

        let currentIndex = 0;
        let interval;
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
            if (interval) clearInterval(interval);
            interval = setInterval(() => {
                if (!paused) next();
            }, CONFIG.SLIDER_INTERVAL);
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
            fetchBooksFromDrive(),
            fetchLatestFatwas()
        ]).then(() => {
            initSingleSlider('videoTrack', 'prevVideo', 'nextVideo', 'pauseVideoBtn');
            initSingleSlider('booksTrack', 'prevBook', 'nextBook', 'pauseBooksBtn');
            initSingleSlider('fatwaTrack', 'prevFatwa', 'nextFatwa', 'pauseFatwaBtn');
        }).catch(err => {
            console.error('خطأ في تحميل أحد العناصر:', err);
        });
    };
})();
