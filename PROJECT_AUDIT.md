# Project Audit

هذا الملف يوثق مشكلات ونقاط مراجعة لاحقة فقط. لم يتم إصلاح أي نقطة هنا. عند الاعتماد على RLS أو SQL غير موجود في المستودع، استخدم الحكم: يحتاج فحص Supabase قبل تأكيد الاستغلال.

- فرع Git الحالي عند التدقيق: `main`.
- Commit المختصر الحالي عند التدقيق: `101509c`.
- أرقام الأسطر في هذا التدقيق مبنية على هذه النسخة من الملفات وقت المراجعة.
- ملفات التوثيق الحالية تغييرات محلية غير committed حاليًا.

## 1. تحديث وحذف `finance_notes` بالـ `id` فقط دون `branch_id`

- الأولوية: P1
- الحالة: يحتاج فحص Supabase
- التبعيات: Schema Supabase.
- النطاق: متعدد الطبقات
- الدليل: صفحة الملاحظات تستخدم update/delete بالـ `id` فقط.
- مسار الملف: `app/finance/[branch]/notes/page.tsx`
- رقم السطر أو النطاق: `176`, `193`
- التأثير: احتمال تعديل أو حذف ملاحظة من فرع آخر إذا لم تمنع RLS ذلك.
- سبب الخطورة: السجل تابع لفرع، واستخدام `id` وحده لا يحقق عزل الفروع في الكود.
- ما يحتاج فحص SQL/RLS: سياسات RLS على `finance_notes` عند update/delete.
- الحكم: يحتاج فحص Supabase قبل تأكيد الاستغلال.
- الحل المقترح: إضافة فلتر `branch_id` لكل update/delete أو نقل العملية إلى API محمي.
- الملفات المتوقع تأثرها: `app/finance/[branch]/notes/page.tsx` وربما API جديد.
- نوع التعديل: Client + ربما API Route.
- طريقة التحقق بعد الإصلاح: محاولة تحديث/حذف ملاحظة بفرع مخالف يجب أن تفشل.

## 2. RPC مالية وحساسة مستدعاة مباشرة من Client

- الأولوية: P1
- الحالة: يحتاج فحص Supabase
- التبعيات: Schema Supabase، API جديدة.
- النطاق: متعدد الطبقات
- الدليل: عدة صفحات تستدعي RPC مباشرة من Client وتعتمد على `branch_id` وبيانات من جلسة توافق محلية.
- التأثير: العمليات الحساسة لا تظهر لها حراسة خادمية موحدة في الكود الحالي، ويعتمد الأمان النهائي على تعريف RPC وRLS غير الموجودين في المستودع.
- سبب الخطورة: Client يمكنه تمرير معاملات حساسة، لذلك يجب فرض الجلسة والصلاحية والفرع في API أو SQL مثبت.
- الحكم: يحتاج فحص Supabase قبل تأكيد الاستغلال.

### 2.1 عمليات تغيير بيانات أو حالة

