import { describe, expect, it } from 'vitest';

import type {
  ArtifactRecord,
  JobRunRecord,
  ScheduleRecord,
} from '@rayfin-app/shared';

import {
  averageDuration,
  buildGantt,
  capacityInfo,
  countUnresolvedCapacities,
  filterArtifacts,
  filterOptions,
  FALLBACK_DURATION_SECONDS,
  formatBarRange,
  itemTypeSlot,
  resolveWeekday,
  runningIn,
  runSummary,
  SERIES_COUNT,
} from '@/lib/gantt';
import type { GanttInput } from '@/lib/gantt';

const NOW = new Date('2026-10-06T12:00:00Z');

function artifact(
  id: string,
  extra: Partial<ArtifactRecord> = {}
): ArtifactRecord {
  return {
    id,
    displayName: `Artifact ${id}`,
    workspaceId: 'w1',
    workspaceName: 'Finance',
    ...extra,
  } as ArtifactRecord;
}

function schedule(
  id: string,
  artifactRowId: string,
  extra: Partial<ScheduleRecord> = {}
): ScheduleRecord {
  return {
    id,
    artifactRowId,
    enabled: true,
    configType: 'Daily',
    startDateTime: '2026-01-01T00:00:00',
    localTimeZoneId: 'UTC',
    timesJson: JSON.stringify(['08:00']),
    ...extra,
  } as ScheduleRecord;
}

function run(
  artifactRowId: string,
  startTimeUtc: string,
  durationSeconds?: number
): JobRunRecord {
  return {
    id: `${artifactRowId}-${startTimeUtc}`,
    artifactRowId,
    status: 'Completed',
    startTimeUtc,
    durationSeconds,
  } as JobRunRecord;
}

function input(
  artifacts: ArtifactRecord[],
  schedules: ScheduleRecord[],
  overrides: Partial<GanttInput> = {}
): GanttInput {
  const byArtifact = new Map<string, ScheduleRecord[]>();
  for (const s of schedules) {
    byArtifact.set(s.artifactRowId, [
      ...(byArtifact.get(s.artifactRowId) ?? []),
      s,
    ]);
  }
  return {
    artifacts,
    schedulesByArtifact: byArtifact,
    runs: [],
    runCount: 5,
    weekday: 'Monday',
    groupBy: 'workspace',
    now: NOW,
    ...overrides,
  };
}

const firstRow = (model: ReturnType<typeof buildGantt>) =>
  model.groups[0].rows[0];

describe('averageDuration', () => {
  const runs = [
    run('a', '2026-10-01T08:00:00', 100),
    run('a', '2026-10-02T08:00:00', 200),
    run('a', '2026-10-03T08:00:00', 300),
    run('a', '2026-10-04T08:00:00'), // no duration: ignored
    run('b', '2026-10-04T08:00:00', 9999), // other artifact: ignored
  ];

  it('averages only the last N runs by start time', () => {
    expect(averageDuration(runs, 'a', 2)).toEqual({ seconds: 250, runsUsed: 2 });
  });

  it('uses every run when N exceeds what is available', () => {
    expect(averageDuration(runs, 'a', 20)).toEqual({ seconds: 200, runsUsed: 3 });
  });

  it('returns null when the artifact has no usable runs', () => {
    expect(averageDuration(runs, 'zzz', 5)).toEqual({ seconds: null, runsUsed: 0 });
  });
});

describe('resolveWeekday', () => {
  it('accepts numbers and day names', () => {
    expect(resolveWeekday(1)).toBe(1);
    expect(resolveWeekday('sunday')).toBe(0);
    expect(resolveWeekday('Friday')).toBe(5);
  });
});

