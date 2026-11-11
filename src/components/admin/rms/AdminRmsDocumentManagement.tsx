import React, { useState } from 'react';
import {
  FileText,
  Upload,
  Search,
  Filter,
  Download,
  Eye,
  ShieldCheck,
  Building,
  Calendar,
  X,
  FileCode,
  FileCheck,
  Lock,
} from 'lucide-react';
import { RmsDocument } from '../../../types/rms';
import { Language } from '../../../types';
import { RmsStore } from '../../../services/rmsStore';

interface Props {
  language: Language;
}

export const AdminRmsDocumentManagement: React.FC<Props> = ({ language }) => {
  const [documents, setDocuments] = useState<RmsDocument[]>(() => RmsStore.getDocuments());
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [committeeFilter, setCommitteeFilter] = useState<string>('all');

  // Modals
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<RmsDocument | null>(null);

  // Upload Form State
  const [docTitle, setDocTitle] = useState('');
  const [docCommId, setDocCommId] = useState('registration-database');
  const [docCategory, setDocCategory] = useState<RmsDocument['category']>('OFFICIAL_LETTERS');
  const [docFileName, setDocFileName] = useState('');
  const [docFileType, setDocFileType] = useState('application/pdf');
  const [docAccess, setDocAccess] = useState<RmsDocument['accessPermission']>('COMMITTEE_ONLY');

  const committees = RmsStore.getCommittees();
  const currentUser = RmsStore.getCurrentUser();

  const reloadData = () => {
    setDocuments(RmsStore.getDocuments());
  };

  const handleUploadDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim() || !docFileName.trim()) return;

    const comm = committees.find((c) => c.id === docCommId);

    RmsStore.uploadDocument({
      title: docTitle.trim(),
      committeeId: docCommId,
      committeeName: comm?.nameEn || 'General Secretariat',
      category: docCategory,
      fileName: docFileName.trim(),
      fileUrl: `#doc-${Date.now()}`,
      fileType: docFileType,
      fileSizeBytes: Math.floor(150000 + Math.random() * 850000),
      uploadedBy: currentUser.id,
      uploadedByName: currentUser.fullName,
      accessPermission: docAccess,
    });

    setIsUploadModalOpen(false);
    setDocTitle('');
    setDocFileName('');
    reloadData();
  };

  const handleDownload = (doc: RmsDocument) => {
    // Generate simulated downloadable file
    const content = `Sylhet Police Lines High School & College Reunion 2027\nDocument Title: ${doc.title}\nCategory: ${doc.category}\nCommittee: ${doc.committeeName}\nUploaded By: ${doc.uploadedByName}\nUpload Date: ${doc.uploadedAt}\nAccess Level: ${doc.accessPermission}\n\nOfficial document content archived for Reunion 2027 administration.`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = doc.fileName.endsWith('.txt') ? doc.fileName : `${doc.fileName}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.uploadedByName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCat = categoryFilter === 'all' || doc.category === categoryFilter;
    const matchesComm = committeeFilter === 'all' || doc.committeeId === committeeFilter;

    return matchesSearch && matchesCat && matchesComm;
  });

  const categoryLabels: Record<RmsDocument['category'], string> = {
    OFFICIAL_LETTERS: 'Official Letters & Memorandums',
    PERMISSION_DOCUMENTS: 'Police & Admin Permissions',
    MEETING_MINUTES: 'Meeting Minutes & Resolutions',
    BUDGET_PROPOSALS: 'Budget Proposals & Requisitions',
    BILLS_VOUCHERS: 'Bills, Invoices & Receipts',
    SPONSORSHIP_AGREEMENTS: 'Sponsorship MOUs & Contracts',
    EVENT_DESIGNS: 'Stage & Venue Architectural Layouts',
    VENDOR_AGREEMENTS: 'Vendor Agreements & Orders',
    PHOTOS_VIDEOS: 'Photos, Videos & Media',
    OTHER: 'General Archives',
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-[#172554] text-white p-6 rounded-3xl shadow-lg border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold uppercase tracking-wider border border-blue-400/30">
              Module 8
            </span>
            <span className="text-xs text-slate-300 font-medium">Reunion Management ERP</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-amber-400" />
            <span>{language === 'bn' ? 'নথি ও অনুমতিপত্র সংরক্ষণাগার' : 'Central Document Repository & Permissions'}</span>
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            {language === 'bn'
              ? 'জেলা প্রশাসন ও পুলিশ অনুমতিপত্র, সভার কার্যবিবরণী, ভেন্ডর চুক্তিপত্র ও স্পনসরশিপ সমঝোতা স্মারক সংরক্ষণ করুন।'
              : 'Secure document archive for administrative permissions, meeting minutes, vendor contracts, sponsorship MOUs, and stage designs.'}
          </p>
        </div>

        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold text-xs shadow-md transition cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          <span>{language === 'bn' ? 'নতুন নথি আপলোড' : 'Upload Document'}</span>
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">{language === 'bn' ? 'মোট সংরক্ষিত নথি' : 'Total Documents'}</span>
            <FileText className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">{documents.length}</p>
          <span className="text-[10px] text-slate-400 font-medium">Across 10 Categories</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">{language === 'bn' ? 'প্রশাসনিক অনুমতি' : 'Permission Letters'}</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600">
            {documents.filter((d) => d.category === 'PERMISSION_DOCUMENTS' || d.category === 'OFFICIAL_LETTERS').length}
          </p>
          <span className="text-[10px] text-emerald-600 font-medium">Police & DC Clearances</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">{language === 'bn' ? 'মিটিং কার্যবিবরণী' : 'Meeting Minutes'}</span>
            <FileCheck className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl font-black text-purple-600">
            {documents.filter((d) => d.category === 'MEETING_MINUTES').length}
          </p>
          <span className="text-[10px] text-purple-600 font-medium">Steering Committee Records</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">{language === 'bn' ? 'চুক্তি ও সমঝোতা' : 'MOUs & Agreements'}</span>
            <Lock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600">
            {documents.filter((d) => d.category === 'SPONSORSHIP_AGREEMENTS' || d.category === 'VENDOR_AGREEMENTS').length}
          </p>
          <span className="text-[10px] text-amber-600 font-medium">Sponsor & Vendor Contracts</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full md:w-auto">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={language === 'bn' ? 'নথি বা ফাইলের নাম খুঁজুন...' : 'Search by title, file name, or author...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 focus:outline-hidden"
          >
            <option value="all">All Categories</option>
            {Object.entries(categoryLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={committeeFilter}
            onChange={(e) => setCommitteeFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 focus:outline-hidden"
          >
            <option value="all">All Committees</option>
            {committees.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameEn}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDocs.map((doc) => (
          <div
            key={doc.id}
            className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition space-y-3 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <span className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                  <FileText className="w-5 h-5" />
                </span>
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    doc.accessPermission === 'PUBLIC'
                      ? 'bg-emerald-100 text-emerald-800'
                      : doc.accessPermission === 'CENTRAL_ONLY'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {doc.accessPermission.replace('_', ' ')}
                </span>
              </div>

              <h4 className="text-sm font-black text-slate-900 mt-2 line-clamp-2 leading-snug">{doc.title}</h4>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">{doc.fileName}</p>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 font-medium text-slate-700 truncate max-w-[170px]">
                  <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  {doc.committeeName}
                </span>
                <span className="font-mono text-slate-400">v{doc.version}.0</span>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(doc.uploadedAt).toLocaleDateString()}
                </span>
                <span>{(doc.fileSizeBytes / 1024).toFixed(0)} KB</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                onClick={() => setPreviewDoc(doc)}
                className="flex-1 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
              </button>

              <button
                onClick={() => handleDownload(doc)}
                className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl transition cursor-pointer"
                title="Download Document"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredDocs.length === 0 && (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
          No documents match your filter criteria.
        </div>
      )}

      {/* MODAL 1: UPLOAD DOCUMENT */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900">
                {language === 'bn' ? 'নথি আপলোড ও সংরক্ষণ' : 'Upload Document to Repository'}
              </h3>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadDocument} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Document Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Police Headquarters Security Clearance Order"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category *</label>
                  <select
                    value={docCategory}
                    onChange={(e) => setDocCategory(e.target.value as RmsDocument['category'])}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-hidden"
                  >
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Committee *</label>
                  <select
                    value={docCommId}
                    onChange={(e) => setDocCommId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-hidden"
                  >
                    {committees.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">File Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Police_Clearance_Faridpur_2027.pdf"
                  value={docFileName}
                  onChange={(e) => setDocFileName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">File Format</label>
                  <select
                    value={docFileType}
                    onChange={(e) => setDocFileType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-hidden"
                  >
                    <option value="application/pdf">PDF Document (.pdf)</option>
                    <option value="application/vnd.ms-excel">Excel Spreadsheet (.xlsx)</option>
                    <option value="image/png">Image / Design Blueprint (.png)</option>
                    <option value="application/msword">Word Document (.docx)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Access Permission</label>
                  <select
                    value={docAccess}
                    onChange={(e) => setDocAccess(e.target.value as RmsDocument['accessPermission'])}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-hidden"
                  >
                    <option value="COMMITTEE_ONLY">Committee Only</option>
                    <option value="CENTRAL_ONLY">Central Leadership Only</option>
                    <option value="PUBLIC">Publicly Visible</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition cursor-pointer"
                >
                  Save & Archive
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: DOCUMENT PREVIEW */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">
                  {previewDoc.category}
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">{previewDoc.title}</h3>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Document Viewer Frame */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center space-y-3">
              <FileCode className="w-12 h-12 text-blue-600 mx-auto" />
              <div className="font-mono text-xs font-bold text-slate-900">{previewDoc.fileName}</div>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                Official encrypted document verified for Sylhet Police Lines High School & College Reunion 2027.
              </p>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white rounded-full text-[10px] font-bold text-slate-700 border border-slate-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Cryptographically Signed & Archived</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl">
              <div>
                <span className="text-slate-400 block text-[10px]">Committee</span>
                <span className="font-bold text-slate-800">{previewDoc.committeeName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Uploaded By</span>
                <span className="font-bold text-slate-800">{previewDoc.uploadedByName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">File Size</span>
                <span className="font-mono text-slate-800">{(previewDoc.fileSizeBytes / 1024).toFixed(1)} KB</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Permission Level</span>
                <span className="font-bold text-slate-800">{previewDoc.accessPermission}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer text-xs"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleDownload(previewDoc)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold cursor-pointer text-xs flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Archive</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

