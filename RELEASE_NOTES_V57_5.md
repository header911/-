# Haydar Pack V57.9 — Print Reliability

## V57.9 fixed-PDF pipeline

- Replaced direct HTML `window.print()` for generated documents with a fixed A4-landscape PDF pipeline.
- The document is rendered into a high-resolution image inside a real `841.89 × 595.28 pt` PDF page, so Chrome's Portrait/Landscape HTML layout setting can no longer shrink it to half a page.
- Arabic text and the existing visual layout are preserved by rasterizing the already-rendered document before embedding it.
- `pdf-lib` is bundled locally and cached with the application; the PDF path does not depend on an external CDN.
- The document button now creates and opens the fixed PDF; printing or saving happens from the real PDF viewer.

## V57.9 Chrome orientation correction

- Removed the V57.7 fixed `281mm` document width that caused clipping when Chrome retained a portrait layout viewport.
- Replaced numeric page dimensions with the standard `A4 landscape` page descriptor so Chrome applies landscape to both the paper and the layout viewport.
- The sheet now fills the active printable area responsively without extending beyond it.
- Added a new cache and asset token so no V57.7 print rules can remain active.

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
- تقليل عناصر كاش PWA المكررة وتحديث رمز النسخة إلى `57_9fixedpdf`.

لا توجد أي خطوة ترحيل للبيانات. مفاتيح التخزين، بنية DB، أسماء الدوال العامة، ورابط Apps Script ما زالت متوافقة.
