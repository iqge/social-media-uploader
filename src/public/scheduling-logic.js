// scheduling-logic.js - All scheduling logic in frontend

// Store existing schedule globally
let existingSchedule = [];

/**
 * Smart scheduling algorithm with separate gap settings
 * @param {number} videoCount - Number of videos to schedule
 * @param {Date} startDate - Start of scheduling window
 * @param {Date} endDate - End of scheduling window
 * @param {Object} options - Scheduling options
 * @returns {Date[]} - Array of scheduled dates
 */
function generateSmartSchedule(videoCount, startDate, endDate, options = {}) {
  const {
    batchMinGap = 30,        // Min gap between videos in current batch (default 30 days)
    batchMaxGap = 45,        // Max gap between videos in current batch (default 45 days)
    existingMinGap = 7,      // Min gap from already scheduled videos (default 7 days)
    existingMaxGap = 14,     // Max gap from already scheduled videos (default 14 days)
    randomnessFactor = 20,   // percentage
    respectExisting = true,
    allowedDays = [],        // empty = all days
    startTime = null,
    endTime = null
  } = options;

  // Ensure we're working with Date objects and not in the past
  const now = new Date();
  const actualStartDate = new Date(Math.max(startDate.getTime(), now.getTime()));
  const actualEndDate = new Date(endDate);

  console.log('Scheduling with settings:', {
    batchMinGap,
    batchMaxGap,
    existingMinGap,
    existingMaxGap,
    videoCount,
    existingScheduleCount: existingSchedule.length,
    startDate: actualStartDate.toISOString(),
    endDate: actualEndDate.toISOString(),
    allowedDays,
    startTime,
    endTime
  });

  // Validate date range
  if (actualEndDate <= actualStartDate) {
    alert('Error: End date must be after start date');
    return [];
  }

  // Convert to milliseconds
  const batchMinGapMs = batchMinGap * 24 * 60 * 60 * 1000;
  const batchMaxGapMs = batchMaxGap * 24 * 60 * 60 * 1000;
  const existingMinGapMs = existingMinGap * 24 * 60 * 60 * 1000;
  const totalTimeWindow = actualEndDate.getTime() - actualStartDate.getTime();

  // Check if we can fit all videos
  const requiredSpace = videoCount * batchMinGapMs;
  if (requiredSpace > totalTimeWindow) {
    alert(`Warning: Time window (${(totalTimeWindow / (24 * 60 * 60 * 1000)).toFixed(1)} days) may be too small for ${videoCount} videos with ${batchMinGap} day minimum gap. Videos will be packed as tightly as possible.`);
  }

  const scheduledDates = [];
  const allScheduledDates = respectExisting ? [...existingSchedule] : [];

  // Helper function to apply time constraints
  const applyTimeConstraints = (date) => {
    const newDate = new Date(date);

    if (startTime && endTime) {
      const [startHour, startMinute] = startTime.split(':').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);

      const startTimeMinutes = startHour * 60 + startMinute;
      const endTimeMinutes = endHour * 60 + endMinute;

      // Generate random time within allowed range
      const randomMinutes = startTimeMinutes + Math.random() * (endTimeMinutes - startTimeMinutes);
      newDate.setHours(Math.floor(randomMinutes / 60), Math.floor(randomMinutes % 60), 0, 0);
    }

    return newDate;
  };

  // Helper function to apply day constraints
  const adjustToAllowedDay = (date) => {
    if (allowedDays.length === 0) return new Date(date);

    const newDate = new Date(date);
    let attempts = 0;

    while (!allowedDays.includes(newDate.getDay().toString()) && attempts < 14) {
      newDate.setDate(newDate.getDate() + 1);
      attempts++;
    }

    // If we can't find allowed day within 2 weeks, just return original
    if (attempts >= 14) {
      console.warn('Could not find allowed day within 2 weeks, using original date');
      return new Date(date);
    }

    return newDate;
  };

  // Helper function to check if date is valid (not in past, within range)
  const isValidDate = (date) => {
    return date >= now && date >= actualStartDate && date <= actualEndDate;
  };

  // Strategy: Distribute videos evenly across the time window
  const idealGap = totalTimeWindow / (videoCount + 1);

  for (let i = 0; i < videoCount; i++) {
    let attempts = 0;
    const maxAttempts = 500;
    let proposedTime = null;
    let bestProposedTime = null;
    let bestScore = -Infinity;

    while (attempts < maxAttempts) {
      // Calculate target position in timeline
      let targetGap;

      if (i === 0) {
        // First video: place near beginning
        targetGap = Math.random() * Math.min(idealGap * 0.5, batchMaxGapMs);
        proposedTime = new Date(actualStartDate.getTime() + targetGap);
      } else {
        // Subsequent videos: maintain good spacing from last scheduled
        const lastScheduled = scheduledDates[scheduledDates.length - 1];
        const remainingVideos = videoCount - i;
        const remainingTime = actualEndDate.getTime() - lastScheduled.getTime();

        // Calculate target gap with randomness
        let baseGap = (batchMinGapMs + batchMaxGapMs) / 2;

        // Adjust based on remaining space
        const averageRemainingGap = remainingTime / (remainingVideos + 1);
        if (averageRemainingGap < baseGap) {
          baseGap = Math.max(batchMinGapMs, averageRemainingGap);
        }

        // Add randomness
        const randomVariation = baseGap * (randomnessFactor / 100);
        targetGap = baseGap + (Math.random() * 2 - 1) * randomVariation;

        // Clamp to min/max
        targetGap = Math.max(batchMinGapMs, Math.min(batchMaxGapMs, targetGap));

        proposedTime = new Date(lastScheduled.getTime() + targetGap);
      }

      // Apply day constraints
      proposedTime = adjustToAllowedDay(proposedTime);

      // Apply time constraints
      proposedTime = applyTimeConstraints(proposedTime);

      // Ensure within bounds and not in past
      if (!isValidDate(proposedTime)) {
        // Try to salvage by placing at start if before range
        if (proposedTime < actualStartDate) {
          proposedTime = new Date(actualStartDate);
          proposedTime = adjustToAllowedDay(proposedTime);
          proposedTime = applyTimeConstraints(proposedTime);
        }
        // If after end date, place earlier
        else if (proposedTime > actualEndDate) {
          const remainingVideos = videoCount - i;
          proposedTime = new Date(actualEndDate.getTime() - remainingVideos * batchMinGapMs);
          proposedTime = adjustToAllowedDay(proposedTime);
          proposedTime = applyTimeConstraints(proposedTime);
        }

        // Final validation
        if (!isValidDate(proposedTime)) {
          attempts++;
          continue;
        }
      }

      // Check conflicts with existing scheduled videos
      let hasExistingConflict = false;
      let minDistanceFromExisting = Infinity;

      if (respectExisting && existingSchedule.length > 0) {
        for (const existingDate of existingSchedule) {
          const timeDiff = Math.abs(proposedTime.getTime() - existingDate.getTime());
          minDistanceFromExisting = Math.min(minDistanceFromExisting, timeDiff);

          if (timeDiff < existingMinGapMs) {
            hasExistingConflict = true;
            break;
          }
        }
      }

      // Check conflicts with newly scheduled videos in this batch
      let hasBatchConflict = false;
      let minDistanceFromBatch = Infinity;

      for (const newDate of scheduledDates) {
        const timeDiff = Math.abs(proposedTime.getTime() - newDate.getTime());
        minDistanceFromBatch = Math.min(minDistanceFromBatch, timeDiff);

        if (timeDiff < batchMinGapMs) {
          hasBatchConflict = true;
          break;
        }
      }

      if (!hasExistingConflict && !hasBatchConflict) {
        // Calculate score for this slot
        let score = 0;

        // Prefer larger gaps from batch videos
        if (minDistanceFromBatch !== Infinity) {
          score += (minDistanceFromBatch / batchMaxGapMs) * 100;
        } else {
          score += 100; // First video gets good score
        }

        // Prefer adequate gap from existing videos
        if (respectExisting && minDistanceFromExisting !== Infinity) {
          score += Math.min(minDistanceFromExisting / existingMinGapMs, 2) * 50;
        } else {
          score += 50; // No existing videos
        }

        // Prefer dates closer to target ideal gap
        if (i > 0) {
          const lastScheduled = scheduledDates[scheduledDates.length - 1];
          const actualGap = proposedTime.getTime() - lastScheduled.getTime();
          const gapDiff = Math.abs(actualGap - idealGap);
          score += Math.max(0, 50 - (gapDiff / idealGap) * 50);
        }

        // Track best option
        if (score > bestScore) {
          bestScore = score;
          bestProposedTime = new Date(proposedTime);
        }

        // If score is very good, accept immediately
        if (score > 180 || attempts > maxAttempts * 0.6) {
          scheduledDates.push(new Date(proposedTime));
          allScheduledDates.push(new Date(proposedTime));
          console.log(`Video ${i + 1} scheduled: ${proposedTime.toISOString()} (score: ${score.toFixed(2)})`);
          break;
        }
      }

      attempts++;
    }

    // Use best attempt if we exhausted all attempts
    if (attempts >= maxAttempts) {
      if (bestProposedTime && isValidDate(bestProposedTime)) {
        console.warn(`Using best attempt for video ${i + 1} (score: ${bestScore.toFixed(2)})`);
        scheduledDates.push(bestProposedTime);
        allScheduledDates.push(bestProposedTime);
      } else {
        console.error(`Could not find valid slot for video ${i + 1}`);
        alert(`Warning: Could not find valid time slot for video ${i + 1}. Try expanding your date range or reducing minimum gaps.`);
      }
    }
  }

  // Final sort to ensure chronological order
  scheduledDates.sort((a, b) => a.getTime() - b.getTime());

  // Validate all dates are in future and within range
  const invalidDates = scheduledDates.filter(d => !isValidDate(d));
  if (invalidDates.length > 0) {
    console.error('Invalid dates found:', invalidDates);
    alert(`Error: Some dates are invalid. Please check your settings.`);
  }

  return scheduledDates;
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