describe('buildGantt bars', () => {
  it('flags artifacts without history and uses the fallback width', () => {
    const model = buildGantt(input([artifact('a1')], [schedule('s1', 'a1')]));
    const row = firstRow(model);
    expect(row.hasHistory).toBe(false);
    expect(row.averageDurationSeconds).toBeNull();
    expect(row.bars[0]).toMatchObject({
      startMin: 480,
      durationMin: FALLBACK_DURATION_SECONDS / 60,
      hasHistory: false,
    });
  });

  it('sizes bars from the average of the last N runs', () => {
    const runs = [
      run('a1', '2026-10-01T08:00:00', 600),
      run('a1', '2026-10-02T08:00:00', 1200),
      run('a1', '2026-10-03T08:00:00', 1800),
    ];
    const base = input([artifact('a1')], [schedule('s1', 'a1')], { runs });
    const last2 = firstRow(buildGantt({ ...base, runCount: 2 }));
    expect(last2.runsUsed).toBe(2);
    expect(last2.averageDurationSeconds).toBe(1500);
    expect(last2.bars[0].durationMin).toBe(25);
    const all = firstRow(buildGantt({ ...base, runCount: 20 }));
    expect(all.runsUsed).toBe(3);
    expect(all.bars[0].hasHistory).toBe(true);
  });

  it('expands daily schedules to one bar per time', () => {
    const model = buildGantt(
      input(
        [artifact('a1')],
        [schedule('s1', 'a1', { timesJson: '["06:30","18:00"]' })]
      )
    );
    expect(firstRow(model).bars.map((bar) => bar.startMin)).toEqual([390, 1080]);
  });

  it('draws weekly schedules only on the chosen weekday', () => {
    const weekly = schedule('s1', 'a1', {
      configType: 'Weekly',
      weekdaysJson: '["Monday","Wednesday"]',
      timesJson: '["09:00"]',
    });
    const monday = buildGantt(input([artifact('a1')], [weekly]));
    expect(firstRow(monday).bars).toHaveLength(1);
    const tuesday = buildGantt(
      input([artifact('a1')], [weekly], { weekday: 'Tuesday' })
    );
    expect(tuesday.groups).toEqual([]);
  });

  it('expands cron schedules from the start anchor every interval', () => {
    const cron = schedule('s1', 'a1', {
      configType: 'Cron',
      intervalMinutes: 360,
      startDateTime: '2026-01-01T02:00:00',
      timesJson: undefined,
    });
    const model = buildGantt(input([artifact('a1')], [cron]));
    expect(firstRow(model).bars.map((bar) => bar.startMin)).toEqual([
      120, 480, 840, 1200,
    ]);
  });

  it('caps very frequent cron schedules and reports the truncation', () => {
    const cron = schedule('s1', 'a1', {
      configType: 'Cron',
      intervalMinutes: 1,
      timesJson: undefined,
    });
    const row = firstRow(buildGantt(input([artifact('a1')], [cron])));
    expect(row.bars).toHaveLength(288);
    expect(row.truncated).toBe(true);
  });

  it('splits a bar that crosses midnight into two flagged segments', () => {
    const runs = [run('a1', '2026-10-01T23:00:00', 7200)]; // 120 min
    const model = buildGantt(
      input(
        [artifact('a1')],
        [schedule('s1', 'a1', { timesJson: '["23:00"]' })],
        { runs }
      )
    );
    const bars = firstRow(model).bars;
    expect(bars).toHaveLength(2);
    expect(bars[0]).toMatchObject({ startMin: 1380, durationMin: 60, wraps: true });
    expect(bars[1]).toMatchObject({ startMin: 0, durationMin: 60, wraps: true });
  });
});

describe('buildGantt filtering', () => {
  it('excludes disabled schedules unless asked to include them', () => {
    const disabled = schedule('s1', 'a1', { enabled: false });
    expect(buildGantt(input([artifact('a1')], [disabled])).groups).toEqual([]);
    const included = buildGantt(
      input([artifact('a1')], [disabled], { includeDisabled: true })
    );
    expect(included.groups).toHaveLength(1);
  });

  it('lists monthly schedules as skipped instead of drawing them', () => {
    const monthly = schedule('s1', 'a1', { configType: 'Monthly' });
    const model = buildGantt(input([artifact('a1')], [monthly]));
    expect(model.groups).toEqual([]);
    expect(model.skipped).toEqual([
      { artifactId: 'a1', scheduleId: 's1', reason: 'monthly' },
    ]);
  });

  it('skips schedules whose end date is in the past', () => {
    const ended = schedule('s1', 'a1', { endDateTime: '2026-01-01T00:00:00' });
    const model = buildGantt(input([artifact('a1')], [ended]));
    expect(model.groups).toEqual([]);
    expect(model.skipped[0]).toMatchObject({ reason: 'ended' });
  });
});

