import React, { useState } from 'react';
import {
  FileText,
  Upload,
  Search,
  Download,
  FolderOpen,
  Calendar,
  Lock,
  Globe,
  Users,
  Eye,
} from 'lucide-react';
import { RmsDocument, RmsUser } from '../../types/rms';
import { RmsStore } from '../../services/rmsStore';
import { sanitizeUrl } from '../../utils/security';

interface Props {
  currentUser: RmsUser;
  canUpload: boolean;
}

export const RmsDocumentsModule: React.FC<Props> = ({ currentUser, canUpload }) => {
  const [documents, setDocuments] = useState<RmsDocument[]>(() => RmsStore.getDocuments());
  const committees = RmsStore.getCommittees();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCommitteeId, setSelectedCommitteeId] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedAccess, setSelectedAccess] = useState<string>('ALL');
  const [previewDoc, setPreviewDoc] = useState<RmsDocument | null>(null);

  // Upload modal state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [commId, setCommId] = useState(currentUser.committeeId || 'registration-database');
  const [category, setCategory] = useState<RmsDocument['category']>('OFFICIAL_LETTERS');
  const [accessPermission, setAccessPermission] = useState<RmsDocument['accessPermission']>('COMMITTEE_ONLY');
  const [fileName, setFileName] = useState('');

  const reloadData = () => {
    setDocuments(RmsStore.getDocuments());
  };

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.committeeName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesComm = selectedCommitteeId === 'ALL' || doc.committeeId === selectedCommitteeId;
    const matchesCat = selectedCategory === 'ALL' || doc.category === selectedCategory;
    const matchesAccess = selectedAccess === 'ALL' || doc.accessPermission === selectedAccess;
    return matchesSearch && matchesComm && matchesCat && matchesAccess;
  });

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const comm = committees.find((c) => c.id === commId);
    const resolvedCommName = comm ? comm.nameEn : 'Central Committee';
    const resolvedFileName = fileName.trim() ? fileName.trim() : `${title.replace(/\s+/g, '_')}.pdf`;

    RmsStore.uploadDocument({
      title: title.trim(),
      committeeId: commId,
      committeeName: resolvedCommName,
      category,
      fileUrl: `https://storage.reunion2027.internal/docs/${encodeURIComponent(resolvedFileName)}`,
      fileName: resolvedFileName,
      fileSizeBytes: Math.floor(500000 + Math.random() * 2500000),
      fileType: resolvedFileName.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf',
      uploadedBy: currentUser.id,
      uploadedByName: currentUser.fullName,
      accessPermission,
    });

    setIsUploadModalOpen(false);
    setTitle('');
    setFileName('');
    reloadData();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return bytes + ' B';
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-500/10 text-indigo-600 rounded-lg">
              <FolderOpen className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900">Document Repository & Archive</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Store, audit, and distribute official administrative approvals, meeting minutes, vendor agreements, and venue diagrams across all 12 committees.
          </p>
        </div>
        {canUpload && (
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition shadow-sm text-sm"
          >
            <Upload className="w-4 h-4" /> Upload Document
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search documents by title, file or committee..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <select
            value={selectedCommitteeId}
            onChange={(e) => setSelectedCommitteeId(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700"
          >
            <option value="ALL">All Committees ({committees.length})</option>
            {committees.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameEn}
              </option>
            ))}
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700"
          >
            <option value="ALL">All Categories</option>
            <option value="OFFICIAL_LETTERS">Official Letters</option>
            <option value="PERMISSION_DOCUMENTS">Administrative Approvals</option>
            <option value="MEETING_MINUTES">Meeting Minutes</option>
            <option value="BUDGET_PROPOSALS">Budget Proposals</option>
            <option value="BILLS_VOUCHERS">Bills & Vouchers</option>
            <option value="SPONSORSHIP_AGREEMENTS">Sponsorship Agreements</option>
            <option value="EVENT_DESIGNS">Event Designs & Layouts</option>
            <option value="VENDOR_AGREEMENTS">Vendor Agreements</option>
            <option value="PHOTOS_VIDEOS">Photos & Videos</option>
            <option value="OTHER">Other Documents</option>
          </select>

          <select
            value={selectedAccess}
            onChange={(e) => setSelectedAccess(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700"
          >
            <option value="ALL">All Permissions</option>
            <option value="PUBLIC">Public</option>
            <option value="COMMITTEE_ONLY">Committee Only</option>
            <option value="CENTRAL_ONLY">Central Committee Only</option>
          </select>
        </div>
      </div>

      {/* Documents Table View */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Document Title</th>
                <th className="px-6 py-4">Committee</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Access Level</th>
                <th className="px-6 py-4">Size & Version</th>
                <th className="px-6 py-4">Uploaded By</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No documents found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                          <FileText className="w-5 h-5" />
                        </span>
                        <div>
                          <p className="font-semibold text-slate-900">{doc.title}</p>
                          <p className="text-xs text-slate-400 font-mono">{doc.fileName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-700">
                      {doc.committeeName}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-block px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 text-slate-700">
                        {doc.category.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${
                          doc.accessPermission === 'PUBLIC'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : doc.accessPermission === 'COMMITTEE_ONLY'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {doc.accessPermission === 'PUBLIC' ? (
                          <Globe className="w-3 h-3" />
                        ) : doc.accessPermission === 'COMMITTEE_ONLY' ? (
                          <Users className="w-3 h-3" />
                        ) : (
                          <Lock className="w-3 h-3" />
                        )}
                        {doc.accessPermission.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      <div>{formatFileSize(doc.fileSizeBytes)}</div>
                      <span className="text-[11px] text-slate-400">Ver. {doc.version}</span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      <div className="font-medium text-slate-800">{doc.uploadedByName}</div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Calendar className="w-3 h-3" />
                        {new Date(doc.uploadedAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setPreviewDoc(doc)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          title="Preview Document Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <a
                          href={sanitizeUrl(doc.fileUrl)}
                          target="_blank"
                          rel="noreferrer"
                          download={doc.fileName}
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                          title="Download File"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Document Detail Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-lg">Document Inspection</h3>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div>
                <span className="text-xs uppercase font-bold text-slate-400">Title</span>
                <p className="font-semibold text-slate-800">{previewDoc.title}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs uppercase font-bold text-slate-400">Committee</span>
                  <p className="text-slate-700">{previewDoc.committeeName}</p>
                </div>
                <div>
                  <span className="text-xs uppercase font-bold text-slate-400">Category</span>
                  <p className="text-slate-700">{previewDoc.category.replace('_', ' ')}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs uppercase font-bold text-slate-400">Access Level</span>
                  <p className="text-slate-700">{previewDoc.accessPermission.replace('_', ' ')}</p>
                </div>
                <div>
                  <span className="text-xs uppercase font-bold text-slate-400">File Size</span>
                  <p className="text-slate-700">{formatFileSize(previewDoc.fileSizeBytes)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs uppercase font-bold text-slate-400">Uploaded By</span>
                  <p className="text-slate-700">{previewDoc.uploadedByName}</p>
                </div>
                <div>
                  <span className="text-xs uppercase font-bold text-slate-400">Date</span>
                  <p className="text-slate-700">{new Date(previewDoc.uploadedAt).toLocaleString()}</p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-xs uppercase font-bold text-slate-400">Storage URI</span>
                <p className="text-xs font-mono text-slate-600 break-all">{previewDoc.fileUrl}</p>
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Close
              </button>
              <a
                href={sanitizeUrl(previewDoc.fileUrl)}
                target="_blank"
                rel="noreferrer"
                download={previewDoc.fileName}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg"
              >
                <Download className="w-3.5 h-3.5" /> Download File
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Upload Official Committee Document</h2>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Document Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Stage Sound Vendor Quotation & Terms"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Owning Committee</label>
                  <select
                    value={commId}
                    onChange={(e) => setCommId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {committees.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Document Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as RmsDocument['category'])}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="OFFICIAL_LETTERS">Official Letter</option>
                    <option value="PERMISSION_DOCUMENTS">Permission Approval</option>
                    <option value="MEETING_MINUTES">Meeting Minutes</option>
                    <option value="BUDGET_PROPOSALS">Budget Proposal</option>
                    <option value="BILLS_VOUCHERS">Bill / Voucher</option>
                    <option value="SPONSORSHIP_AGREEMENTS">Sponsorship Agreement</option>
                    <option value="EVENT_DESIGNS">Event Design / Layout</option>
                    <option value="VENDOR_AGREEMENTS">Vendor Contract</option>
                    <option value="PHOTOS_VIDEOS">Photos / Videos</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">File Name</label>
                  <input
                    type="text"
                    placeholder="Quotation_Sound_2027.pdf"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Access Control</label>
                  <select
                    value={accessPermission}
                    onChange={(e) => setAccessPermission(e.target.value as RmsDocument['accessPermission'])}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="COMMITTEE_ONLY">Committee Only</option>
                    <option value="PUBLIC">Public</option>
                    <option value="CENTRAL_ONLY">Central Committee Only</option>
                  </select>
                </div>
              </div>

              <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center text-xs text-slate-500">
                <FileText className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                <p>Attach file (PDF, DOCX, XLSX, PNG up to 25MB)</p>
                <p className="text-[11px] text-slate-400 mt-1">Encrypted storage with MD5 checksum verification</p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
                >
                  Upload & Archive
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
