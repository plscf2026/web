import {
  RegistrationRecord,
  DonationRecord,
  NoticeItem,
  ExpenseRecord,
  StaffUser,
  FeeSettings,
  ScanLog,
  DEFAULT_HOME_PAGE_SECTIONS,
} from '../types';
import { SupabaseService, supabase } from './supabase';
import { isValidSixCharToken, generateUniqueSixCharToken } from '../utils/tokenGenerator';

const STORAGE_KEY_REGISTRATIONS = 'plscf_reunion_registrations_v1';
const STORAGE_KEY_DONATIONS = 'plscf_reunion_donations_v1';
const STORAGE_KEY_NOTICES = 'plscf_reunion_notices_v1';
const STORAGE_KEY_EXPENSES = 'plscf_reunion_expenses_v1';
const STORAGE_KEY_SETTINGS = 'plscf_reunion_settings_v1';
const STORAGE_KEY_SCAN_LOGS = 'plscf_reunion_scan_logs_v1';
const STORAGE_KEY_ACTIVE_STAFF = 'plscf_reunion_active_staff_v1';

export const INITIAL_STAFF_USERS: StaffUser[] = [
  {
    id: 'STF-ADM-01',
    username: 'admin@gmail.com',
    fullName: 'System Administrator (Testing)',
    role: 'super_admin',
    gateAssigned: 'All Gates / All Modules',
  },
  {
    id: 'STF-GAT-01',
    username: 'gate@gmail.com',
    fullName: 'Tariqul Islam (Gate Lead)',
    role: 'scanner_staff',
    gateAssigned: 'Gate 01 - Main Entrance',
  },
  {
    id: 'STF-GAT-02',
    username: 'gate2@gmail.com',
    fullName: 'Tanvir Hasan (Gate 02 Officer)',
    role: 'scanner_staff',
    gateAssigned: 'Gate 02 - East Campus',
  },
  {
    id: 'STF-BRK-01',
    username: 'breakfast@gmail.com',
    fullName: 'Nasir Uddin (Breakfast Incharge)',
    role: 'scanner_staff',
    gateAssigned: 'Food Pavilion B (Breakfast)',
  },
  {
    id: 'STF-LUN-01',
    username: 'food@gmail.com',
    fullName: 'Mohammad Faruk Hossain (Lunch Lead)',
    role: 'scanner_staff',
    gateAssigned: 'Food Pavilion A (Lunch)',
  },
  {
    id: 'STF-DIN-01',
    username: 'dinner@gmail.com',
    fullName: 'Abdur Rahim (Dinner Incharge)',
    role: 'scanner_staff',
    gateAssigned: 'Food Pavilion C (Dinner)',
  },
  {
    id: 'STF-DRS-01',
    username: 'dress@gmail.com',
    fullName: 'Jamal Uddin Chowdhury (Kit & T-Shirt)',
    role: 'scanner_staff',
    gateAssigned: 'Distribution Booth 01',
  },
  {
    id: 'STF-DRS-02',
    username: 'dress2@gmail.com',
    fullName: 'Kazi Rayhan (Distribution Booth 02)',
    role: 'scanner_staff',
    gateAssigned: 'Distribution Booth 02',
  },
  {
    id: 'STF-FIN-01',
    username: 'finance@gmail.com',
    fullName: 'Md. Shafiqul Alam (Finance Secretary)',
    role: 'finance_mgr',
    gateAssigned: 'Central Accounts Office',
  },
  {
    id: 'STF-REG-01',
    username: 'registration@gmail.com',
    fullName: 'Dr. Nusrat Jahan (Registration Lead)',
    role: 'registration_mgr',
    gateAssigned: 'Secretariat Registration Desk',
  },
  {
    id: 'STF-SUP-01',
    username: 'supervisor@gmail.com',
    fullName: 'Engr. Moniruzzaman (Floor Supervisor)',
    role: 'scanner_supervisor',
    gateAssigned: 'All Gate & Floor Stations',
  },
  {
    id: 'STF-CNT-01',
    username: 'content@gmail.com',
    fullName: 'Farhana Yasmin (Souvenir & Media Lead)',
    role: 'content_mgr',
    gateAssigned: 'Media & Public Relations Room',
  },
  {
    id: 'STF-IDC-01',
    username: 'idcard.staff@gmail.com',
    fullName: 'Kamrul Hasan (ID Card Coordinator)',
    role: 'admin',
    gateAssigned: 'ID Card Production Center',
  },
];

export const INITIAL_FEE_SETTINGS: FeeSettings = {
  formerStudentFee: 1500,
  currentStudentFee: 500,
  registrationOpen: true,
  startDate: '2026-01-01',
  endDate: '2027-01-20',
  lateFeeEnabled: false,
  lateFeeAmount: 300,
  closedMessageEn: 'Online registration is currently closed. If you need special authorization, please contact the Reunion Secretariat.',
  closedMessageBn: 'অনলাইন রেজিস্ট্রেশন কার্যক্রম বর্তমানে বন্ধ রয়েছে। জরুরি প্রয়োজনে অনুগ্রহ করে পুনর্মিলনী সচিবালয়ে যোগাযোগ করুন।',
  eventTargetDate: '2027-01-29T09:00:00',
  simulateEventCompleted: false,
  homePageSections: DEFAULT_HOME_PAGE_SECTIONS,
};

