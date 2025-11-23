// scheduling-logic.js - Optimized scheduling algorithm

// Store existing schedule globally
let existingSchedule = [];

/**
 * Optimized scheduling that prioritizes batch distribution above all else
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
    existingMaxGap = 14,
    randomnessFactor = 20,
    respectExisting = true,
    allowedDays = [],
    startTime = null,
    endTime = null
  } = options;

  // Validate inputs
  if (videoCount <= 0) return [];

  const now = new Date();
  const actualStartDate = new Date(Math.max(startDate.getTime(), now.getTime()));
  const actualEndDate = new Date(endDate);

  if (actualEndDate <= actualStartDate) {
    alert('Error: End date must be after start date');
    return [];
  }

  console.log('Maximum distribution scheduling with settings:', {
    batchMinGap,
    batchMaxGap,
    videoCount,
    existingScheduleCount: existingSchedule.length,
    startDate: actualStartDate.toISOString(),
    endDate: actualEndDate.toISOString()
  });

  // Convert to milliseconds
  const batchMinGapMs = batchMinGap * 24 * 60 * 60 * 1000;
  const batchMaxGapMs = batchMaxGap * 24 * 60 * 60 * 1000;
  const totalTimeWindow = actualEndDate.getTime() - actualStartDate.getTime();

  // Calculate ideal spread - this is our primary goal
  const idealGap = totalTimeWindow / (videoCount + 1);

  // For maximum spread, we want to place videos at ideal distribution points
  const idealPoints = [];
  for (let i = 0; i < videoCount; i++) {
    const position = (i + 1) / (videoCount + 1);
    idealPoints.push(actualStartDate.getTime() + totalTimeWindow * position);
  }

  const scheduledDates = [];

  for (let i = 0; i < videoCount; i++) {
    const idealTime = idealPoints[i];
    let bestDate = null;
    let bestScore = -Infinity;

    // Try to find the best position around the ideal point
    for (let attempt = 0; attempt < 100; attempt++) {
      let candidateTime;

      if (attempt === 0) {
        // First attempt: exact ideal position
        candidateTime = idealTime;
      } else {
        // Subsequent attempts: search around ideal point with increasing radius
        const searchRadius = Math.min(totalTimeWindow * 0.4, attempt * totalTimeWindow * 0.01);
        candidateTime = idealTime + (Math.random() * 2 - 1) * searchRadius;
      }

      const candidate = new Date(candidateTime);

      // Apply day constraints if specified
      const dayAdjusted = applyDayConstraints(candidate, allowedDays);
      if (!dayAdjusted) continue;

      // Apply time constraints if specified
      const timeAdjusted = applyTimeConstraints(dayAdjusted, startTime, endTime);
      if (!timeAdjusted) continue;

      // Must be in future and within range
      if (timeAdjusted < now || timeAdjusted > actualEndDate) continue;

      // Calculate score - prioritize spread and batch gaps over existing conflicts
      const score = calculateSpreadScore(
        timeAdjusted,
        scheduledDates,
        idealTime,
        batchMinGapMs,
        batchMaxGapMs,
        respectExisting
      );

      if (score > bestScore) {
        bestScore = score;
        bestDate = timeAdjusted;
      }

      // Early exit if we found a very good candidate
      if (score > 90 && attempt > 10) break;
    }

    if (bestDate) {
      scheduledDates.push(bestDate);
      console.log(`Video ${i + 1} scheduled at ${bestDate.toISOString()} (score: ${bestScore.toFixed(2)})`);
    } else {
      // Fallback: place at calculated position even if constraints can't be fully met
      const fallbackDate = new Date(idealTime);
      const constrainedDate = applyAllConstraints(fallbackDate, allowedDays, startTime, endTime);
      if (constrainedDate && constrainedDate >= now && constrainedDate <= actualEndDate) {
        scheduledDates.push(constrainedDate);
        console.warn(`Used fallback for video ${i + 1}`);
      } else {
        // Last resort: linear placement with min gap
        const lastDate = scheduledDates.length > 0 ?
          scheduledDates[scheduledDates.length - 1] : actualStartDate;
        const linearDate = new Date(lastDate.getTime() + batchMinGapMs);
        scheduledDates.push(linearDate);
        console.error(`Used linear fallback for video ${i + 1}`);
      }
    }
  }

  // Final optimization: try to improve spread by adjusting dates
  const optimizedDates = optimizeSpread(scheduledDates, actualStartDate, actualEndDate, batchMinGapMs, batchMaxGapMs);

  // Sort chronologically
  optimizedDates.sort((a, b) => a.getTime() - b.getTime());

  console.log('Final schedule analysis:', analyzeBatchSpread(optimizedDates));

  return optimizedDates;
}

/**
 * Calculate score prioritizing spread and batch distribution
 */
