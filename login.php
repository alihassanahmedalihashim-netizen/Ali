<?php
session_start();

// بيانات تسجيل الدخول
define('ADMIN_USER', 'userali');
define('ADMIN_PASS', 'ali773399154');
define('DATA_FILE', 'fatwas_clean.json'); // تأكد من وجود هذا الملف أو سيتم إنشاؤه

// تسجيل الدخول
if (isset($_POST['login'])) {
    if ($_POST['username'] === ADMIN_USER && $_POST['password'] === ADMIN_PASS) {
        $_SESSION['admin'] = true;
    } else {
        $error = 'بيانات الدخول غير صحيحة';
    }
}

// تسجيل الخروج
if (isset($_GET['logout'])) {
    session_destroy();
    header('Location: ' . strtok($_SERVER['REQUEST_URI'], '?'));
    exit;
}

// التحقق من الجلسة
$isAdmin = isset($_SESSION['admin']) && $_SESSION['admin'] === true;

// قراءة البيانات
function loadFatwas() {
    if (!file_exists(DATA_FILE)) {
        file_put_contents(DATA_FILE, '[]');
    }
    return json_decode(file_get_contents(DATA_FILE), true) ?: [];
}

// حفظ البيانات
function saveFatwas($data) {
    file_put_contents(DATA_FILE, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

// الحصول على أكبر ID
function getNextId($fatwas) {
    if (empty($fatwas)) return 1;
    $maxId = max(array_column($fatwas, 'id'));
    return $maxId + 1;
}

// معالجة الإضافة والتعديل والحذف
if ($isAdmin) {
    // حذف
    if (isset($_GET['delete'])) {
        $id = (int)$_GET['delete'];
        $fatwas = loadFatwas();
        $fatwas = array_filter($fatwas, fn($f) => $f['id'] !== $id);
        saveFatwas(array_values($fatwas));
        header('Location: ' . strtok($_SERVER['REQUEST_URI'], '?'));
        exit;
    }

    // حفظ (إضافة/تعديل)
    if (isset($_POST['save'])) {
        $id = isset($_POST['id']) && $_POST['id'] !== '' ? (int)$_POST['id'] : null;
        $title = $_POST['title'] ?? '';
        $question = $_POST['question'] ?? '';
        $answer = $_POST['answer'] ?? '';
        $mufti = $_POST['mufti'] ?? '';
        $date = $_POST['date'] ?? '';
        $tags = array_map('trim', explode(',', $_POST['tags'] ?? ''));
        $tags = array_filter($tags);

        $fatwa = [
            'id' => $id,
            'title' => $title,
            'question' => $question,
            'answer' => $answer,
            'mufti' => $mufti,
            'date' => $date,
            'tags' => $tags
        ];

        $fatwas = loadFatwas();

        if ($id === null) {
            // إضافة جديدة
            $fatwa['id'] = getNextId($fatwas);
            $fatwas[] = $fatwa;
        } else {
            // تعديل
            foreach ($fatwas as &$f) {
                if ($f['id'] === $id) {
                    $f = $fatwa;
                    break;
                }
            }
        }

        saveFatwas($fatwas);
        header('Location: ' . strtok($_SERVER['REQUEST_URI'], '?'));
        exit;
    }
}

// جلب البيانات للعرض
$fatwas = $isAdmin ? loadFatwas() : [];

// بيانات التعديل إن وجدت
$editFatwa = null;
if ($isAdmin && isset($_GET['edit'])) {
    $editId = (int)$_GET['edit'];
    foreach ($fatwas as $f) {
        if ($f['id'] === $editId) {
            $editFatwa = $f;
            break;
        }
    }
}
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>إدارة الفتاوى</title>
    <style>
        body {
            font-family: 'Tajawal', sans-serif;
            background: #f4f7f9;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 1300px;
            margin: auto;
            background: white;
            border-radius: 20px;
            padding: 25px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        h1, h2 {
            color: #016fae;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 0.9rem;
        }
        th {
            background: #016fae;
            color: white;
            padding: 12px;
        }
        td {
            padding: 10px;
            border-bottom: 1px solid #ddd;
        }
        tr:hover {
            background: #f1f9ff;
        }
        .btn {
            display: inline-block;
            padding: 8px 15px;
            border-radius: 30px;
            border: none;
            color: white;
            text-decoration: none;
            font-size: 0.85rem;
            margin: 2px;
            cursor: pointer;
        }
        .btn-edit { background: #f39c12; }
        .btn-delete { background: #e74c3c; }
        .btn-add { background: #27ae60; }
        .btn-logout { background: #34495e; }
        .btn-save { background: #016fae; }
        .btn-cancel { background: #7f8c8d; }
        .form-group {
            margin-bottom: 15px;
        }
        label {
            font-weight: bold;
            display: block;
            margin-bottom: 5px;
        }
        input, textarea {
            width: 100%;
            padding: 10px;
            border: 1px solid #ccc;
            border-radius: 8px;
            font-family: inherit;
            box-sizing: border-box;
        }
        textarea {
            min-height: 80px;
        }
        .login-box {
            max-width: 400px;
            margin: 50px auto;
            background: white;
            padding: 30px;
            border-radius: 20px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        .error {
            color: red;
            margin: 10px 0;
        }
        .flex {
            display: flex;
            gap: 10px;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
        }
        @media (max-width: 700px) {
            table, thead, tbody, tr, td, th {
                display: block;
            }
            thead {
                display: none;
            }
            tr {
                margin-bottom: 15px;
                border: 1px solid #ddd;
                border-radius: 10px;
                padding: 10px;
            }
            td {
                display: flex;
                justify-content: space-between;
                align-items: center;
                border: none;
                padding: 8px;
            }
            td::before {
                content: attr(data-label);
                font-weight: bold;
                margin-left: 10px;
                color: #016fae;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <?php if (!$isAdmin): ?>
            <!-- صفحة تسجيل الدخول -->
            <div class="login-box">
                <h1>دخول المشرف</h1>
                <?php if (isset($error)) echo "<p class='error'>$error</p>"; ?>
                <form method="post">
                    <div class="form-group">
                        <label>اسم المستخدم</label>
                        <input type="text" name="username" required>
                    </div>
                    <div class="form-group">
                        <label>كلمة المرور</label>
                        <input type="password" name="password" required>
                    </div>
                    <button type="submit" name="login" class="btn btn-add" style="width:100%">دخول</button>
                </form>
            </div>
        <?php else: ?>
            <!-- رأس الصفحة -->
            <div class="flex">
                <h1>إدارة الفتاوى</h1>
                <a href="?logout" class="btn btn-logout">تسجيل الخروج</a>
            </div>

            <!-- نموذج الإضافة/التعديل -->
            <h2><?php echo $editFatwa ? 'تعديل فتوى' : 'إضافة فتوى جديدة'; ?></h2>
            <form method="post">
                <?php if ($editFatwa): ?>
                    <input type="hidden" name="id" value="<?php echo $editFatwa['id']; ?>">
                <?php endif; ?>
                <div class="form-group">
                    <label>العنوان (اختياري)</label>
                    <input type="text" name="title" value="<?php echo htmlspecialchars($editFatwa['title'] ?? ''); ?>">
                </div>
                <div class="form-group">
                    <label>السؤال *</label>
                    <textarea name="question" required><?php echo htmlspecialchars($editFatwa['question'] ?? ''); ?></textarea>
                </div>
                <div class="form-group">
                    <label>الجواب</label>
                    <textarea name="answer"><?php echo htmlspecialchars($editFatwa['answer'] ?? ''); ?></textarea>
                </div>
                <div class="form-group">
                    <label>المفتي</label>
                    <input type="text" name="mufti" value="<?php echo htmlspecialchars($editFatwa['mufti'] ?? ''); ?>">
                </div>
                <div class="form-group">
                    <label>التاريخ</label>
                    <input type="date" name="date" value="<?php echo htmlspecialchars($editFatwa['date'] ?? ''); ?>">
                </div>
                <div class="form-group">
                    <label>التصنيفات (مفصولة بفواصل)</label>
                    <input type="text" name="tags" value="<?php echo isset($editFatwa) ? htmlspecialchars(implode(', ', $editFatwa['tags'] ?? [])) : ''; ?>" placeholder="طهارة, صلاة">
                </div>
                <div class="flex">
                    <button type="submit" name="save" class="btn btn-save">حفظ</button>
                    <?php if ($editFatwa): ?>
                        <a href="?" class="btn btn-cancel">إلغاء</a>
                    <?php endif; ?>
                </div>
            </form>

            <!-- قائمة الفتاوى -->
            <h2>جميع الفتاوى</h2>
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>العنوان</th>
                        <th>السؤال</th>
                        <th>الجواب</th>
                        <th>المفتي</th>
                        <th>التاريخ</th>
                        <th>التصنيفات</th>
                        <th>إجراءات</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($fatwas as $f): ?>
                    <tr>
                        <td data-label="#"><span><?php echo $f['id']; ?></span></td>
                        <td data-label="العنوان"><span><?php echo htmlspecialchars($f['title'] ?? ''); ?></span></td>
                        <td data-label="السؤال"><span><?php echo htmlspecialchars(mb_substr($f['question'] ?? '', 0, 50)) . (mb_strlen($f['question'] ?? '') > 50 ? '…' : ''); ?></span></td>
                        <td data-label="الجواب"><span><?php echo htmlspecialchars(mb_substr($f['answer'] ?? '', 0, 50)) . (mb_strlen($f['answer'] ?? '') > 50 ? '…' : ''); ?></span></td>
                        <td data-label="المفتي"><span><?php echo htmlspecialchars($f['mufti'] ?? ''); ?></span></td>
                        <td data-label="التاريخ"><span><?php echo htmlspecialchars($f['date'] ?? ''); ?></span></td>
                        <td data-label="التصنيفات"><span><?php echo htmlspecialchars(implode('، ', $f['tags'] ?? [])); ?></span></td>
                        <td data-label="إجراءات">
                            <a href="?edit=<?php echo $f['id']; ?>" class="btn btn-edit">تعديل</a>
                            <a href="?delete=<?php echo $f['id']; ?>" class="btn btn-delete" onclick="return confirm('هل أنت متأكد؟')">حذف</a>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        <?php endif; ?>
    </div>
</body>
</html>