| الفئة | RPC | الملف | السطر | نوع العملية | الحماية الظاهرة | يحتاج فحص SQL/RLS |
| --- | --- | --- | --- | --- | --- | --- |
| السداد والعقود | `record_payment_atomic` | `app/finance/[branch]/payments/new/page.tsx` | `733` | تغيير مالي | Client مباشر وlocalStorage طبقة توافق | تحقق الفرع والصلاحية ومنع التلاعب بالمبلغ |
| السداد والعقود | `cancel_payment_atomic` | `app/finance/[branch]/payments/page.tsx`, `app/finance/[branch]/contracts/[id]/page.tsx` | `726`, `764` | إلغاء دفعة | Client مباشر وlocalStorage طبقة توافق | تحقق الفرع والصلاحية وربط الدفعة بالعقد |
| السداد والعقود | `close_contract_atomic` | `app/finance/[branch]/contracts/[id]/page.tsx` | `830` | إغلاق عقد | Client مباشر وlocalStorage طبقة توافق | تحقق الأهلية والصلاحية والفرع |
| السداد والعقود | `reopen_contract_atomic` | `app/finance/[branch]/contracts/[id]/page.tsx` | `888` | إعادة فتح عقد | Client مباشر وlocalStorage طبقة توافق | تحقق الصلاحية والفرع وحالة العقد |
| السداد والعقود | `update_finance_contract_atomic` | `app/finance/[branch]/contracts/edit/[id]/page.tsx` | `1423` | تعديل عقد | Client مباشر وlocalStorage طبقة توافق | تحقق المخزون والفرع والصلاحية والذرية |
| التعثر | `declare_contract_default_atomic` | `app/finance/[branch]/contracts/[id]/declare-default/page.tsx` | `923` | إعلان تعثر | Client مباشر وlocalStorage طبقة توافق | تحقق 7 أيام كاملة، الفرع، الصلاحية، ومنع التكرار |
| العملاء | `update_customer_atomic` | `app/finance/[branch]/customers/[id]/page.tsx` | `752` | تعديل عميل | Client مباشر وlocalStorage طبقة توافق | تحقق الفرع والصلاحية وملكية العميل |
| العملاء | `delete_customer_atomic` | `app/finance/[branch]/customers/[id]/page.tsx` | `848` | حذف عميل | Client مباشر وlocalStorage طبقة توافق | تحقق الفرع والصلاحية وعدم وجود عقود مانعة |
| الحظر | `block_finance_customer` | `app/finance/[branch]/customers/blocklist/page.tsx` | `754` | إضافة حظر | Client مباشر مع تحقق واجهة | تحقق الفرع والصلاحية وعدم تكرار الحظر |
| الحظر | `unblock_finance_customer` | `app/finance/[branch]/customers/blocklist/page.tsx` | `816` | رفع حظر | Client مباشر مع تحقق واجهة | تحقق الفرع والصلاحية وحالة الحظر |
| المصروفات | `process_expense_invoice_atomic` | `app/finance/[branch]/expenses/page.tsx` | `841` | اعتماد/معالجة مصروف | Client مباشر وlocalStorage طبقة توافق | تحقق الفرع والصلاحية وحالة الفاتورة |
| المصروفات | `delete_expense_invoice_atomic` | `app/finance/[branch]/expenses/page.tsx` | `902` | حذف مصروف | Client مباشر وlocalStorage طبقة توافق | تحقق الفرع والصلاحية وحالة الفاتورة |
| المصروفات | `update_expense_invoice_atomic` | `app/finance/[branch]/expenses/[id]/edit/page.tsx` | `673` | تعديل مصروف | Client مباشر وlocalStorage طبقة توافق | تحقق الفرع والصلاحية وحالة الفاتورة |
| إعدادات الحساب | `update_own_finance_settings_atomic` | `app/finance/[branch]/settings/page.tsx` | `695` | تعديل إعدادات | Client مباشر وlocalStorage طبقة توافق | تحقق أن المستخدم يعدل نفسه داخل نفس الفرع |
| إعدادات الحساب | `change_own_finance_password_atomic` | `app/finance/[branch]/settings/page.tsx` | `802` | تغيير كلمة مرور | Client مباشر وlocalStorage طبقة توافق | تحقق كلمة المرور الحالية وجلسة المستخدم |
| إعدادات الحساب | `self_disable_finance_account_atomic` | `app/finance/[branch]/settings/page.tsx` | `868` | تعطيل الحساب | Client مباشر وlocalStorage طبقة توافق | تحقق المستخدم والفرع وكلمة المرور |

### 2.2 RPC قراءة حساسة

| الفئة | RPC | الملف | السطر | نوع العملية | الحماية الظاهرة | يحتاج فحص SQL/RLS |
| --- | --- | --- | --- | --- | --- | --- |
| إعدادات الحساب | `get_own_finance_settings_secure` | `app/finance/[branch]/settings/page.tsx` | `599` | قراءة إعدادات مستخدم | Client مباشر وlocalStorage طبقة توافق | تحقق أن المستخدم يقرأ نفسه فقط |
| تقارير/قراءة مستثمر | `get_finance_investor_inventory_summary` | `app/finance/[branch]/inventory/investors/[id]/page.tsx` | `410` | قراءة ملخص مخزون مستثمر | Client مباشر وlocalStorage طبقة توافق | تحقق الفرع والمستثمر والصلاحية |
| جلسة توافق | `validate_finance_session_state` | `lib/financeSession.ts` | `1108` | تحقق/قراءة حالة جلسة | Client helper | تحقق حدود البيانات الراجعة وصلاحية الاستدعاء |

- الحل المقترح: نقل عمليات تغيير البيانات إلى API Routes محمية أو إثبات أن RPC نفسها تتحقق من الجلسة والفرع والصلاحية داخليًا.
- طريقة التحقق بعد الإصلاح: إرسال الطلب يدويًا من مستخدم بلا صلاحية أو بفرع مخالف يجب أن يفشل، وقراءات المستخدم يجب ألا ترجع بيانات غيره.

## 3. مسارات تسجيل خروج خاطئة تستخدم `/api/finance/login`