function calculateSpreadScore(candidate, scheduledDates, idealTime, batchMinGapMs, batchMaxGapMs, respectExisting) {
  let score = 0;
  const candidateTime = candidate.getTime();

  // PRIMARY: Proximity to ideal distribution point (40% weight)
  const timeDiff = Math.abs(candidateTime - idealTime);
  const maxTimeDiff = batchMaxGapMs * 2;
  const proximityScore = 40 * (1 - Math.min(timeDiff / maxTimeDiff, 1));
  score += proximityScore;

  // SECONDARY: Gap from other batch videos (30% weight)
  let minBatchGap = Infinity;
  let batchGapScore = 0;

  if (scheduledDates.length > 0) {
    for (const scheduledDate of scheduledDates) {
      const gap = Math.abs(candidateTime - scheduledDate.getTime());
      minBatchGap = Math.min(minBatchGap, gap);
    }

    // Prefer gaps close to ideal range
    if (minBatchGap >= batchMinGapMs && minBatchGap <= batchMaxGapMs) {
      batchGapScore = 30; // Perfect
    } else if (minBatchGap < batchMinGapMs) {
      // Allow some congestion within batch but penalize
      batchGapScore = 15 * (minBatchGap / batchMinGapMs);
    } else {
      // Too far apart is better than too close
      batchGapScore = 20;
    }
  } else {
    batchGapScore = 30; // First video
  }

  score += batchGapScore;

  // TERTIARY: Gap from existing videos (20% weight) - but we allow congestion
  let existingGapScore = 20; // Default full score

  if (respectExisting && existingSchedule.length > 0) {
    let minExistingGap = Infinity;
    for (const existingDate of existingSchedule) {
      const gap = Math.abs(candidateTime - existingDate.getTime());
      minExistingGap = Math.min(minExistingGap, gap);
    }

    // We allow congestion with existing videos, but prefer reasonable gaps
    if (minExistingGap < batchMinGapMs) {
      // Congestion allowed but penalized slightly
      existingGapScore = 15;
    }
    // If gap is good, we keep the full 20 points
  }

  score += existingGapScore;

  // SMALL BONUS: Avoid exact same times (10% weight)
  let uniquenessBonus = 10;
  for (const existingDate of existingSchedule) {
    if (candidateTime === existingDate.getTime()) {
      uniquenessBonus = 0;
      break;
    }
  }
  for (const scheduledDate of scheduledDates) {
    if (candidateTime === scheduledDate.getTime()) {
      uniquenessBonus = 0;
      break;
    }
  }

  score += uniquenessBonus;

  return score;
}

/**
 * Optimize the spread of scheduled dates
 */
function optimizeSpread(scheduledDates, startDate, endDate, batchMinGapMs, batchMaxGapMs) {
  if (scheduledDates.length <= 1) return scheduledDates;

  const optimized = [...scheduledDates].sort((a, b) => a.getTime() - b.getTime());
  const totalTime = endDate.getTime() - startDate.getTime();
  const idealGap = totalTime / (optimized.length + 1);

  let improved = true;
  let iterations = 0;

  // Iteratively improve spread
  while (improved && iterations < 50) {
    improved = false;

    for (let i = 0; i < optimized.length; i++) {
      const currentTime = optimized[i].getTime();
      const idealTime = startDate.getTime() + (i + 1) * idealGap;

      // If we're not at ideal position, try to move closer
      if (Math.abs(currentTime - idealTime) > idealGap * 0.1) {
        const direction = idealTime > currentTime ? 1 : -1;
        const moveAmount = Math.min(
          Math.abs(idealTime - currentTime) * 0.5,
          batchMaxGapMs * 0.1
        );

        const newTime = currentTime + direction * moveAmount;
        const newDate = new Date(newTime);

        // Check if move improves overall spread without violating major constraints
        if (isMoveBeneficial(optimized, i, newDate, batchMinGapMs)) {
          optimized[i] = newDate;
          improved = true;
        }
      }
    }

    iterations++;
  }

  return optimized;
}

