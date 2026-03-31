// scheduling-logic.js - Deterministic scheduling algorithm with proper gap enforcement

// Store existing schedule globally
let existingSchedule = [];

/**
 * Generate a schedule that deterministically places videos with proper gaps.
 *
 * Strategy:
 * 1. Build a sorted list of "blocked" intervals from existing scheduled videos
 * 2. Compute the ideal even-spread gap across the date window
 * 3. Clamp the ideal gap to [batchMinGap, batchMaxGap]
 * 4. Place each video sequentially, skipping over blocked intervals and
 *    snapping to allowed days / time windows
 * 5. If the window is too small for the requested gap, compress proportionally
 *
 * @param {number} videoCount - Number of videos to schedule
 * @param {Date} startDate - Start of scheduling window
 * @param {Date} endDate - End of scheduling window
 * @param {Object} options - Scheduling options
 * @returns {Date[]} - Array of scheduled dates
 */
function generateSmartSchedule(videoCount, startDate, endDate, options = {}) {
  const {
    batchMinGap = 30,
    batchMaxGap = 45,
    existingMinGap = 7,
    respectExisting = true,
    allowedDays = [],
    startTime = null,
    endTime = null
  } = options;

  if (videoCount <= 0) return [];

  const now = new Date();
  const windowStart = new Date(Math.max(startDate.getTime(), now.getTime()));
  const windowEnd = new Date(endDate);

  if (windowEnd <= windowStart) {
    alert('Error: End date must be after start date');
    return [];
  }

  const DAY_MS = 24 * 60 * 60 * 1000;
  const batchMinGapMs = batchMinGap * DAY_MS;
  const batchMaxGapMs = batchMaxGap * DAY_MS;
  const existingMinGapMs = existingMinGap * DAY_MS;
  const totalWindow = windowEnd.getTime() - windowStart.getTime();

  console.log('Scheduling with settings:', {
    batchMinGap,
    batchMaxGap,
    existingMinGap,
    videoCount,
    existingScheduleCount: existingSchedule.length,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    totalWindowDays: (totalWindow / DAY_MS).toFixed(1)
  });

  // ── Step 1: Determine the gap to use ──────────────────────────────────
  // Ideal gap = spread videos evenly across the window
  // We need (videoCount - 1) gaps between videos, plus margin at start/end
  const idealGap = totalWindow / (videoCount + 1);

  // Clamp to configured range; if window is too small, compress proportionally
  let effectiveGap;
  if (idealGap >= batchMinGapMs && idealGap <= batchMaxGapMs) {
    effectiveGap = idealGap;
  } else if (idealGap > batchMaxGapMs) {
    effectiveGap = batchMaxGapMs;
  } else {
    // Window too small for min gap — check if we can fit at all
    const requiredWindow = batchMinGapMs * (videoCount - 1);
    if (totalWindow >= requiredWindow) {
      effectiveGap = batchMinGapMs;
    } else {
      // Compress: distribute evenly even though it violates min gap
      effectiveGap = totalWindow / (videoCount + 1);
      console.warn(
        `Window too small for ${videoCount} videos with ${batchMinGap}-day min gap. ` +
        `Compressing to ${(effectiveGap / DAY_MS).toFixed(1)}-day gaps.`
      );
    }
  }

  console.log(`Effective gap: ${(effectiveGap / DAY_MS).toFixed(1)} days`);

  // ── Step 2: Build sorted existing dates for conflict checking ─────────
  const sortedExisting = respectExisting
    ? [...existingSchedule].sort((a, b) => a.getTime() - b.getTime())
    : [];

  // ── Step 3: Place videos deterministically ────────────────────────────
  const scheduledDates = [];

  for (let i = 0; i < videoCount; i++) {
    // Calculate ideal position: evenly distributed across window
    const idealTime = windowStart.getTime() + effectiveGap * (i + 1);

    // Start from ideal position and find the nearest valid slot
    let candidate = findValidSlot(
      idealTime,
      scheduledDates,
      sortedExisting,
      batchMinGapMs,
      existingMinGapMs,
      windowStart,
      windowEnd,
      allowedDays,
      startTime,
      endTime,
      now
    );

    if (candidate) {
      scheduledDates.push(candidate);
      console.log(
        `Video ${i + 1}: ${candidate.toISOString()} ` +
        `(${((candidate.getTime() - windowStart.getTime()) / DAY_MS).toFixed(1)} days from start)`
      );
    } else {
      // Fallback: place with minimum gap from last scheduled video
      const lastTime = scheduledDates.length > 0
        ? scheduledDates[scheduledDates.length - 1].getTime()
        : windowStart.getTime();
      const fallback = new Date(lastTime + batchMinGapMs);
      const constrained = applyDayAndTimeConstraints(fallback, allowedDays, startTime, endTime);
      if (constrained && constrained <= windowEnd && constrained > now) {
        scheduledDates.push(constrained);
        console.warn(`Video ${i + 1}: Used fallback at ${constrained.toISOString()}`);
      } else {
        console.error(`Video ${i + 1}: Could not find valid slot`);
      }
    }
  }

  // Sort chronologically
  scheduledDates.sort((a, b) => a.getTime() - b.getTime());

  console.log('Final schedule:', analyzeScheduleQuality(scheduledDates, sortedExisting));

  return scheduledDates;
}

