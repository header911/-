# V56 File Map

- `index.html` — تحميل التطبيق والكاش v=56capitalwallet.
- `assets/js/01-core-base.js` إلى `07-clients-final.js` — الأساس والوظائف القديمة المستقرة.
- `assets/js/08-post49-final-modules.js` — كل موديولات ما بعد V49 + V56 Capital & Wallet.
- `assets/css/styles.css` — ستايل البرنامج الأساسي.
- `sw.js` — Service Worker cache: `haydar-pack-pwa-v56-capital-wallet`.

## بيانات جديدة داخل DB
- `DB.houseExpenses[]` — مصروفات البيت.
- `DB.walletAdjustments[]` — تسويات السيولة اليدوية.
- `DB.settings.v56Wallet` — الرصيد الافتتاحي وفترة التقرير.