/**
 * Check if moving a date improves overall spread
 */
function isMoveBeneficial(dates, index, newDate, batchMinGapMs) {
  const newTime = newDate.getTime();

  // Check gap with previous date
  if (index > 0) {
    const prevGap = newTime - dates[index - 1].getTime();
    if (prevGap < batchMinGapMs * 0.8) return false; // Don't create severe congestion
  }

  // Check gap with next date
  if (index < dates.length - 1) {
    const nextGap = dates[index + 1].getTime() - newTime;
    if (nextGap < batchMinGapMs * 0.8) return false;
  }

  return true;
}

/**
 * Analyze batch spread quality
 */
function analyzeBatchSpread(scheduledDates) {
  if (scheduledDates.length <= 1) {
    return { averageGap: 0, minGap: 0, maxGap: 0, spreadEfficiency: 1 };
  }

  const gaps = [];
  for (let i = 1; i < scheduledDates.length; i++) {
    const gap = (scheduledDates[i] - scheduledDates[i - 1]) / (24 * 60 * 60 * 1000);
    gaps.push(gap);
  }

  const averageGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const minGap = Math.min(...gaps);
  const maxGap = Math.max(...gaps);

  // Calculate how well we're using the available time
  const totalDuration = scheduledDates[scheduledDates.length - 1] - scheduledDates[0];
  const optimalDuration = averageGap * (scheduledDates.length - 1);
  const spreadEfficiency = totalDuration / optimalDuration;

  return {
    averageGap: averageGap.toFixed(1),
    minGap: minGap.toFixed(1),
    maxGap: maxGap.toFixed(1),
    spreadEfficiency: spreadEfficiency.toFixed(2),
    gaps: gaps.map(g => g.toFixed(1))
  };
}

/**
 * Helper function to apply day constraints
 */
function applyDayConstraints(date, allowedDays) {
  if (allowedDays.length === 0) return new Date(date);

  const result = new Date(date);
  let attempts = 0;

  while (!allowedDays.includes(result.getDay().toString()) && attempts < 7) {
    result.setDate(result.getDate() + 1);
    attempts++;
  }

  return attempts < 7 ? result : null;
}

/**
 * Helper function to apply time constraints
 */
function applyTimeConstraints(date, startTime, endTime) {
  if (!startTime || !endTime) return new Date(date);

  const result = new Date(date);
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);

  const startTimeMinutes = startHour * 60 + startMinute;
  const endTimeMinutes = endHour * 60 + endMinute;

  // Random time within allowed window
  const randomMinutes = startTimeMinutes + Math.random() * (endTimeMinutes - startTimeMinutes);
  result.setHours(Math.floor(randomMinutes / 60), Math.floor(randomMinutes % 60), 0, 0);

  return result;
}

/**
 * Apply all constraints to a date
 */
function applyAllConstraints(date, allowedDays, startTime, endTime) {
  const dayAdjusted = applyDayConstraints(date, allowedDays);
  if (!dayAdjusted) return null;

  return applyTimeConstraints(dayAdjusted, startTime, endTime);
}


/**
 * Phase 1: Find all available time slots respecting constraints
 */