export const INITIAL_REGISTRATIONS: RegistrationRecord[] = [
  {
    "id": "PLSCF-2026-F1001",
    "fullName": "Tanvir Ahmed",
    "fullNameBn": "তানভীর আহমেদ",
    "photoUrl": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01711223344",
    "email": "tanvir.ahmed@example.com",
    "address": "House 14, Road 3, Faridpur Sadar, Faridpur",
    "category": "former",
    "passingYear": "1998",
    "batchName": "SSC 1998",
    "tShirtSize": "XL",
    "registrationFee": 1500,
    "donationAmount": 500,
    "totalPaid": 2000,
    "paymentStatus": "paid",
    "transactionId": "PST-BK-8821901",
    "paymentMethod": "bkash",
    "registeredAt": "2026-01-16T10:30:00Z",
    "qrToken": "A7K9M2",
    "isTShirtCollected": false,
    "serverVerificationSignature": "SIG_V2_7A82910F11223344",
    "verificationTimestamp": "2026-01-16T10:32:15Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-F1002",
    "fullName": "Dr. Nusrat Jahan",
    "fullNameBn": "ডা. নুসরাত জাহান",
    "photoUrl": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01819887766",
    "email": "dr.nusrat@example.com",
    "address": "Medical College Road, Faridpur",
    "category": "former",
    "passingYear": "2005",
    "batchName": "SSC 2005",
    "tShirtSize": "M",
    "registrationFee": 1500,
    "donationAmount": 1000,
    "totalPaid": 2500,
    "paymentStatus": "paid",
    "transactionId": "PST-CRD-9948201",
    "paymentMethod": "card",
    "registeredAt": "2026-01-18T14:15:00Z",
    "qrToken": "R8W3N5",
    "isTShirtCollected": true,
    "serverVerificationSignature": "SIG_V2_5B91024D9948201",
    "verificationTimestamp": "2026-01-18T14:16:30Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-F1003",
    "fullName": "Md. Asaduzzaman",
    "fullNameBn": "মোঃ আসাদুজ্জামান",
    "photoUrl": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01912345678",
    "email": "asad.zaman@example.com",
    "address": "Goalchamot, Faridpur",
    "category": "former",
    "passingYear": "2012",
    "batchName": "SSC 2012",
    "tShirtSize": "L",
    "registrationFee": 1500,
    "donationAmount": 0,
    "totalPaid": 1500,
    "paymentStatus": "paid",
    "transactionId": "PST-NG-7738192",
    "paymentMethod": "nagad",
    "registeredAt": "2026-01-20T11:00:00Z",
    "qrToken": "B9F2Q7",
    "isTShirtCollected": false,
    "serverVerificationSignature": "SIG_V2_3C88219E7738192",
    "verificationTimestamp": "2026-01-20T11:02:10Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-F1004",
    "fullName": "Kazi Mahfuzur Rahman",
    "fullNameBn": "কাজী মাহফুজুর রহমান",
    "photoUrl": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01713456789",
    "email": "mahfuz.kazi@example.com",
    "address": "Police Lines Housing Area, Faridpur",
    "category": "former",
    "passingYear": "1986",
    "batchName": "SSC 1986",
    "tShirtSize": "Oversize 50",
    "registrationFee": 1500,
    "donationAmount": 3500,
    "totalPaid": 5000,
    "paymentStatus": "paid",
    "transactionId": "PST-RCK-6629103",
    "paymentMethod": "rocket",
    "registeredAt": "2026-01-22T16:20:00Z",
    "qrToken": "X5H8C3",
    "isTShirtCollected": false,
    "serverVerificationSignature": "SIG_V2_8D19482A6629103",
    "verificationTimestamp": "2026-01-22T16:22:45Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-C2001",
    "fullName": "Samiul Islam",
    "fullNameBn": "সামিউল ইসলাম",
    "photoUrl": "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01301234567",
    "email": "samiul.student@plscf.edu.bd",
    "address": "Jhiltoli, Faridpur",
    "category": "current",
    "studentId": "PLSC-2026-101",
    "currentClass": "Class 10",
    "batchName": "Class 10 Section A",
    "groupOrSection": "Section A",
    "rollNumber": "05",
    "tShirtSize": "M",
    "registrationFee": 500,
    "donationAmount": 0,
    "totalPaid": 500,
    "paymentStatus": "paid",
    "transactionId": "PST-BK-5518294",
    "paymentMethod": "bkash",
    "registeredAt": "2026-01-25T09:40:00Z",
    "qrToken": "C4P8L1",
    "isTShirtCollected": false,
    "serverVerificationSignature": "SIG_V2_9E10294F5518294",
    "verificationTimestamp": "2026-01-25T09:41:20Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-C2002",
    "fullName": "Ayesha Siddiqua",
    "fullNameBn": "আয়েশা সিদ্দিকা",
    "photoUrl": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01799887711",
    "email": "ayesha.siddiqua@plscf.edu.bd",
    "address": "Aliabad, Faridpur",
    "category": "current",
    "studentId": "PLSC-2026-104",
    "currentClass": "Class 12",
    "batchName": "HSC 2026 Science",
    "groupOrSection": "Science",
    "rollNumber": "12",
    "tShirtSize": "S",
    "registrationFee": 500,
    "donationAmount": 0,
    "totalPaid": 500,
    "paymentStatus": "paid",
    "transactionId": "PST-NG-4419205",
    "paymentMethod": "nagad",
    "registeredAt": "2026-01-26T12:00:00Z",
    "qrToken": "D2M9V6",
    "isTShirtCollected": true,
    "serverVerificationSignature": "SIG_V2_2F88192A4419205",
    "verificationTimestamp": "2026-01-26T12:02:10Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-F1005",
    "fullName": "Shafiqul Islam",
    "fullNameBn": "শফিকুল ইসলাম",
    "photoUrl": "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01611223344",
    "email": "shafiq.islam@example.com",
    "address": "Bhanga, Faridpur",
    "category": "former",
    "passingYear": "2018",
    "batchName": "SSC 2018",
    "tShirtSize": "XXL",
    "registrationFee": 1500,
    "donationAmount": 0,
    "totalPaid": 0,
    "paymentStatus": "pending",
    "transactionId": "",
    "paymentMethod": "bkash",
    "registeredAt": "2026-02-01T15:30:00Z",
    "qrToken": "E6T1W8",
    "isTShirtCollected": false,
    "year": 2026
  },
  {
    "id": "PLSCF-2026-C2003",
    "fullName": "Nafis Fuad",
    "fullNameBn": "নাফিস ফুয়াদ",
    "photoUrl": "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01788776655",
    "email": "nafis.fuad@plscf.edu.bd",
    "address": "Ambikapur, Faridpur",
    "category": "current",
    "studentId": "PLSC-2026-105",
    "currentClass": "Class 9",
    "batchName": "Class 9 Section B",
    "groupOrSection": "Section B",
    "rollNumber": "21",
    "tShirtSize": "L",
    "registrationFee": 500,
    "donationAmount": 0,
    "totalPaid": 0,
    "paymentStatus": "pending",
    "transactionId": "",
    "paymentMethod": "bkash",
    "registeredAt": "2026-02-02T10:15:00Z",
    "qrToken": "F3Y7K4",
    "isTShirtCollected": false,
    "year": 2026
  },
  {
    "id": "PLSCF-2026-F1006",
    "fullName": "Engr. Moniruzzaman",
    "fullNameBn": "প্রকৌ. মনিরুজ্জামান",
    "photoUrl": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01711002233",
    "email": "monir.engr@example.com",
    "address": "Alipur, Faridpur Sadar, Faridpur",
    "category": "former",
    "passingYear": "1975",
    "batchName": "SSC 1975",
    "tShirtSize": "XL",
    "registrationFee": 1500,
    "donationAmount": 50000,
    "totalPaid": 51500,
    "paymentStatus": "paid",
    "transactionId": "PST-BK-9910245",
    "paymentMethod": "bkash",
    "registeredAt": "2026-01-10T11:00:00Z",
    "qrToken": "G9Z2N6",
    "isTShirtCollected": true,
    "serverVerificationSignature": "SIG_V2_1A990245F991024",
    "verificationTimestamp": "2026-01-10T11:02:40Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-F1007",
    "fullName": "Advocate Rafiqul Hasan",
    "fullNameBn": "এডভোকেট রফিকুল হাসান",
    "photoUrl": "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01812334455",
    "email": "rafiq.law@example.com",
    "address": "Court Road, Faridpur Sadar",
    "category": "former",
    "passingYear": "1980",
    "batchName": "SSC 1980",
    "tShirtSize": "L",
    "registrationFee": 1500,
    "donationAmount": 5000,
    "totalPaid": 6500,
    "paymentStatus": "paid",
    "transactionId": "PST-NG-6618291",
    "paymentMethod": "nagad",
    "registeredAt": "2026-01-12T14:20:00Z",
    "qrToken": "H4K8J1",
    "isTShirtCollected": false,
    "serverVerificationSignature": "SIG_V2_2B882910F661829",
    "verificationTimestamp": "2026-01-12T14:22:15Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-F1008",
    "fullName": "Prof. Anisur Rahman",
    "fullNameBn": "অধ্যাপক আনিসুর রহমান",
    "photoUrl": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01913445566",
    "email": "prof.anis@example.com",
    "address": "College Road, Faridpur",
    "category": "former",
    "passingYear": "1983",
    "batchName": "SSC 1983",
    "tShirtSize": "M",
    "registrationFee": 1500,
    "donationAmount": 10000,
    "totalPaid": 11500,
    "paymentStatus": "paid",
    "transactionId": "PST-RCK-5529104",
    "paymentMethod": "rocket",
    "registeredAt": "2026-01-14T09:10:00Z",
    "qrToken": "J7M3X9",
    "isTShirtCollected": true,
    "serverVerificationSignature": "SIG_V2_3C771045F552910",
    "verificationTimestamp": "2026-01-14T09:12:00Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-F1009",
    "fullName": "Sultana Razia",
    "fullNameBn": "সুলতানা রাজিয়া",
    "photoUrl": "https://images.unsplash.com/photo-1548142813-c348350df52b?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01714556677",
    "email": "razia.s@example.com",
    "address": "Jhiltoli, Faridpur",
    "category": "former",
    "passingYear": "1988",
    "batchName": "SSC 1988",
    "tShirtSize": "S",
    "registrationFee": 1500,
    "donationAmount": 2000,
    "totalPaid": 3500,
    "paymentStatus": "paid",
    "transactionId": "PST-BK-4438192",
    "paymentMethod": "bkash",
    "registeredAt": "2026-01-15T16:45:00Z",
    "qrToken": "K2P6B8",
    "isTShirtCollected": false,
    "serverVerificationSignature": "SIG_V2_4D661923F443819",
    "verificationTimestamp": "2026-01-15T16:47:30Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-F1010",
    "fullName": "Golam Mostafa",
    "fullNameBn": "গোলাম মোস্তফা",
    "photoUrl": "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01615667788",
    "email": "g.mostafa@example.com",
    "address": "Madhukhali, Faridpur",
    "category": "former",
    "passingYear": "1991",
    "batchName": "SSC 1991",
    "tShirtSize": "XL",
    "registrationFee": 1500,
    "donationAmount": 1500,
    "totalPaid": 3000,
    "paymentStatus": "paid",
    "transactionId": "PST-CRD-3349105",
    "paymentMethod": "card",
    "registeredAt": "2026-01-17T11:30:00Z",
    "qrToken": "L5R9T3",
    "isTShirtCollected": true,
    "serverVerificationSignature": "SIG_V2_5E551056F334910",
    "verificationTimestamp": "2026-01-17T11:31:45Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-F1011",
    "fullName": "Farhana Yasmin",
    "fullNameBn": "ফারহানা ইয়াসমিন",
    "photoUrl": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01911882244",
    "email": "farhana.y@example.com",
    "address": "Chawkbazar, Faridpur",
    "category": "former",
    "passingYear": "1995",
    "batchName": "SSC 1995",
    "tShirtSize": "M",
    "registrationFee": 1500,
    "donationAmount": 20000,
    "totalPaid": 21500,
    "paymentStatus": "paid",
    "transactionId": "PST-NG-5519203",
    "paymentMethod": "nagad",
    "registeredAt": "2026-01-28T14:30:00Z",
    "qrToken": "M8W2D7",
    "isTShirtCollected": true,
    "serverVerificationSignature": "SIG_V2_6F442037F551920",
    "verificationTimestamp": "2026-01-28T14:32:00Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-F1012",
    "fullName": "Squadron Leader Rashed Khan",
    "fullNameBn": "স্কোয়াড্রন লিডার রাশেদ খান",
    "photoUrl": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01811554433",
    "email": "rashed.khan@example.com",
    "address": "BAF Base Colony, Faridpur",
    "category": "former",
    "passingYear": "2001",
    "batchName": "SSC 2001",
    "tShirtSize": "L",
    "registrationFee": 1500,
    "donationAmount": 15000,
    "totalPaid": 16500,
    "paymentStatus": "paid",
    "transactionId": "PST-CRD-3319024",
    "paymentMethod": "card",
    "registeredAt": "2026-02-05T09:15:00Z",
    "qrToken": "N3X7F4",
    "isTShirtCollected": false,
    "serverVerificationSignature": "SIG_V2_7A330248F331902",
    "verificationTimestamp": "2026-02-05T09:17:10Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-F1013",
    "fullName": "Nahid Sultana",
    "fullNameBn": "নাহিদ সুলতানা",
    "photoUrl": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01716778899",
    "email": "nahid.s@example.com",
    "address": "Guhho Laxmipur, Faridpur",
    "category": "former",
    "passingYear": "2003",
    "batchName": "SSC 2003",
    "tShirtSize": "S",
    "registrationFee": 1500,
    "donationAmount": 500,
    "totalPaid": 2000,
    "paymentStatus": "paid",
    "transactionId": "PST-BK-2259106",
    "paymentMethod": "bkash",
    "registeredAt": "2026-01-29T10:20:00Z",
    "qrToken": "P6Y1H9",
    "isTShirtCollected": false,
    "serverVerificationSignature": "SIG_V2_8B221069F225910",
    "verificationTimestamp": "2026-01-29T10:21:50Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-F1014",
    "fullName": "Zubair Hossain",
    "fullNameBn": "জুবায়ের হোসেন",
    "photoUrl": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01517889900",
    "email": "zubair.h@example.com",
    "address": "Boalmari, Faridpur",
    "category": "former",
    "passingYear": "2006",
    "batchName": "SSC 2006",
    "tShirtSize": "XXL",
    "registrationFee": 1500,
    "donationAmount": 0,
    "totalPaid": 1500,
    "paymentStatus": "paid",
    "transactionId": "PST-UP-1168297",
    "paymentMethod": "rocket",
    "registeredAt": "2026-01-30T13:40:00Z",
    "qrToken": "Q4B8J2",
    "isTShirtCollected": true,
    "serverVerificationSignature": "SIG_V2_9C112970F116829",
    "verificationTimestamp": "2026-01-30T13:42:00Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-F1015",
    "fullName": "Mahbuba Akter",
    "fullNameBn": "মাহবুবা আক্তার",
    "photoUrl": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01818990011",
    "email": "mahbuba.a@example.com",
    "address": "Kamlapur, Faridpur",
    "category": "former",
    "passingYear": "2008",
    "batchName": "SSC 2008",
    "tShirtSize": "M",
    "registrationFee": 1500,
    "donationAmount": 1000,
    "totalPaid": 2500,
    "paymentStatus": "paid",
    "transactionId": "PST-BK-9978198",
    "paymentMethod": "bkash",
    "registeredAt": "2026-01-31T15:15:00Z",
    "qrToken": "R9C3K7",
    "isTShirtCollected": true,
    "serverVerificationSignature": "SIG_V2_0D991981F997819",
    "verificationTimestamp": "2026-01-31T15:16:30Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-F1016",
    "fullName": "Tanzeem Morshed",
    "fullNameBn": "তানজীম মোরশেদ",
    "photoUrl": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01719001122",
    "email": "tanzeem.m@example.com",
    "address": "Ambikapur, Faridpur",
    "category": "former",
    "passingYear": "2010",
    "batchName": "SSC 2010",
    "tShirtSize": "XL",
    "registrationFee": 1500,
    "donationAmount": 0,
    "totalPaid": 1500,
    "paymentStatus": "paid",
    "transactionId": "PST-NG-8889109",
    "paymentMethod": "nagad",
    "registeredAt": "2026-02-01T09:30:00Z",
    "qrToken": "S2D7M5",
    "isTShirtCollected": false,
    "serverVerificationSignature": "SIG_V2_1E881092F888910",
    "verificationTimestamp": "2026-02-01T09:31:45Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-F1017",
    "fullName": "Shahriar Kabir",
    "fullNameBn": "শাহরিয়ার কবির",
    "photoUrl": "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01620112233",
    "email": "shahriar.k@example.com",
    "address": "Tepakhola, Faridpur",
    "category": "former",
    "passingYear": "2013",
    "batchName": "SSC 2013",
    "tShirtSize": "L",
    "registrationFee": 1500,
    "donationAmount": 500,
    "totalPaid": 2000,
    "paymentStatus": "paid",
    "transactionId": "PST-RCK-7798201",
    "paymentMethod": "rocket",
    "registeredAt": "2026-02-02T12:00:00Z",
    "qrToken": "T8F2N4",
    "isTShirtCollected": true,
    "serverVerificationSignature": "SIG_V2_2F772013F779820",
    "verificationTimestamp": "2026-02-02T12:01:50Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-F1018",
    "fullName": "Sabrina Sharmin",
    "fullNameBn": "সাবরিনা শারমিন",
    "photoUrl": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01921223344",
    "email": "sabrina.s@example.com",
    "address": "Sreepur, Faridpur",
    "category": "former",
    "passingYear": "2014",
    "batchName": "SSC 2014",
    "tShirtSize": "S",
    "registrationFee": 1500,
    "donationAmount": 0,
    "totalPaid": 1500,
    "paymentStatus": "paid",
    "transactionId": "PST-BK-6609102",
    "paymentMethod": "bkash",
    "registeredAt": "2026-02-03T14:10:00Z",
    "qrToken": "U5G9P1",
    "isTShirtCollected": true,
    "serverVerificationSignature": "SIG_V2_3A661024F660910",
    "verificationTimestamp": "2026-02-03T14:12:00Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-F1019",
    "fullName": "Md. Al-Amin",
    "fullNameBn": "মোঃ আল-আমিন",
    "photoUrl": "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01722334455",
    "email": "alamin.m@example.com",
    "address": "Sadarpur, Faridpur",
    "category": "former",
    "passingYear": "2016",
    "batchName": "SSC 2016",
    "tShirtSize": "M",
    "registrationFee": 1500,
    "donationAmount": 500,
    "totalPaid": 2000,
    "paymentStatus": "paid",
    "transactionId": "PST-NG-5518203",
    "paymentMethod": "nagad",
    "registeredAt": "2026-02-04T16:25:00Z",
    "qrToken": "V3H6R8",
    "isTShirtCollected": false,
    "serverVerificationSignature": "SIG_V2_4B552035F551820",
    "verificationTimestamp": "2026-02-04T16:26:40Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-F1020",
    "fullName": "Tahsin Mahmud",
    "fullNameBn": "তাহসিন মাহমুদ",
    "photoUrl": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01823445566",
    "email": "tahsin.m@example.com",
    "address": "Charbhadrasan, Faridpur",
    "category": "former",
    "passingYear": "2019",
    "batchName": "SSC 2019",
    "tShirtSize": "L",
    "registrationFee": 1500,
    "donationAmount": 0,
    "totalPaid": 1500,
    "paymentStatus": "paid",
    "transactionId": "PST-CRD-4429104",
    "paymentMethod": "card",
    "registeredAt": "2026-02-05T10:45:00Z",
    "qrToken": "W7J1T2",
    "isTShirtCollected": false,
    "serverVerificationSignature": "SIG_V2_5C441046F442910",
    "verificationTimestamp": "2026-02-05T10:47:00Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-F1021",
    "fullName": "Fariha Tasnim",
    "fullNameBn": "ফারিহা তাসনিম",
    "photoUrl": "https://images.unsplash.com/photo-1548142813-c348350df52b?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01524556677",
    "email": "fariha.t@example.com",
    "address": "Goalchamot, Faridpur",
    "category": "former",
    "passingYear": "2021",
    "batchName": "SSC 2021",
    "tShirtSize": "S",
    "registrationFee": 1500,
    "donationAmount": 500,
    "totalPaid": 2000,
    "paymentStatus": "paid",
    "transactionId": "PST-BK-3338205",
    "paymentMethod": "bkash",
    "registeredAt": "2026-02-06T11:15:00Z",
    "qrToken": "X2K5V9",
    "isTShirtCollected": true,
    "serverVerificationSignature": "SIG_V2_6D332057F333820",
    "verificationTimestamp": "2026-02-06T11:16:30Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-F1022",
    "fullName": "Shakil Ahmed",
    "fullNameBn": "শাকিল আহমেদ",
    "photoUrl": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01325667788",
    "email": "shakil.a@example.com",
    "address": "Nagarkanda, Faridpur",
    "category": "former",
    "passingYear": "2022",
    "batchName": "SSC 2022",
    "tShirtSize": "XL",
    "registrationFee": 1500,
    "donationAmount": 0,
    "totalPaid": 1500,
    "paymentStatus": "paid",
    "transactionId": "PST-UP-2249106",
    "paymentMethod": "rocket",
    "registeredAt": "2026-02-07T13:50:00Z",
    "qrToken": "Y8M4W3",
    "isTShirtCollected": false,
    "serverVerificationSignature": "SIG_V2_7E221068F224910",
    "verificationTimestamp": "2026-02-07T13:52:10Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-F1023",
    "fullName": "Israt Jahan Eva",
    "fullNameBn": "ইসরাত জাহান ইভা",
    "photoUrl": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01726778899",
    "email": "israt.eva@example.com",
    "address": "Alipur, Faridpur",
    "category": "former",
    "passingYear": "2023",
    "batchName": "SSC 2023",
    "tShirtSize": "M",
    "registrationFee": 1500,
    "donationAmount": 1000,
    "totalPaid": 2500,
    "paymentStatus": "paid",
    "transactionId": "PST-NG-1158207",
    "paymentMethod": "nagad",
    "registeredAt": "2026-02-08T15:40:00Z",
    "qrToken": "Z1N7X6",
    "isTShirtCollected": false,
    "serverVerificationSignature": "SIG_V2_8F112079F115820",
    "verificationTimestamp": "2026-02-08T15:42:00Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-F1024",
    "fullName": "Towhidul Islam",
    "fullNameBn": "তৌহিদুল ইসলাম",
    "photoUrl": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01827889900",
    "email": "towhid.i@example.com",
    "address": "Bhanga, Faridpur",
    "category": "former",
    "passingYear": "2024",
    "batchName": "SSC 2024",
    "tShirtSize": "L",
    "registrationFee": 1500,
    "donationAmount": 0,
    "totalPaid": 0,
    "paymentStatus": "pending",
    "transactionId": "",
    "paymentMethod": "bkash",
    "registeredAt": "2026-02-09T09:20:00Z",
    "qrToken": "A3P9B5",
    "isTShirtCollected": false,
    "year": 2026
  },
  {
    "id": "PLSCF-2026-F1025",
    "fullName": "Kamrul Ahsan",
    "fullNameBn": "কামরুল আহসান",
    "photoUrl": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01728990011",
    "email": "kamrul.a@example.com",
    "address": "Housing Estate, Faridpur",
    "category": "former",
    "passingYear": "1972",
    "batchName": "SSC 1972",
    "tShirtSize": "Oversize 50",
    "registrationFee": 1500,
    "donationAmount": 25000,
    "totalPaid": 26500,
    "paymentStatus": "paid",
    "transactionId": "PST-BK-9968208",
    "paymentMethod": "bkash",
    "registeredAt": "2026-01-11T10:00:00Z",
    "qrToken": "B6R2C8",
    "isTShirtCollected": true,
    "serverVerificationSignature": "SIG_V2_9A992080F996820",
    "verificationTimestamp": "2026-01-11T10:02:15Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-C2004",
    "fullName": "Mehedi Hasan",
    "fullNameBn": "মেহেদী হাসান",
    "photoUrl": "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01929001122",
    "email": "mehedi.h@plscf.edu.bd",
    "address": "Police Lines Staff Quarter, Faridpur",
    "category": "current",
    "studentId": "PLSC-2026-102",
    "currentClass": "Class 10",
    "batchName": "Class 10 Section B",
    "groupOrSection": "Section B",
    "rollNumber": "08",
    "tShirtSize": "L",
    "registrationFee": 500,
    "donationAmount": 0,
    "totalPaid": 500,
    "paymentStatus": "paid",
    "transactionId": "PST-RCK-8859101",
    "paymentMethod": "rocket",
    "registeredAt": "2026-01-27T08:30:00Z",
    "qrToken": "C9T4D1",
    "isTShirtCollected": false,
    "serverVerificationSignature": "SIG_V2_1B881012F885910",
    "verificationTimestamp": "2026-01-27T08:31:40Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-C2005",
    "fullName": "Fatema Tuj Zohra",
    "fullNameBn": "ফাতেমা তুজ জোহরা",
    "photoUrl": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01730112233",
    "email": "fatema.z@plscf.edu.bd",
    "address": "Goalchamot, Faridpur",
    "category": "current",
    "studentId": "PLSC-2026-103",
    "currentClass": "Class 10",
    "batchName": "Class 10 Section A",
    "groupOrSection": "Section A",
    "rollNumber": "03",
    "tShirtSize": "S",
    "registrationFee": 500,
    "donationAmount": 0,
    "totalPaid": 500,
    "paymentStatus": "paid",
    "transactionId": "PST-BK-7748202",
    "paymentMethod": "bkash",
    "registeredAt": "2026-01-27T11:45:00Z",
    "qrToken": "D2V8E7",
    "isTShirtCollected": true,
    "serverVerificationSignature": "SIG_V2_2C772023F774820",
    "verificationTimestamp": "2026-01-27T11:46:50Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-C2006",
    "fullName": "Sadia Afrin",
    "fullNameBn": "সাদিয়া আফরিন",
    "photoUrl": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01831223344",
    "email": "sadia.a@plscf.edu.bd",
    "address": "Alipur, Faridpur",
    "category": "current",
    "studentId": "PLSC-2026-106",
    "currentClass": "Class 11",
    "batchName": "HSC 2027 Science",
    "groupOrSection": "Science",
    "rollNumber": "15",
    "tShirtSize": "M",
    "registrationFee": 500,
    "donationAmount": 0,
    "totalPaid": 500,
    "paymentStatus": "paid",
    "transactionId": "PST-NG-6639103",
    "paymentMethod": "nagad",
    "registeredAt": "2026-01-28T10:15:00Z",
    "qrToken": "E5W1F9",
    "isTShirtCollected": true,
    "serverVerificationSignature": "SIG_V2_3D661034F663910",
    "verificationTimestamp": "2026-01-28T10:16:30Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-C2007",
    "fullName": "Rifat Hossain",
    "fullNameBn": "রিফাত হোসেন",
    "photoUrl": "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01632334455",
    "email": "rifat.h@plscf.edu.bd",
    "address": "Tepakhola, Faridpur",
    "category": "current",
    "studentId": "PLSC-2026-107",
    "currentClass": "Class 11",
    "batchName": "HSC 2027 Commerce",
    "groupOrSection": "Commerce",
    "rollNumber": "09",
    "tShirtSize": "XL",
    "registrationFee": 500,
    "donationAmount": 0,
    "totalPaid": 500,
    "paymentStatus": "paid",
    "transactionId": "PST-CRD-5528204",
    "paymentMethod": "card",
    "registeredAt": "2026-01-29T14:00:00Z",
    "qrToken": "F8X3G2",
    "isTShirtCollected": false,
    "serverVerificationSignature": "SIG_V2_4E552045F552820",
    "verificationTimestamp": "2026-01-29T14:01:45Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-C2008",
    "fullName": "Nusrat Binte Alam",
    "fullNameBn": "নুসরাত বিনতে আলম",
    "photoUrl": "https://images.unsplash.com/photo-1548142813-c348350df52b?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01933445566",
    "email": "nusrat.b@plscf.edu.bd",
    "address": "Court Road, Faridpur",
    "category": "current",
    "studentId": "PLSC-2026-108",
    "currentClass": "Class 12",
    "batchName": "HSC 2026 Humanities",
    "groupOrSection": "Humanities",
    "rollNumber": "02",
    "tShirtSize": "S",
    "registrationFee": 500,
    "donationAmount": 0,
    "totalPaid": 500,
    "paymentStatus": "paid",
    "transactionId": "PST-BK-4419105",
    "paymentMethod": "bkash",
    "registeredAt": "2026-01-30T09:40:00Z",
    "qrToken": "G1Y7H4",
    "isTShirtCollected": false,
    "serverVerificationSignature": "SIG_V2_5F441056F441910",
    "verificationTimestamp": "2026-01-30T09:41:30Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-C2009",
    "fullName": "Ahsan Habib",
    "fullNameBn": "আহসান হাবীব",
    "photoUrl": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01734556677",
    "email": "ahsan.h@plscf.edu.bd",
    "address": "Chawkbazar, Faridpur",
    "category": "current",
    "studentId": "PLSC-2026-109",
    "currentClass": "Class 8",
    "batchName": "Class 8 Section A",
    "groupOrSection": "Section A",
    "rollNumber": "11",
    "tShirtSize": "M",
    "registrationFee": 500,
    "donationAmount": 0,
    "totalPaid": 500,
    "paymentStatus": "paid",
    "transactionId": "PST-NG-3308206",
    "paymentMethod": "nagad",
    "registeredAt": "2026-01-31T12:20:00Z",
    "qrToken": "H4Z2J6",
    "isTShirtCollected": true,
    "serverVerificationSignature": "SIG_V2_6A332067F330820",
    "verificationTimestamp": "2026-01-31T12:21:40Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-C2010",
    "fullName": "Jannatul Ferdous",
    "fullNameBn": "জান্নাতুল ফেরদৌস",
    "photoUrl": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01835667788",
    "email": "jannat.f@plscf.edu.bd",
    "address": "Sreepur, Faridpur",
    "category": "current",
    "studentId": "PLSC-2026-110",
    "currentClass": "Class 8",
    "batchName": "Class 8 Section B",
    "groupOrSection": "Section B",
    "rollNumber": "07",
    "tShirtSize": "S",
    "registrationFee": 500,
    "donationAmount": 0,
    "totalPaid": 500,
    "paymentStatus": "paid",
    "transactionId": "PST-RCK-2299107",
    "paymentMethod": "rocket",
    "registeredAt": "2026-02-01T14:10:00Z",
    "qrToken": "J7A8K3",
    "isTShirtCollected": true,
    "serverVerificationSignature": "SIG_V2_7B221078F229910",
    "verificationTimestamp": "2026-02-01T14:11:55Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-C2011",
    "fullName": "Mahir Faisal",
    "fullNameBn": "মাহির ফয়সাল",
    "photoUrl": "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01536778899",
    "email": "mahir.f@plscf.edu.bd",
    "address": "Guhho Laxmipur, Faridpur",
    "category": "current",
    "studentId": "PLSC-2026-111",
    "currentClass": "Class 7",
    "batchName": "Class 7 Section A",
    "groupOrSection": "Section A",
    "rollNumber": "14",
    "tShirtSize": "S",
    "registrationFee": 500,
    "donationAmount": 0,
    "totalPaid": 500,
    "paymentStatus": "paid",
    "transactionId": "PST-BK-1188208",
    "paymentMethod": "bkash",
    "registeredAt": "2026-02-02T16:30:00Z",
    "qrToken": "K1B3L7",
    "isTShirtCollected": false,
    "serverVerificationSignature": "SIG_V2_8C112089F118820",
    "verificationTimestamp": "2026-02-02T16:31:40Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-C2012",
    "fullName": "Samia Sultana",
    "fullNameBn": "সামিয়া সুলতানা",
    "photoUrl": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01337889900",
    "email": "samia.s@plscf.edu.bd",
    "address": "Kamlapur, Faridpur",
    "category": "current",
    "studentId": "PLSC-2026-112",
    "currentClass": "Class 7",
    "batchName": "Class 7 Section B",
    "groupOrSection": "Section B",
    "rollNumber": "04",
    "tShirtSize": "S",
    "registrationFee": 500,
    "donationAmount": 0,
    "totalPaid": 500,
    "paymentStatus": "paid",
    "transactionId": "PST-UP-9979109",
    "paymentMethod": "rocket",
    "registeredAt": "2026-02-03T11:00:00Z",
    "qrToken": "L4C9M2",
    "isTShirtCollected": false,
    "serverVerificationSignature": "SIG_V2_9D991090F997910",
    "verificationTimestamp": "2026-02-03T11:01:25Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-C2013",
    "fullName": "Ariful Islam",
    "fullNameBn": "আরিফুল ইসলাম",
    "photoUrl": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01738990011",
    "email": "ariful.i@plscf.edu.bd",
    "address": "Jhiltoli, Faridpur",
    "category": "current",
    "studentId": "PLSC-2026-113",
    "currentClass": "Class 6",
    "batchName": "Class 6 Section A",
    "groupOrSection": "Section A",
    "rollNumber": "18",
    "tShirtSize": "S",
    "registrationFee": 500,
    "donationAmount": 0,
    "totalPaid": 500,
    "paymentStatus": "paid",
    "transactionId": "PST-BK-8868201",
    "paymentMethod": "bkash",
    "registeredAt": "2026-02-04T13:40:00Z",
    "qrToken": "M7D2N8",
    "isTShirtCollected": false,
    "serverVerificationSignature": "SIG_V2_0E882011F886820",
    "verificationTimestamp": "2026-02-04T13:41:50Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-C2014",
    "fullName": "Tasnim Rahman",
    "fullNameBn": "তাসনিম রহমান",
    "photoUrl": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01839001122",
    "email": "tasnim.r@plscf.edu.bd",
    "address": "Ambikapur, Faridpur",
    "category": "current",
    "studentId": "PLSC-2026-114",
    "currentClass": "Class 6",
    "batchName": "Class 6 Section B",
    "groupOrSection": "Section B",
    "rollNumber": "06",
    "tShirtSize": "S",
    "registrationFee": 500,
    "donationAmount": 0,
    "totalPaid": 500,
    "paymentStatus": "paid",
    "transactionId": "PST-NG-7759102",
    "paymentMethod": "nagad",
    "registeredAt": "2026-02-05T15:20:00Z",
    "qrToken": "N1E6P4",
    "isTShirtCollected": true,
    "serverVerificationSignature": "SIG_V2_1F771022F775910",
    "verificationTimestamp": "2026-02-05T15:21:40Z",
    "verifiedBy": "PAYSTATION_GATEWAY",
    "year": 2026
  },
  {
    "id": "PLSCF-2026-C2015",
    "fullName": "Zayan Al Din",
    "fullNameBn": "জায়ান আল দিন",
    "photoUrl": "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=300&auto=format&fit=crop&q=80",
    "mobileNumber": "01940112233",
    "email": "zayan.d@plscf.edu.bd",
    "address": "Madhukhali, Faridpur",
    "category": "current",
    "studentId": "PLSC-2026-115",
    "currentClass": "Class 9",
    "batchName": "Class 9 Section A",
    "groupOrSection": "Section A",
    "rollNumber": "25",
    "tShirtSize": "M",
    "registrationFee": 500,
    "donationAmount": 0,
    "totalPaid": 0,
    "paymentStatus": "pending",
    "transactionId": "",
    "paymentMethod": "bkash",
    "registeredAt": "2026-02-06T10:30:00Z",
    "qrToken": "P4F1R9",
    "isTShirtCollected": false,
    "year": 2026
  }
];