- الأولوية: P1
- الحالة: مفتوح
- التبعيات: لا توجد.
- النطاق: Client
- الدليل: أربع صفحات تستدعي `/api/finance/login` عند الخروج، بينما المسار الصحيح الموجود هو `/finance/api/branch-logout`.
- المسار الصحيح: `app/finance/api/branch-logout/route.ts:44`, `app/finance/api/branch-logout/route.ts:64`

| الصفحة | السطر المؤكد |
| --- | --- |
| `app/finance/[branch]/contracts/promissory-note/new/page.tsx` | `664` |
| `app/finance/[branch]/contracts/new/page.tsx` | `1086` |
| `app/finance/[branch]/new-request/page.tsx` | `1384` |
| `app/finance/[branch]/customers/new/page.tsx` | `544` |

- التأثير: قد لا يتم حذف Cookie الفرع عند الخروج، وقد تبقى الجلسة الخادمية فعالة.
- سبب الخطورة: مسح localStorage وحده لا ينهي Cookie الموقعة.
- الحل المقترح: استخدام `/finance/api/branch-logout` ثم مسح مفاتيح localStorage ثم `router.replace("/login")`.
- طريقة التحقق بعد الإصلاح: استدعاء API الخروج الصحيح، إرسال Cookies عند الحاجة، حذف Cookie الفرع، مسح مفاتيح localStorage، والانتقال باستخدام `router.replace("/login")`.

## 4. إضافة المخزون وحركة المخزون ليستا ذريتين

- الأولوية: P1
- الحالة: مفتوح
- التبعيات: API جديدة، Migration.
- النطاق: متعدد الطبقات
- الدليل: صفحة إضافة كمية تنفذ تعديل `finance_inventory` ثم insert في `finance_inventory_movements` من Client.
- مسار الملف: `app/finance/[branch]/inventory/add-stock/page.tsx`
- رقم السطر أو النطاق: `217`, `234`, `248`, `269`, `285`
- التأثير: قد يتغير الرصيد دون تسجيل حركة أو العكس.
- سبب الخطورة: العملية يجب أن تنجح أو تتراجع كاملة.
- ما يحتاج فحص SQL/RLS: هل توجد قيود أو triggers تعوض هذا السلوك؛ لا توجد SQL في المستودع لإثبات ذلك.
- الحكم: يحتاج فحص Supabase قبل تأكيد الاستغلال.
- الحل المقترح: RPC/API ذرية لإضافة كمية وتسجيل الحركة.
- طريقة التحقق بعد الإصلاح: فشل تسجيل الحركة يتراجع معه تعديل الرصيد.

## 5. تعديل سند لأمر مباشرة من Client

- الأولوية: P1
- الحالة: يحتاج فحص Supabase
- التبعيات: Schema Supabase، API جديدة.
- النطاق: متعدد الطبقات
- الدليل: صفحة تعديل السند تقرأ من `finance_promissory_notes` مع `id` و`branch_id`، ثم تحدث السند مباشرة من Client مع `id` و`branch_id`، وبعدها تسجل نشاطًا منفصلًا.
- مسار الملف: `app/finance/[branch]/contracts/promissory-note/edit/[id]/page.tsx`
- رقم السطر أو النطاق: القراءة `199-209`، التحديث `872-898`، سجل النشاط `906-920`
- التأثير: التحديث وسجل النشاط ليسا مثبتين كعملية ذرية في الكود، والحراسة الخادمية غير ظاهرة.
- سبب الخطورة: حتى مع وجود `branch_id` في التحديث، تبقى الصلاحية والذرية ورقابة التعديل معتمدة على RLS/SQL غير موثقة في المستودع.
- ما يحتاج فحص SQL/RLS: RLS على `finance_promissory_notes`، صلاحيات update، ووجود audit/trigger أو RPC ذرية.
- الحكم: يحتاج فحص Supabase قبل تأكيد الاستغلال.
- الحل المقترح: نقل تعديل السند إلى API محمي أو RPC ذرية تشمل التحديث وسجل النشاط.
- طريقة التحقق بعد الإصلاح: مستخدم بلا صلاحية لا يستطيع التعديل، وفرع مخالف يفشل، وسجل النشاط يكتب أو يتراجع مع التحديث.

## 6. مجموعات العملاء تعتمد Client مباشرًا رغم وجود `branch_id`

