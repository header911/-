# Haydar Pack V53.2 - File Map

نسخة V53.2 مبنية على V52 وتضيف طبقة تقارير مالية أعمق بدون لمس Apps Script أو الداتا.

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
- `assets/js/10-reports-finance-insights.js` — Finance Insights & Drilldown V53.2.

## ملفات مهمة

- `index.html` — ترتيب تحميل الملفات.
- `assets/css/styles.css` — التصميم، ويتضمن تنسيقات V52 و V53.2.
- `sw.js` — كاش PWA محدث على `v=53_2postaudit`.
- `manifest.webmanifest` — إعدادات PWA.
- `config.js` — رابط Apps Script الحالي.