describe('buildGantt grouping and load', () => {
  const artifacts = [
    artifact('a1', { capacityId: 'cap-1', capacityName: 'Prod', workspaceName: 'Finance' }),
    artifact('a2', { capacityId: 'cap-1', capacityName: 'Prod', workspaceName: 'Ops' }),
    artifact('a3', { workspaceName: 'Ops' }),
  ];
  const schedules = [
    schedule('s1', 'a1', { timesJson: '["08:00"]' }),
    schedule('s2', 'a2', { timesJson: '["08:00"]' }),
    schedule('s3', 'a3', { timesJson: '["12:00"]' }),
  ];

  it('groups by capacity, naming artifacts without one', () => {
    const model = buildGantt(input(artifacts, schedules, { groupBy: 'capacity' }));
    expect(model.groups.map((group) => group.label)).toEqual([
      'Prod',
      'No capacity',
    ]);
  });

  it('groups by workspace', () => {
    const model = buildGantt(input(artifacts, schedules, { groupBy: 'workspace' }));
    expect(model.groups.map((group) => [group.label, group.rows.length])).toEqual([
      ['Finance', 1],
      ['Ops', 2],
    ]);
  });

  it('computes peak concurrency and overlapping artifacts', () => {
    const model = buildGantt(input(artifacts, schedules, { groupBy: 'capacity' }));
    const prod = model.groups[0];
    expect(prod.peak).toEqual({ minute: 480, count: 2 });
    expect(prod.overlapping.sort()).toEqual(['a1', 'a2']);
    expect(prod.load[480]).toBe(2);
    expect(prod.load[0]).toBe(0);
    const none = model.groups[1];
    expect(none.peak.count).toBe(1);
    expect(none.overlapping).toEqual([]);
  });

  it('orders groups by peak then name and rows by first start', () => {
    const ordered = buildGantt(
      input(
        [artifact('a1'), artifact('a2')],
        [
          schedule('s1', 'a1', { timesJson: '["20:00"]' }),
          schedule('s2', 'a2', { timesJson: '["01:00"]' }),
        ]
      )
    );
    expect(ordered.groups[0].rows.map((row) => row.artifact.id)).toEqual([
      'a2',
      'a1',
    ]);
  });
});

describe('capacity labels', () => {
  it('uses the name, an id fallback, or "No capacity"', () => {
    expect(
      capacityInfo(artifact('a', { capacityId: 'c-1', capacityName: 'Prod' }))
    ).toEqual({ key: 'c-1', label: 'Prod', nameKnown: true });
    expect(
      capacityInfo(artifact('a', { capacityId: '1234567890abcdef' }))
    ).toEqual({ key: '1234567890abcdef', label: 'Capacity 12345678', nameKnown: false });
    expect(capacityInfo(artifact('a'))).toMatchObject({
      label: 'No capacity',
      nameKnown: true,
    });
  });

  it('counts distinct capacities whose name is unresolved', () => {
    expect(
      countUnresolvedCapacities([
        artifact('a', { capacityId: 'c1' }),
        artifact('b', { capacityId: 'c1' }),
        artifact('c', { capacityId: 'c2' }),
        artifact('d', { capacityId: 'c3', capacityName: 'Prod' }),
        artifact('e'),
      ])
    ).toBe(2);
  });

  it('flags capacity groups that only have an id', () => {
    const model = buildGantt(
      input(
        [artifact('a1', { capacityId: 'abcdef0123456789' })],
        [schedule('s1', 'a1')],
        { groupBy: 'capacity' }
      )
    );
    expect(model.groups[0]).toMatchObject({
      label: 'Capacity abcdef01',
      nameUnavailable: true,
    });
  });
});

describe('capacity and workspace filters', () => {
  const artifacts = [
    artifact('a1', { capacityId: 'cap-1', capacityName: 'Prod', workspaceId: 'w-fin', workspaceName: 'Finance' }),
    artifact('a2', { capacityId: 'cap-1', capacityName: 'Prod', workspaceId: 'w-ops', workspaceName: 'Ops' }),
    artifact('a3', { capacityId: 'cap-2', workspaceId: 'w-dev', workspaceName: 'Dev' }),
    artifact('a4', { workspaceId: 'w-ops', workspaceName: 'Ops' }),
  ];
  const ids = (list: readonly ArtifactRecord[]) => list.map((a) => a.id);

  it('treats an empty selection as no filter', () => {
    expect(ids(filterArtifacts(artifacts, {}))).toEqual(['a1', 'a2', 'a3', 'a4']);
    expect(
      ids(filterArtifacts(artifacts, { capacities: [], workspaces: [] }))
    ).toEqual(['a1', 'a2', 'a3', 'a4']);
  });

  it('keeps artifacts matching any selected capacity key, "" meaning none', () => {
    expect(ids(filterArtifacts(artifacts, { capacities: ['cap-2', ''] }))).toEqual([
      'a3',
      'a4',
    ]);
  });

  it('combines capacity and workspace filters with AND', () => {
    expect(
      ids(filterArtifacts(artifacts, { capacities: ['cap-1'], workspaces: ['w-ops'] }))
    ).toEqual(['a2']);
  });

  it('derives options with counts, labels and narrowed workspaces', () => {
    const all = filterOptions(artifacts, {});
    expect(all.capacities).toEqual([
      { key: 'cap-2', label: 'Capacity cap-2', count: 1, nameKnown: false },
      { key: '', label: 'No capacity', count: 1, nameKnown: true },
      { key: 'cap-1', label: 'Prod', count: 2, nameKnown: true },
    ]);
    expect(all.workspaces.map((o) => [o.label, o.count])).toEqual([
      ['Dev', 1],
      ['Finance', 1],
      ['Ops', 2],
    ]);
    const narrowed = filterOptions(artifacts, { capacities: ['cap-1'] });
    expect(narrowed.workspaces.map((o) => [o.key, o.count])).toEqual([
      ['w-fin', 1],
      ['w-ops', 1],
    ]);
    // Capacity options are never narrowed by the capacity selection itself.
    expect(narrowed.capacities).toHaveLength(3);
  });

  it('applies filters before grouping and peak computation', () => {
    const schedules = [
      schedule('s1', 'a1', { timesJson: '["08:00"]' }),
      schedule('s2', 'a2', { timesJson: '["08:00"]' }),
    ];
    const base = input(artifacts.slice(0, 2), schedules, { groupBy: 'capacity' });
    expect(buildGantt(base).groups[0].peak.count).toBe(2);
    const filtered = buildGantt({ ...base, filters: { workspaces: ['w-fin'] } });
    expect(filtered.groups).toHaveLength(1);
    expect(filtered.groups[0].peak.count).toBe(1);
    expect(filtered.groups[0].rows.map((row) => row.artifact.id)).toEqual(['a1']);
  });
});

