/**
 * admin.js – لوحة تحكم إدارة الفتاوى (نسخة متجاوبة مع الجوال)
 * يتطلب تسجيل الدخول عبر sessionStorage
 */
(function() {
    'use strict';

    // التحقق من تسجيل الدخول
    if (!sessionStorage.getItem('adminLoggedIn')) {
        window.location.href = 'admin-login.html';
        return;
    }

    const DATA_FILE = '../fatwas_clean.json'; // المسار الصحيح لملف JSON
    let fatwas = []; // مصفوفة الفتاوى المحملة

    // عناصر الصفحة
    const tableBody = document.getElementById('tableBody');
    const addNewBtn = document.getElementById('addNewBtn');
    const modal = document.getElementById('fatwaModal');
    const modalTitle = document.getElementById('modalTitle');
    const fatwaId = document.getElementById('fatwaId');
    const titleInput = document.getElementById('title');
    const questionInput = document.getElementById('question');
    const answerInput = document.getElementById('answer');
    const muftiInput = document.getElementById('mufti');
    const dateInput = document.getElementById('date');
    const tagsInput = document.getElementById('tags');
    const saveBtn = document.getElementById('saveFatwaBtn');
    const cancelModalBtn = document.getElementById('cancelModalBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const exportBtn = document.getElementById('exportBtn');

    // تحميل الفتاوى
    async function loadFatwas() {
        try {
            const response = await fetch(DATA_FILE);
            if (!response.ok) throw new Error('فشل تحميل الفتاوى');
            fatwas = await response.json();
            if (!Array.isArray(fatwas)) fatwas = [];
            renderTable();
        } catch (error) {
            console.error(error);
            alert('تعذر تحميل الفتاوى. تأكد من وجود الملف في المسار: ' + DATA_FILE);
        }
    }

    // عرض الفتاوى في الجدول (مع دعم البطاقات للجوال)
    function renderTable() {
        if (fatwas.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:40px;">لا توجد فتاوى</td></tr>';
            return;
        }

        tableBody.innerHTML = fatwas.map((f, index) => {
            // معالجة التصنيفات لعرضها
            const tags = Array.isArray(f.tags) ? f.tags.join('، ') : (f.tags || '');
            const title = f.title || '-';
            const question = (f.question || '').substring(0, 50) + (f.question?.length > 50 ? '…' : '');
            const answer = (f.answer || '').substring(0, 50) + (f.answer?.length > 50 ? '…' : '');
            const mufti = f.mufti || '-';
            const date = f.date || '-';

            // نستخدم data-label لتظهر التسميات في وضع الجوال
            return `
            <tr data-id="${f.id}">
                <td data-label="#"><span>${f.id}</span></td>
                <td data-label="العنوان"><span>${title}</span></td>
                <td data-label="السؤال"><span>${question}</span></td>
                <td data-label="الجواب"><span>${answer}</span></td>
                <td data-label="المفتي"><span>${mufti}</span></td>
                <td data-label="التاريخ"><span>${date}</span></td>
                <td data-label="التصنيفات"><span>${tags}</span></td>
                <td data-label="الإجراءات">
                    <button class="action-btn edit-btn" onclick="editFatwa('${f.id}')"><i class="fas fa-edit"></i> تعديل</button>
                    <button class="action-btn delete-btn" onclick="deleteFatwa('${f.id}')"><i class="fas fa-trash"></i> حذف</button>
                </td>
            </tr>
            `;
        }).join('');
    }

    // دالة لإنشاء معرف جديد (أكبر id + 1)
    function generateNewId() {
        if (fatwas.length === 0) return 1;
        const maxId = Math.max(...fatwas.map(f => f.id));
        return maxId + 1;
    }

    // فتح المودال للإضافة
    function openAddModal() {
        modalTitle.textContent = 'إضافة فتوى جديدة';
        fatwaId.value = '';
        titleInput.value = '';
        questionInput.value = '';
        answerInput.value = '';
        muftiInput.value = '';
        dateInput.value = '';
        tagsInput.value = '';
        modal.classList.add('active');
    }

    // فتح المودال للتعديل (دالة عامة)
    window.editFatwa = function(id) {
        const fatwa = fatwas.find(f => f.id == id);
        if (!fatwa) return;

        modalTitle.textContent = 'تعديل الفتوى';
        fatwaId.value = fatwa.id;
        titleInput.value = fatwa.title || '';
        questionInput.value = fatwa.question || '';
        answerInput.value = fatwa.answer || '';
        muftiInput.value = fatwa.mufti || '';
        dateInput.value = fatwa.date || '';
        tagsInput.value = Array.isArray(fatwa.tags) ? fatwa.tags.join(', ') : (fatwa.tags || '');
        modal.classList.add('active');
    };

    // حذف فتوى (دالة عامة)
    window.deleteFatwa = function(id) {
        if (confirm('هل أنت متأكد من حذف هذه الفتوى؟')) {
            fatwas = fatwas.filter(f => f.id != id);
            renderTable();
        }
    };

    // حفظ الفتوى (إضافة أو تعديل)
    function saveFatwa() {
        // التحقق من صحة المدخلات
        if (!questionInput.value.trim()) {
            alert('السؤال مطلوب');
            return;
        }

        const id = fatwaId.value ? parseInt(fatwaId.value) : generateNewId();
        const tags = tagsInput.value.split(',').map(t => t.trim()).filter(t => t !== '');

        const fatwaData = {
            id: id,
            title: titleInput.value.trim() || '',
            question: questionInput.value.trim(),
            answer: answerInput.value.trim() || '',
            mufti: muftiInput.value.trim() || '',
            date: dateInput.value || '',
            tags: tags
        };

        if (fatwaId.value) {
            // تعديل
            const index = fatwas.findIndex(f => f.id == id);
            if (index !== -1) fatwas[index] = fatwaData;
        } else {
            // إضافة
            fatwas.push(fatwaData);
        }

        // إعادة ترتيب الفتاوى حسب id (تصاعدي) اختياري
        fatwas.sort((a, b) => a.id - b.id);

        renderTable();
        modal.classList.remove('active');
    }

    // تصدير الملف JSON
    function exportJSON() {
        const dataStr = JSON.stringify(fatwas, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'fatwas_clean.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    // أحداث
    addNewBtn.addEventListener('click', openAddModal);
    saveBtn.addEventListener('click', saveFatwa);
    cancelModalBtn.addEventListener('click', () => modal.classList.remove('active'));
    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('adminLoggedIn');
        window.location.href = 'admin-login.html';
    });
    exportBtn.addEventListener('click', exportJSON);

    // إغلاق المودال عند النقر خارجه
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });

    // بدء التحميل
    loadFatwas();
})();