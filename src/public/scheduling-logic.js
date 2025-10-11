// scheduling-logic.js - All scheduling logic in frontend

// Store existing schedule globally
let existingSchedule = [];

/**
 * Smart scheduling algorithm that distributes videos naturally
 * @param {number} videoCount - Number of videos to schedule
 * @param {Date} startDate - Start of scheduling window
 * @param {Date} endDate - End of scheduling window
 * @param {Object} options - Scheduling options
 * @returns {Date[]} - Array of scheduled dates
 */
function generateSmartSchedule(videoCount, startDate, endDate, options = {}) {
  const {
    minGapDays = 2,
    maxGapDays = 4,
    randomnessFactor = 20, // percentage
    respectExisting = true,
    allowedDays = [], // empty = all days
    startTime = null,
    endTime = null
  } = options;

  // Convert to milliseconds
  const minGapMs = minGapDays * 24 * 60 * 60 * 1000;
  const maxGapMs = maxGapDays * 24 * 60 * 60 * 1000;
  const totalTimeWindow = endDate.getTime() - startDate.getTime();

  // Calculate ideal distribution
  const idealGap = totalTimeWindow / (videoCount + 1);

  // Ensure we can fit all videos with minimum gap
  if (videoCount * minGapMs > totalTimeWindow) {
    console.warn('Time window too small for minimum gaps. Extending end date.');
    endDate = new Date(startDate.getTime() + (videoCount * minGapMs * 1.5));
  }

  const scheduledDates = [];
  const allScheduledDates = respectExisting ? [...existingSchedule] : [];

  // Start from the beginning of the window
  let currentTime = new Date(startDate);

  for (let i = 0; i < videoCount; i++) {
    let attempts = 0;
    const maxAttempts = 200;
    let proposedTime = null;

    while (attempts < maxAttempts) {
      // Calculate base gap with some intelligence
      let baseGap;

      if (i === 0) {
        // First video: random position in early window
        baseGap = Math.random() * idealGap * 0.5;
      } else {
        // Subsequent videos: use target gap with randomness
        const targetGap = (minGapMs + maxGapMs) / 2;
        const randomVariation = targetGap * (randomnessFactor / 100);
        baseGap = targetGap + (Math.random() * 2 - 1) * randomVariation;

        // Ensure within bounds
        baseGap = Math.max(minGapMs, Math.min(maxGapMs, baseGap));
      }

      proposedTime = new Date(currentTime.getTime() + baseGap);

      // Adjust for day constraints
      if (allowedDays.length > 0) {
        let dayAttempts = 0;
        while (!allowedDays.includes(proposedTime.getDay().toString()) && dayAttempts < 7) {
          proposedTime.setDate(proposedTime.getDate() + 1);
          dayAttempts++;
        }
      }

      // Adjust for time constraints
      if (startTime && endTime) {
        const proposedHour = proposedTime.getHours();
        const proposedMinute = proposedTime.getMinutes();
        const [startHour, startMinute] = startTime.split(':').map(Number);
        const [endHour, endMinute] = endTime.split(':').map(Number);

        const proposedTimeMinutes = proposedHour * 60 + proposedMinute;
        const startTimeMinutes = startHour * 60 + startMinute;
        const endTimeMinutes = endHour * 60 + endMinute;

        if (proposedTimeMinutes < startTimeMinutes || proposedTimeMinutes > endTimeMinutes) {
          // Adjust to random time within allowed range
          const randomMinutes = startTimeMinutes + Math.random() * (endTimeMinutes - startTimeMinutes);
          proposedTime.setHours(Math.floor(randomMinutes / 60), Math.floor(randomMinutes % 60), 0, 0);
        }
      }

      // Check if within end date
      if (proposedTime > endDate) {
        console.warn(`Video ${i + 1}: Proposed time exceeds end date, adjusting...`);
        proposedTime = new Date(endDate.getTime() - (videoCount - i) * minGapMs);
      }

      // Check for conflicts with existing and newly scheduled
      let hasConflict = false;
      for (const existingDate of allScheduledDates) {
        const timeDiff = Math.abs(proposedTime.getTime() - existingDate.getTime());
        if (timeDiff < minGapMs) {
          hasConflict = true;
          // Move forward past the conflict
          proposedTime = new Date(existingDate.getTime() + minGapMs);
          break;
        }
      }

      if (!hasConflict) {
        // Check that we're maintaining good distribution with previous videos
        if (scheduledDates.length > 0) {
          const lastScheduled = scheduledDates[scheduledDates.length - 1];
          const gapFromLast = proposedTime.getTime() - lastScheduled.getTime();

          // If too close to last scheduled (shouldn't happen with conflict check, but safety)
          if (gapFromLast < minGapMs) {
            proposedTime = new Date(lastScheduled.getTime() + minGapMs);
            attempts++;
            continue;
          }
        }

        // Success! Add to schedule
        scheduledDates.push(new Date(proposedTime));
        allScheduledDates.push(new Date(proposedTime));
        currentTime = new Date(proposedTime);
        break;
      }

      attempts++;
    }

    if (attempts >= maxAttempts) {
      console.warn(`Could not find optimal time for video ${i + 1}, using best attempt`);
      if (proposedTime) {
        scheduledDates.push(proposedTime);
        allScheduledDates.push(proposedTime);
        currentTime = proposedTime;
      }
    }
  }

  // Sort to ensure chronological order
  scheduledDates.sort((a, b) => a.getTime() - b.getTime());

  return scheduledDates;
}

/**
 * Analyze schedule distribution quality
 */
function analyzeScheduleQuality(scheduledDates, existingDates = []) {
  if (scheduledDates.length < 2) return null;

  const allDates = [...existingDates, ...scheduledDates].sort((a, b) => a - b);
  const gaps = [];

  for (let i = 1; i < allDates.length; i++) {
    const gapDays = (allDates[i] - allDates[i - 1]) / (1000 * 60 * 60 * 24);
    gaps.push(gapDays);
  }

  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const minGap = Math.min(...gaps);
  const maxGap = Math.max(...gaps);
  const stdDev = Math.sqrt(gaps.reduce((sq, n) => sq + Math.pow(n - avgGap, 2), 0) / gaps.length);

  return {
    averageGap: avgGap.toFixed(2),
    minGap: minGap.toFixed(2),
    maxGap: maxGap.toFixed(2),
    standardDeviation: stdDev.toFixed(2),
    totalVideos: allDates.length,
    newVideos: scheduledDates.length,
    gaps: gaps.map(g => g.toFixed(2))
  };
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
            💡 Smart scheduling will automatically avoid conflicts and maintain optimal distribution
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
