# หนี้ชัด (NeeChat) — Design Spec: Phase 1+2 (Payment Ledger)

วันที่: 2026-10-04
สถานะ: รอผู้ใช้ทบทวน

## 1. เป้าหมายของ Phase นี้

ส่งมอบเว็บแอปที่เปิดจากมือถือได้ทันที ติดตั้งเป็น PWA ได้ ล็อกอินด้วยอีเมล แล้วทำได้ครบ 5 อย่าง:

1. ตั้งค่าเงินกู้ (ชื่อ, เลขสัญญา, ยอดตั้งต้น, วันที่ของยอดนั้น, ยอดจ่ายประจำ)
2. บันทึกการชำระพร้อมแนบสลิป ภายใน 30–60 วินาที
3. ดูรายการชำระย้อนหลังแบบ timeline พร้อมยอดหลังชำระ
4. ดูรายละเอียดรายการและเปิดสลิปเต็มจอ แก้ไข/ยกเลิกแบบเก็บประวัติ
5. ดู Dashboard: ยอด Ledger ล่าสุด, ชำระแล้วรวม, จำนวนครั้ง, งวดล่าสุด

**ไม่อยู่ใน Phase นี้**: Official Snapshot, Reconciliation, Export, Backup, App Lock/PIN, OCR, แจ้งเตือน, offline-first, UI สำหรับหลายเงินกู้ (schema รองรับ แต่ UI แสดงก้อนเดียว)

## 2. การตัดสินใจหลัก

| เรื่อง | ตัดสินใจ | เหตุผล |
|---|---|---|
| ที่เก็บข้อมูล | Hosted: Next.js + Supabase | ข้อมูลอยู่รอดแม้มือถือหาย ใช้ได้หลายเครื่อง |
| Infra | Supabase (Postgres + Storage + Auth) + Vercel | ครบในที่เดียว free tier พอสำหรับคนเดียว |
| ที่อยู่ของกฎธุรกิจ | Use cases ฝั่ง server เรียกผ่าน Server Actions | กฎอยู่ที่เดียว ตรวจย้อนหลังและ test ง่าย |
| สถาปัตยกรรม | Clean Architecture 4 ชั้น ลูกศรชี้เข้าใน | ข้อกำหนดจากผู้ใช้ รองรับการดูแลระยะยาว |
| Ledger Balance | ยึดจาก opening_balance + opening_balance_date บน Loan | ง่าย ตรวจสอบได้ สอดคล้องแนวคิด Recorded Balance |
| Payment | Immutable: void แล้วสร้างใหม่ + correction record | ข้อมูลการเงินต้องย้อนดูได้ว่าเกิดอะไรขึ้น |
| Login | Supabase Auth magic link | ไม่ต้องจำรหัส ไม่เก็บ password เอง |
| ภาษา UI | ไทย ตัวเลข 3,000.00 บาท วันที่ พ.ศ. เช่น 4 ต.ค. 2569 | |

## 3. ภาพรวมระบบ

```text
มือถือ (Browser / PWA)
      │
      ▼
Next.js (presentation: หน้าจอ + Server Actions)
      │
      ▼
application: use cases + ports
      │
      ▼
domain: entities, value objects, กฎ ledger (pure)
      ▲
      │ implement ports
infrastructure
      ├── Supabase Postgres ผ่าน Drizzle ORM
      ├── Supabase Storage (bucket private "evidence", signed URL 1 ชม.)
      └── Supabase Auth (ดึง user ปัจจุบัน)
```

หลักการที่ยึดตลอด:

- ทุกแถวข้อมูลมี `user_id` และ Supabase RLS เปิดไว้เป็นชั้นป้องกันสำรอง แม้ server ใช้ service role
- ไฟล์สลิปเป็น private เสมอ เปิดผ่าน signed URL ที่หมดอายุ
- Official / Recorded / Calculated ไม่ปนกัน Phase นี้มีเฉพาะ Recorded

## 4. Data Model

ชนิดจำนวนเงินทุกคอลัมน์: `numeric(12,2)` คำนวณฝั่ง server ด้วย decimal.js ห้ามใช้ float

### loans

```text
id                    uuid PK
user_id               uuid  (auth.users.id)
name                  text        เช่น "กยศ. ของฉัน"
loan_number           text null   เลขสัญญา
opening_balance       numeric(12,2)
opening_balance_date  date        ยอดตั้งต้นเป็นของวันนี้
default_amount        numeric(12,2) null   ยอดจ่ายประจำ ใช้ auto-fill
created_at, updated_at timestamptz
```

### payments