/**
 * Find a valid slot near the ideal time, searching outward in both directions.
 * Enforces batch gap from already-scheduled videos and existing gap from YouTube schedule.
 */
function findValidSlot(
  idealTime,
  scheduledDates,
  existingDates,
  batchMinGapMs,
  existingMinGapMs,
  windowStart,
  windowEnd,
  allowedDays,
  startTime,
  endTime,
  now
) {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const maxSearchRadius = windowEnd.getTime() - windowStart.getTime();

  // Search outward from ideal position in 1-day increments
  for (let offset = 0; offset <= maxSearchRadius; offset += DAY_MS) {
    // Try both directions: ideal, ideal+offset, ideal-offset
    const candidates = offset === 0
      ? [idealTime]
      : [idealTime + offset, idealTime - offset];

    for (const candidateTime of candidates) {
      const candidate = new Date(candidateTime);

      // Apply day and time constraints
      const constrained = applyDayAndTimeConstraints(candidate, allowedDays, startTime, endTime);
      if (!constrained) continue;

      // Must be within window and in the future
      if (constrained.getTime() < now.getTime()) continue;
      if (constrained.getTime() < windowStart.getTime()) continue;
      if (constrained.getTime() > windowEnd.getTime()) continue;

      // Check batch gap (distance from other videos in this batch)
      if (!respectsBatchGap(constrained, scheduledDates, batchMinGapMs)) continue;

      // Check existing gap (distance from already-scheduled YouTube videos)
      if (!respectsExistingGap(constrained, existingDates, existingMinGapMs)) continue;

      return constrained;
    }
  }

  return null;
}

/**
 * Check if a candidate date respects the minimum batch gap from all scheduled dates
 */
function respectsBatchGap(candidate, scheduledDates, batchMinGapMs) {
  const candidateTime = candidate.getTime();
  for (const scheduled of scheduledDates) {
    if (Math.abs(candidateTime - scheduled.getTime()) < batchMinGapMs) {
      return false;
    }
  }
  return true;
}

/**
 * Check if a candidate date respects the minimum gap from existing YouTube schedule
 */
function respectsExistingGap(candidate, existingDates, existingMinGapMs) {
  if (existingMinGapMs <= 0 || existingDates.length === 0) return true;

  const candidateTime = candidate.getTime();
  for (const existing of existingDates) {
    if (Math.abs(candidateTime - existing.getTime()) < existingMinGapMs) {
      return false;
    }
  }
  return true;
}

/**
 * Apply day-of-week and time-of-day constraints to a date.
 * Returns the nearest valid date (searching forward up to 7 days for day constraint).
 */
function applyDayAndTimeConstraints(date, allowedDays, startTime, endTime) {
  let result = new Date(date);

  // Apply day constraint: find nearest allowed day (forward only)
  if (allowedDays.length > 0) {
    let attempts = 0;
    while (!allowedDays.includes(result.getDay().toString()) && attempts < 7) {
      result.setDate(result.getDate() + 1);
      attempts++;
    }
    if (attempts >= 7) return null;
  }

  // Apply time constraint: set time within allowed window
  if (startTime && endTime) {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    if (endMinutes <= startMinutes) return null; // Invalid time range

    // Pick a deterministic time within the window (midpoint + small hash-based offset)
    // Use the date itself to create variation without randomness
    const dayOfYear = Math.floor(
      (result.getTime() - new Date(result.getFullYear(), 0, 0).getTime()) / (24 * 60 * 60 * 1000)
    );
    const range = endMinutes - startMinutes;
    // Use golden ratio to distribute times across the window deterministically
    const offset = ((dayOfYear * 0.618033988749895) % 1) * range;
    const targetMinutes = startMinutes + offset;

    result.setHours(Math.floor(targetMinutes / 60), Math.floor(targetMinutes % 60), 0, 0);
  }

  return result;
}

/**
 * Analyze schedule distribution quality
 */
