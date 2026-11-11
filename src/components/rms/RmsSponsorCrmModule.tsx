import React, { useState } from 'react';
import {
  Award,
  DollarSign,
  Plus,
  Search,
  CheckCircle2,
  Building,
  User,
  Phone,
  Mail,
  CheckSquare,
  Square,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { RmsSponsor, SponsorTier, RmsUser } from '../../types/rms';
import { RmsStore } from '../../services/rmsStore';

interface Props {
  currentUser: RmsUser;
  canEdit: boolean;
}

export const RmsSponsorCrmModule: React.FC<Props> = ({ currentUser, canEdit }) => {
  const [sponsors, setSponsors] = useState<RmsSponsor[]>(() => RmsStore.getSponsors());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>('ALL');
  const [selectedSponsor, setSelectedSponsor] = useState<RmsSponsor | null>(null);

  // New Sponsor Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState<SponsorTier>('PLATINUM');
  const [agreedAmount, setAgreedAmount] = useState<number>(500000);
  const [receivedAmount, setReceivedAmount] = useState<number>(0);

  // Interaction Note State
  const [newNote, setNewNote] = useState('');

  const reloadData = () => {
    setSponsors(RmsStore.getSponsors());
    if (selectedSponsor) {
      const refreshed = RmsStore.getSponsors().find((s) => s.id === selectedSponsor.id);
      if (refreshed) setSelectedSponsor(refreshed);
    }
  };

  const filteredSponsors = sponsors.filter((sp) => {
    const matchesSearch =
      sp.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sp.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sp.phone.includes(searchQuery);
    const matchesCat = selectedCategory === 'ALL' || sp.category === selectedCategory;
    const matchesPay = selectedPaymentStatus === 'ALL' || sp.paymentStatus === selectedPaymentStatus;
    return matchesSearch && matchesCat && matchesPay;
  });

  // Analytics Metrics
  const totalAgreed = sponsors.reduce((acc, curr) => acc + curr.agreedAmount, 0);
  const totalReceived = sponsors.reduce((acc, curr) => acc + curr.receivedAmount, 0);
  const totalOutstanding = totalAgreed - totalReceived;
  const collectionRate = totalAgreed > 0 ? Math.round((totalReceived / totalAgreed) * 100) : 0;

  const handleAddSponsor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || agreedAmount <= 0) return;

    let paymentStatus: RmsSponsor['paymentStatus'] = 'NOT_PAID';
    if (receivedAmount >= agreedAmount) {
      paymentStatus = 'PAID_FULL';
    } else if (receivedAmount > 0) {
      paymentStatus = 'PARTIAL';
    }

    const defaultBenefits: RmsSponsor['benefits'] = [
      { id: `BEN-${Date.now()}-1`, name: 'Logo on Main Event Backdrop', category: 'STAGE', isDelivered: false },
      { id: `BEN-${Date.now()}-2`, name: 'Souvenir Full-Page Advertisement', category: 'LOGO', isDelivered: false },
      { id: `BEN-${Date.now()}-3`, name: 'VIP Passes for Corporate Executives', category: 'VIP_PASS', isDelivered: false },
      { id: `BEN-${Date.now()}-4`, name: 'On-Field Promotional Stall Space', category: 'BOOTH', isDelivered: false },
    ];

    const newSponsor: RmsSponsor = {
      id: `SPN-${Date.now().toString().slice(-4)}`,
      companyName,
      contactPerson,
      phone,
      email,
      address,
      category,
      proposedAmount: agreedAmount,
      agreedAmount,
      receivedAmount,
      paymentStatus,
      contactHistory: [
        {
          date: new Date().toISOString().split('T')[0],
          communicator: currentUser.fullName,
          summary: 'Initial sponsorship onboarded into RMS CRM.',
        },
      ],
      benefits: defaultBenefits,
      createdAt: new Date().toISOString(),
    };

    RmsStore.saveSponsor(newSponsor);
    setIsAddModalOpen(false);
    resetForm();
    reloadData();
  };

  const resetForm = () => {
    setCompanyName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    setCategory('PLATINUM');
    setAgreedAmount(500000);
    setReceivedAmount(0);
  };

  const toggleBenefit = (sponsor: RmsSponsor, benefitId: string) => {
    if (!canEdit) return;
    const updated = {
      ...sponsor,
      benefits: sponsor.benefits.map((b) =>
        b.id === benefitId ? { ...b, isDelivered: !b.isDelivered } : b
      ),
    };
    RmsStore.saveSponsor(updated);
    reloadData();
  };

  const handleAddInteractionNote = (sponsor: RmsSponsor) => {
    if (!newNote.trim()) return;
    const updated: RmsSponsor = {
      ...sponsor,
      contactHistory: [
        {
          date: new Date().toISOString().split('T')[0],
          communicator: currentUser.fullName,
          summary: newNote.trim(),
        },
        ...sponsor.contactHistory,
      ],
    };
    RmsStore.saveSponsor(updated);
    setNewNote('');
    reloadData();
  };

  const handleUpdatePayment = (sponsor: RmsSponsor, newReceived: number) => {
    let paymentStatus: RmsSponsor['paymentStatus'] = 'NOT_PAID';
    if (newReceived >= sponsor.agreedAmount) {
      paymentStatus = 'PAID_FULL';
    } else if (newReceived > 0) {
      paymentStatus = 'PARTIAL';
    }
    const updated: RmsSponsor = {
      ...sponsor,
      receivedAmount: newReceived,
      paymentStatus,
    };
    RmsStore.saveSponsor(updated);
    reloadData();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-500/10 text-amber-600 rounded-lg">
              <Award className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900">Sponsorship CRM & Fulfillment Tracker</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Manage Title, Platinum, Gold, and Silver partner packages, track receivable disbursements, and monitor stage & souvenir branding delivery.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-xl transition shadow-sm text-sm"
          >
            <Plus className="w-4 h-4" /> Add Partner / Sponsor
          </button>
        )}
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Committed</span>
            <DollarSign className="w-5 h-5 text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">৳{totalAgreed.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">{sponsors.length} Corporate Partners</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Collected Funds</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-600 mt-2">৳{totalReceived.toLocaleString()}</p>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-2">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(collectionRate, 100)}%` }}
            />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Outstanding Due</span>
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-600 mt-2">৳{totalOutstanding.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">Pending banking reconciliation</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Fulfillment Health</span>
            <TrendingUp className="w-5 h-5 text-sky-600" />
          </div>
          <p className="text-2xl font-black text-sky-600 mt-2">{collectionRate}%</p>
          <p className="text-xs text-slate-500 mt-1">Collection target progress</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search company, contact, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700"
          >
            <option value="ALL">All Sponsorship Tiers</option>
            <option value="TITLE_SPONSOR">Title Sponsor</option>
            <option value="PLATINUM">Platinum Partner</option>
            <option value="GOLD">Gold Partner</option>
            <option value="SILVER">Silver Partner</option>
            <option value="CO_SPONSOR">Co-Sponsor</option>
            <option value="MEDIA_PARTNER">Media Partner</option>
          </select>

          <select
            value={selectedPaymentStatus}
            onChange={(e) => setSelectedPaymentStatus(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700"
          >
            <option value="ALL">All Payment Statuses</option>
            <option value="PAID_FULL">Paid in Full</option>
            <option value="PARTIAL">Partially Paid</option>
            <option value="NOT_PAID">Unpaid</option>
          </select>
        </div>
      </div>

      {/* Sponsors Grid / List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSponsors.map((sponsor) => {
          const progress = sponsor.agreedAmount > 0
            ? Math.round((sponsor.receivedAmount / sponsor.agreedAmount) * 100)
            : 0;

          const deliveredBenefits = sponsor.benefits.filter((b) => b.isDelivered).length;
          const totalBenefits = sponsor.benefits.length;

          return (
            <div
              key={sponsor.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-slate-100 rounded-xl text-slate-700">
                      <Building className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="font-bold text-slate-900 leading-tight">{sponsor.companyName}</h3>
                      <span className="inline-block px-2 py-0.5 mt-1 text-[11px] font-bold uppercase rounded-md tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                        {sponsor.category.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${
                      sponsor.paymentStatus === 'PAID_FULL'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : sponsor.paymentStatus === 'PARTIAL'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {sponsor.paymentStatus === 'PAID_FULL' ? 'Paid Full' : sponsor.paymentStatus === 'PARTIAL' ? 'Partial' : 'Unpaid'}
                  </span>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-medium text-slate-800">{sponsor.contactPerson}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{sponsor.phone}</span>
                  </div>
                  {sponsor.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>{sponsor.email}</span>
                    </div>
                  )}
                </div>

                {/* Financial Summary */}
                <div className="mt-4 p-3 bg-slate-50 rounded-xl space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Agreed Pledge:</span>
                    <span className="font-bold text-slate-900">৳{sponsor.agreedAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Disbursed:</span>
                    <span className="font-bold text-emerald-600">৳{sponsor.receivedAmount.toLocaleString()} ({progress}%)</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-1.5 rounded-full"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Deliverables summary */}
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>Deliverables Ready:</span>
                  <span className="font-semibold text-slate-800">
                    {deliveredBenefits}/{totalBenefits} Delivered
                  </span>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => setSelectedSponsor(sponsor)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition"
                >
                  Manage Deliverables & History
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sponsor Details / Deliverables Checklist Modal */}
      {selectedSponsor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="text-xs uppercase font-bold text-amber-600 tracking-wider">
                  {selectedSponsor.category.replace('_', ' ')}
                </span>
                <h2 className="text-xl font-bold text-slate-900 mt-1">{selectedSponsor.companyName}</h2>
                <p className="text-xs text-slate-500">Contact: {selectedSponsor.contactPerson} ({selectedSponsor.phone})</p>
              </div>
              <button
                onClick={() => setSelectedSponsor(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {/* Financial Update Controls */}
            <div className="mt-4 p-4 bg-slate-50 rounded-xl space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Financial Disbursement</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-xs text-slate-500">Agreed Pledge:</span>
                  <p className="font-black text-slate-900">৳{selectedSponsor.agreedAmount.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Received So Far:</span>
                  <p className="font-black text-emerald-600">৳{selectedSponsor.receivedAmount.toLocaleString()}</p>
                </div>
              </div>
              {canEdit && (
                <div className="pt-2 flex items-center gap-2">
                  <input
                    type="number"
                    defaultValue={selectedSponsor.receivedAmount}
                    id={`amt-${selectedSponsor.id}`}
                    placeholder="Update received amount"
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg w-40"
                  />
                  <button
                    onClick={() => {
                      const input = document.getElementById(`amt-${selectedSponsor.id}`) as HTMLInputElement;
                      if (input) handleUpdatePayment(selectedSponsor, Number(input.value));
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg"
                  >
                    Update Disbursed Amount
                  </button>
                </div>
              )}
            </div>

            {/* Benefit Checklist */}
            <div className="mt-6">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-amber-600" />
                Agreed Corporate Deliverables & Branding Checklist
              </h3>
              <div className="space-y-2">
                {selectedSponsor.benefits.map((benefit) => (
                  <div
                    key={benefit.id}
                    onClick={() => toggleBenefit(selectedSponsor, benefit.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border text-sm cursor-pointer transition ${
                      benefit.isDelivered
                        ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {benefit.isDelivered ? (
                        <CheckSquare className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-400 flex-shrink-0" />
                      )}
                      <div>
                        <span className={`font-medium ${benefit.isDelivered ? 'line-through text-slate-500' : ''}`}>
                          {benefit.name}
                        </span>
                        <span className="block text-[11px] text-slate-400 uppercase font-semibold">
                          Category: {benefit.category}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-semibold ${
                        benefit.isDelivered ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {benefit.isDelivered ? 'Delivered' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact / Interaction History */}
            <div className="mt-6">
              <h3 className="text-sm font-bold text-slate-900 mb-3">Communication & Meeting Log</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {selectedSponsor.contactHistory.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="font-semibold text-slate-700">{item.communicator}</span>
                      <span>{item.date}</span>
                    </div>
                    <p className="text-slate-600">{item.summary}</p>
                  </div>
                ))}
              </div>

              {canEdit && (
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    placeholder="Log a new meeting or phone call update..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    onClick={() => handleAddInteractionNote(selectedSponsor)}
                    className="px-4 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800"
                  >
                    Add Log
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Sponsor Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Onboard New Reunion Sponsor</h2>
            <form onSubmit={handleAddSponsor} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Company / Brand Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Footwear Ltd."
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Contact Person</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tanvir Hasan"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Phone Number</label>
                  <input
                    type="text"
                    required
                    placeholder="01711XXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="sponsor@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Sponsorship Tier</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as SponsorTier)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="TITLE_SPONSOR">Title Sponsor</option>
                    <option value="PLATINUM">Platinum Partner</option>
                    <option value="GOLD">Gold Partner</option>
                    <option value="SILVER">Silver Partner</option>
                    <option value="SUPPORTING">Supporting Partner</option>
                    <option value="MEDIA_PARTNER">Media Partner</option>
                    <option value="OTHER_PARTNER">Other Partner</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Agreed Amount (৳)</label>
                  <input
                    type="number"
                    min="1000"
                    required
                    value={agreedAmount}
                    onChange={(e) => setAgreedAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Initial Received (৳)</label>
                  <input
                    type="number"
                    min="0"
                    value={receivedAmount}
                    onChange={(e) => setReceivedAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Office Address</label>
                <input
                  type="text"
                  placeholder="Corporate Head Office, Dhaka"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
                >
                  Save Partner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
