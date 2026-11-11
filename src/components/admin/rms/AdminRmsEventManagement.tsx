import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Music,
  Plus,
  Edit2,
  Trash2,
  Users,
  CheckCircle2,
  X,
  Sparkles,
  Radio,
} from 'lucide-react';
import { Language } from '../../../types';

interface ProgramSession {
  id: string;
  day: 'DAY_1' | 'DAY_2';
  startTime: string;
  endTime: string;
  titleEn: string;
  titleBn: string;
  venue: string;
  performerOrSpeaker?: string;
  leadCoordinator: string;
  coordinatorPhone: string;
  category: 'CEREMONY' | 'CULTURAL' | 'MEAL' | 'RALLY' | 'REGISTRATION' | 'INTERACTION';
  notes?: string;
}

interface VenueZone {
  id: string;
  name: string;
  location: string;
  capacity: string;
  inCharge: string;
  phone: string;
  status: 'READY' | 'IN_PREPARATION' | 'INSPECTION_PENDING';
}

const INITIAL_PROGRAM_SESSIONS: ProgramSession[] = [
  // DAY 1 - JAN 28, 2027
  {
    id: 'SESS-01',
    day: 'DAY_1',
    startTime: '10:00 AM',
    endTime: '05:00 PM',
    titleEn: 'Delegate Registration & ID Card Distribution',
    titleBn: 'অংশগ্রহণকারীদের নিবন্ধন কিট ও আইডি কার্ড বিতরণ',
    venue: 'Campus Main Auditorium & Desks 1-12',
    performerOrSpeaker: 'Registration & Database Committee',
    leadCoordinator: 'Sagar',
    coordinatorPhone: '01711000005',
    category: 'REGISTRATION',
    notes: 'Kits include T-shirts, ID badge, food coupons, souvenir booklet.',
  },
  {
    id: 'SESS-02',
    day: 'DAY_1',
    startTime: '06:30 PM',
    endTime: '10:30 PM',
    titleEn: 'Evening Sufi & Traditional Qawwali Night',
    titleBn: 'সন্ধ্যার আধ্যাত্মিক সুফি ও ঐতিহ্যবাহী কাওয়ালী আসর',
    venue: 'Police Lines Large Field Main Amphitheater',
    performerOrSpeaker: 'Renowned Sufi Troupe & Local Maestros',
    leadCoordinator: 'Cultural Affairs Committee Director',
    coordinatorPhone: '01711000010',
    category: 'CULTURAL',
    notes: 'Warm tea, snacks, and traditional ambient lighting provided.',
  },

  // DAY 2 - JAN 29, 2027 (MAIN EVENT)
  {
    id: 'SESS-03',
    day: 'DAY_2',
    startTime: '08:30 AM',
    endTime: '10:00 AM',
    titleEn: 'Grand Reunion Procession & Street Carnival',
    titleBn: 'আনন্দ র‍্যালি ও শোভাযাত্রা (স্কুল গেট হতে শহর প্রদক্ষিণ)',
    venue: 'Main Gate to Town Circle & Return to Field',
    performerOrSpeaker: 'Rally & Procession Committee with Police Band',
    leadCoordinator: 'Rally Committee Director',
    coordinatorPhone: '01711000008',
    category: 'RALLY',
    notes: 'Procession ordered by graduating batches chronologically (1962-2026).',
  },
  {
    id: 'SESS-04',
    day: 'DAY_2',
    startTime: '10:00 AM',
    endTime: '11:30 AM',
    titleEn: 'Solemn Opening, National Anthem & Memorial',
    titleBn: 'উদ্বোধনী অনুষ্ঠান, জাতীয় সংগীত ও প্রয়াতদের স্মরণে শ্রদ্ধা',
    venue: 'Police Lines Large Field Central Pavilion',
    performerOrSpeaker: 'Chief Adviser (Principal) & Convener Monowar Shikder',
    leadCoordinator: 'Event Production Director',
    coordinatorPhone: '01711000011',
    category: 'CEREMONY',
    notes: 'Honoring fallen martyrs, respected retired teachers, and alumni.',
  },
  {
    id: 'SESS-05',
    day: 'DAY_2',
    startTime: '11:30 AM',
    endTime: '01:00 PM',
    titleEn: 'Reminiscence Session & Honoring Revered Teachers',
    titleBn: 'স্মৃতিচারণ ও শ্রদ্ধেয় শিক্ষক সম্মাননা প্রদান',
    venue: 'Central Stage',
    performerOrSpeaker: 'Distinguished Former Teachers & Alumni Dignitaries',
    leadCoordinator: 'Hospitality & Protocol Director',
    coordinatorPhone: '01711000012',
    category: 'CEREMONY',
    notes: 'Presentation of crests, honorary uttariyo, and life insurance endowments.',
  },
  {
    id: 'SESS-06',
    day: 'DAY_2',
    startTime: '01:00 PM',
    endTime: '02:30 PM',
    titleEn: 'Grand Alumni Banquet & Mezban Feast',
    titleBn: 'পুনর্মিলনী মধ্যাহ্নভোজ ও ঐতিহ্যবাহী মেজবানি প্রীতিভোজ',
    venue: 'Dining Pavilion A (Former Batches) & Pavilion B (Current)',
    performerOrSpeaker: 'Food & Catering Committee (Master Chef Team)',
    leadCoordinator: 'Food Committee Director',
    coordinatorPhone: '01711000009',
    category: 'MEAL',
    notes: 'Buffet with traditional beef mezban, chicken roast, firni & beverages.',
  },
  {
    id: 'SESS-07',
    day: 'DAY_2',
    startTime: '02:30 PM',
    endTime: '04:30 PM',
    titleEn: 'Batch-wise Interactive Sessions & Photo Ops',
    titleBn: 'ব্যাচভিত্তিক আড্ডা, স্মৃতিচারণ ও গ্রুপ ফটো সেশন',
    venue: 'Designated Batch Tents (Zones 1-8)',
    performerOrSpeaker: 'Batch Representatives & Senior Alumni',
    leadCoordinator: 'Registration & Database Committee',
    coordinatorPhone: '01711000005',
    category: 'INTERACTION',
    notes: 'Professional photographers stationed at each batch photo backdrop.',
  },
  {
    id: 'SESS-08',
    day: 'DAY_2',
    startTime: '05:00 PM',
    endTime: '10:00 PM',
    titleEn: 'Mega Reunion Musical Concert & Grand Fireworks',
    titleBn: 'মেগা কনসার্ট, র‍্যাফেল ড্র ও সমাপনী আতশবাজি প্রদর্শনী',
    venue: 'Main Field Open Concert Stage',
    performerOrSpeaker: 'National Headline Band, Guest Pop Artists & Alumni Performers',
    leadCoordinator: 'Cultural Affairs Committee Director',
    coordinatorPhone: '01711000010',
    category: 'CULTURAL',
    notes: 'Security barricades in place; wristbands mandatory for arena entry.',
  },
];

