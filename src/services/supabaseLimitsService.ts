import { Language } from '../types';
import { SUPABASE_PROJECT_ID, supabase } from './supabase';

export type SupabasePlanTier = 'free' | 'pro';
export type QuotaSeverity = 'healthy' | 'warning' | 'critical';
export type RealtimeConnectionState = 'CONNECTING' | 'SUBSCRIBED' | 'POLLING_FALLBACK' | 'OFFLINE';

export interface SupabaseMonitorConfig {
  activePlan: SupabasePlanTier;
  warningThresholdPercent: number;
  criticalThresholdPercent: number;
  autoRefreshSeconds: number;
  updatedAt?: string;
  updatedBy?: string;
}

export interface TableSizeBreakdown {
  tableName: string;
  totalBytes: number;
  heapBytes: number;
  indexBytes: number;
  estimatedRows: number;
}

export interface StorageBucketBreakdown {
  bucketId: string;
  bucketName: string;
  isPublic: boolean;
  fileSizeLimitBytes: number | null;
  fileCount: number;
  totalBytes: number;
  maxFileBytes: number;
}

export interface SupabaseUsageTelemetry {
  capturedAt: string;
  databaseName: string;
  postgresVersion: string;
  monitorConfig: SupabaseMonitorConfig;
  database: {
    sizeBytes: number;
    maxFreeBytes: number;
    maxProBytes: number;
    tableCount: number;
    topTables: TableSizeBreakdown[];
  };
  storage: {
    totalBytes: number;
    fileCount: number;
    largestFileBytes: number;
    maxFreeBytes: number;
    maxProBytes: number;
    maxFreeUploadBytes: number;
    maxProUploadBytes: number;
    buckets: StorageBucketBreakdown[];
  };
  auth: {
    totalUsers: number;
    mau30d: number;
    active24h: number;
    adminAccountsCount: number;
    activeAdminAccountsCount: number;
    staffAccountsCount: number;
    activeStaffAccountsCount: number;
  };
  connections: {
    totalConnections: number;
    activeQueries: number;
    idleConnections: number;
    maxConnections: number;
  };
  activity: {
    registrationsTotal: number;
    registrations24h: number;
    donationsTotal: number;
    donations24h: number;
    pendingOrdersTotal: number;
    pendingOrders24h: number;
    ipnLogsTotal: number;
    ipnLogs24h: number;
    ipnLogs30d: number;
    currentStudentIdsTotal: number;
    auditLogsTotal: number;
    auditLogs30d: number;
    lastActivityAt: string | null;
    idleDays: number;
  };
}

export interface EvaluatedQuotaMetric {
  id:
    | 'database_size'
    | 'storage_size'
    | 'max_upload_file'
    | 'auth_mau'
    | 'db_connections'
    | 'inactivity_pause';
  titleEn: string;
  titleBn: string;
  usedLabel: string;
  activeLimitLabel: string;
  freeLimitLabel: string;
  proLimitLabel: string;
  activePercent: number;
  freePercent: number;
  proPercent: number;
  severity: QuotaSeverity;
  sublabelEn: string;
  sublabelBn: string;
  overageHintEn?: string;
  overageHintBn?: string;
}

export interface PlanComparisonRow {
  key: string;
  featureEn: string;
  featureBn: string;
  currentUsageLabelEn: string;
  currentUsageLabelBn: string;
  freeLimitEn: string;
  freeLimitBn: string;
  proLimitEn: string;
  proLimitBn: string;
  isDirectlyMetered: boolean;
  activePercent: number | null;
  severity: QuotaSeverity;
}

export interface SupabaseAlertSummary {
  level: QuotaSeverity;
  hasRedAlert: boolean;
  hasAnyWarningOrAlert: boolean;
  isSimulation: boolean;
  highestPercent: number;
  criticalMetrics: EvaluatedQuotaMetric[];
  warningMetrics: EvaluatedQuotaMetric[];
  headlineEn: string;
  headlineBn: string;
  recommendationEn: string;
  recommendationBn: string;
}

export interface SupabaseLimitsEvaluation {
  activePlan: SupabasePlanTier;
  metrics: EvaluatedQuotaMetric[];
  comparisonRows: PlanComparisonRow[];
  alertSummary: SupabaseAlertSummary;
  estimatedMonthlyEgressBytes: number;
}

export interface SupabaseLimitsSnapshot {
  status: 'loading' | 'ready' | 'error';
  telemetry: SupabaseUsageTelemetry | null;
  evaluation: SupabaseLimitsEvaluation | null;
  error: string | null;
  permissionDenied: boolean;
  migrationMissing: boolean;
  realtimeState: RealtimeConnectionState;
  lastSyncedAt: string | null;
  lastEventTable: string | null;
  realtimeEventsCount: number;
  simulateRedAlert: boolean;
}

export interface SupabasePlanSpec {
  id: SupabasePlanTier;
  nameEn: string;
  nameBn: string;
  priceMonthlyUsd: number;
  dbSizeBytes: number;
  storageBytes: number;
  maxFileUploadBytes: number;
  egressUncachedBytes: number;
  egressCachedBytes: number;
  authMau: number;
  edgeFunctionInvocationsMonthly: number;
  realtimeConcurrentConnections: number;
  realtimeMessagesMonthly: number;
  directConnectionsGuideline: number;
  pooledConnectionsGuideline: number;
  inactivityAutoPauseDays: number | null;
}

const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;

