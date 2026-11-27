import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  SUPABASE_PLAN_SPECS,
  SupabaseUsageTelemetry,
  calculateUsagePercent,
  evaluateSupabaseLimits,
  formatBytes,
  resolveMetricSeverity,
} from '../services/supabaseLimitsService';
import { PORTAL_ROLE_CONFIGS, PortalRole } from '../types';

function buildBaseTelemetry(
  overrides: Partial<SupabaseUsageTelemetry> = {}
): SupabaseUsageTelemetry {
  return {
    capturedAt: '2026-11-27T12:00:00.000Z',
    databaseName: 'postgres',
    postgresVersion: '15.8',
    monitorConfig: {
      activePlan: 'free',
      warningThresholdPercent: 70,
      criticalThresholdPercent: 85,
      autoRefreshSeconds: 30,
    },
    database: {
      sizeBytes: 28 * 1024 * 1024, // 28 MB
      maxFreeBytes: SUPABASE_PLAN_SPECS.free.dbSizeBytes,
      maxProBytes: SUPABASE_PLAN_SPECS.pro.dbSizeBytes,
      tableCount: 24,
      topTables: [],
    },
    storage: {
      totalBytes: 42 * 1024 * 1024, // 42 MB
      fileCount: 120,
      largestFileBytes: 420 * 1024,
      maxFreeBytes: SUPABASE_PLAN_SPECS.free.storageBytes,
      maxProBytes: SUPABASE_PLAN_SPECS.pro.storageBytes,
      maxFreeUploadBytes: SUPABASE_PLAN_SPECS.free.maxFileUploadBytes,
      maxProUploadBytes: SUPABASE_PLAN_SPECS.pro.maxFileUploadBytes,
      buckets: [],
    },
    auth: {
      totalUsers: 8,
      mau30d: 4,
      active24h: 2,
      adminAccountsCount: 4,
      activeAdminAccountsCount: 4,
      staffAccountsCount: 4,
      activeStaffAccountsCount: 4,
    },
    connections: {
      totalConnections: 6,
      activeQueries: 1,
      idleConnections: 5,
      maxConnections: 60,
    },
    activity: {
      registrationsTotal: 150,
      registrations24h: 12,
      donationsTotal: 25,
      donations24h: 3,
      pendingOrdersTotal: 2,
      pendingOrders24h: 1,
      ipnLogsTotal: 180,
      ipnLogs24h: 14,
      ipnLogs30d: 180,
      currentStudentIdsTotal: 800,
      auditLogsTotal: 90,
      auditLogs30d: 40,
      lastActivityAt: '2026-11-27T11:55:00.000Z',
      idleDays: 0.01,
    },
    ...overrides,
  };
}

test('supabaseLimitsService: formats bytes and computes percentages accurately', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(512 * 1024), '512.0 KB');
  assert.equal(formatBytes(500 * 1024 * 1024), '500.0 MB');
  assert.equal(formatBytes(8 * 1024 * 1024 * 1024), '8.00 GB');

  assert.equal(calculateUsagePercent(250, 500), 50);
  assert.equal(calculateUsagePercent(450, 500), 90);
  assert.equal(calculateUsagePercent(100, 0), 0);
});

test('supabaseLimitsService: classifies healthy, warning, and critical red alert thresholds', () => {
  assert.equal(resolveMetricSeverity(45, 70, 85), 'healthy');
  assert.equal(resolveMetricSeverity(70, 70, 85), 'warning');
  assert.equal(resolveMetricSeverity(84.9, 70, 85), 'warning');
  assert.equal(resolveMetricSeverity(85, 70, 85), 'critical');
  assert.equal(resolveMetricSeverity(102, 70, 85), 'critical');
});

test('supabaseLimitsService: keeps both Free and Pro limits visible while evaluating healthy baseline', () => {
  const telemetry = buildBaseTelemetry();
  const res = evaluateSupabaseLimits(telemetry);

  assert.equal(res.activePlan, 'free');
  assert.equal(res.alertSummary.level, 'healthy');
  assert.equal(res.alertSummary.hasRedAlert, false);

  const dbMetric = res.metrics.find((m) => m.id === 'database_size');
  assert.ok(dbMetric);
  assert.equal(dbMetric.freeLimitLabel, '500 MB');
  assert.equal(dbMetric.proLimitLabel, '8 GB');
  assert.ok(dbMetric.freePercent > 0);
  assert.ok(dbMetric.proPercent < dbMetric.freePercent);

  assert.ok(res.comparisonRows.some((r) => r.key === 'egress' && !r.isDirectlyMetered));
  assert.ok(res.comparisonRows.some((r) => r.key === 'edge_functions'));
});