const INITIAL_ZONES: VenueZone[] = [
  { id: 'ZN-1', name: 'Main Concert Stage & Amphitheater', location: 'Police Lines Large Field North End', capacity: '10,000+ Persons', inCharge: 'Event Production Team', phone: '01711000011', status: 'IN_PREPARATION' },
  { id: 'ZN-2', name: 'Dining Pavilion A (Senior Batches)', location: 'Field East Corridor', capacity: '3,000 Seats', inCharge: 'Food & Catering Team', phone: '01711000009', status: 'READY' },
  { id: 'ZN-3', name: 'Dining Pavilion B (Junior Batches)', location: 'Field South Corridor', capacity: '2,500 Seats', inCharge: 'Food & Catering Team', phone: '01711000009', status: 'READY' },
  { id: 'ZN-4', name: 'VIP & Revered Teachers Lounge', location: 'College Building Ground Floor', capacity: '250 Persons', inCharge: 'Hospitality & Protocol Team', phone: '01711000012', status: 'READY' },
  { id: 'ZN-5', name: 'First Aid & Emergency Medical Center', location: 'School Dispensary & Field Tent 4', capacity: '20 Beds + 2 Ambulances', inCharge: 'Medical Support Team', phone: '01711000018', status: 'READY' },
  { id: 'ZN-6', name: 'Vehicle Parking & Traffic Terminal', location: 'Police Lines Outer Ground', capacity: '500 Cars / 2000 Bikes', inCharge: 'Security & Discipline Team', phone: '01711000013', status: 'READY' },
];

