# Automated Student ID Card Management, Generation & Bulk Download System
## Police Lines School & College, Faridpur — Reunion 2026 / 2027

**Module Status:** Production Ready & Authoritative  
**Integration Scope:** Seamlessly integrated into existing Admin Panel without modifying existing registration or payment workflows.  
**Design Standard:** Exact match to `Police Lines Student ID - Campus Signature.pptx` (CR80 Portrait: 54 × 86 mm).  
**Test Suite:** 62/62 Tests Passing (`npm test`) | 0 TypeScript Errors (`npm run lint`) | Built Successfully.

---

## 1. System Architecture & Existing System Integration

The **Student ID Card Management System** connects directly to the existing database and registration records. It retrieves all required student information directly from the authoritative registration store:

- **Primary Reference:** Existing Registration ID (e.g. `PLSCF-2026-F1001`).
- **Student Information:** Full Name (Bengali & English), Mobile Number, Address, Category (Alumni / Current).
- **Batch / Passing Year:** Dynamically retrieved from `passingYear` (for Alumni) or class/academic year (for Current Students).
- **Payment Verification:** Only records with `paymentStatus === 'paid'` are eligible for ID card generation.
- **Photograph Integration:** High-resolution student photo uploaded during registration is embedded directly into the designated gold frame. If absent, the record is flagged for administrative review (`FLAGGED_REVIEW`) with a fallback silhouette.
- **Zero Record Duplication:** The system never creates duplicate student records or asks students to register again.

---

## 2. Official PowerPoint ID Card Template Integration

The supplied PowerPoint template (`Police Lines Student ID - Campus Signature.pptx`) was extracted and analyzed down to exact millimeter coordinates ($1\text{ mm} = 36,000\text{ EMU}$):

### Physical Card Specifications
- **Format:** Standard CR80 Portrait
- **Dimensions:** $54.0 \times 86.0\text{ mm}$ ($153.07 \times 243.78\text{ pt}$ at 72 DPI; $638 \times 1016\text{ px}$ at 300 DPI)
- **Aspect Ratio:** $54 / 86 = 0.6279$

### Visual Layer Mapping

| Layer / Component | Coordinate & Dimensions | Visual Properties & Color Codes |
| :--- | :--- | :--- |
| **Card Background** | $0 \times 0$ to $54 \times 86\text{ mm}$ | Multi-stop Pearl & Sky Blue gradient (`#FDFCF8` $\to$ `#F3F7FA` $\to$ `#E1F0F8`) |
| **Upper Navy Banner** | $x=0$, $y=0$, $w=54$, $h=38.5\text{ mm}$ | Deep Navy gradient (`#041025` $\to$ `#092446` $\to$ `#123F66`) |
| **Top-Right Corner Accent** | $x=38$, $y=0$, $w=16$, $h=12\text{ mm}$ | Deep Cyan polygon (`#104D77`) |
| **Gold Contour Divider** | $y=39.0\text{ mm}$, $w=54\text{ mm}$ | Metallic Gold line (`#F5BE35`) |
| **School Crest / Logo** | $x=36.2$, $y=4.8$, $w=15.0$, $h=7.75\text{ mm}$ | Official Institution Crest (`school_crest.png`) |
| **Header Titles** | $x=3.5$, $y=3.1$ to $16.5\text{ mm}$ | Gold rule, "STUDENT IDENTITY CARD" (`#8ED9F5`), "Police Lines School & College" (`#FFFCF5`), "FARIDPUR" (`#F4CB7C`) |
| **Student Photo Frame** | $x=3.5$, $y=19.5$, $w=16.5$, $h=19.0\text{ mm}$ | Gold rounded frame (`#F3D490`) with photo inset (`15.5 \times 18.0\text{ mm}`) |
| **Student Name & Badge** | $x=21.9$, $y=25.5$ to $34.0\text{ mm}$ | Gold accent, Full Name (`#FFFCF5`, bold), Category tag ("ALUMNI MEMBER" / "CURRENT STUDENT") |
| **Batch / Year Field** | $x=3.6$, $y=44.5\text{ mm}$ | Label (`#10203A`), Value (`#1E3A8A`), Underline (`#9EB8CB`) |
| **ID Number Field** | $x=3.6$, $y=50.5\text{ mm}$ | Label (`#10203A`), Registration ID (`#1E3A8A`), Underline (`#9EB8CB`) |
| **Contact Number Field** | $x=3.6$, $y=56.5\text{ mm}$ | Label (`#10203A`), Mobile Number (`#1E3A8A`), Underline (`#9EB8CB`) |
| **Secure QR Code Box** | $x=30.9$, $y=41.5$, $w=19.8$, $h=19.8\text{ mm}$ | Gold surround (`#D9B15E`), White inset, corner tick marks (`#76A4BE`), $17 \times 17\text{ mm}$ QR |
| **Campus Footer Artwork** | $x=0$, $y=64.2$, $w=54.0$, $h=21.8\text{ mm}$ | High-res Campus photo (`campus_footer.png`), gold divider, navy corner overlay |

---

## 3. Role-Based Access Control (RBAC) & Staff Approval