```text
id                       uuid PK
loan_id                  uuid FK loans
user_id                  uuid
paid_at                  date
amount                   numeric(12,2)  > 0
payment_method           enum MOBILE_BANKING | COUNTER | ATM | OTHER
reference_no             text null
notes                    text null
status                   enum ACTIVE | VOIDED
voided_at                timestamptz null
void_reason              text null
replaced_by_payment_id   uuid null FK payments
created_at               timestamptz
```

ไม่มี `updated_at` โดยตั้งใจ: Payment ไม่ถูกแก้ไขหลังสร้าง ยกเว้นเปลี่ยน status เป็น VOIDED ครั้งเดียว

### payment_evidence

```text
id                 uuid PK
payment_id         uuid FK payments
user_id            uuid
storage_path       text    "{user_id}/payments/{payment_id}/{uuid}.{ext}"
type               enum PAYMENT_SLIP | RECEIPT | OTHER
mime_type          text    image/jpeg, image/png, image/webp, application/pdf
size_bytes         integer ≤ 5,242,880
original_filename  text null
created_at         timestamptz
```

### payment_corrections

```text
id                       uuid PK
user_id                  uuid
original_payment_id      uuid FK payments
replacement_payment_id   uuid null FK payments   (null = ยกเลิกเฉย ๆ)
reason                   text  บังคับ
created_at               timestamptz
```

### กฎ Immutable Ledger

การ "แก้ไข" Payment:

```text
Payment #1  3,000 บาท  ACTIVE
        │  ผู้ใช้กดแก้ไข ใส่ค่าใหม่ + เหตุผล (บังคับ)
        ▼
Payment #1  3,000 บาท  VOIDED  voided_at=now, void_reason, replaced_by → #2
Payment #2  2,500 บาท  ACTIVE  (evidence ของ #1 ถูก copy แถวมาผูกกับ #2 ชี้ไฟล์เดิม)
Correction: original=#1, replacement=#2, reason="พิมพ์ยอดผิด"
```

การ "ยกเลิก" Payment: เหมือนข้างบนแต่ไม่สร้าง #2 และ `replacement_payment_id = null`

ทั้งสองกรณีทำใน transaction เดียว Payment ที่ VOIDED แล้วห้าม void ซ้ำหรือใช้เป็นต้นทางแก้ไขอีก

### สูตร Ledger Balance

```text
Ledger Balance = opening_balance
               − SUM(amount) ของ payments ที่ status = ACTIVE
                 และ paid_at > opening_balance_date
```

Payment ที่ `paid_at <= opening_balance_date` บันทึกได้เพื่อเก็บหลักฐาน แต่ไม่นำมาลบ เพราะยอดตั้งต้นรวมไว้แล้ว ใน timeline แถวเหล่านี้แสดง "ยอดหลังชำระ: —" พร้อมคำอธิบายสั้น

"ยอดหลังชำระ" ของแต่ละแถว = opening_balance − ผลรวม ACTIVE payments ที่ paid_at > opening_balance_date และ (paid_at, created_at) ≤ แถวนั้น เรียงด้วย paid_at แล้ว created_at

## 5. หน้าจอและ flow

### หน้าจอ

| หน้า | เส้นทาง | เนื้อหา |
|---|---|---|
| Login | /login | ช่องอีเมล ปุ่มส่งลิงก์ ข้อความ "ตรวจอีเมลของคุณ" |
| ตั้งค่าเงินกู้ | /setup | ฟอร์ม Loan แสดงอัตโนมัติถ้ายังไม่มี Loan; เข้าแก้ได้จาก /more |
| Dashboard | / | การ์ด: ยอด Ledger ล่าสุด, ชำระแล้วรวม + จำนวนครั้ง, งวดล่าสุด; ปุ่มใหญ่ "+ บันทึกการชำระ" ด้านล่าง |
| รายการชำระ | /payments | timeline จัดกลุ่มตามเดือน (พ.ศ.); แถว: วันที่, จำนวนเงิน, ยอดหลังชำระ, ไอคอนมีสลิป; toggle "แสดงรายการที่ยกเลิก" |
| บันทึกการชำระ | /payments/new | ฟอร์มสั้น + แนบสลิป กล้องเป็นปุ่มหลัก |
| รายละเอียด | /payments/[id] | ข้อมูลครบ, สลิปเปิดเต็มจอ, ปุ่ม "แก้ไข" และ "ยกเลิกรายการ"; ถ้า VOIDED แสดง badge + เหตุผล + ลิงก์ไปรายการแทน; ถ้าเป็นรายการแทน แสดงลิงก์ "แก้ไขจากรายการเดิม" |
| เพิ่มเติม | /more | ตั้งค่าเงินกู้, ออกจากระบบ, เวอร์ชันแอป |