export const INITIAL_DONATIONS: DonationRecord[] = [
  {
    id: 'DON-2026-001',
    donorName: 'Engr. Moniruzzaman (Batch 1982)',
    mobileNumber: '01711002233',
    email: 'monir.engr@example.com',
    amount: 50000,
    purpose: 'Campus Beautification & Souvenir Color Printing',
    paymentMethod: 'bkash',
    transactionId: 'PST-BK-9910245',
    paymentStatus: 'paid',
    date: '2026-01-10',
    year: 2026,
    createdAt: '2026-01-10T11:00:00Z',
  },
  {
    id: 'DON-2026-002',
    donorName: 'Dr. Kazi Mahfuzur Rahman (Batch 1986)',
    mobileNumber: '01713456789',
    email: 'mahfuz.kazi@example.com',
    amount: 35000,
    purpose: 'Retired Teachers Health & Welfare Grant',
    paymentMethod: 'rocket',
    transactionId: 'PST-RCK-6629103',
    paymentStatus: 'paid',
    date: '2026-01-22',
    year: 2026,
    createdAt: '2026-01-22T16:25:00Z',
  },
  {
    id: 'DON-2026-003',
    donorName: 'Farhana Yasmin (Batch 1995)',
    mobileNumber: '01911882244',
    email: 'farhana.y@example.com',
    amount: 20000,
    purpose: 'Needy Current Students Scholarship Endowment',
    paymentMethod: 'nagad',
    transactionId: 'PST-NG-5519203',
    paymentStatus: 'paid',
    date: '2026-01-28',
    year: 2026,
    createdAt: '2026-01-28T14:30:00Z',
  },
  {
    id: 'DON-2026-004',
    donorName: 'Squadron Leader Rashed Khan (Batch 2001)',
    mobileNumber: '01811554433',
    email: 'rashed.khan@example.com',
    amount: 15000,
    purpose: 'Cultural Gala Concert & Evening Fireworks',
    paymentMethod: 'card',
    transactionId: 'PST-CRD-3319024',
    paymentStatus: 'paid',
    date: '2026-02-05',
    year: 2026,
    createdAt: '2026-02-05T09:15:00Z',
  },
];

