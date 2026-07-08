# Haydar Pack V53.3 - File Map

نسخة V53.3 مبنية على V52 وتضيف طبقة تقارير مالية أعمق بدون لمس Apps Script أو الداتا.

## ملفات JavaScript

- `assets/js/01-core-base.js` — نواة البرنامج القديمة وقاعدة البيانات المحلية.
- `assets/js/02-business-legacy.js` — منطق الأعمال القديم المتبقي.
- `assets/js/03-boot-calc-print.js` — الحسابات والطباعة.
- `assets/js/04-sync-import.js` — المزامنة والاستيراد.
- `assets/js/05-feature-patches.js` — إصلاحات الأوردرات والمستندات.
- `assets/js/06-data-protection-images-backup.js` — حماية الداتا والـ Backup Center Pro.
- `assets/js/07-clients-final.js` — المصدر النهائي لصفحة العملاء.
- `assets/js/08-mobile-ux.js` — تحسينات استخدام الموبايل.
- `assets/js/09-reports-pro.js` — Reports Pro V52.
- `assets/js/10-reports-finance-insights.js` — Finance Insights & Drilldown V53.3.

## ملفات مهمة

- `index.html` — ترتيب تحميل الملفات.
- `assets/css/styles.css` — التصميم، ويتضمن تنسيقات V52 و V53.3.
- `sw.js` — كاش PWA محدث على `v=54docspro`.
- `manifest.webmanifest` — إعدادات PWA.
- `config.js` — رابط Apps Script الحالي.


## V53.3 Notes
- النسخة الحالية: `?v=54docspro`.
- V53.3 يصلح ظهور التقارير، زر Back في الموبايل، إزالة الزر العائم، وتغيير رابط Apps Script من شاشة المزامنة.