Bottom Navigation 3 แท็บ: หน้าแรก / รายการ / เพิ่มเติม (แท็บ Evidence เพิ่มใน Phase 3-4)

### Flow บันทึกการชำระ

```text
กด "+ บันทึกการชำระ"
  → ฟอร์ม auto-fill:
      วันที่      = วันนี้
      จำนวนเงิน   = loan.default_amount (ถ้ามี) ไม่งั้น = amount ของ payment ล่าสุด
      ช่องทาง     = payment_method ของ payment ล่าสุด ไม่งั้น MOBILE_BANKING
      เลขอ้างอิง  = ว่าง
      หมายเหตุ    = "ชำระงวดเดือน {เดือนย่อ} {พ.ศ.}" แก้ได้
  → [ ถ่ายรูปสลิป ] [ เลือกจาก Gallery ]   (input capture="environment" / ปกติ)
      เห็น preview ทันที
      ย่อรูปในเครื่องก่อนอัปโหลด: ด้านยาว ≤ 1600px, คุณภาพ JPEG 0.85 (PDF ไม่ย่อ)
      สลิปไม่บังคับ แต่ถ้าไม่แนบจะมีข้อความเตือนสีเหลืองก่อนบันทึก
  → กด "บันทึก"
      1. ขอ upload path จาก server action (ผูกกับ payment id ที่สร้างล่วงหน้า)
      2. อัปโหลดไฟล์ไป Storage จาก browser ด้วย signed upload URL
      3. เรียก RecordPayment use case: สร้าง Payment + Evidence ใน transaction เดียว
      4. redirect → /payments เห็นรายการใหม่บนสุด พร้อม toast "บันทึกแล้ว"
```

### Flow แก้ไข / ยกเลิก

- แก้ไข: ฟอร์มเดิมกรอกค่าเดิม + ช่อง "เหตุผลที่แก้" บังคับ → CorrectPayment use case → redirect ไปรายละเอียดของรายการใหม่
- ยกเลิก: dialog ยืนยัน + ช่องเหตุผล บังคับ → VoidPayment use case → อยู่หน้าเดิม แสดง badge "ยกเลิกแล้ว"
- แก้ไขสามารถเพิ่มสลิปใหม่ได้ สลิปเดิมติดไปด้วยอัตโนมัติ

## 6. โครงสร้างโค้ด (Clean Architecture)

```text
src/
  domain/                      ไม่ import Next.js / Drizzle / Supabase
    shared/      Money (decimal.js wrapper), DateOnly, Result/DomainError
    loan/        Loan entity, กฎ opening balance
    payment/     Payment entity (ACTIVE/VOIDED), PaymentMethod, กฎ void/replace
    evidence/    Evidence entity, allowedMimeTypes, maxSizeBytes
    ledger/      computeLedgerBalance(), buildTimeline(), computeDashboard()

  application/
    ports/       LoanRepository, PaymentRepository, EvidenceRepository,
                 FileStorage, UnitOfWork, Clock, IdGenerator, CurrentUser
    use-cases/   SetupLoan, UpdateLoan, RecordPayment, CorrectPayment,
                 VoidPayment, GetDashboard, ListPayments, GetPaymentDetail,
                 PrepareEvidenceUpload

  infrastructure/
    db/          Drizzle schema, migrations, drizzle.config.ts, DrizzleUnitOfWork
    repositories/ DrizzleLoanRepository, DrizzlePaymentRepository, DrizzleEvidenceRepository
    storage/     SupabaseFileStorage (signed upload URL, signed read URL, delete)
    auth/        SupabaseCurrentUser
    system/      SystemClock, UuidIdGenerator
    container.ts ประกอบ dependencies (เรียกจาก server actions เท่านั้น)

  presentation/
    app/         (Next.js App Router) /login /setup / /payments /payments/new /payments/[id] /more
    actions/     server actions: parse FormData ด้วย zod → use case → return Result
    components/  ui (shadcn), forms, BottomNav, PaymentRow, EvidencePicker, MoneyText
    view-models/ แปลง entity → ข้อความไทย, รูปแบบเงิน, วันที่ พ.ศ.
    middleware.ts ตรวจ session ทุก route ยกเว้น /login และ /auth/callback
```

กฎการพึ่งพา: `presentation → application → domain` และ `infrastructure → application, domain` บังคับด้วย eslint-plugin-boundaries ห้าม import ข้ามทิศ

Use case แต่ละตัวรับ input แบบ plain object คืน `Result<Output, DomainError>` ไม่ throw ออกนอกชั้น application

## 7. เทคโนโลยี