export const INITIAL_EXPENSES: ExpenseRecord[] = [
  {
    id: 'EXP-REC-01',
    category: 'Stage & Acoustics',
    amount: 85000,
    reason: 'Main grand stage structure, sound system, and lighting truss rental',
    date: '2026-01-20',
    responsiblePerson: 'Md. Shafiqul Alam',
    receiptRef: 'VOUCHER-STG-01',
  },
  {
    id: 'EXP-REC-02',
    category: 'Souvenir Printing',
    amount: 65000,
    reason: '4-color offset printing of 2,000 reunion memorial magazines',
    date: '2026-01-25',
    responsiblePerson: 'Kazi Mahfuzur Rahman',
    receiptRef: 'VOUCHER-PRN-02',
  },
  {
    id: 'EXP-REC-03',
    category: 'Catering Advance',
    amount: 120000,
    reason: 'Advance booking token for Grand Buffet lunch and morning breakfast',
    date: '2026-02-01',
    responsiblePerson: 'Mohammad Faruk Hossain',
    receiptRef: 'VOUCHER-CAT-03',
  },
  {
    id: 'EXP-REC-04',
    category: 'T-Shirts & Kits',
    amount: 95000,
    reason: 'Premium polo shirts manufacturing, embroidery and packaging',
    date: '2026-02-05',
    responsiblePerson: 'Jamal Uddin Chowdhury',
    receiptRef: 'VOUCHER-TSH-04',
  },
];