- الأولوية: P2
- الحالة: يحتاج فحص Supabase
- التبعيات: Schema Supabase.
- النطاق: متعدد الطبقات
- الدليل: صفحة المجموعات تقرأ بـ`branch_id`، وتدرج `branch_id` عند الإنشاء، وتستخدم `id` و`branch_id` في update/delete. صفحة تفاصيل المجموعة تستخدم `id` و`branch_id` للمجموعة والعملاء.
- مسار الملف: `app/finance/[branch]/customers/groups/page.tsx`, `app/finance/[branch]/customers/groups/[id]/page.tsx`
- رقم السطر أو النطاق: القراءة `groups/page.tsx:100-104`، insert `144-149`، update `196-203`, delete `234-238`, التفاصيل `groups/[id]/page.tsx:97-117`
- التأثير: لم يظهر خطأ `branch_id` في update/delete، لكن العمليات ما زالت مباشرة من Client ولا تظهر صلاحية خادمية.
- سبب الخطورة: RLS والصلاحيات هي الضمان النهائي لهذه العمليات.
- ما يحتاج فحص SQL/RLS: سياسات `finance_customer_groups` و`finance_customers` لفرع المستخدم وصلاحياته.
- الحكم: يحتاج فحص Supabase قبل تأكيد الاستغلال.
- الحل المقترح: إبقاء `branch_id` في كل فلتر، والنظر في API محمي إذا كانت إدارة المجموعات حساسة.
- طريقة التحقق بعد الإصلاح: تعديل/حذف مجموعة من فرع مخالف يفشل، ومستخدم بلا صلاحية لا يستطيع إدارة المجموعات.

## 7. اختلاف قوائم `MANAGER_ROLES` بين الخادم والواجهات

- الأولوية: P2
- الحالة: مفتوح
- التبعيات: قرار منتج.
- النطاق: متعدد الطبقات
- الدليل: القائمة الخادمية المرجعية تختلف عن بعض قوائم الواجهة وAPI المتابعة.

| الملف | القيم الحرفية | الفرق |
| --- | --- | --- |
| `lib/requireFinanceBranchSession.ts:90-96` | `main_admin`, `branch_manager`, `مدير رئيسي`, `مدير فرع`, `مدير` | القائمة الخادمية المرجعية |
| `app/finance/api/follow-up/route.ts:11-19` | `main_admin`, `branch_manager`, `admin`, `manager`, `مدير رئيسي`, `مدير فرع`, `مدير` | زيادة `admin`, `manager` |
| `app/finance/[branch]/page.tsx:257-265` | `main_admin`, `branch_manager`, `admin`, `manager`, `مدير فرع`, `مدير رئيسي`, `مدير` | زيادة `admin`, `manager` |
| `app/finance/[branch]/customers/page.tsx:44-52` | `main_admin`, `branch_manager`, `admin`, `manager`, `مدير فرع`, `مدير رئيسي`, `مدير` | زيادة `admin`, `manager` |
| `app/finance/[branch]/customers/blocklist/page.tsx:78-86` | `main_admin`, `branch_manager`, `admin`, `manager`, `مدير فرع`, `مدير رئيسي`, `مدير` | زيادة `admin`, `manager` |
| `app/finance/[branch]/permissions/page.tsx:68-74` | `مدير`, `مدير فرع`, `مدير رئيسي`, `branch_manager`, `main_admin` | مطابقة للخادمية من حيث القيم |
| `app/finance/[branch]/contracts/[id]/page.tsx:183-189` | `main_admin`, `branch_manager`, `مدير فرع`, `مدير رئيسي`, `مدير` | مطابقة للخادمية من حيث القيم |
| `app/finance/[branch]/expenses/page.tsx:35-44` | `main_admin`, `branch_manager`, `admin`, `manager`, `مدير فرع`, `مدير رئيسي`, `مدير`, `support_impersonation` | زيادة `admin`, `manager`, `support_impersonation` |

- التأثير: قد تظهر صلاحية أو زر في الواجهة ثم يرفض الخادم العملية، أو تختلف معاملة الدور بين صفحة وأخرى.
- سبب الخطورة: مصدر الأدوار غير موحد.
- الحل المقترح: توحيد مصدر الأدوار أو توثيق الفرق المقصود صراحة.
- طريقة التحقق بعد الإصلاح: اختبار كل دور عبر UI وAPI لنفس العملية.

## 8. خلط حالة المتأخر مع أهلية إعلان التعثر