function findAvailableSlots(videoCount, startDate, endDate, batchMinGapMs, existingMinGapMs, respectExisting, allowedDays, startTime, endTime) {
  const slots = [];
  const now = new Date();
  const totalDuration = endDate.getTime() - startDate.getTime();

  // Create a grid of potential slots (more granular for better distribution)
  const slotCount = Math.min(200, videoCount * 10); // Adaptive granularity
  const baseGap = totalDuration / slotCount;

  for (let i = 0; i < slotCount; i++) {
    const baseTime = startDate.getTime() + i * baseGap;
    const candidate = new Date(baseTime);

    // Apply day constraints
    const dayAdjusted = applyDayConstraints(candidate, allowedDays);
    if (!dayAdjusted) continue;

    // Apply time constraints
    const timeAdjusted = applyTimeConstraints(dayAdjusted, startTime, endTime);
    if (!timeAdjusted) continue;

    // Check if in past
    if (timeAdjusted < now) continue;

    // Check existing schedule conflicts
    if (respectExisting && hasExistingConflict(timeAdjusted, existingMinGapMs)) {
      continue;
    }

    slots.push({
      time: timeAdjusted.getTime(),
      date: timeAdjusted,
      score: calculateSlotScore(timeAdjusted, startDate, endDate, i, slotCount)
    });
  }

  return slots.sort((a, b) => a.time - b.time);
}

/**
 * Phase 2: Optimal distribution across available slots
 */
function distributeVideosOptimally(availableSlots, videoCount, batchMinGapMs, batchMaxGapMs) {
  if (videoCount === 1) {
    // For single video, pick the slot closest to the middle
    const middleSlot = Math.floor(availableSlots.length / 2);
    return [availableSlots[middleSlot].date];
  }

  // Use dynamic programming to find optimal distribution
  const n = availableSlots.length;
  const k = videoCount;

  // DP table: dp[i][j] = best score for j videos using first i slots
  const dp = Array(n + 1).fill(null).map(() =>
    Array(k + 1).fill(-Infinity)
  );
  const choice = Array(n + 1).fill(null).map(() =>
    Array(k + 1).fill(null)
  );

  // Base case: 0 videos
  for (let i = 0; i <= n; i++) {
    dp[i][0] = 0;
  }

  // Fill DP table
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= Math.min(k, i); j++) {
      // Option 1: Don't take current slot
      if (dp[i-1][j] > dp[i][j]) {
        dp[i][j] = dp[i-1][j];
        choice[i][j] = { take: false, prev: i-1 };
      }

      // Option 2: Take current slot
      for (let prev = 0; prev < i; prev++) {
        if (prev === 0 || j === 1) {
          // First video in sequence
          const score = availableSlots[i-1].score + (prev === 0 ? 0 : dp[prev][j-1]);
          if (score > dp[i][j]) {
            dp[i][j] = score;
            choice[i][j] = { take: true, prev };
          }
        } else {
          // Check gap constraints with previous selection
          const gap = availableSlots[i-1].time - availableSlots[prev-1].time;
          if (gap >= batchMinGapMs && gap <= batchMaxGapMs) {
            const spacingScore = calculateSpacingScore(gap, batchMinGapMs, batchMaxGapMs);
            const score = availableSlots[i-1].score + spacingScore + dp[prev][j-1];
            if (score > dp[i][j]) {
              dp[i][j] = score;
              choice[i][j] = { take: true, prev };
            }
          }
        }
      }
    }
  }

  // Backtrack to find optimal selection
  const selected = [];
  let i = n, j = k;

  while (j > 0 && i > 0) {
    if (choice[i][j] && choice[i][j].take) {
      selected.push(availableSlots[i-1].date);
      i = choice[i][j].prev;
      j--;
    } else {
      i--;
    }
  }

  return selected.reverse();
}

/**
 * Phase 3: Fallback scheduling that allows some congestion
 */