export const INITIAL_NOTICES: NoticeItem[] = [
  {
    id: 'NOT-01',
    titleEn: 'Grand Reunion 2026 Registration Officially Commenced',
    titleBn: 'গ্র্যান্ড পুনর্মিলনী ২০২৬-এর অনলাইন রেজিস্ট্রেশন কার্যক্রমের আনুষ্ঠানিক উদ্বোধন',
    category: 'registration',
    date: '2026-01-15',
    isPinned: true,
    contentEn:
      'We are delighted to announce that student registration for the 64th Anniversary Grand Reunion 2026 has officially opened. Former students (fee BDT 1,500) and current students (fee BDT 500) can register through our verified bilingual portal.',
    contentBn:
      'অত্যন্ত আনন্দের সাথে জানানো যাচ্ছে যে, পুলিশ লাইন্স স্কুল অ্যান্ড কলেজ, ফরিদপুরের ৬৪ বছর পূর্তি উপলক্ষে গ্র্যান্ড পুনর্মিলনী ২০২৬-এর অনলাইন রেজিস্ট্রেশন শুরু হয়েছে। সকল প্রাক্তন (ফি ১,৫০০/-) ও বর্তমান (ফি ৫০০/-) শিক্ষার্থীদের যথাসময়ে নিবন্ধন সম্পন্ন করার জন্য অনুরোধ করা হলো।',
    attachmentName: 'Reunion_2026_Notice_01.pdf',
  },
  {
    id: 'NOT-02',
    titleEn: 'Batch Representatives Meeting on November 20 at College Auditorium',
    titleBn: 'আগামী ২০ নভেম্বর কলেজ অডিটোরিয়ামে ব্যাচ প্রতিনিধিদের মতবিনিময় সভা',
    category: 'event',
    date: '2026-02-01',
    isPinned: true,
    contentEn:
      'All batch convenors from SSC 1968 to SSC 2025 are requested to attend the coordination meeting regarding souvenir write-ups, photo submissions, and seating arrangements.',
    contentBn:
      '১৯৬৮ থেকে ২০২৫ সালের সকল এসএসসি ও এইচএসসি ব্যাচের প্রতিনিধিদের সাথে স্মরণিকা লেখা সংগ্রহ, স্মৃতিচারণ ও আসন বিন্যাস বিষয়ক জরুরি সমন্বয় সভা আহ্বান করা হয়েছে।',
    attachmentName: 'Batch_Meeting_Schedule.pdf',
  },
  {
    id: 'NOT-03',
    titleEn: 'Souvenir Article & Historical Photo Submission Guidelines',
    titleBn: 'স্মরণিকার জন্য লেখা ও স্মৃতিচিহ্ন পাঠানোর নির্দেশিকা',
    category: 'general',
    date: '2026-02-10',
    isPinned: false,
    contentEn:
      'Alumni are invited to send poems, nostalgic essays, and old campus photographs for publication in our commemorative magazine "ঐতিহ্যের আঙিনা". Email to: souvenir@plscf.edu.bd.',
    contentBn:
      'প্রাক্তন ও বর্তমান শিক্ষক-শিক্ষার্থীদের স্মৃতিকথা, কবিতা এবং ঐতিহাসিক ক্যাম্পাস ফটোগ্রাফ স্মরণিকায় প্রকাশের জন্য souvenir@plscf.edu.bd ঠিকানায় পাঠানোর অনুরোধ করা হলো।',
    attachmentName: 'Souvenir_Guidelines_2026.pdf',
  },
  {
    id: 'NOT-04',
    titleEn: 'Security & QR Badge Gate Entry Rules on Event Days',
    titleBn: 'অনুষ্ঠান দিবসে প্রবেশপথে কিউআর কোডযুক্ত পরিচয়পত্র প্রদর্শন সংক্রান্ত বিজ্ঞপ্তি',
    category: 'emergency',
    date: '2026-02-18',
    isPinned: false,
    contentEn:
      'Strict security will be maintained by district police forces. No attendee will be allowed inside the campus without a verified digital ticket QR code. Please ensure mobile battery charge or carry printed passes.',
    contentBn:
      'জেলা পুলিশের সমন্বয়ে সার্বিক নিরাপত্তা নিশ্চিত করা হবে। যাচাইকৃত ডিজিটাল টিকিটের কিউআর কোড স্ক্যান ব্যতীত কাউকে ক্যাম্পাসে প্রবেশ করতে দেওয়া হবে না।',
    attachmentName: 'Gate_Security_Advisory.pdf',
  },
];