test('supabaseLimitsService: triggers Red Alert on Free plan when database size nears 500 MB and clears on Pro plan', () => {
  const telemetry = buildBaseTelemetry({
    database: {
      sizeBytes: 450 * 1024 * 1024, // 90% of Free 500MB, 5.5% of Pro 8GB
      maxFreeBytes: SUPABASE_PLAN_SPECS.free.dbSizeBytes,
      maxProBytes: SUPABASE_PLAN_SPECS.pro.dbSizeBytes,
      tableCount: 24,
      topTables: [],
    },
  });

  const freeEval = evaluateSupabaseLimits(telemetry, 'free');
  assert.equal(freeEval.alertSummary.hasRedAlert, true);
  assert.equal(freeEval.alertSummary.level, 'critical');
  assert.ok(freeEval.alertSummary.criticalMetrics.some((m) => m.id === 'database_size'));
  assert.ok(freeEval.alertSummary.headlineEn.includes('RED ALERT'));
  assert.ok(freeEval.alertSummary.headlineBn.includes('রেড অ্যালার্ট'));

  const proEval = evaluateSupabaseLimits(telemetry, 'pro');
  assert.equal(proEval.alertSummary.hasRedAlert, false);
  assert.equal(proEval.alertSummary.level, 'healthy');
});

test('supabaseLimitsService: triggers Free Plan 7-day inactivity Red Alert at >= 5.5 idle days', () => {
  const base = buildBaseTelemetry();
  const telemetry = buildBaseTelemetry({
    activity: {
      ...base.activity,
      idleDays: 5.7,
    },
  });

  const freeEval = evaluateSupabaseLimits(telemetry, 'free');
  assert.equal(freeEval.alertSummary.hasRedAlert, true);
  assert.ok(freeEval.alertSummary.criticalMetrics.some((m) => m.id === 'inactivity_pause'));

  const proEval = evaluateSupabaseLimits(telemetry, 'pro');
  assert.equal(proEval.alertSummary.hasRedAlert, false);
});

test('supabaseLimitsService: supports Red Alert preview simulation without altering real telemetry input', () => {
  const telemetry = buildBaseTelemetry();
  const simEval = evaluateSupabaseLimits(telemetry, 'free', true);

  assert.equal(simEval.alertSummary.isSimulation, true);
  assert.equal(simEval.alertSummary.hasRedAlert, true);
  assert.equal(telemetry.database.sizeBytes, 28 * 1024 * 1024);
});

test('supabaseLimitsService: restricts supabaseLimits tab exclusively to super_admin and locks telemetry RPCs', () => {
  assert.ok(PORTAL_ROLE_CONFIGS.super_admin.allowedTabs.includes('supabaseLimits'));
  (['admin', 'moderator', 'finance_manager', 'registration_officer'] as PortalRole[]).forEach((role) => {
    assert.equal(
      PORTAL_ROLE_CONFIGS[role].allowedTabs.includes('supabaseLimits'),
      false,
      `${role} must not access supabaseLimits`
    );
  });

  const migrationSql = fs.readFileSync(
    path.resolve(process.cwd(), 'supabase/migrations/20270324000000_supabase_usage_telemetry_rpc.sql'),
    'utf8'
  );
  const rollbackSql = fs.readFileSync(
    path.resolve(process.cwd(), 'supabase/rollback/20270324000000_rollback.sql'),
    'utf8'
  );

  assert.ok(migrationSql.includes('SECURITY DEFINER'));
  assert.ok(migrationSql.includes("<> 'super_admin'"));
  assert.ok(
    migrationSql.includes('REVOKE ALL ON FUNCTION public.rpc_get_supabase_usage_telemetry() FROM PUBLIC, anon;')
  );
  assert.ok(
    migrationSql.includes(
      'REVOKE ALL ON FUNCTION public.rpc_update_supabase_monitor_config(JSONB, TEXT) FROM PUBLIC, anon;'
    )
  );
  assert.ok(rollbackSql.includes('DROP FUNCTION IF EXISTS public.rpc_get_supabase_usage_telemetry()'));
  assert.ok(rollbackSql.includes('DROP FUNCTION IF EXISTS public.rpc_update_supabase_monitor_config(JSONB, TEXT)'));
});