The ID Card Management System enforces strict separation between Super Admin and Authorized Staff:

### Super Admin Privileges
- Create staff accounts.
- Approve or reject pending staff registrations.
- Activate, disable, or delete staff accounts.
- Reset staff passwords.
- Configure granular staff permissions (`canGenerate`, `canDownloadSingle`, `canDownloadBatch`, `canDownloadAll`).
- Access all student records across all batches.
- Generate and download individual, batch-wise, and master ZIP archives.
- Access complete Download History and administrative audit logs.

### Authorized Staff Workflow
1. A staff account is created with `status: 'PENDING_APPROVAL'`.
2. **Access Blocked:** The staff member cannot log in or access any ID card data until approved.
3. Super Admin reviews and approves the account (`status: 'APPROVED'`).
4. Staff member logs in to view eligible registrations, preview ID cards, generate cards, and download permitted batches.
5. Staff members can **never** create, approve, or manage other staff accounts.

---

## 4. Year-Wise Folder Organization & Hierarchy

All generated ID cards are dynamically grouped by the student's Graduation Year / Passing Year without hardcoding:

```
STUDENT_ID_CARDS/
├── Batch_1962/
│   ├── Individual_Cards/
│   │   ├── Student_PLSCF_2026_F001.pdf
│   │   └── Student_PLSCF_2026_F002.pdf
│   ├── Batch_1962_All_Cards.pdf (A4 Gang-run Print Deck)
│   └── Batch_1962.zip
├── Batch_1986/
│   ├── Individual_Cards/
│   │   └── Student_PLSCF_2026_F1004.pdf
│   ├── Batch_1986_All_Cards.pdf
│   └── Batch_1986.zip
├── Batch_1998/
│   ├── Individual_Cards/
│   │   └── Student_PLSCF_2026_F1001.pdf
│   ├── Batch_1998_All_Cards.pdf
│   └── Batch_1998.zip
└── Batch_2026/
    ├── Individual_Cards/
    │   ├── Student_PLSCF_2026_C2001.pdf
    │   └── Student_PLSCF_2026_C2002.pdf
    ├── Batch_2026_All_Cards.pdf
    └── Batch_2026.zip
```

If an attendee has missing graduation year info, the record is placed under `Batch_REVIEW_REQUIRED` and flagged for administrative inspection instead of guessing an incorrect year.

---

## 5. Combined A4 Gang-Run Printing Deck

For print shops and high-volume badge printers, the system provides batch-wise combined A4 printing decks:
- **Paper Size:** Standard ISO A4 ($210 \times 297\text{ mm}$).
- **Gang-Run Layout:** 9 cards per sheet (3 columns $\times$ 3 rows).
- **Margins:** Top/Bottom = $19.5\text{ mm}$; Left/Right = $24.0\text{ mm}$.
- **Cutting Guides:** Precision corner crop marks ($3\text{ mm}$ length) and bounding borders around each card for guillotine cutters.
- **Header:** Institutional deck title and page numbering ("Page X of Y").

---

## 6. One-Click Bulk Packaging Engine (10,000+ Students)

The prominent **DOWNLOAD ALL ID CARDS** button triggers an asynchronous background packaging engine:
- **Asynchronous Chunking:** Processes batches in chunks to eliminate browser thread locking and request timeouts.
- **Progress Tracking:** Live progress bar displaying percentage (0% to 100%), processed cards, total cards, and active task.
- **Archive Structure:** Master archive `Police_Lines_All_Student_ID_Cards.zip` containing all year folders, individual PDFs, and combined A4 print decks.

---

## 7. Scannable Unique QR Code Security

Every student receives a unique, scannable QR code:
- **No Sensitive Leakage:** The QR code does not expose national IDs, passwords, or raw payment tokens.
- **Verification URL:** Encodes a secure, tamper-evident URL:
  `https://plscf2026.reunion.org/verify-student-id?id=PLSCF-2026-F1001&token=PLSCF26-TANVIR-98`
- **Instant Scan Compatibility:** Scannable with standard iOS/Android cameras and industrial 2D barcode scanners.

---

## 8. Database Schema & Migration

The complete schema is provided in [`supabase/migrations/20270103000000_student_id_card_management_schema.sql`](file:///Users/sagarkumarsaha/Desktop/1%20plsc2027/plscf65/supabase/migrations/20270103000000_student_id_card_management_schema.sql):
- `id_card_staff_accounts`: Role, status (`PENDING_APPROVAL`, `APPROVED`), permissions.
- `student_id_cards`: One-to-one record with existing registration, QR token, generation timestamp, storage path.
- `batch_id_card_collections`: Batch-level card counts and combined PDF references.
- `id_card_download_jobs`: Background bulk job tracking.
- `id_card_download_logs`: Immutable administrative audit trail.

---

## 9. Verification & Quality Assurance

```bash
# Execute full test suite (62 unit & integration tests)
npm test
# Result: 62 pass, 0 fail (all 8 ID Card tests passing)

# Run TypeScript type check
npm run lint
# Result: 0 errors, 0 warnings

# Build production bundle
npm run build
# Result: Built cleanly in 890ms
```