export const INITIAL_SCAN_LOGS: ScanLog[] = [];

// In-memory fallback when window.localStorage is not available (SSR / Node / Tests)
const memoryStore: Record<string, string> = {};

// Helper to load or initialize from localStorage
function getStored<T>(key: string, defaultValue: T): T {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const item = window.localStorage.getItem(key);
      if (!item) return defaultValue;
      return JSON.parse(item);
    }
    const item = memoryStore[key];
    if (!item) return defaultValue;
    return JSON.parse(item);
  } catch {
    return defaultValue;
  }
}

function setStored<T>(key: string, value: T): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(value));
      return;
    }
    memoryStore[key] = JSON.stringify(value);
  } catch (err) {
    console.warn(`Failed to save to localStorage for key ${key} (QuotaExceeded or unavailable):`, err);
    try {
      memoryStore[key] = JSON.stringify(value);
    } catch (_) { }
  }
}

export class AppStore {
  static getRegistrations(): RegistrationRecord[] {
    const rawList = getStored<RegistrationRecord[]>(STORAGE_KEY_REGISTRATIONS, []);
    const map = new Map<string, RegistrationRecord>();
    for (const r of INITIAL_REGISTRATIONS) {
      map.set(r.id, r);
    }
    for (const r of rawList) {
      map.set(r.id, r);
    }
    const list = Array.from(map.values());
    let modified = false;
    const existingTokens = new Set<string>();

    for (const r of list) {
      if (isValidSixCharToken(r.qrToken)) {
        existingTokens.add(r.qrToken.toUpperCase());
      }
    }

    for (const r of list) {
      if (!isValidSixCharToken(r.qrToken)) {
        r.qrToken = generateUniqueSixCharToken(existingTokens);
        existingTokens.add(r.qrToken);
        modified = true;
      }
    }

    if (modified || rawList.length !== list.length) {
      setStored(STORAGE_KEY_REGISTRATIONS, list);
    }
    return list;
  }