- الأولوية: P2
- الحالة: مفتوح
- التبعيات: قرار منتج.
- النطاق: Client + Server/API
- الدليل: API المتابعة يصنف التأخر بعد يوم واحد، بينما تفاصيل العقد وصفحة إعلان التعثر تستخدمان 7 أيام في بعض العرض أو الشروط.
- مسارات الملفات وأرقام الأسطر:
  - `app/finance/api/follow-up/route.ts:177-207`: حساب `daysLate`.
  - `app/finance/api/follow-up/route.ts:1103-1113`: `overdue` عند `daysLate >= 1`.
  - `app/finance/[branch]/contracts/[id]/page.tsx:1197-1216`: `isAutomaticallyLate` عند `contractDaysAfterDue >= 7`.
  - `app/finance/[branch]/contracts/[id]/page.tsx:1228-1240`: عرض `متعثر` عند وجود default فعّال و`متأخر` عند `isAutomaticallyLate`.
  - `app/finance/[branch]/contracts/[id]/declare-default/page.tsx:581-610`: `isLate` عند `daysAfterDue >= 7`.
  - `app/finance/[branch]/contracts/[id]/declare-default/page.tsx:871-878`: منع إعلان التعثر قبل 7 أيام.
  - `app/finance/[branch]/contracts/[id]/declare-default/page.tsx:922-944`: التعثر لا يعلن فعليًا إلا بعد نجاح `declare_contract_default_atomic`.
- التأثير: قد تختلط ثلاث حالات: متأخر بعد اليوم التالي، مؤهل لإعلان التعثر بعد 7 أيام كاملة، ومتعثر معلن بعد RPC.
- الحل المقترح: فصل أسماء وحسابات الحالات الثلاث في الكود والواجهة.
- طريقة التحقق بعد الإصلاح: عقد بعد يوم واحد يظهر متأخرًا لا مؤهلًا للتعثر، وبعد 7 أيام يظهر مؤهلًا، وبعد نجاح RPC يظهر متعثرًا.

## 9. `/admin` يعرض جدول `calculations` دون حماية خادمية ظاهرة

- الأولوية: P1
- الحالة: يحتاج فحص Supabase
- التبعيات: Schema Supabase، قرار منتج.
- النطاق: Client + Database
- الدليل: صفحة `/admin` تقرأ `calculations` مباشرة وتعرضها مرتبة دون جلسة أو تحقق خادمي ظاهر.
- مسار الملف: `app/admin/page.tsx`
- رقم السطر أو النطاق: `13-23`
- الجدول المستخدم: `calculations`
- التأثير: قد يعرض بيانات حسابات إذا كانت RLS لا تمنع ذلك.
- الحكم: يحتاج فحص Supabase قبل تأكيد الاستغلال.
- الحل المقترح: حذف المسار، أو حمايته، أو نقله إلى API بإذن واضح.
- طريقة التحقق بعد الإصلاح: مستخدم غير مصرح لا يستطيع فتح البيانات أو جلبها.

## 10. `/customer` يعتمد على localStorage فقط

- الأولوية: P2
- الحالة: يحتاج قرار منتج
- التبعيات: قرار منتج.
- النطاق: Client
- الدليل: صفحة العميل تقرأ `customer_id`, `customer_name`, `customer_phone`, `customer_sector` من localStorage وتستخدم `window.location.href`.
- مسار الملف: `app/customer/page.tsx`
- رقم السطر أو النطاق: `5-24`
- الجداول المستخدمة: لا يوجد استعلام مباشر في هذه الصفحة.
- التأثير: صفحة قديمة أو عامة تعتمد على بيانات قابلة للتغيير من المتصفح.
- الحل المقترح: تحديد هل بوابة العميل مطلوبة في الإنتاج، ثم نقل الجلسة إلى تحقق خادمي أو حذف المسار.
- طريقة التحقق بعد الإصلاح: تعديل localStorage لا يغير هوية العميل ولا يمنح وصولًا.

## 11. `/customer/calculations` يقرأ `calculations` بمعرف عميل من localStorage

- الأولوية: P1
- الحالة: يحتاج فحص Supabase
- التبعيات: Schema Supabase، قرار منتج.
- النطاق: Client + Database
- الدليل: الصفحة تقرأ `customer_id` من localStorage ثم تستعلم `calculations.eq("customer_id", customerId)`.
- مسار الملف: `app/customer/calculations/page.tsx`
- رقم السطر أو النطاق: `28-41`
- الجدول المستخدم: `calculations`
- التأثير: معرف العميل قابل للتغيير في Client، والحماية النهائية تعتمد على RLS.
- الحكم: يحتاج فحص Supabase قبل تأكيد الاستغلال.
- الحل المقترح: جلسة عميل خادمية أو API يتحقق من العميل.
- طريقة التحقق بعد الإصلاح: تغيير `customer_id` في localStorage لا يعرض حسابات عميل آخر.

## 12. `/customer/calculations/[id]` يقرأ تفاصيل حساب بمعرفين من Client

