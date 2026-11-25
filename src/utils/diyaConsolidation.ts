export function consolidateUpvanDharClient(byRmList: any[], _programType?: string): any[] {
  if (!byRmList || !Array.isArray(byRmList) || byRmList.length === 0) return byRmList || [];

  const isUpvan = (item: any) => {
    const val = String(item.name || item.rm_sh_zh || '').trim().toLowerCase();
    return val === 'upvan dhar' || val.includes('upvan');
  };

  const isKrishnaPrasad = (item: any) => {
    const val = String(item.name || item.rm_sh_zh || '').trim().toLowerCase();
    return val === 'krishna prasad' || val.includes('krishna prasad');
  };

  const upvanItems = byRmList.filter(isUpvan);
  const kpItems = byRmList.filter(isKrishnaPrasad);

  // If Upvan Dhar is already merged/absent and at most 1 Krishna Prasad exists, return as-is
  if (upvanItems.length === 0 && kpItems.length <= 1) {
    return byRmList;
  }

  const matches = byRmList.filter((item) => isUpvan(item) || isKrishnaPrasad(item));
  if (matches.length === 0) return byRmList;

  const others = byRmList.filter((item) => !isUpvan(item) && !isKrishnaPrasad(item));

  const kp: any = {
    name: 'Krishna Prasad',
    rm_sh_zh: 'Krishna Prasad',
  };

  let weightedDelaySum = 0;
  let totalBatchesForDelay = 0;

  for (const item of matches) {
    if (item.avg_delay_days !== undefined && item.total_batches !== undefined) {
      weightedDelaySum += (Number(item.avg_delay_days) || 0) * (Number(item.total_batches) || 0);
      totalBatchesForDelay += Number(item.total_batches) || 0;
    }
    for (const key of Object.keys(item)) {
      if (key === 'name' || key === 'rm_sh_zh') continue;
      const val = item[key];
      if (typeof val === 'number' || (val != null && !isNaN(Number(val)) && typeof kp[key] === 'number')) {
        const current = Number(kp[key]) || 0;
        const added = Number(val) || 0;
        const sum = current + added;
        kp[key] = Number.isInteger(current) && Number.isInteger(added) ? sum : Number(sum.toFixed(1));
      } else if (kp[key] === undefined) {
        kp[key] = val;
      }
    }
  }

  // 1. Dropout rates: keep additive merge (Initial 20.6%, Regular 14.1%, Total 34.7%)
  if (kp.initial_dropout_rate != null || kp.regular_dropout_rate != null) {
    const totalRate = Number(((Number(kp.initial_dropout_rate) || 0) + (Number(kp.regular_dropout_rate) || 0)).toFixed(1));
    kp.total_dropout_rate = totalRate;
    kp.dropout_rate = totalRate;
  }
  if (kp.trained_rate !== undefined && kp.students !== undefined && kp.trained_students !== undefined) {
    kp.trained_rate = kp.students > 0 ? Number(((kp.trained_students / kp.students) * 100).toFixed(1)) : 0;
  }

  // 2. Trained & Timeliness percentages: recalculate from merged counts so they never exceed 100%
  if (kp.trained_within_10 !== undefined && kp.trained !== undefined) {
    kp.trained_within_10_pct = kp.trained > 0 ? Number(((kp.trained_within_10 / kp.trained) * 100).toFixed(1)) : 0;
    kp.trained_after_10_pct = kp.trained > 0 ? Number(((kp.trained_after_10 / kp.trained) * 100).toFixed(1)) : 0;
    if (kp.students !== undefined) {
      kp.running_trained_pct = kp.students > 0 ? Number(((kp.trained / kp.students) * 100).toFixed(1)) : 0;
    }
  }

  // 3. Batch Closure percentages: recalculate from merged counts so they never exceed 100%
  if (kp.on_time !== undefined && kp.total_batches !== undefined) {
    kp.on_time_pct = kp.total_batches > 0 ? Number(((kp.on_time / kp.total_batches) * 100).toFixed(1)) : 0;
    kp.delayed_pct = kp.total_batches > 0 ? Number(((kp.delayed / kp.total_batches) * 100).toFixed(1)) : 0;
    if (kp.within_10_days !== undefined) {
      kp.within_10_pct = kp.total_batches > 0 ? Number(((kp.within_10_days / kp.total_batches) * 100).toFixed(1)) : 0;
      kp.after_10_pct = kp.total_batches > 0 ? Number(((kp.after_10_days / kp.total_batches) * 100).toFixed(1)) : 0;
    }
    if (kp.avg_delay_days !== undefined && totalBatchesForDelay > 0) {
      kp.avg_delay_days = Number((weightedDelaySum / totalBatchesForDelay).toFixed(1));
    }
  }

  // 4. Exceptions rate: recalculate from merged counts
  if (kp.exception_rate !== undefined && kp.total_exceptions !== undefined) {
    const denom = kp.trained_students > 0 ? kp.trained_students : kp.students;
    kp.exception_rate = denom > 0 ? Number(((kp.total_exceptions / denom) * 100).toFixed(1)) : 0;
  }

  // 5. Scheduling conductance & missed percentages: recalculate from merged counts
  if (kp.sessions_conducted !== undefined && kp.total_scheduled !== undefined) {
    kp.conducted_pct = kp.total_scheduled > 0 ? Number(((kp.sessions_conducted / kp.total_scheduled) * 100).toFixed(1)) : 100;
    kp.missed_pct = kp.total_scheduled > 0 ? Number((100 - kp.conducted_pct).toFixed(1)) : 0;
    if (kp.sessions_rescheduled !== undefined) {
      kp.rescheduled_pct = kp.total_scheduled > 0 ? Number(((kp.sessions_rescheduled / kp.total_scheduled) * 100).toFixed(1)) : 0;
    }
  }

  // 6. Running Batch Progress averages & percentages: recalculate from weighted sums/counts
  if (kp.running_attendance_sum !== undefined && kp.running_attendance_count !== undefined) {
    kp.avg_running_attendance = kp.running_attendance_count > 0
      ? Number((kp.running_attendance_sum / kp.running_attendance_count).toFixed(1))
      : 0;
  }
  if (kp.beneficiary_attendance_sum !== undefined && kp.beneficiary_attendance_count !== undefined) {
    kp.avg_beneficiary_attendance = kp.beneficiary_attendance_count > 0
      ? Number((kp.beneficiary_attendance_sum / kp.beneficiary_attendance_count).toFixed(1))
      : 0;
  }
  if (kp.ilt_completion_sum !== undefined && kp.ilt_completion_count !== undefined) {
    kp.avg_ilt_completion = kp.ilt_completion_count > 0
      ? Number((kp.ilt_completion_sum / kp.ilt_completion_count).toFixed(1))
      : 0;
  }
  if (kp.students_gte_75 !== undefined && kp.total_students !== undefined) {
    kp.students_gte_75_pct = kp.total_students > 0
      ? Number(((kp.students_gte_75 / kp.total_students) * 100).toFixed(1))
      : 0;
  }
  if (kp.students_lt_75 !== undefined && kp.total_students !== undefined) {
    kp.students_lt_75_pct = kp.total_students > 0
      ? Number(((kp.students_lt_75 / kp.total_students) * 100).toFixed(1))
      : 0;
  }
  if (kp.students_gte_50 !== undefined && kp.total_students !== undefined) {
    kp.students_gte_50_pct = kp.total_students > 0
      ? Number(((kp.students_gte_50 / kp.total_students) * 100).toFixed(1))
      : 0;
  }
  if (kp.students_lt_50 !== undefined && kp.total_students !== undefined) {
    kp.students_lt_50_pct = kp.total_students > 0
      ? Number(((kp.students_lt_50 / kp.total_students) * 100).toFixed(1))
      : 0;
  }

  const firstMatchIndex = byRmList.findIndex((item) => isUpvan(item) || isKrishnaPrasad(item));
  const result = [...others];
  if (firstMatchIndex !== -1 && firstMatchIndex <= result.length) {
    result.splice(firstMatchIndex, 0, kp);
  } else {
    result.push(kp);
  }

  return result;
}