export const SUPABASE_PLAN_SPECS: Record<SupabasePlanTier, SupabasePlanSpec> = {
  free: {
    id: 'free',
    nameEn: 'Free Plan ($0/mo)',
    nameBn: 'ফ্রি প্ল্যান ($০/মাস)',
    priceMonthlyUsd: 0,
    dbSizeBytes: 500 * MB, // 500 MB
    storageBytes: 1 * GB, // 1 GB
    maxFileUploadBytes: 50 * MB, // 50 MB per object
    egressUncachedBytes: 5 * GB, // 5 GB + 5 GB cached
    egressCachedBytes: 5 * GB,
    authMau: 50_000,
    edgeFunctionInvocationsMonthly: 500_000,
    realtimeConcurrentConnections: 200,
    realtimeMessagesMonthly: 2_000_000,
    directConnectionsGuideline: 60,
    pooledConnectionsGuideline: 200,
    inactivityAutoPauseDays: 7,
  },
  pro: {
    id: 'pro',
    nameEn: 'Paid Pro Plan ($25/mo)',
    nameBn: 'পেইড প্রো প্ল্যান ($২৫/মাস)',
    priceMonthlyUsd: 25,
    dbSizeBytes: 8 * GB, // 8 GB included ($0.125/GB overage)
    storageBytes: 100 * GB, // 100 GB included ($0.021/GB overage)
    maxFileUploadBytes: 50 * GB, // 50 GB max object
    egressUncachedBytes: 250 * GB, // 250 GB combined included ($0.09/GB overage)
    egressCachedBytes: 250 * GB,
    authMau: 100_000, // $0.00325 per extra MAU
    edgeFunctionInvocationsMonthly: 2_000_000, // $2 per 1M overage
    realtimeConcurrentConnections: 500,
    realtimeMessagesMonthly: 5_000_000,
    directConnectionsGuideline: 60,
    pooledConnectionsGuideline: 200,
    inactivityAutoPauseDays: null,
  },
};

export const SUPABASE_DASHBOARD_USAGE_URL = `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/settings/billing/usage`;

export function formatBytes(bytes: number): string {
  const safe = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  if (safe < 1024) return `${Math.round(safe)} B`;
  if (safe < MB) return `${(safe / 1024).toFixed(1)} KB`;
  if (safe < GB) return `${(safe / MB).toFixed(safe >= 100 * MB ? 1 : 2)} MB`;
  return `${(safe / GB).toFixed(2)} GB`;
}

export function formatNumberCompact(value: number): string {
  const safe = Number.isFinite(value) && value >= 0 ? value : 0;
  return new Intl.NumberFormat('en-US').format(Math.round(safe));
}

export function calculateUsagePercent(used: number, limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) return 0;
  const safeUsed = Number.isFinite(used) && used > 0 ? used : 0;
  return Math.round((safeUsed / limit) * 1000) / 10;
}

export function resolveMetricSeverity(
  percent: number,
  warningThreshold = 70,
  criticalThreshold = 85
): QuotaSeverity {
  if (!Number.isFinite(percent)) return 'healthy';
  if (percent >= criticalThreshold) return 'critical';
  if (percent >= warningThreshold) return 'warning';
  return 'healthy';
}

export function createSimulatedHighUsageTelemetry(
  base: SupabaseUsageTelemetry,
  plan: SupabasePlanTier
): SupabaseUsageTelemetry {
  const targetDbBytes =
    plan === 'free' ? Math.round(458 * MB) : Math.round(7.45 * GB); // ~91.6% or ~93.1%
  const targetStorageBytes =
    plan === 'free' ? Math.round(915 * MB) : Math.round(89.2 * GB); // ~91.5% or ~89.2%
  const targetMau = plan === 'free' ? 43_500 : 87_200; // ~87%
  const targetConnections = 54; // 90% of 60

  return {
    ...base,
    database: {
      ...base.database,
      sizeBytes: Math.max(base.database.sizeBytes, targetDbBytes),
    },
    storage: {
      ...base.storage,
      totalBytes: Math.max(base.storage.totalBytes, targetStorageBytes),
      largestFileBytes:
        plan === 'free'
          ? Math.max(base.storage.largestFileBytes, Math.round(44 * MB))
          : base.storage.largestFileBytes,
    },
    auth: {
      ...base.auth,
      mau30d: Math.max(base.auth.mau30d, targetMau),
    },
    connections: {
      ...base.connections,
      totalConnections: Math.max(base.connections.totalConnections, targetConnections),
    },
    activity: {
      ...base.activity,
      idleDays: plan === 'free' ? Math.max(base.activity.idleDays, 5.8) : base.activity.idleDays,
    },
  };
}