function scheduleWithCongestion(videoCount, startDate, endDate, batchMinGapMs, batchMaxGapMs, existingMinGapMs, respectExisting, allowedDays, startTime, endTime) {
  const scheduledDates = [];
  const now = new Date();
  const totalTime = endDate.getTime() - startDate.getTime();

  // Calculate ideal distribution points
  const idealPoints = [];
  for (let i = 0; i < videoCount; i++) {
    const idealPosition = (i + 1) / (videoCount + 1);
    idealPoints.push(startDate.getTime() + totalTime * idealPosition);
  }

  for (let i = 0; i < videoCount; i++) {
    let bestDate = null;
    let bestScore = -Infinity;
    const idealTime = idealPoints[i];

    // Try multiple candidate positions around ideal point
    for (let attempt = 0; attempt < 50; attempt++) {
      let candidateTime;

      if (attempt === 0) {
        candidateTime = idealTime;
      } else {
        // Search in expanding radius around ideal point
        const searchRadius = Math.min(totalTime * 0.3, attempt * totalTime * 0.02);
        candidateTime = idealTime + (Math.random() * 2 - 1) * searchRadius;
      }

      const candidate = new Date(candidateTime);

      // Apply constraints
      const dayAdjusted = applyDayConstraints(candidate, allowedDays);
      if (!dayAdjusted) continue;

      const timeAdjusted = applyTimeConstraints(dayAdjusted, startTime, endTime);
      if (!timeAdjusted || timeAdjusted < now || timeAdjusted > endDate) continue;

      // Calculate score for this candidate
      const score = calculateCandidateScore(
        timeAdjusted,
        scheduledDates,
        idealTime,
        batchMinGapMs,
        batchMaxGapMs,
        existingMinGapMs,
        respectExisting
      );

      if (score > bestScore) {
        bestScore = score;
        bestDate = timeAdjusted;
      }
    }

    if (bestDate) {
      scheduledDates.push(bestDate);
    } else {
      // Last resort: place at end with minimum gap
      const lastDate = scheduledDates.length > 0 ?
        scheduledDates[scheduledDates.length - 1] : startDate;
      const fallbackDate = new Date(lastDate.getTime() + batchMinGapMs);
      const constrainedDate = applyAllConstraints(fallbackDate, allowedDays, startTime, endTime);
      if (constrainedDate && constrainedDate <= endDate) {
        scheduledDates.push(constrainedDate);
      }
    }
  }

  return scheduledDates;
}

/**
 * Helper function to apply day constraints
 */
function applyDayConstraints(date, allowedDays) {
  if (allowedDays.length === 0) return new Date(date);

  const result = new Date(date);
  let attempts = 0;

  while (!allowedDays.includes(result.getDay().toString()) && attempts < 7) {
    result.setDate(result.getDate() + 1);
    attempts++;
  }

  return attempts < 7 ? result : null;
}

/**
 * Helper function to apply time constraints
 */
function applyTimeConstraints(date, startTime, endTime) {
  if (!startTime || !endTime) return new Date(date);

  const result = new Date(date);
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);

  const startTimeMinutes = startHour * 60 + startMinute;
  const endTimeMinutes = endHour * 60 + endMinute;

  // Random time within allowed window
  const randomMinutes = startTimeMinutes + Math.random() * (endTimeMinutes - startTimeMinutes);
  result.setHours(Math.floor(randomMinutes / 60), Math.floor(randomMinutes % 60), 0, 0);

  return result;
}

/**
 * Apply all constraints to a date
 */
function applyAllConstraints(date, allowedDays, startTime, endTime) {
  const dayAdjusted = applyDayConstraints(date, allowedDays);
  if (!dayAdjusted) return null;

  return applyTimeConstraints(dayAdjusted, startTime, endTime);
}

/**
 * Check for conflicts with existing schedule
 */
function hasExistingConflict(date, existingMinGapMs) {
  return existingSchedule.some(existingDate => {
    const timeDiff = Math.abs(date.getTime() - existingDate.getTime());
    return timeDiff < existingMinGapMs;
  });
}

/**
 * Calculate slot score for distribution
 */
function calculateSlotScore(date, startDate, endDate, index, totalSlots) {
  const time = date.getTime();
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();

  // Prefer slots in the middle of the time window
  const position = (time - startTime) / (endTime - startTime);
  const centerScore = 1 - Math.abs(position - 0.5) * 2;

  // Prefer evenly distributed slots
  const distributionScore = 1 - Math.abs(index / totalSlots - position);

  return centerScore + distributionScore;
}

/**
 * Calculate spacing score between videos
 */