describe('tooltip data', () => {
  const runs = [
    { ...run('a1', '2026-10-01T08:00:00', 600), status: 'Completed' },
    { ...run('a1', '2026-10-02T08:00:00', 1800), status: 'Completed' },
    { ...run('a1', '2026-10-03T08:00:00'), status: 'Failed' },
  ];

  it('summarizes min/max of the last N runs and the latest run', () => {
    expect(runSummary(runs, 'a1', 5)).toEqual({
      minDurationSeconds: 600,
      maxDurationSeconds: 1800,
      lastRun: { status: 'Failed', startTimeUtc: '2026-10-03T08:00:00' },
    });
    expect(runSummary(runs, 'zzz', 5)).toEqual({
      minDurationSeconds: null,
      maxDurationSeconds: null,
      lastRun: null,
    });
  });

  it('exposes drawn schedules and the run summary on each row', () => {
    const row = firstRow(
      buildGantt(input([artifact('a1')], [schedule('s1', 'a1')], { runs }))
    );
    expect(row.schedules.map((s) => s.id)).toEqual(['s1']);
    expect(row.lastRun?.status).toBe('Failed');
    expect(row.maxDurationSeconds).toBe(1800);
  });

  it('keeps the scheduled start on both segments of a wrapped bar', () => {
    const wrapped = buildGantt(
      input(
        [artifact('a1')],
        [schedule('s1', 'a1', { timesJson: '["23:00"]' })],
        { runs: [run('a1', '2026-10-01T23:00:00', 7200)] }
      )
    );
    expect(firstRow(wrapped).bars.map((bar) => bar.runStartMin)).toEqual([1380, 1380]);
  });

  it('formats the whole time range and flags midnight crossings', () => {
    expect(formatBarRange({ runStartMin: 480 }, 1200)).toEqual({
      text: '08:00–08:20',
      wraps: false,
    });
    expect(formatBarRange({ runStartMin: 1380 }, 7200)).toEqual({
      text: '23:00–01:00',
      wraps: true,
    });
  });

  it('lists the artifacts running in a time window, capped', () => {
    const arts = Array.from({ length: 10 }, (_, i) => artifact(`a${i}`));
    const scheds = arts.map((a) => schedule(`s-${a.id}`, a.id));
    const group = buildGantt(input(arts, scheds)).groups[0];
    const result = runningIn(group, 480, 495);
    expect(result.names).toHaveLength(8);
    expect(result.extra).toBe(2);
    expect(runningIn(group, 600, 615)).toEqual({ names: [], extra: 0 });
  });

  it('assigns a stable color slot per item type', () => {
    expect(itemTypeSlot('Notebook')).toBe(itemTypeSlot('Notebook'));
    expect(itemTypeSlot('Notebook')).toBeLessThan(SERIES_COUNT);
  });
});

describe('buildGantt time zones', () => {
  it('reports the distinct time zones of drawn schedules', () => {
    const model = buildGantt(
      input(
        [artifact('a1'), artifact('a2')],
        [
          schedule('s1', 'a1', { localTimeZoneId: 'UTC' }),
          schedule('s2', 'a2', { localTimeZoneId: 'W. Europe Standard Time' }),
          schedule('s3', 'a2', { localTimeZoneId: 'UTC' }),
        ]
      )
    );
    expect(model.timeZones).toEqual(['UTC', 'W. Europe Standard Time']);
  });
});