export function evaluateSupabaseLimits(
  rawTelemetry: SupabaseUsageTelemetry,
  activePlanOverride?: SupabasePlanTier,
  simulateHighUsage = false
): SupabaseLimitsEvaluation {
  const activePlan: SupabasePlanTier =
    activePlanOverride === 'pro' || activePlanOverride === 'free'
      ? activePlanOverride
      : rawTelemetry.monitorConfig?.activePlan === 'pro'
      ? 'pro'
      : 'free';

  const warningPct = Math.min(90, Math.max(50, Number(rawTelemetry.monitorConfig?.warningThresholdPercent) || 70));
  const criticalPct = Math.min(99, Math.max(warningPct + 5, Number(rawTelemetry.monitorConfig?.criticalThresholdPercent) || 85));

  const telemetry = simulateHighUsage
    ? createSimulatedHighUsageTelemetry(rawTelemetry, activePlan)
    : rawTelemetry;

  const activeSpec = SUPABASE_PLAN_SPECS[activePlan];
  const freeSpec = SUPABASE_PLAN_SPECS.free;
  const proSpec = SUPABASE_PLAN_SPECS.pro;

  const dbActivePct = calculateUsagePercent(telemetry.database.sizeBytes, activeSpec.dbSizeBytes);
  const storageActivePct = calculateUsagePercent(telemetry.storage.totalBytes, activeSpec.storageBytes);
  const uploadActivePct = calculateUsagePercent(telemetry.storage.largestFileBytes, activeSpec.maxFileUploadBytes);
  const mauActivePct = calculateUsagePercent(telemetry.auth.mau30d, activeSpec.authMau);

  const effectiveConnCap = Math.max(
    activeSpec.directConnectionsGuideline,
    telemetry.connections.maxConnections || activeSpec.directConnectionsGuideline
  );
  const connActivePct = calculateUsagePercent(telemetry.connections.totalConnections, effectiveConnCap);

  const inactivityPct =
    activePlan === 'free'
      ? calculateUsagePercent(telemetry.activity.idleDays, freeSpec.inactivityAutoPauseDays || 7)
      : 0;

  const metrics: EvaluatedQuotaMetric[] = [
    {
      id: 'database_size',
      titleEn: 'PostgreSQL Database Storage',
      titleBn: 'পোস্টগ্রেস ডাটাবেস স্টোরেজ',
      usedLabel: formatBytes(telemetry.database.sizeBytes),
      activeLimitLabel: formatBytes(activeSpec.dbSizeBytes),
      freeLimitLabel: '500 MB',
      proLimitLabel: '8 GB',
      activePercent: dbActivePct,
      freePercent: calculateUsagePercent(telemetry.database.sizeBytes, freeSpec.dbSizeBytes),
      proPercent: calculateUsagePercent(telemetry.database.sizeBytes, proSpec.dbSizeBytes),
      severity: resolveMetricSeverity(dbActivePct, warningPct, criticalPct),
      sublabelEn: `${telemetry.database.tableCount} public tables · ${formatNumberCompact(telemetry.activity.registrationsTotal)} registrations`,
      sublabelBn: `${telemetry.database.tableCount}টি টেবিল · ${formatNumberCompact(telemetry.activity.registrationsTotal)}টি রেজিস্ট্রেশন`,
      overageHintEn:
        activePlan === 'free'
          ? 'Free projects enter read-only mode if DB exceeds 500 MB. Clean test logs or upgrade to Pro ($25/mo, 8 GB).'
          : 'Pro overage: $0.125 per extra GB/month after 8 GB.',
      overageHintBn:
        activePlan === 'free'
          ? 'ডাটাবেস ৫০০ MB ছাড়ালে Free প্রজেক্ট Read-Only হয়ে যাবে। প্রো প্ল্যানে ($২৫/মাস, ৮ GB) আপগ্রেড করুন।'
          : 'Pro প্ল্যানে ৮ GB-র বেশি হলে প্রতি অতিরিক্ত GB তে $০.১২৫/মাস চার্জ হবে।',
    },
    {
      id: 'storage_size',
      titleEn: 'File & Photo Storage Buckets',
      titleBn: 'ফাইল ও ছবি স্টোরেজ বাকেট',
      usedLabel: formatBytes(telemetry.storage.totalBytes),
      activeLimitLabel: formatBytes(activeSpec.storageBytes),
      freeLimitLabel: '1 GB',
      proLimitLabel: '100 GB',
      activePercent: storageActivePct,
      freePercent: calculateUsagePercent(telemetry.storage.totalBytes, freeSpec.storageBytes),
      proPercent: calculateUsagePercent(telemetry.storage.totalBytes, proSpec.storageBytes),
      severity: resolveMetricSeverity(storageActivePct, warningPct, criticalPct),
      sublabelEn: `${formatNumberCompact(telemetry.storage.fileCount)} files across ${telemetry.storage.buckets.length} buckets`,
      sublabelBn: `${telemetry.storage.buckets.length}টি বাকেটে মোট ${formatNumberCompact(telemetry.storage.fileCount)}টি ফাইল`,
      overageHintEn:
        activePlan === 'free'
          ? 'Compressing student photos (< 300 KB) stretches 1 GB Free quota for 3,000+ registrations.'
          : 'Pro overage: $0.021 per extra GB/month after 100 GB.',
      overageHintBn:
        activePlan === 'free'
          ? 'শিক্ষার্থীর ছবি ৩০০ KB-এর নিচে কম্প্রেস থাকলে ১ GB Free লিমিটে ৩,০০০+ ছবি রাখা যায়।'
          : 'Pro প্ল্যানে ১০০ GB-র পর প্রতি GB তে $০.০২১/মাস।',
    },
    {
      id: 'auth_mau',
      titleEn: 'Auth Monthly Active Users (30d)',
      titleBn: 'Auth মাসিক অ্যাক্টিভ ইউজার (৩০ দিন)',
      usedLabel: `${formatNumberCompact(telemetry.auth.mau30d)} MAU`,
      activeLimitLabel: formatNumberCompact(activeSpec.authMau),
      freeLimitLabel: '50,000 MAU',
      proLimitLabel: '100,000 MAU',
      activePercent: mauActivePct,
      freePercent: calculateUsagePercent(telemetry.auth.mau30d, freeSpec.authMau),
      proPercent: calculateUsagePercent(telemetry.auth.mau30d, proSpec.authMau),
      severity: resolveMetricSeverity(mauActivePct, warningPct, criticalPct),
      sublabelEn: `${formatNumberCompact(telemetry.auth.totalUsers)} total auth users (${telemetry.auth.activeAdminAccountsCount} admin, ${telemetry.auth.activeStaffAccountsCount} staff)`,
      sublabelBn: `মোট ${formatNumberCompact(telemetry.auth.totalUsers)} Auth ইউজার (${telemetry.auth.activeAdminAccountsCount} অ্যাডমিন, ${telemetry.auth.activeStaffAccountsCount} স্টাফ)`,
      overageHintEn:
        activePlan === 'free'
          ? 'Public students do not consume Auth MAU unless signed in; mostly admin/staff logins count.'
          : 'Pro overage: $0.00325 per MAU above 100,000.',
      overageHintBn:
        activePlan === 'free'
          ? 'সাধারণ শিক্ষার্থীরা Auth লগইন ছাড়া রেজিস্ট্রেশন করে, তাই শুধু অ্যাডমিন/স্টাফ সেশন MAU হিসেবে গণ্য হয়।'
          : 'Pro প্ল্যানে ১,০০,০০০ MAU-র পর প্রতি ইউজারে $০.০০৩২৫।',
    },
    {
      id: 'db_connections',
      titleEn: 'Live PostgreSQL Connections',
      titleBn: 'লাইভ ডাটাবেস কানেকশন',
      usedLabel: `${telemetry.connections.totalConnections} active`,
      activeLimitLabel: `${effectiveConnCap} direct / 200 pooled`,
      freeLimitLabel: '60 direct / 200 pooled',
      proLimitLabel: '60+ direct / 200+ pooled',
      activePercent: connActivePct,
      freePercent: connActivePct,
      proPercent: connActivePct,
      severity: resolveMetricSeverity(connActivePct, warningPct, criticalPct),
      sublabelEn: `${telemetry.connections.activeQueries} running queries · ${telemetry.connections.idleConnections} idle`,
      sublabelBn: `${telemetry.connections.activeQueries}টি রানিং কুয়েরি · ${telemetry.connections.idleConnections}টি আইডল`,
      overageHintEn: 'Use Supavisor transaction pooler (port 6543) for Edge Functions if connections stay high.',
      overageHintBn: 'কানেকশন বেশি হলে Edge Function-এ Supavisor pooler (পোর্ট 6543) ব্যবহার করুন।',
    },
    {
      id: 'max_upload_file',
      titleEn: 'Largest Single File Upload',
      titleBn: 'সর্বোচ্চ সিঙ্গেল ফাইল সাইজ',
      usedLabel: formatBytes(telemetry.storage.largestFileBytes),
      activeLimitLabel: formatBytes(activeSpec.maxFileUploadBytes),
      freeLimitLabel: '50 MB / file',
      proLimitLabel: '50 GB / file',
      activePercent: uploadActivePct,
      freePercent: calculateUsagePercent(telemetry.storage.largestFileBytes, freeSpec.maxFileUploadBytes),
      proPercent: calculateUsagePercent(telemetry.storage.largestFileBytes, proSpec.maxFileUploadBytes),
      severity: resolveMetricSeverity(uploadActivePct, warningPct, criticalPct),
      sublabelEn: `Photo & receipt uploads are client-checked against plan safety caps`,
      sublabelBn: `ছবি ও রিসিট আপলোডের ক্ষেত্রে একক ফাইলের সর্বোচ্চ সীমা`,
    },
    {
      id: 'inactivity_pause',
      titleEn: activePlan === 'free' ? '7-Day Inactivity Auto-Pause Watch' : 'Always-On Project Uptime (No Pause)',
      titleBn: activePlan === 'free' ? '৭ দিনের নিষ্ক্রিয়তা অটো-পজ ওয়াচ' : 'সবসময় সচল আপটাইম (কোনো পজ নেই)',
      usedLabel:
        activePlan === 'free'
          ? `${telemetry.activity.idleDays.toFixed(1)} days idle`
          : 'Never Auto-Pauses',
      activeLimitLabel: activePlan === 'free' ? '7.0 days max idle' : 'Unlimited uptime',
      freeLimitLabel: 'Pauses after 7d idle',
      proLimitLabel: 'Never Auto-Pauses',
      activePercent: inactivityPct,
      freePercent: calculateUsagePercent(telemetry.activity.idleDays, freeSpec.inactivityAutoPauseDays || 7),
      proPercent: 0,
      severity: activePlan === 'free' ? resolveMetricSeverity(inactivityPct, 57, 78) : 'healthy',
      sublabelEn:
        telemetry.activity.lastActivityAt
          ? `Last DB write: ${new Date(telemetry.activity.lastActivityAt).toLocaleString()}`
          : 'Waiting for first recorded write activity',
      sublabelBn:
        telemetry.activity.lastActivityAt
          ? `সর্বশেষ ডাটাবেস অ্যাক্টিভিটি: ${new Date(telemetry.activity.lastActivityAt).toLocaleString()}`
          : 'সর্বশেষ অ্যাক্টিভিটি সময় হিসাব হচ্ছে',
      overageHintEn:
        activePlan === 'free'
          ? 'Free projects pause automatically if there is zero database/API activity for 7 days.'
          : 'Paid Pro projects remain running 24/7 with zero auto-pause.',
      overageHintBn:
        activePlan === 'free'
          ? 'টানা ৭ দিন কোনো ডাটাবেস বা API অ্যাক্টিভিটি না থাকলে Free প্রজেক্ট স্বয়ংক্রিয়ভাবে Pause হয়ে যায়।'
          : 'Paid Pro প্রজেক্ট কখনোই স্বয়ংক্রিয়ভাবে Pause হয় না।',
    },
  ];

  // Estimate baseline egress purely as a transparent traffic signal (photo downloads + DB queries proxy)
  // Average photo ~220KB; assume each registration lookup/card view pulls ~2.5x asset weight; strictly labeled "Est. Activity Signal"
  const estimatedMonthlyEgressBytes = Math.round(
    telemetry.storage.totalBytes * 1.5 +
      telemetry.activity.registrationsTotal * 250 * 1024 +
      telemetry.activity.ipnLogs30d * 8 * 1024
  );

  const comparisonRows: PlanComparisonRow[] = [
    {
      key: 'db_size',
      featureEn: 'PostgreSQL Database Size',
      featureBn: 'ডাটাবেস স্টোরেজ লিমিট',
      currentUsageLabelEn: `${formatBytes(telemetry.database.sizeBytes)} (${dbActivePct}%)`,
      currentUsageLabelBn: `${formatBytes(telemetry.database.sizeBytes)} (${dbActivePct}%)`,
      freeLimitEn: '500 MB (Read-only if exceeded)',
      freeLimitBn: '৫০০ MB (ছাড়ালে Read-Only)',
      proLimitEn: '8 GB included ($0.125/GB extra)',
      proLimitBn: '৮ GB অন্তর্ভুক্ত ($০.১২৫/GB)',
      isDirectlyMetered: true,
      activePercent: dbActivePct,
      severity: metrics[0].severity,
    },
    {
      key: 'storage_size',
      featureEn: 'Object File Storage (Photos & Receipts)',
      featureBn: 'ফাইল ও ছবি স্টোরেজ (Storage)',
      currentUsageLabelEn: `${formatBytes(telemetry.storage.totalBytes)} (${telemetry.storage.fileCount} files)`,
      currentUsageLabelBn: `${formatBytes(telemetry.storage.totalBytes)} (${telemetry.storage.fileCount} ফাইল)`,
      freeLimitEn: '1 GB',
      proLimitEn: '100 GB included ($0.021/GB extra)',
      freeLimitBn: '১ GB',
      proLimitBn: '১০০ GB অন্তর্ভুক্ত ($০.০২১/GB)',
      isDirectlyMetered: true,
      activePercent: storageActivePct,
      severity: metrics[1].severity,
    },
    {
      key: 'max_file',
      featureEn: 'Max Single File Upload Size',
      featureBn: 'সর্বোচ্চ সিঙ্গেল ফাইল আপলোড',
      currentUsageLabelEn: formatBytes(telemetry.storage.largestFileBytes),
      currentUsageLabelBn: formatBytes(telemetry.storage.largestFileBytes),
      freeLimitEn: '50 MB per file',
      freeLimitBn: '৫০ MB / ফাইল',
      proLimitEn: '50 GB per file',
      proLimitBn: '৫০ GB / ফাইল',
      isDirectlyMetered: true,
      activePercent: uploadActivePct,
      severity: metrics[4].severity,
    },
    {
      key: 'egress',
      featureEn: 'Bandwidth / Egress Quota',
      featureBn: 'ব্যান্ডউইথ / ইগ্রেস কোটা',
      currentUsageLabelEn: `~${formatBytes(estimatedMonthlyEgressBytes)} (Est. local signal — verify exact meter in Billing)`,
      currentUsageLabelBn: `~${formatBytes(estimatedMonthlyEgressBytes)} (আনুমানিক সিগন্যাল — সঠিক হিসাব Billing-এ)`,
      freeLimitEn: '5 GB uncached + 5 GB cached egress',
      freeLimitBn: '৫ GB ডাটা + ৫ GB ক্যাশড ইগ্রেস',
      proLimitEn: '250 GB included ($0.09/GB extra)',
      proLimitBn: '২৫০ GB অন্তর্ভুক্ত ($০.০৯/GB)',
      isDirectlyMetered: false,
      activePercent: null,
      severity: 'healthy',
    },
    {
      key: 'auth_mau',
      featureEn: 'Authentication MAUs (30 Days)',
      featureBn: 'অথেনটিকেশন ইউজার (৩০ দিনের MAU)',
      currentUsageLabelEn: `${formatNumberCompact(telemetry.auth.mau30d)} MAU (${formatNumberCompact(telemetry.auth.totalUsers)} total)`,
      currentUsageLabelBn: `${formatNumberCompact(telemetry.auth.mau30d)} MAU (${formatNumberCompact(telemetry.auth.totalUsers)} মোট)`,
      freeLimitEn: '50,000 MAU',
      freeLimitBn: '৫০,০০০ MAU',
      proLimitEn: '100,000 MAU ($0.00325/extra)',
      proLimitBn: '১,০০,০০০ MAU ($০.০০৩২৫/অতিরিক্ত)',
      isDirectlyMetered: true,
      activePercent: mauActivePct,
      severity: metrics[2].severity,
    },
    {
      key: 'edge_functions',
      featureEn: 'Edge Function Invocations (Monthly)',
      featureBn: 'Edge Function কল লিমিট (মাসিক)',
      currentUsageLabelEn: `${formatNumberCompact(telemetry.activity.ipnLogs30d)} IPN webhooks in 30d (all HTTP calls on Supabase Dashboard)`,
      currentUsageLabelBn: `৩০ দিনে ${formatNumberCompact(telemetry.activity.ipnLogs30d)} IPN কল (মোট HTTP কল Dashboard-এ)`,
      freeLimitEn: '500,000 invocations / mo',
      freeLimitBn: '৫,০০,০০০ কল / মাস',
      proLimitEn: '2,000,000 invocations / mo ($2/1M)',
      proLimitBn: '২০,০০,০০০ কল / মাস ($২/১০ লাখ)',
      isDirectlyMetered: false,
      activePercent: null,
      severity: 'healthy',
    },
    {
      key: 'realtime',
      featureEn: 'Realtime Peak Connections & Messages',
      featureBn: 'রিয়েলটাইম কানেকশন ও মেসেজ',
      currentUsageLabelEn: `${telemetry.connections.totalConnections} live DB sessions now`,
      currentUsageLabelBn: `বর্তমানে ${telemetry.connections.totalConnections}টি লাইভ DB সেশন`,
      freeLimitEn: '200 concurrent · 2M msgs/mo',
      freeLimitBn: '২০০ লাইভ ইউজার · ২০ লাখ মেসেজ/মাস',
      proLimitEn: '500 concurrent · 5M msgs/mo',
      proLimitBn: '৫০০ লাইভ ইউজার · ৫০ লাখ মেসেজ/মাস',
      isDirectlyMetered: false,
      activePercent: null,
      severity: 'healthy',
    },
    {
      key: 'backups',
      featureEn: 'Automated Backups & Point-in-Time Recovery',
      featureBn: 'অটোমেটেড ব্যাকআপ ও PITR রিকভারি',
      currentUsageLabelEn: activePlan === 'pro' ? 'Eligible for 7d Automated Backups' : 'Manual pg_dump / CSV required',
      currentUsageLabelBn: activePlan === 'pro' ? '৭ দিনের অটো ব্যাকআপ সক্রিয়' : 'ম্যানুয়াল ব্যাকআপ নিতে হবে',
      freeLimitEn: 'None (0 automated backups)',
      freeLimitBn: 'নেই (ম্যানুয়াল ব্যাকআপ)',
      proLimitEn: '7-day daily backups (+PITR add-on)',
      proLimitBn: '৭ দিনের ডেইলি ব্যাকআপ (+PITR)',
      isDirectlyMetered: false,
      activePercent: null,
      severity: 'healthy',
    },
    {
      key: 'auto_pause',
      featureEn: 'Inactivity Auto-Pause Policy',
      featureBn: 'নিষ্ক্রিয়তায় অটো-পজ নীতি',
      currentUsageLabelEn:
        activePlan === 'free'
          ? `${telemetry.activity.idleDays.toFixed(1)} / 7.0 days idle`
          : `Active (${telemetry.activity.idleDays.toFixed(1)}d since last write)`,
      currentUsageLabelBn:
        activePlan === 'free'
          ? `${telemetry.activity.idleDays.toFixed(1)} / ৭.০ দিন নিষ্ক্রিয়`
          : `সচল (${telemetry.activity.idleDays.toFixed(1)} দিন আগে শেষ ডেটা)`,
      freeLimitEn: 'Auto-pauses after 7 days idle',
      freeLimitBn: '৭ দিন নিষ্ক্রিয় থাকলে পজ হয়',
      proLimitEn: 'Never pauses automatically',
      proLimitBn: 'কখনো অটো-পজ হয় না',
      isDirectlyMetered: activePlan === 'free',
      activePercent: activePlan === 'free' ? inactivityPct : 0,
      severity: metrics[5].severity,
    },
  ];

  const criticalMetrics = metrics.filter((m) => m.severity === 'critical');
  const warningMetrics = metrics.filter((m) => m.severity === 'warning');
  const highestPercent = metrics.reduce((max, item) => Math.max(max, item.activePercent), 0);

  let level: QuotaSeverity = 'healthy';
  if (criticalMetrics.length > 0) level = 'critical';
  else if (warningMetrics.length > 0) level = 'warning';

  const criticalNamesEn = criticalMetrics.map((m) => `${m.titleEn} (${m.activePercent}%)`).join(', ');
  const criticalNamesBn = criticalMetrics.map((m) => `${m.titleBn} (${m.activePercent}%)`).join(', ');
  const warningNamesEn = warningMetrics.map((m) => `${m.titleEn} (${m.activePercent}%)`).join(', ');
  const warningNamesBn = warningMetrics.map((m) => `${m.titleBn} (${m.activePercent}%)`).join(', ');

  let headlineEn = 'All metered Supabase quotas are operating smoothly within safe capacity.';
  let headlineBn = 'সব মিটারকৃত সুপাবেস কোটা নিরাপদ সীমার মধ্যে সচল রয়েছে।';
  let recommendationEn =
    activePlan === 'free'
      ? 'Monitoring against Free Plan ($0/mo) caps. You will get instant Red Alerts before hitting 500 MB DB or 1 GB Storage.'
      : 'Monitoring against Paid Pro Plan ($25/mo) included caps.';
  let recommendationBn =
    activePlan === 'free'
      ? 'ফ্রি প্ল্যান ($০/মাস)-এর লিমিট অনুযায়ী মনিটর করা হচ্ছে। ৫০০ MB DB বা ১ GB স্টোরেজ শেষ হওয়ার আগেই লাল সতর্কতা পাবেন।'
      : 'পেইড প্রো প্ল্যান ($২৫/মাস)-এর লিমিট অনুযায়ী মনিটর করা হচ্ছে।';

  if (level === 'critical') {
    headlineEn = `RED ALERT: Approaching ${activePlan.toUpperCase()} limit — ${criticalNamesEn}`;
    headlineBn = `রেড অ্যালার্ট: ${activePlan === 'free' ? 'ফ্রি প্ল্যানের' : 'প্রো প্ল্যানের'} লিমিট শেষ হতে চলেছে — ${criticalNamesBn}`;
    recommendationEn =
      activePlan === 'free'
        ? 'Action Required: Upgrade to Supabase Pro ($25/mo) before service interruption or remove old/test records & oversized uploads immediately.'
        : 'Action Required: Included Pro tier quota is almost full — prepare for automatic Pro overage billing or prune old logs/uploads.';
    recommendationBn =
      activePlan === 'free'
        ? 'জরুরি পদক্ষেপ নিন: সাইট বন্ধ হওয়ার আগেই Supabase Pro ($২৫/মাস)-এ আপগ্রেড করুন অথবা পুরনো টেস্ট ডেটা/ছবি ক্লিন করুন।'
        : 'জরুরি সতর্কতা: Pro প্ল্যানের মূল কোটা প্রায় পূর্ণ — অতিরিক্ত ব্যবহারের জন্য অটো ওভারেজ বিলিং বা ক্লিনআপ বিবেচনা করুন।';
  } else if (level === 'warning') {
    headlineEn = `WARNING: Usage crossed ${warningPct}% threshold — ${warningNamesEn}`;
    headlineBn = `সতর্কতা: ব্যবহার ${warningPct}% সীমা ছাড়িয়েছে — ${warningNamesBn}`;
    recommendationEn =
      activePlan === 'free'
        ? 'Monitor closely as registrations & photo uploads grow; keep Pro upgrade ready if traffic spikes.'
        : 'Traffic is rising toward Pro included quota. Check table/storage breakdown below.';
    recommendationBn =
      activePlan === 'free'
        ? 'রেজিস্ট্রেশন ও ছবি বাড়ার সাথে সাথে ব্যবহার বাড়ছে; ইভেন্টের আগে Pro প্ল্যানের প্রস্তুতি রাখুন।'
        : 'ব্যবহার প্রো কোটার কাছাকাছি বাড়ছে। নিচের টেবিল ও বাকেট ব্রেকডাউন পর্যবেক্ষণ করুন।';
  }

  return {
    activePlan,
    metrics,
    comparisonRows,
    estimatedMonthlyEgressBytes,
    alertSummary: {
      level,
      hasRedAlert: level === 'critical',
      hasAnyWarningOrAlert: level !== 'healthy',
      isSimulation: simulateHighUsage,
      highestPercent,
      criticalMetrics,
      warningMetrics,
      headlineEn,
      headlineBn,
      recommendationEn,
      recommendationBn,
    },
  };
}

