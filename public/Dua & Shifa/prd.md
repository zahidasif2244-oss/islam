یہ رہا آپ کے لیے مکمل اور تفصیلی پرامپٹ:

---

## 🕌 Urdu Islamic Daily Post Website — Complete Prompt

````
Build a complete full-stack Urdu Islamic daily post website with an admin panel. 
Everything must be in Urdu language (RTL layout). Use Supabase as the backend database.

---

## 🌐 TECH STACK

- Frontend: React (single HTML file or JSX) with RTL support
- Backend/Database: Supabase (PostgreSQL)
- Styling: Tailwind CSS + custom Islamic aesthetic
- Language: Urdu (RTL — right-to-left layout throughout)
- Font: Noto Nastaliq Urdu or Jameel Noori Nastaleeq from Google Fonts

---

## 🗄️ SUPABASE DATABASE SCHEMA

### Table: `categories`
- id: uuid (primary key, auto-generated)
- name: text (Urdu category name, e.g. حدیث، دعا، قرآن)
- created_at: timestamp

### Table: `posts`
- id: uuid (primary key, auto-generated)
- title: text (Urdu post title)
- image_url: text (URL input for post image)
- audio_url: text (URL input for post audio)
- description: text (Urdu post body/description)
- category_id: uuid (foreign key → categories.id)
- is_published: boolean (default false)
- created_at: timestamp

---

## 🏠 PUBLIC HOME PAGE

Design an Islamic-themed homepage with a deep green and gold color palette, 
Arabic/Urdu calligraphy-style decorative elements, Islamic geometric border patterns.

### Top Navigation Bar (RTL):
- Right side: Website logo/name in Urdu (e.g. "روزانہ اسلامی پوسٹ")
- Center: Search bar with placeholder "تلاش کریں..." 
  - Live search filters posts by title as user types
- Left side: "ایڈمن پینل" button (links to /admin)

### Posts Grid:
- Show 20 published posts per page in a responsive grid (3 cols desktop, 2 tablet, 1 mobile)
- Each post card shows:
  - Post image (from image_url, with Islamic geometric frame/border)
  - Post title in Urdu (bold, Nastaleeq font)
  - Short excerpt of description (first 100 characters)
  - Category badge
  - "مزید پڑھیں" (Read More) button → opens post detail page

### Pagination:
- Below the 20 posts, show:
  - "← پچھلا صفحہ" (Previous Page) button
  - Current page indicator (e.g. صفحہ 1 / 5)
  - "اگلا صفحہ →" (Next Page) button
- Buttons are disabled when on first/last page

### Post Detail Page (/post/:id):
- Full post title
- Post image (large display)
- Audio player (if audio_url exists) — styled Islamic audio player
- Full description in Urdu
- Category name
- Back button "← واپس جائیں"

---

## 🔐 ADMIN PANEL (/admin)

### Admin Login:
- Simple password-protected page (hardcoded or Supabase auth)
- Urdu labels: "پاس ورڈ درج کریں", "لاگ ان" button

### Admin Dashboard (after login):
Show a stats overview with Islamic-themed cards:
- 📊 کل پوسٹس: [total count of posts]
- 📂 کل زمرہ جات: [total count of categories]
- ✅ شائع شدہ پوسٹس: [published posts count]
- 📝 غیر شائع پوسٹس: [unpublished posts count]

Admin sidebar navigation (RTL):
- ڈیش بورڈ (Dashboard)
- تمام پوسٹس (All Posts)
- نئی پوسٹ (New Post)
- تمام زمرہ جات (All Categories)
- نیا زمرہ (New Category)
- لاگ آؤٹ (Logout)

---

## 📝 POST MANAGEMENT (Admin)

### All Posts Page:
- Table listing all posts (title, category, published status, date)
- Each row has: ✏️ ترمیم (Edit) | 🗑️ حذف (Delete) | 👁️ دیکھیں (View) buttons
- Toggle to publish/unpublish directly from table