| ส่วน | เลือกใช้ |
|---|---|
| Framework | Next.js 15 App Router, TypeScript strict, React Server Components |
| UI | Tailwind CSS, shadcn/ui, lucide-react |
| ฟอร์ม | react-hook-form + zod (schema เดียวใช้ทั้ง client และ server action) |
| DB | Supabase Postgres, Drizzle ORM + drizzle-kit migrations |
| ไฟล์ | Supabase Storage bucket `evidence` (private), signed upload/read URLs |
| Auth | Supabase Auth magic link, `@supabase/ssr` สำหรับ cookie session |
| เงิน | decimal.js ใน domain, `numeric(12,2)` ใน DB |
| วันที่ | date-fns + locale th, แสดง พ.ศ. |
| PWA | manifest.json + service worker (Serwist) cache เฉพาะ shell/asset ไม่ cache ข้อมูล |
| Lint/Format | ESLint + eslint-plugin-boundaries, Prettier |
| Test | Vitest, Playwright, Supabase CLI local (Postgres ใน Docker) |

## 8. การจัดการข้อผิดพลาด

| สถานการณ์ | พฤติกรรม |
|---|---|
| ข้อมูลไม่ผ่าน zod (ยอด ≤ 0, วันที่อนาคต, ไฟล์ชนิดไม่รองรับ/เกิน 5MB, เหตุผลว่าง) | ข้อความไทยใต้ช่องนั้น ไม่เรียก server |
| อัปโหลดไฟล์ล้มเหลว | ไม่สร้าง Payment, ฟอร์มคงค่าเดิม, แสดง "อัปโหลดสลิปไม่สำเร็จ ลองใหม่" |
| สร้าง Payment ล้มเหลวหลังอัปโหลดแล้ว | server action ลบไฟล์ที่เพิ่งอัปโหลด แล้วคืน error |
| Void/Correct บน Payment ที่ VOIDED แล้ว | DomainError `PAYMENT_ALREADY_VOIDED` → "รายการนี้ถูกยกเลิกไปแล้ว" |
| ยังไม่มี Loan | middleware/layout redirect ไป /setup |
| Session หมดอายุ | redirect /login พร้อม `next=` กลับหน้าเดิม |
| Signed URL หมดอายุระหว่างดูสลิป | component ขอ URL ใหม่อัตโนมัติครั้งเดียว |

## 9. การทดสอบ

- **Domain + Use cases (Vitest, in-memory repositories)**: สูตร Ledger Balance กรณี payment ก่อน/หลัง/วันเดียวกับ opening date, รายการ VOIDED ไม่ถูกนับ, ทศนิยม .50, void ซ้ำถูกปฏิเสธ, correct copy evidence, timeline เรียงลำดับและจัดกลุ่มเดือน พ.ศ., dashboard ตัวเลข
- **Infrastructure (Vitest + Postgres จริงผ่าน Supabase CLI local)**: repositories แปลง numeric ↔ Money ถูกต้อง, transaction ของ RecordPayment/CorrectPayment rollback เมื่อล้มเหลว, RLS กันข้าม user
- **E2E (Playwright, viewport 390×844)**: login (ใช้ Supabase local inbucket อ่าน magic link) → setup → บันทึกการชำระพร้อมสลิป → เห็นในรายการพร้อมยอดหลังชำระ → แก้ไข → เห็น badge/ลิงก์ประวัติ → ยกเลิก
- แนวทาง TDD: เขียน test ชั้น domain/application ก่อนเสมอ

## 10. Deploy และ environment

- รันบนเครื่องด้วย `supabase start` (Docker) + `next dev` ไม่ต้องสมัคร Supabase ก่อน
- Production: Vercel + Supabase project 1 โปรเจกต์
- ตัวแปร: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` ใน `.env.local` (ไม่เข้า git) มี `.env.example`
- Migration รันด้วย drizzle-kit ก่อน deploy

## 11. Definition of Done (Phase 1+2)

- [ ] ล็อกอินด้วย magic link ได้บนมือถือจริง
- [ ] ตั้งค่าเงินกู้พร้อมยอดตั้งต้นได้
- [ ] บันทึกการชำระพร้อมถ่ายสลิปจากกล้องมือถือได้ภายใน 1 นาที
- [ ] รายการแสดง timeline พร้อมยอดหลังชำระถูกต้องตามสูตร
- [ ] เปิดดูสลิปจากหน้ารายละเอียดได้
- [ ] แก้ไข/ยกเลิกแล้วประวัติเดิมยังอยู่และย้อนดูได้
- [ ] Dashboard แสดงยอด Ledger, รวมที่จ่าย, จำนวนครั้ง, งวดล่าสุด
- [ ] ติดตั้งเป็น PWA บน home screen ได้
- [ ] test ทุกชั้นผ่าน, lint boundaries ผ่าน
- [ ] deploy บน Vercel + Supabase ใช้งานได้จริง