  static saveRegistrations(items: RegistrationRecord[]): void {
    setStored(STORAGE_KEY_REGISTRATIONS, items);
  }

  static addRegistration(record: RegistrationRecord, year: number = 2026): void {
    const list = this.getRegistrations();
    const updated = [record, ...list];
    this.saveRegistrations(updated);

    // Asynchronously sync with Supabase backend tables (e.g. registrations_2026)
    SupabaseService.saveRegistration(record, year).then((res) => {
      if (res.success) {
        console.log(`[Supabase] Successfully saved booking ${record.id} to table ${res.table}`);
      } else {
        console.warn(`[Supabase] Booking saved locally. Supabase sync notice:`, res.error);
      }
    }).catch((err) => {
      console.warn('[Supabase] Background sync error:', err);
    });
  }

  static updateRegistration(id: string, updates: Partial<RegistrationRecord>, year: number = 2026): RegistrationRecord | null {
    const list = this.getRegistrations();
    const index = list.findIndex((r) => r.id === id);
    if (index === -1) return null;
    list[index] = { ...list[index], ...updates };
    this.saveRegistrations(list);

    // Sync updated record to Supabase
    SupabaseService.saveRegistration(list[index], year).catch(() => { });
    return list[index];
  }

  static deleteRegistration(id: string, year: number = 2026): boolean {
    const list = this.getRegistrations();
    const updated = list.filter((r) => r.id !== id);
    if (updated.length === list.length) return false;
    this.saveRegistrations(updated);

    // Asynchronously delete from Supabase if table exists
    const yearTableName = `registrations_${year}`;
    supabase.from(yearTableName).delete().eq('id', id).then(undefined, () => { });
    supabase.from('registrations').delete().eq('id', id).then(undefined, () => { });
    return true;
  }