export class SupabaseLimitsService {
  private static snapshot: SupabaseLimitsSnapshot = {
    status: 'loading',
    telemetry: null,
    evaluation: null,
    error: null,
    permissionDenied: false,
    migrationMissing: false,
    realtimeState: 'CONNECTING',
    lastSyncedAt: null,
    lastEventTable: null,
    realtimeEventsCount: 0,
    simulateRedAlert: false,
  };

  private static listeners = new Set<(snap: SupabaseLimitsSnapshot) => void>();
  private static syncRefCount = 0;
  private static realtimeChannel: any = null;
  private static pollTimer: ReturnType<typeof setInterval> | null = null;
  private static debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private static inflightFetch: Promise<SupabaseLimitsSnapshot> | null = null;
  private static activePollIntervalMs = 30_000;

  static getSnapshot(): SupabaseLimitsSnapshot {
    return { ...this.snapshot };
  }

  static reset(): void {
    this.emit({
      status: 'loading',
      telemetry: null,
      evaluation: null,
      error: null,
      permissionDenied: false,
      migrationMissing: false,
      realtimeState: 'CONNECTING',
      lastSyncedAt: null,
      lastEventTable: null,
      realtimeEventsCount: 0,
      simulateRedAlert: false,
    });
  }

  static subscribe(listener: (snap: SupabaseLimitsSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static emit(next: SupabaseLimitsSnapshot): void {
    this.snapshot = next;
    this.listeners.forEach((cb) => {
      try {
        cb({ ...next });
      } catch (_) {}
    });
  }

  static setSimulatedRedAlert(enabled: boolean): void {
    const telemetry = this.snapshot.telemetry;
    const evaluation = telemetry
      ? evaluateSupabaseLimits(telemetry, telemetry.monitorConfig?.activePlan, enabled)
      : this.snapshot.evaluation;

    this.emit({
      ...this.snapshot,
      simulateRedAlert: enabled,
      evaluation,
    });
  }

  private static schedulePollInterval(seconds: number): void {
    const nextMs = Math.min(300, Math.max(10, seconds || 30)) * 1000;
    if (this.pollTimer && this.activePollIntervalMs === nextMs) {
      return;
    }
    this.activePollIntervalMs = nextMs;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
    if (this.syncRefCount > 0) {
      this.pollTimer = setInterval(() => {
        void this.fetchTelemetry();
      }, nextMs);
    }
  }

  static async fetchTelemetry(eventTable?: string): Promise<SupabaseLimitsSnapshot> {
    if (this.inflightFetch) {
      return this.inflightFetch;
    }

    if (this.snapshot.telemetry === null && this.snapshot.status !== 'loading') {
      this.emit({
        ...this.snapshot,
        status: 'loading',
        error: null,
      });
    }

    this.inflightFetch = (async () => {
      try {
        const { data, error } = await supabase.rpc('rpc_get_supabase_usage_telemetry');

        if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
          const msg = error?.message || 'Unable to load Supabase telemetry.';
          const isPermission =
            error?.code === '42501' || /permission denied|authentication required|super admin/i.test(msg);
          const isMissingFn =
            error?.code === 'PGRST202' ||
            error?.code === '42883' ||
            /could not find the function|does not exist/i.test(msg);

          const next: SupabaseLimitsSnapshot = {
            ...this.snapshot,
            status: 'error',
            error: msg,
            permissionDenied: isPermission,
            migrationMissing: isMissingFn,
          };
          this.emit(next);
          return next;
        }

        const telemetry = data as SupabaseUsageTelemetry;
        const evaluation = evaluateSupabaseLimits(
          telemetry,
          telemetry.monitorConfig?.activePlan,
          this.snapshot.simulateRedAlert
        );

        this.schedulePollInterval(telemetry.monitorConfig?.autoRefreshSeconds || 30);

        const next: SupabaseLimitsSnapshot = {
          ...this.snapshot,
          status: 'ready',
          telemetry,
          evaluation,
          error: null,
          permissionDenied: false,
          migrationMissing: false,
          lastSyncedAt: telemetry.capturedAt || new Date().toISOString(),
          lastEventTable: eventTable || this.snapshot.lastEventTable,
          realtimeEventsCount: eventTable
            ? this.snapshot.realtimeEventsCount + 1
            : this.snapshot.realtimeEventsCount,
        };
        this.emit(next);
        return next;
      } catch (err: any) {
        const next: SupabaseLimitsSnapshot = {
          ...this.snapshot,
          status: 'error',
          error: err?.message || 'Unexpected telemetry fetch failure.',
        };
        this.emit(next);
        return next;
      } finally {
        this.inflightFetch = null;
      }
    })();

    return this.inflightFetch;
  }

  static async updateMonitorConfig(
    patch: Partial<Pick<SupabaseMonitorConfig, 'activePlan' | 'warningThresholdPercent' | 'criticalThresholdPercent' | 'autoRefreshSeconds'>>,
    actorName?: string,
    lang: Language = 'en'
  ): Promise<{ success: boolean; config?: SupabaseMonitorConfig; error?: string }> {
    try {
      const currentConfig = this.snapshot.telemetry?.monitorConfig || {
        activePlan: 'free',
        warningThresholdPercent: 70,
        criticalThresholdPercent: 85,
        autoRefreshSeconds: 30,
      };
      const merged = {
        activePlan: patch.activePlan || currentConfig.activePlan,
        warningThresholdPercent: patch.warningThresholdPercent ?? currentConfig.warningThresholdPercent,
        criticalThresholdPercent: patch.criticalThresholdPercent ?? currentConfig.criticalThresholdPercent,
        autoRefreshSeconds: patch.autoRefreshSeconds ?? currentConfig.autoRefreshSeconds,
      };

      const { data, error } = await supabase.rpc('rpc_update_supabase_monitor_config', {
        p_config: merged,
        p_actor_name: actorName || null,
      });

      if (error || !data || typeof data !== 'object') {
        const rawErr = error?.message || 'Failed to update Supabase plan monitor configuration.';
        const friendlyErr =
          error?.code === '42501' || /permission denied|super admin/i.test(rawErr)
            ? lang === 'bn'
              ? 'অনুমতি নেই: শুধুমাত্র যাচাইকৃত সুপার অ্যাডমিন প্ল্যান সেটিংস পরিবর্তন করতে পারবেন।'
              : 'Permission Denied: Only an authenticated Super Admin can update plan monitor settings.'
            : rawErr;
        return { success: false, error: friendlyErr };
      }

      const savedConfig = data as SupabaseMonitorConfig;
      if (this.snapshot.telemetry) {
        const updatedTelemetry: SupabaseUsageTelemetry = {
          ...this.snapshot.telemetry,
          monitorConfig: savedConfig,
        };
        const updatedEval = evaluateSupabaseLimits(
          updatedTelemetry,
          savedConfig.activePlan,
          this.snapshot.simulateRedAlert
        );
        this.schedulePollInterval(savedConfig.autoRefreshSeconds);
        this.emit({
          ...this.snapshot,
          telemetry: updatedTelemetry,
          evaluation: updatedEval,
          lastSyncedAt: new Date().toISOString(),
        });
      } else {
        await this.fetchTelemetry('system_settings');
      }

      return { success: true, config: savedConfig };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Unexpected error updating monitor config.',
      };
    }
  }