- الأولوية: P1
- الحالة: يحتاج فحص Supabase
- التبعيات: Schema Supabase، قرار منتج.
- النطاق: Client + Database
- الدليل: الصفحة تقرأ `customer_id` من localStorage وتستخدم `id` من الرابط ثم تستعلم `calculations`.
- مسار الملف: `app/customer/calculations/[id]/page.tsx`
- رقم السطر أو النطاق: `36-50`
- الجدول المستخدم: `calculations`
- التأثير: كل من `id` و`customer_id` قابلان للتحكم من Client أو الرابط، والحماية النهائية تعتمد على RLS.
- الحكم: يحتاج فحص Supabase قبل تأكيد الاستغلال.
- الحل المقترح: API خادمي يتحقق من جلسة العميل وملكية السجل.
- طريقة التحقق بعد الإصلاح: رابط حساب لا يخص العميل لا يعرض بيانات.

## 13. `/register` يدرج مباشرة في جدول `customers`

- الأولوية: P1
- الحالة: يحتاج فحص Supabase
- التبعيات: Schema Supabase، قرار منتج.
- النطاق: Client + Database
- الدليل: صفحة التسجيل تستخدم `supabase.from("customers").insert(...)` مباشرة.
- مسار الملف: `app/register/page.tsx`
- رقم السطر أو النطاق: `62-69`
- الجدول المستخدم: `customers`
- التأثير: إدخال عملاء من صفحة عامة يعتمد على قيود/RLS/validation غير موثقة داخل المستودع.
- الحكم: يحتاج فحص Supabase قبل تأكيد الاستغلال.
- الحل المقترح: API تسجيل مع validation، rate limit، وتحديد إن كان المسار مطلوبًا.
- طريقة التحقق بعد الإصلاح: إدخال مكرر أو غير صالح أو آلي يفشل حسب القواعد.

## 14. `/ehtisab` يدرج في `calculations` بمعرف عميل من localStorage

- الأولوية: P2
- الحالة: يحتاج فحص Supabase
- التبعيات: Schema Supabase، قرار منتج.
- النطاق: Client + Database
- الدليل: صفحة الاحتساب العامة تستخدم `localStorage.getItem("customer_id")` عند insert في `calculations`.
- مسار الملف: `app/ehtisab/page.tsx`
- رقم السطر أو النطاق: `177-184`
- الجدول المستخدم: `calculations`
- التأثير: ربط الحساب بعميل يعتمد على قيمة قابلة للتغيير من Client.
- الحكم: يحتاج فحص Supabase قبل تأكيد الاستغلال.
- الحل المقترح: تحديد هل الصفحة العامة مطلوبة، ثم استخدام جلسة عميل موثوقة أو عدم ربطها بعميل.
- طريقة التحقق بعد الإصلاح: تعديل localStorage لا يربط الحساب بعميل آخر.

## 15. `/supabase-test` صفحة اختبار تقرأ `rate_rules`

- الأولوية: P3
- الحالة: يحتاج قرار منتج
- التبعيات: قرار منتج.
- النطاق: Client + Database
- الدليل: صفحة الاختبار تستعلم `rate_rules.select("id").limit(1)` دون حماية ظاهرة.
- مسار الملف: `app/supabase-test/page.tsx`
- رقم السطر أو النطاق: `6-14`
- الجدول المستخدم: `rate_rules`
- التأثير: صفحة اختبار قد تكشف حالة الاتصال أو بنية جدول في الإنتاج.
- الحكم: يحتاج فحص Supabase قبل تأكيد الاستغلال.
- الحل المقترح: حذفها أو حمايتها أو تعطيلها في الإنتاج.
- طريقة التحقق بعد الإصلاح: المسار غير متاح في الإنتاج أو يتطلب صلاحية واضحة.

## 16. API سير العمل يجلب حدودًا كبيرة من البيانات

- الأولوية: P2
- الحالة: مفتوح
- التبعيات: API جديدة.
- النطاق: Server/API
- الدليل: `workflow` يستخدم `MAX_ACTIVITY_RECORDS = 10_000` و`MAX_CONTRACT_RECORDS = 20_000` مع `DATABASE_PAGE_SIZE = 1000`.
- مسار الملف: `app/finance/api/workflow/route.ts`
- رقم السطر أو النطاق: الثوابت `17-20`، تحميل النشاط `146-151`، تحميل العقود `314-319`، meta limits `500-502`
- التأثير: ارتفاع استهلاك الذاكرة، زمن الاستجابة، واستهلاك الشبكة مع نمو البيانات.
- سبب الخطورة: API واحد قد يسحب حجمًا كبيرًا لكل فتح أو تحديث لسير العمل.
- الحل المقترح: pagination خادمية حقيقية، استعلامات إحصائية مجمعة، وجلب البيانات اللازمة فقط لكل تبويب.
- طريقة التحقق بعد الإصلاح: استجابة workflow محدودة بحجم page واضح ولا تجلب كل العقود أو النشاطات.