  static getDonations(): DonationRecord[] {
    return getStored<DonationRecord[]>(STORAGE_KEY_DONATIONS, INITIAL_DONATIONS);
  }

  static addDonation(donation: DonationRecord, year: number = 2026): void {
    const list = this.getDonations();
    this.saveDonations([donation, ...list]);

    // Asynchronously sync with Supabase backend tables (e.g. donations_2026)
    SupabaseService.saveDonation(donation, year).then((res) => {
      if (res.success) {
        console.log(`[Supabase] Successfully saved donation ${donation.id} to table ${res.table}`);
      }
    }).catch(() => { });
  }

  static saveDonations(items: DonationRecord[]): void {
    setStored(STORAGE_KEY_DONATIONS, items);
  }

  static getExpenses(): ExpenseRecord[] {
    return getStored<ExpenseRecord[]>(STORAGE_KEY_EXPENSES, INITIAL_EXPENSES);
  }

  static addExpense(expense: ExpenseRecord): void {
    const list = this.getExpenses();
    this.saveExpenses([expense, ...list]);
  }

  static saveExpenses(items: ExpenseRecord[]): void {
    setStored(STORAGE_KEY_EXPENSES, items);
  }

  static getNotices(): NoticeItem[] {
    return getStored<NoticeItem[]>(STORAGE_KEY_NOTICES, INITIAL_NOTICES);
  }

  static saveNotices(items: NoticeItem[]): void {
    setStored(STORAGE_KEY_NOTICES, items);
  }

  static getFeeSettings(): FeeSettings {
    return getStored<FeeSettings>(STORAGE_KEY_SETTINGS, INITIAL_FEE_SETTINGS);
  }

  static getActiveEventYear(): number {
    const feeSettings = this.getFeeSettings();
    if (feeSettings?.eventTargetDate) {
      const parsed = new Date(feeSettings.eventTargetDate).getFullYear();
      if (!isNaN(parsed) && parsed >= 2020 && parsed <= 2100) {
        return parsed;
      }
    }
    return 2027;
  }

  static saveFeeSettings(settings: FeeSettings): void {
    setStored(STORAGE_KEY_SETTINGS, settings);
  }

  static getScanLogs(): ScanLog[] {
    return getStored<ScanLog[]>(STORAGE_KEY_SCAN_LOGS, INITIAL_SCAN_LOGS);
  }

  static addScanLog(log: ScanLog): void {
    const list = this.getScanLogs();
    this.saveScanLogs([log, ...list]);
  }

  static saveScanLogs(items: ScanLog[]): void {
    setStored(STORAGE_KEY_SCAN_LOGS, items);
  }

  static getActiveStaff(): StaffUser | null {
    return getStored<StaffUser | null>(STORAGE_KEY_ACTIVE_STAFF, null);
  }

  static setActiveStaff(staff: StaffUser): void {
    setStored(STORAGE_KEY_ACTIVE_STAFF, staff);
  }

  /**
   * Helper to check whether a student is currently inside the venue.
   * Finds their most recent approved scan. If it was 'entry', they are inside.
   */
  static isStudentInside(registrationId: string): boolean {
    const logs = this.getScanLogs().filter(
      (l) => l.registrationId === registrationId && l.status === 'approved'
    );
    if (logs.length === 0) return false;
    // logs are saved newest first
    return logs[0].scanType === 'entry';
  }

  static getStudentScanCounts(registrationId: string): { entryCount: number; exitCount: number; lastScan?: string } {
    const logs = this.getScanLogs().filter(
      (l) => l.registrationId === registrationId && l.status === 'approved'
    );
    const entryCount = logs.filter((l) => l.scanType === 'entry').length;
    const exitCount = logs.filter((l) => l.scanType === 'exit').length;
    return {
      entryCount,
      exitCount,
      lastScan: logs.length > 0 ? logs[0].timestamp : undefined,
    };
  }

  /**
   * Helper to reset to default seed data if ever needed
   */
  static resetToDefault(): void {
    localStorage.removeItem(STORAGE_KEY_REGISTRATIONS);
    localStorage.removeItem(STORAGE_KEY_DONATIONS);
    localStorage.removeItem(STORAGE_KEY_EXPENSES);
    localStorage.removeItem(STORAGE_KEY_NOTICES);
    localStorage.removeItem(STORAGE_KEY_SETTINGS);
    localStorage.removeItem(STORAGE_KEY_SCAN_LOGS);
  }
}