  private static triggerDebouncedRefresh(tableName: string): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.fetchTelemetry(tableName);
    }, 1000);
  }

  static initRealtimeSync(): () => void {
    this.syncRefCount += 1;

    if (this.snapshot.telemetry === null) {
      void this.fetchTelemetry();
    }

    if (!this.realtimeChannel) {
      try {
        this.emit({ ...this.snapshot, realtimeState: 'CONNECTING' });

        this.realtimeChannel = supabase
          .channel('super_admin_supabase_limits_live_v1')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'registrations_2027' },
            () => this.triggerDebouncedRefresh('registrations_2027')
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'donations' },
            () => this.triggerDebouncedRefresh('donations')
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'pending_orders' },
            () => this.triggerDebouncedRefresh('pending_orders')
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'ipn_logs' },
            () => this.triggerDebouncedRefresh('ipn_logs')
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'system_settings',
              filter: 'key=eq.supabase_plan_monitor',
            },
            () => this.triggerDebouncedRefresh('system_settings')
          )
          .subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              this.emit({ ...this.snapshot, realtimeState: 'SUBSCRIBED' });
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              this.emit({ ...this.snapshot, realtimeState: 'POLLING_FALLBACK' });
            }
          });
      } catch (_) {
        this.emit({ ...this.snapshot, realtimeState: 'POLLING_FALLBACK' });
      }
    }

    if (!this.pollTimer) {
      this.schedulePollInterval(
        this.snapshot.telemetry?.monitorConfig?.autoRefreshSeconds || 30
      );
    }

    return () => {
      this.syncRefCount = Math.max(0, this.syncRefCount - 1);
      if (this.syncRefCount === 0) {
        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
          this.debounceTimer = null;
        }
        if (this.pollTimer) {
          clearInterval(this.pollTimer);
          this.pollTimer = null;
        }
        if (this.realtimeChannel) {
          try {
            supabase.removeChannel(this.realtimeChannel);
          } catch (_) {}
          this.realtimeChannel = null;
        }
      }
    };
  }
}