interface Props {
  language: Language;
}

export const AdminRmsEventManagement: React.FC<Props> = ({ language }) => {
  const [sessions, setSessions] = useState<ProgramSession[]>(() => {
    try {
      const stored = localStorage.getItem('plscf_rms_event_sessions_2027');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Failed to load event sessions:', e);
    }
    return INITIAL_PROGRAM_SESSIONS;
  });

  const [zones] = useState<VenueZone[]>(INITIAL_ZONES);
  const [selectedDay, setSelectedDay] = useState<'DAY_1' | 'DAY_2'>('DAY_2');
  const [activeTab, setActiveTab] = useState<'timeline' | 'venues' | 'artists'>('timeline');

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<ProgramSession | null>(null);

  // Form State
  const [dayInput, setDayInput] = useState<'DAY_1' | 'DAY_2'>('DAY_2');
  const [startTimeInput, setStartTimeInput] = useState('10:00 AM');
  const [endTimeInput, setEndTimeInput] = useState('11:30 AM');
  const [titleEnInput, setTitleEnInput] = useState('');
  const [titleBnInput, setTitleBnInput] = useState('');
  const [venueInput, setVenueInput] = useState('Police Lines Large Field');
  const [speakerInput, setSpeakerInput] = useState('');
  const [coordInput, setCoordInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [categoryInput, setCategoryInput] = useState<ProgramSession['category']>('CEREMONY');
  const [notesInput, setNotesInput] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem('plscf_rms_event_sessions_2027', JSON.stringify(sessions));
    } catch (e) {
      console.warn('Failed to persist sessions:', e);
    }
  }, [sessions]);

  const handleOpenAdd = () => {
    setEditingSession(null);
    setDayInput(selectedDay);
    setStartTimeInput('10:00 AM');
    setEndTimeInput('11:30 AM');
    setTitleEnInput('');
    setTitleBnInput('');
    setVenueInput('Police Lines Large Field');
    setSpeakerInput('');
    setCoordInput('');
    setPhoneInput('');
    setCategoryInput('CEREMONY');
    setNotesInput('');
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (s: ProgramSession) => {
    setEditingSession(s);
    setDayInput(s.day);
    setStartTimeInput(s.startTime);
    setEndTimeInput(s.endTime);
    setTitleEnInput(s.titleEn);
    setTitleBnInput(s.titleBn);
    setVenueInput(s.venue);
    setSpeakerInput(s.performerOrSpeaker || '');
    setCoordInput(s.leadCoordinator);
    setPhoneInput(s.coordinatorPhone);
    setCategoryInput(s.category);
    setNotesInput(s.notes || '');
    setIsAddModalOpen(true);
  };

  const handleSaveSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleEnInput.trim() || !startTimeInput.trim()) return;

    if (editingSession) {
      const updated = sessions.map((s) =>
        s.id === editingSession.id
          ? {
              ...s,
              day: dayInput,
              startTime: startTimeInput.trim(),
              endTime: endTimeInput.trim(),
              titleEn: titleEnInput.trim(),
              titleBn: titleBnInput.trim() || titleEnInput.trim(),
              venue: venueInput.trim(),
              performerOrSpeaker: speakerInput.trim() || undefined,
              leadCoordinator: coordInput.trim() || 'Central Secretariat',
              coordinatorPhone: phoneInput.trim() || '01700000000',
              category: categoryInput,
              notes: notesInput.trim() || undefined,
            }
          : s
      );
      setSessions(updated);
    } else {
      const newSession: ProgramSession = {
        id: `SESS-${Date.now().toString().slice(-4)}`,
        day: dayInput,
        startTime: startTimeInput.trim(),
        endTime: endTimeInput.trim(),
        titleEn: titleEnInput.trim(),
        titleBn: titleBnInput.trim() || titleEnInput.trim(),
        venue: venueInput.trim(),
        performerOrSpeaker: speakerInput.trim() || undefined,
        leadCoordinator: coordInput.trim() || 'Central Secretariat',
        coordinatorPhone: phoneInput.trim() || '01700000000',
        category: categoryInput,
        notes: notesInput.trim() || undefined,
      };
      setSessions([...sessions, newSession]);
    }

    setIsAddModalOpen(false);
  };

  const handleDeleteSession = (id: string) => {
    if (!window.confirm('Remove this session from the schedule?')) return;
    setSessions(sessions.filter((s) => s.id !== id));
  };

  const filteredSessions = sessions.filter((s) => s.day === selectedDay);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-[#172554] text-white p-6 rounded-3xl shadow-lg border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold uppercase tracking-wider border border-blue-400/30">
              Module 6
            </span>
            <span className="text-xs text-slate-300 font-medium">Reunion Management ERP</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Calendar className="w-6 h-6 text-amber-400" />
            <span>{language === 'bn' ? 'ইভেন্ট ও প্রোগ্রাম শিডিউল ব্যবস্থাপনা' : 'Event & Program Run-Down Schedule'}</span>
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            {language === 'bn'
              ? '২৮ ও ২৯ জানুয়ারি ২০২৭ এর পূর্ণাঙ্গ কার্যসূচি, ভেন্যু জোনিং, কাওয়ালী ও মেগা কনসার্ট পারফর্মার লাইনআপ পরিচালনা করুন।'
              : 'Master event timeline for Jan 28 (Sufi Night & Badge Distribution) & Jan 29 (Grand Reunion 2027), stage zones, and artist rosters.'}
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold text-xs shadow-md transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{language === 'bn' ? 'কার্যসূচি সেশন যুক্ত করুন' : 'Add Agenda Session'}</span>
        </button>
      </div>

      {/* Sub Tabs: Timeline, Venue Zones, Artists */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'timeline' ? 'bg-[#172554] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>2-Day Event Schedule</span>
          </button>
          <button
            onClick={() => setActiveTab('venues')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'venues' ? 'bg-[#172554] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Venue Zones & Facilities</span>
          </button>
          <button
            onClick={() => setActiveTab('artists')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'artists' ? 'bg-[#172554] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>Cultural & Concert Lineup</span>
          </button>
        </div>

        {/* Day Toggle (Visible when in timeline tab) */}
        {activeTab === 'timeline' && (
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setSelectedDay('DAY_1')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                selectedDay === 'DAY_1' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Day 1: Jan 28, 2027 (Pre-Event & Qawwali)
            </button>
            <button
              onClick={() => setSelectedDay('DAY_2')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                selectedDay === 'DAY_2' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Day 2: Jan 29, 2027 (Main Grand Reunion)
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: 2-DAY EVENT SCHEDULE */}
      {activeTab === 'timeline' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl flex items-center justify-between text-xs text-blue-950">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-700" />
              <span className="font-bold">
                {selectedDay === 'DAY_1'
                  ? 'Thursday, January 28, 2027 • Delegate Registration, ID Card Kits & Evening Sufi Night'
                  : 'Friday, January 29, 2027 • Grand Reunion Procession, Memorial, Mezban Feast & Mega Concert'}
              </span>
            </div>
            <span className="font-mono font-bold text-blue-800">{filteredSessions.length} Scheduled Sessions</span>
          </div>

          <div className="space-y-3">
            {filteredSessions.map((session, index) => (
              <div
                key={session.id}
                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-4">
                  {/* Time Badge */}
                  <div className="shrink-0 bg-slate-900 text-white rounded-xl p-2.5 text-center min-w-[100px]">
                    <span className="text-[10px] text-amber-400 font-bold block uppercase">Session #{index + 1}</span>
                    <span className="text-xs font-black font-mono block mt-0.5">{session.startTime}</span>
                    <span className="text-[10px] text-slate-400 font-mono">to {session.endTime}</span>
                  </div>

                  {/* Details */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase ${
                          session.category === 'CULTURAL'
                            ? 'bg-purple-100 text-purple-800'
                            : session.category === 'MEAL'
                            ? 'bg-emerald-100 text-emerald-800'
                            : session.category === 'RALLY'
                            ? 'bg-amber-100 text-amber-800'
                            : session.category === 'CEREMONY'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {session.category}
                      </span>
                      <h3 className="text-sm font-black text-slate-900">
                        {language === 'bn' ? session.titleBn : session.titleEn}
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-0.5">
                      <span className="flex items-center gap-1 font-medium text-slate-700">
                        <MapPin className="w-3.5 h-3.5 text-rose-500" />
                        {session.venue}
                      </span>

                      {session.performerOrSpeaker && (
                        <span className="flex items-center gap-1 text-slate-600">
                          <Users className="w-3.5 h-3.5 text-blue-500" />
                          <b>Speaker / Artist:</b> {session.performerOrSpeaker}
                        </span>
                      )}

                      <span className="flex items-center gap-1 text-slate-500">
                        <b>In Charge:</b> {session.leadCoordinator} ({session.coordinatorPhone})
                      </span>
                    </div>

                    {session.notes && (
                      <p className="text-[11px] text-slate-400 italic pt-1">{session.notes}</p>
                    )}
                  </div>
                </div>

                {/* Edit & Delete Controls */}
                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  <button
                    onClick={() => handleOpenEdit(session)}
                    className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition cursor-pointer"
                    title="Edit Session"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteSession(session.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                    title="Delete Session"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: VENUE ZONES & INFRASTRUCTURE */}
      {activeTab === 'venues' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {zones.map((zone) => (
              <div key={zone.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                      <MapPin className="w-5 h-5" />
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{zone.name}</h4>
                      <span className="text-[10px] text-slate-400 font-mono">ID: {zone.id}</span>
                    </div>
                  </div>
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      zone.status === 'READY'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {zone.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-slate-600">
                  <p>
                    <span className="font-semibold text-slate-700">Location:</span> {zone.location}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Capacity:</span> {zone.capacity}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Coordinator:</span> {zone.inCharge} ({zone.phone})
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Security Cleared
                  </span>
                  <span className="font-mono text-[10px]">Police Lines Large Field</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: CULTURAL & CONCERT LINEUP */}
      {activeTab === 'artists' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <span className="p-2 bg-purple-50 text-purple-700 rounded-xl">
                <Radio className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Jan 28: Evening Traditional Qawwali Night</h3>
                <span className="text-xs text-purple-700 font-medium">06:30 PM - 10:30 PM • Main Amphitheater</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Featuring renowned traditional Sufi and Qawwali troupes alongside honored alumni artists. The ambiance will be set with traditional Persian carpets, warm ambient lantern lighting, and steaming samovar tea served to all guests.
            </p>

            <div className="bg-slate-50 p-3 rounded-xl space-y-2 text-xs">
              <div className="font-bold text-slate-800">Featured Segments:</div>
              <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px]">
                <li>Hamd & Naat Recitations by Alumnus Choirs</li>
                <li>Classic Sufiyana Kalam & Amir Khusrau Compositions</li>
                <li>Live Harmonising & Traditional Tabla Dholak Jugalbandi</li>
                <li>Late Evening Sufi Fusion Encore</li>
              </ul>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <span className="p-2 bg-amber-50 text-amber-700 rounded-xl">
                <Sparkles className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Jan 29: Grand Reunion Mega Concert</h3>
                <span className="text-xs text-amber-700 font-medium">05:00 PM - 10:00 PM • Large Field Concert Arena</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              The grand climax of Reunion 2027 featuring celebrated national guest bands, contemporary pop performers, school batch acoustic groups, exciting raffle draws, and concluding with a breathtaking 15-minute synchronized fireworks extravaganza.
            </p>

            <div className="bg-slate-50 p-3 rounded-xl space-y-2 text-xs">
              <div className="font-bold text-slate-800">Technical Highlights:</div>
              <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px]">
                <li>60ft x 40ft Elevated Covered Truss Concert Stage</li>
                <li>Line-Array Sound System (50,000W RMS output)</li>
                <li>P3 LED Video Backdrop & Live Multi-Camera Drone Broadcast</li>
                <li>Mega Raffle Draw with Grand Prizes for Alumni</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT SESSION */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900">
                {editingSession ? 'Edit Agenda Session' : 'Add Agenda Session'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSession} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Event Day *</label>
                  <select
                    value={dayInput}
                    onChange={(e) => setDayInput(e.target.value as 'DAY_1' | 'DAY_2')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-hidden"
                  >
                    <option value="DAY_1">Day 1: Jan 28, 2027</option>
                    <option value="DAY_2">Day 2: Jan 29, 2027</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Session Category</label>
                  <select
                    value={categoryInput}
                    onChange={(e) => setCategoryInput(e.target.value as ProgramSession['category'])}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-hidden"
                  >
                    <option value="CEREMONY">Ceremony & Formal</option>
                    <option value="CULTURAL">Cultural & Concert</option>
                    <option value="MEAL">Meal & Banquet</option>
                    <option value="RALLY">Rally & Procession</option>
                    <option value="REGISTRATION">Registration & Kits</option>
                    <option value="INTERACTION">Batch Interaction</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Start Time *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 10:00 AM"
                    value={startTimeInput}
                    onChange={(e) => setStartTimeInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">End Time *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 11:30 AM"
                    value={endTimeInput}
                    onChange={(e) => setEndTimeInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Session Title (English) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Grand Alumni Banquet & Mezban Feast"
                  value={titleEnInput}
                  onChange={(e) => setTitleEnInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Session Title (Bengali)</label>
                <input
                  type="text"
                  placeholder="e.g. পুনর্মিলনী মধ্যাহ্নভোজ ও মেজবানি প্রীতিভোজ"
                  value={titleBnInput}
                  onChange={(e) => setTitleBnInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Venue / Specific Stage Location *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Police Lines Large Field Central Pavilion"
                  value={venueInput}
                  onChange={(e) => setVenueInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Featured Speaker / Performer</label>
                <input
                  type="text"
                  placeholder="e.g. Chief Guest, Principal, or Headline Band"
                  value={speakerInput}
                  onChange={(e) => setSpeakerInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Lead Coordinator</label>
                  <input
                    type="text"
                    placeholder="e.g. Sagar"
                    value={coordInput}
                    onChange={(e) => setCoordInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Coordinator Phone</label>
                  <input
                    type="text"
                    placeholder="01711000005"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Notes & Logistics Guidelines</label>
                <textarea
                  rows={2}
                  placeholder="Key instructions, sound check timings, or badge verification requirements..."
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition cursor-pointer"
                >
                  {editingSession ? 'Update Session' : 'Save Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