function analyzeScheduleQuality(scheduledDates, existingDates = []) {
  if (scheduledDates.length < 1) return null;

  const DAY_MS = 24 * 60 * 60 * 1000;
  const result = {
    totalVideos: scheduledDates.length + existingDates.length,
    newVideos: scheduledDates.length,
    existingVideos: existingDates.length
  };

  // Calculate gaps within the new batch
  if (scheduledDates.length > 1) {
    const sorted = [...scheduledDates].sort((a, b) => a.getTime() - b.getTime());
    const batchGaps = [];
    for (let i = 1; i < sorted.length; i++) {
      const gapDays = (sorted[i].getTime() - sorted[i - 1].getTime()) / DAY_MS;
      batchGaps.push(gapDays);
    }

    const avgBatchGap = batchGaps.reduce((a, b) => a + b, 0) / batchGaps.length;
    result.batchGaps = {
      average: avgBatchGap.toFixed(2),
      min: Math.min(...batchGaps).toFixed(2),
      max: Math.max(...batchGaps).toFixed(2),
      all: batchGaps.map(g => g.toFixed(2))
    };
  }

  // Calculate gaps between new and existing videos
  if (existingDates.length > 0 && scheduledDates.length > 0) {
    const existingGaps = [];
    const allDates = [...existingDates, ...scheduledDates].sort(
      (a, b) => a.getTime() - b.getTime()
    );

    for (let i = 0; i < allDates.length - 1; i++) {
      const currentIsNew = scheduledDates.some(d => d.getTime() === allDates[i].getTime());
      const nextIsNew = scheduledDates.some(d => d.getTime() === allDates[i + 1].getTime());

      // Only count gaps between new and existing videos
      if (currentIsNew !== nextIsNew) {
        const gapDays = (allDates[i + 1].getTime() - allDates[i].getTime()) / DAY_MS;
        existingGaps.push(gapDays);
      }
    }

    if (existingGaps.length > 0) {
      const avgExistingGap = existingGaps.reduce((a, b) => a + b, 0) / existingGaps.length;
      result.existingGaps = {
        average: avgExistingGap.toFixed(2),
        min: Math.min(...existingGaps).toFixed(2),
        max: Math.max(...existingGaps).toFixed(2),
        all: existingGaps.map(g => g.toFixed(2))
      };
    }
  }

  return result;
}

/**
 * Fetch existing schedule from YouTube
 */
async function fetchExistingSchedule(forceRefresh = false) {
  const btn = document.getElementById('fetch-schedule-btn');
  btn.disabled = true;
  btn.textContent = forceRefresh ? 'Refreshing from API...' : 'Fetching...';

  try {
    const url = forceRefresh ? '/existing-schedule?refresh=true' : '/existing-schedule';
    const response = await fetch(url);
    const data = await response.json();

    existingSchedule = data.scheduledDates ? data.scheduledDates.map(d => new Date(d)) : [];

    const display = document.getElementById('schedule-display');
    if (existingSchedule.length > 0) {
      // Sort chronologically
      existingSchedule.sort((a, b) => a.getTime() - b.getTime());

      // Calculate gaps between existing videos
      const gaps = [];
      for (let i = 1; i < existingSchedule.length; i++) {
        const gapDays = (existingSchedule[i] - existingSchedule[i - 1]) / (1000 * 60 * 60 * 24);
        gaps.push(gapDays.toFixed(1));
      }

      display.innerHTML = `
        <div class="schedule-display">
          <h4>📅 You have ${data.count} video(s) scheduled</h4>
          <div class="schedule-list">
            ${existingSchedule.map((date, i) => `
              <div class="schedule-item">
                <span class="schedule-number">#${i + 1}</span>
                <span class="schedule-date">${date.toLocaleString()}</span>
                ${i > 0 ? `<span style="color: #666; font-size: 12px;">(+${gaps[i-1]} days)</span>` : ''}
              </div>
            `).join('')}
          </div>
          <div class="schedule-info">
            💡 Smart scheduling will maintain ${document.getElementById('existing-min-gap')?.value || 7} day minimum gap from these videos
            ${gaps.length > 0 ? `<br><strong>Current avg gap:</strong> ${(gaps.reduce((a, b) => parseFloat(a) + parseFloat(b), 0) / gaps.length).toFixed(1)} days` : ''}
          </div>
        </div>
      `;
    } else {
      display.innerHTML = `
        <div class="schedule-display">
          <p>✅ No scheduled videos found. You can schedule freely!</p>
        </div>
      `;
    }

    return existingSchedule;
  } catch (error) {
    alert(`❌ Failed to fetch schedule: ${error.message}`);
    return [];
  } finally {
    btn.disabled = false;
    btn.textContent = '🔄 Fetch Current Schedule';
  }
}

// Export functions for use in main.js
window.schedulingModule = {
  generateSmartSchedule,
  analyzeScheduleQuality,
  fetchExistingSchedule,
  getExistingSchedule: () => existingSchedule
};