### New Post / Edit Post Form:
All labels in Urdu, RTL layout:
- پوسٹ کا عنوان *: text input (required)
- زمرہ *: dropdown select from categories (required)
- تصویر کا URL: text input for image URL
  - Live preview of image below input
- آڈیو کا URL: text input for audio file URL
  - Mini audio player preview below input
- تفصیل *: large textarea for Urdu description (required)
- شائع کریں: toggle switch (Publish / Unpublish)
- "پوسٹ محفوظ کریں" (Save Post) button — green
- "منسوخ کریں" (Cancel) button — gray

### Delete Post:
- Confirmation modal in Urdu: "کیا آپ واقعی یہ پوسٹ حذف کرنا چاہتے ہیں؟"
- "ہاں، حذف کریں" | "نہیں، واپس جائیں" buttons

---

## 📂 CATEGORY MANAGEMENT (Admin)

### All Categories Page:
- Table: category name, post count, created date
- Each row: ✏️ ترمیم | 🗑️ حذف buttons

### New Category / Edit Category Form:
- زمرہ کا نام *: text input
- "زمرہ محفوظ کریں" button
- "منسوخ کریں" button

### Delete Category:
- Confirmation modal: "کیا آپ یہ زمرہ حذف کرنا چاہتے ہیں؟"
- Warning if category has posts linked

---

## 🎨 DESIGN REQUIREMENTS

- Full RTL (dir="rtl") on all pages
- Color palette: Deep forest green (#1a4a2e), Gold (#c9a227), Cream (#f5f0e8), Dark (#1a1a1a)
- Islamic geometric patterns as decorative borders/dividers
- Noto Nastaliq Urdu font for all Urdu text
- Smooth fade-in animations on page load
- Mobile responsive throughout
- Islamic crescent/star subtle watermarks in backgrounds
- Loading spinner with Arabic calligraphy style
- Toast notifications in Urdu for success/error messages
  (e.g. "پوسٹ کامیابی سے محفوظ ہو گئی ✓")

---

## ⚙️ SUPABASE INTEGRATION

At top of code, define:
```js
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
````

Use Supabase JS client for all CRUD:
- `supabase.from('posts').select(*)` with pagination (.range())
- `supabase.from('posts').insert()` for new posts
- `supabase.from('posts').update()` for editing
- `supabase.from('posts').delete()` for deleting
- Same pattern for categories table
- Filter home page: `.eq('is_published', true).order('created_at', { ascending: false })`
- Pagination: `.range(page*20, page*20+19)`
- Search: `.ilike('title', '%searchTerm%')`

---

## 📱 PAGES SUMMARY

| صفحہ | راستہ | تفصیل |
|------|-------|--------|
| ہوم پیج | / | 20 پوسٹس، سرچ، پیجینیشن |
| پوسٹ تفصیل | /post/:id | مکمل پوسٹ، آڈیو، تصویر |
| ایڈمن لاگ ان | /admin | پاس ورڈ صفحہ |
| ڈیش بورڈ | /admin/dashboard | اعداد و شمار |
| تمام پوسٹس | /admin/posts | فہرست، ترمیم، حذف |
| نئی پوسٹ | /admin/posts/new | فارم |
| ترمیم پوسٹ | /admin/posts/edit/:id | فارم |
| تمام زمرہ جات | /admin/categories | فہرست |
| نیا زمرہ | /admin/categories/new | فارم |

Build this as a complete, working single-page React application with React Router for navigation. All text, labels, buttons, messages, and UI elements must be in Urdu. The overall feel should be spiritual, elegant, and authentically Islamic.

```

---

یہ پرامپٹ کسی بھی AI کوڈ جنریٹر (جیسے Claude، ChatGPT، یا Cursor) میں استعمال کریں۔ Supabase پر جا کر پہلے دونوں ٹیبلز بنائیں، پھر اپنا `SUPABASE_URL` اور `ANON_KEY` ڈالیں — ویب سائٹ مکمل چلنے لگے گی۔
```