## 17. عدم توحيد آلية حماية API Routes

- الأولوية: P2
- الحالة: مفتوح
- التبعيات: لا توجد.
- النطاق: Server/API
- الدليل: لم يظهر من الفحص الحالي API محميًا مفقود الحماية بالكامل؛ لكن آليات الحماية متعددة بين `verifyAdminSupportRequest`, `requireFinanceBranchSession`, وتحقق Cookie يدوي.
- تصنيف المسارات:
  - عامة بطبيعتها: login/logout مثل `app/api/admin-support/login/route.ts:416`, `app/api/admin-support/logout/route.ts:8`, `app/finance/api/branch-login/route.ts:117`, `app/finance/api/branch-logout/route.ts:44`, `app/finance/api/branch-logout/route.ts:64`.
  - محمية بـ`verifyAdminSupportRequest`: dashboard/branches/support-users/impersonate/verifications مثل `app/api/admin-support/dashboard/route.ts:329`, `app/api/admin-support/branches/route.ts:437`, `app/api/admin-support/verifications/search/route.ts:138`.
  - محمية بـ`requireFinanceBranchSession`: workflow/permissions مثل `app/finance/api/workflow/route.ts:404`, `app/finance/api/permissions/route.ts:203`.
  - تحقق Cookie يدوي موثق: finance create/customers/promissory/follow-up/customer-verification مثل `app/api/finance/new-request/route.ts:393`, `app/api/finance/contracts/create/route.ts:457`, `app/api/finance/promissory-notes/route.ts:678`, `app/finance/api/customer-verification/route.ts:160`, `app/finance/api/follow-up/route.ts:567`.
- التأثير: التعدد يزيد تكلفة المراجعة واحتمال اختلاف السلوك، لكنه ليس مشكلة أمنية مؤكدة بذاته إذا حققت الطرق المتطلبات نفسها.
- الحل المقترح: توثيق نمط حماية موحد أو مصفوفة حماية لكل API.
- طريقة التحقق بعد الإصلاح: اختبارات 401/403 لكل API حسب نوع الجلسة والصلاحية.

## 18. عدم تطابق مؤكد في dependencies الجذرية بين `package.json` و`package-lock.json`

- الأولوية: P2
- الحالة: مفتوح
- التبعيات: لا توجد.
- النطاق: Server/API
- الدليل: `package.json` يحتوي dependencies غير موجودة ضمن dependencies الجذرية في `package-lock.json`.
- مسار الملف: `package.json`, `package-lock.json`
- رقم السطر أو النطاق: `package.json:11-17`, `package-lock.json:10-14`
- التفاصيل:
  - `html2canvas` موجود في `package.json:12` ومفقود من dependencies الجذرية في `package-lock.json:10-14`.
  - `jspdf` موجود في `package.json:13` ومفقود من dependencies الجذرية في `package-lock.json:10-14`.
  - `@supabase/supabase-js` موجود في `package.json:14` ومفقود من dependencies الجذرية في `package-lock.json:10-14`.
  - `next`, `react`, `react-dom` موجودة ومتطابقة في `package.json:15-17` و`package-lock.json:11-13`.
- التأثير: تثبيت غير قابل للتكرار أو اختلاف بيئات.
- الحل المقترح: تحديث lockfile في مهمة مخصصة بعد موافقة، دون تعديل يدوي.
- طريقة التحقق بعد الإصلاح: lockfile يحتوي كل dependencies الجذرية بنفس الإصدارات المطلوبة.

## 19. اعتماد بعض الصفحات القديمة على `localStorage` والتنقل الكامل

- الأولوية: P2
- الحالة: مفتوح
- التبعيات: لا توجد.
- النطاق: Client
- الدليل: صفحات قديمة تقرأ جلسات من localStorage وتستخدم `window.location.href` أو `window.location.reload()`.
- مسارات وأرقام أسطر مؤكدة: `lib/getBranchUser.ts:7-11`, `lib/financeSession.ts:97-121`, `lib/requireBranchAuth.ts:7`, `app/finance/[branch]/expenses/new/page.tsx:580`, `app/finance/[branch]/inventory/products/[id]/edit/page.tsx:147`
- التأثير: حماية الواجهة لا تساوي حماية خادمية، والتنقل الكامل قد يفقد state ويخالف نمط App Router.
- الحل المقترح: الاعتماد على Cookie موقعة وخادم للعمليات الحساسة، واستبدال التنقل بـrouter حيث يلزم.
- طريقة التحقق بعد الإصلاح: تعديل localStorage يدويًا لا يمنح صلاحيات، والتنقل يتم دون reload كامل.

