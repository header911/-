# Haydar Pack V57.7 — Print Reliability

## V57.7 physical-width correction

- Print layout no longer depends on the popup or preview viewport width.
- The printable document root is fixed at `281mm`, matching A4 landscape after the two `8mm` page margins.
- The physical A4 page remains fixed at `297mm × 210mm`.
- The new cache token forces browsers and the service worker to discard the earlier print stylesheet.

## V57.7 print-layout correction

- The supplied quotation PDF confirmed that Chrome created an A4 landscape page while the document root retained a portrait-like percentage width.
- Print-only `html`, `body`, and `.sheet` widths now use the physical printable area instead of inheriting `width:100%` from preview mode.
- The page size is declared explicitly as `297mm 210mm`.
- Verified by printing a representative 11-column quotation through headless Chrome and rendering the resulting PDF: both brands and all columns are visible across the landscape page.

نسخة إصلاح آمنة مبنية على V57.4 بدون تغيير التصميم أو نموذج البيانات أو رابط Apps Script.

## ما تم

- إصلاح قص وتقسيم مستندات الطباعة وPDF، بما في ذلك المستندات القديمة المحفوظة.
- انتظار الخطوط والصور قبل فتح نافذة الطباعة.
- تثبيت عرض الجداول داخل مساحة A4 Landscape ومنع الخروج الأفقي.
- تحسين تقسيم الصفوف والإجماليات في المستندات الطويلة.
- تقوية أسماء ملفات PDF وحذف الرموز غير الصالحة أو المخفية.
- توحيد تقريب الحسابات المالية إلى منزلتين عشريتين.
- منع القيم السالبة غير الصالحة ومنع الضغط المتكرر على أزرار الحفظ.
- إصلاح قص بطاقات الأرقام الكبيرة على شاشات الموبايل.
- تقليل فحص Google أثناء الخمول من كل 20 ثانية إلى كل 60 ثانية، وإيقافه عند إخفاء الصفحة أو انقطاع الاتصال.
- منع Service Worker من اعتراض أو تخزين طلبات Apps Script الخارجية.
- تقليل عناصر كاش PWA المكررة وتحديث رمز النسخة إلى `57_7physicalprint`.

لا توجد أي خطوة ترحيل للبيانات. مفاتيح التخزين، بنية DB، أسماء الدوال العامة، ورابط Apps Script ما زالت متوافقة.