function calculateSpacingScore(gap, minGap, maxGap) {
  const idealGap = (minGap + maxGap) / 2;
  const gapDiff = Math.abs(gap - idealGap);
  const maxDiff = (maxGap - minGap) / 2;

  return 1 - (gapDiff / maxDiff);
}

/**
 * Calculate candidate score for fallback scheduling
 */
function calculateCandidateScore(candidate, scheduledDates, idealTime, batchMinGapMs, batchMaxGapMs, existingMinGapMs, respectExisting) {
  let score = 0;

  // Proximity to ideal distribution point (50%)
  const timeDiff = Math.abs(candidate.getTime() - idealTime);
  const maxTimeDiff = batchMaxGapMs * 3;
  score += 50 * (1 - Math.min(timeDiff / maxTimeDiff, 1));

  // Gap from existing videos (30%)
  if (respectExisting) {
    let minExistingGap = Infinity;
    for (const existingDate of existingSchedule) {
      const gap = Math.abs(candidate.getTime() - existingDate.getTime());
      minExistingGap = Math.min(minExistingGap, gap);
    }

    if (minExistingGap < Infinity) {
      const existingGapScore = Math.min(minExistingGap / existingMinGapMs, 2);
      score += 30 * existingGapScore;
    } else {
      score += 30;
    }
  }

  // Gap from other scheduled videos (20%)
  if (scheduledDates.length > 0) {
    let minBatchGap = Infinity;
    for (const scheduledDate of scheduledDates) {
      const gap = Math.abs(candidate.getTime() - scheduledDate.getTime());
      minBatchGap = Math.min(minBatchGap, gap);
    }

    const batchGapScore = minBatchGap >= batchMinGapMs ?
      1 : Math.max(0, minBatchGap / batchMinGapMs);
    score += 20 * batchGapScore;
  } else {
    score += 20;
  }

  return score;
}


/**
 * Analyze schedule distribution quality
 */
function analyzeScheduleQuality(scheduledDates, existingDates = []) {
  if (scheduledDates.length < 1) return null;

  const batchGaps = [];
  const existingGaps = [];

  // Calculate gaps within the new batch
  for (let i = 1; i < scheduledDates.length; i++) {
    const gapDays = (scheduledDates[i] - scheduledDates[i - 1]) / (1000 * 60 * 60 * 24);
    batchGaps.push(gapDays);
  }

  // Calculate gaps from existing schedule
  if (existingDates.length > 0) {
    const allDates = [...existingDates, ...scheduledDates].sort((a, b) => a - b);

    for (let i = 0; i < allDates.length - 1; i++) {
      const currentIsNew = scheduledDates.some(d => d.getTime() === allDates[i].getTime());
      const nextIsNew = scheduledDates.some(d => d.getTime() === allDates[i + 1].getTime());

      // Only count gaps between new and existing videos
      if (currentIsNew !== nextIsNew) {
        const gapDays = (allDates[i + 1] - allDates[i]) / (1000 * 60 * 60 * 24);
        existingGaps.push(gapDays);
      }
    }
  }

  const result = {
    totalVideos: scheduledDates.length + existingDates.length,
    newVideos: scheduledDates.length,
    existingVideos: existingDates.length
  };

  // Batch gaps (between new videos)
  if (batchGaps.length > 0) {
    const avgBatchGap = batchGaps.reduce((a, b) => a + b, 0) / batchGaps.length;
    result.batchGaps = {
      average: avgBatchGap.toFixed(2),
      min: Math.min(...batchGaps).toFixed(2),
      max: Math.max(...batchGaps).toFixed(2),
      all: batchGaps.map(g => g.toFixed(2))
    };
  }

  // Gaps from existing schedule
  if (existingGaps.length > 0) {
    const avgExistingGap = existingGaps.reduce((a, b) => a + b, 0) / existingGaps.length;
    result.existingGaps = {
      average: avgExistingGap.toFixed(2),
      min: Math.min(...existingGaps).toFixed(2),
      max: Math.max(...existingGaps).toFixed(2),
      all: existingGaps.map(g => g.toFixed(2))
    };
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