## 20. عدم توحيد `normalizeDigits`

- الأولوية: P3
- الحالة: مفتوح
- التبعيات: لا توجد.
- النطاق: Client + Server/API
- الدليل: helper موجود في `lib/numberUtils.ts` لكن المنطق مكرر في صفحات وAPIs كثيرة.
- مسار الملف: `lib/numberUtils.ts`, `app/login/page.tsx`, `app/api/finance/contracts/create/route.ts`, `app/admin-support/page.tsx`
- رقم السطر أو النطاق: `lib/numberUtils.ts:1`, `app/login/page.tsx:82`
- التأثير: اختلافات في التحويل والتحقق.
- الحل المقترح: استخدام helper موحد في كل الملفات المناسبة.
- طريقة التحقق بعد الإصلاح: إدخال ٠١٢٣ و۰۱۲۳ يتحول فورًا إلى 0123.

## 21. عدم وجود تعريفات SQL/migrations داخل المستودع

- الأولوية: P1
- الحالة: يحتاج فحص Supabase
- التبعيات: Schema Supabase.
- النطاق: Database
- الدليل: لا توجد ملفات `.sql` أو migrations أو schema في الجرد الحالي.
- مسار الملف: المستودع كامل.
- رقم السطر أو النطاق: غير منطبق.
- التأثير: لا يمكن تأكيد RLS، SECURITY DEFINER، الذرية، أو صلاحيات execute.
- سبب الخطورة: أسماء RPC وحدها لا تثبت الأمان.
- الحل المقترح: إضافة migrations/SQL مرجعية أو تصدير موثق قابل للمراجعة.
- طريقة التحقق بعد الإصلاح: مراجعة SQL داخل المستودع.

## 22. وجود `FinanceType = "personal" | "real" | "both"`

- الأولوية: P2
- الحالة: يحتاج قرار منتج
- التبعيات: قرار منتج.
- النطاق: Client
- الدليل: نوع `FinanceType` لا يزال يحتوي `both`.
- مسار الملف: `lib/ehtisabEngine.ts`
- رقم السطر أو النطاق: `1`
- التأثير: يخالف قرار إزالة خيار "شخصي + عقاري" إذا لم يعد مستخدمًا.
- الحل المقترح: مراجعة صفحة احتساب التمويل والمحرك وإزالة `both` عند التأكد.
- طريقة التحقق بعد الإصلاح: لا يظهر خيار both ولا تقبله الحسابات.

## 23. صفحات وأدوات تجريبية تحتاج تحديد وضعها قبل الإنتاج

- الأولوية: P3
- الحالة: يحتاج قرار منتج
- التبعيات: قرار منتج.
- النطاق: Client
- الدليل: مسارات `design-lab*` و`supabase-test`.
- مسار الملف: `app/finance/[branch]/design-lab*/page.tsx`, `app/supabase-test/page.tsx`
- رقم السطر أو النطاق: `app/finance/[branch]/design-lab-v13/page.tsx:19`, `app/supabase-test/page.tsx:6-14`
- التأثير: تعريض صفحات اختبار أو تصميم غير مقصودة.
- الحل المقترح: حذفها أو حمايتها أو توثيق أنها non-production.
- طريقة التحقق بعد الإصلاح: لا تصل إليها بيئة الإنتاج أو تكون محمية.

## خطة المعالجة المقترحة

1. عزل الفروع والجلسات والخروج: البنود 1، 3، 5، 6، 9، 11، 12، 13، 14.
2. العمليات الحساسة وفرض الصلاحيات خادميًا: البنود 2، 5، 6.
3. سحب Schema ومراجعة RLS وRPC: البنود 1، 2، 4، 5، 6، 9، 11، 12، 13، 14، 15، 21.
4. العمليات الذرية: البنود 4، 5، وجزء العقود/السداد من البند 2.
5. توحيد الحالات والمنطق التجاري: البنود 7، 8، 22.
6. الأداء وpagination: البند 16، ثم مراجعة القوائم الكبيرة الأخرى.
7. توحيد helpers والتنظيف: البنود 19، 20.
8. المسارات القديمة والتجريبية: البنود 9 إلى 15، 23.
9. Dependencies وlockfile: البند 18.
