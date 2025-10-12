// main.js - Main application logic

// Set minimum date for datetime inputs to now
const now = new Date();
now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
document.getElementById('bulk-start-date').min = now.toISOString().slice(0, 16);
document.getElementById('bulk-end-date').min = now.toISOString().slice(0, 16);

// Smart schedule toggle
document.getElementById('enable-smart-schedule').addEventListener('change', function() {
  document.getElementById('smart-schedule-options').style.display = this.checked ? 'block' : 'none';
});

// Validate gap settings - Existing gaps
document.getElementById('existing-min-gap').addEventListener('change', function() {
  const minGap = parseInt(this.value);
  const maxGapInput = document.getElementById('existing-max-gap');
  const maxGap = parseInt(maxGapInput.value);

  if (maxGap <= minGap) {
    maxGapInput.value = minGap + 1;
  }
});

document.getElementById('existing-max-gap').addEventListener('change', function() {
  const maxGap = parseInt(this.value);
  const minGapInput = document.getElementById('existing-min-gap');
  const minGap = parseInt(minGapInput.value);

  if (maxGap <= minGap) {
    this.value = minGap + 1;
  }
});

// Validate gap settings - Batch gaps
document.getElementById('batch-min-gap').addEventListener('change', function() {
  const minGap = parseInt(this.value);
  const maxGapInput = document.getElementById('batch-max-gap');
  const maxGap = parseInt(maxGapInput.value);

  if (maxGap <= minGap) {
    maxGapInput.value = minGap + 1;
  }
});

document.getElementById('batch-max-gap').addEventListener('change', function() {
  const maxGap = parseInt(this.value);
  const minGapInput = document.getElementById('batch-min-gap');
  const minGap = parseInt(minGapInput.value);

  if (maxGap <= minGap) {
    this.value = minGap + 1;
  }
});

// Fetch existing schedule
document.getElementById('fetch-schedule-btn').addEventListener('click', () => {
  window.schedulingModule.fetchExistingSchedule();
});

// Title counter
document.getElementById('bulk-title').addEventListener('input', function() {
  const titles = this.value.split('\n').filter(t => t.trim().length > 0);
  const counter = document.getElementById('title-counter');

  if (titles.length > 0) {
    counter.style.display = 'block';
    counter.textContent = `📝 ${titles.length} title(s) entered`;
  } else {
    counter.style.display = 'none';
  }
});

// Preview functionality
document.getElementById('preview-bulk').addEventListener('click', function() {
  const bulkTitleText = document.getElementById('bulk-title').value;
  const bulkDescription = document.getElementById('bulk-description').value;

  const bulkTitles = bulkTitleText
    .split('\n')
    .map(t => t.trim())
    .filter(t => t.length > 0);

  if (bulkTitles.length === 0) {
    alert('⚠️ Please enter at least one title to preview');
    return;
  }

  const previewItems = document.getElementById('preview-items');
  previewItems.innerHTML = '';

  bulkTitles.forEach((title, index) => {
    const formattedDescription = bulkDescription
      ? `${title}\n\n\n${bulkDescription}`
      : `${title}\n\n\n`;

    const item = document.createElement('div');
    item.className = 'preview-item';
    item.innerHTML = `
      <h4>Sample ${index + 1}</h4>
      <div class="preview-title">Title: ${title}</div>
      <div style="font-weight: 600; margin: 10px 0;">Description:</div>
      <div class="preview-description">${formattedDescription}</div>
    `;
    previewItems.appendChild(item);
  });

  document.getElementById('preview-modal').classList.add('active');
});

document.getElementById('close-preview').addEventListener('click', function() {
  document.getElementById('preview-modal').classList.remove('active');
});

document.getElementById('preview-modal').addEventListener('click', function(e) {
  if (e.target === this) {
    this.classList.remove('active');
  }
});

// Show/hide schedule options
document.getElementById('bulk-start-date').addEventListener('change', toggleScheduleOptions);
document.getElementById('bulk-end-date').addEventListener('change', toggleScheduleOptions);

function toggleScheduleOptions() {
  const startDate = document.getElementById('bulk-start-date').value;
  const endDate = document.getElementById('bulk-end-date').value;
  const scheduleOptions = document.getElementById('schedule-options');

  if (startDate && endDate) {
    scheduleOptions.style.display = 'block';
  } else {
    scheduleOptions.style.display = 'none';
  }
}

// Day selector
const dayButtons = document.querySelectorAll('.day-btn');
dayButtons.forEach(btn => {
  btn.addEventListener('click', function(e) {
    e.preventDefault();
    this.classList.toggle('selected');
  });
});

function getSelectedDays() {
  return Array.from(document.querySelectorAll('.day-btn.selected'))
    .map(btn => btn.dataset.day);
}

// Apply bulk settings with smart scheduling
document.getElementById('apply-bulk').addEventListener('click', function() {
  const bulkTitleText = document.getElementById('bulk-title').value;
  const bulkDescription = document.getElementById('bulk-description').value;
  const bulkTags = document.getElementById('bulk-tags').value;
  const bulkIs18Plus = document.getElementById('bulk-is-18-plus').checked;
  const bulkStartDate = new Date(document.getElementById('bulk-start-date').value);
  const bulkEndDate = new Date(document.getElementById('bulk-end-date').value);
  const bulkDays = getSelectedDays();
  const bulkStartTime = document.getElementById('bulk-start-time').value;
  const bulkEndTime = document.getElementById('bulk-end-time').value;

  const videoSections = document.querySelectorAll('.video-form-section');
  const videoCount = videoSections.length;

  if (videoCount === 0) {
    alert('⚠️ Please select videos first');
    return;
  }

  if (!bulkStartDate || !bulkEndDate) {
    alert('⚠️ Please set start and end dates');
    return;
  }

  if (bulkEndDate <= bulkStartDate) {
    alert('⚠️ End date must be after start date');
    return;
  }

  // Prepare titles
  const bulkTitles = bulkTitleText
    .split('\n')
    .map(t => t.trim())
    .filter(t => t.length > 0);

  if (bulkTitles.length > 0 && bulkTitles.length < videoCount) {
    if (!confirm(`You have ${bulkTitles.length} titles but ${videoCount} videos. Some titles will be reused. Continue?`)) {
      return;
    }
  }

  let titlePool = [];
  if (bulkTitles.length > 0) {
    while (titlePool.length < videoCount) {
      titlePool = titlePool.concat([...bulkTitles]);
    }
    titlePool.sort(() => Math.random() - 0.5);
    titlePool = titlePool.slice(0, videoCount);
  }

  // Generate schedule
  let scheduledDates = [];
  const useSmartSchedule = document.getElementById('enable-smart-schedule').checked;

  if (useSmartSchedule) {
    // Use smart scheduling algorithm with separate gap settings
    const batchMinGap = parseInt(document.getElementById('batch-min-gap').value) || 30;
    const batchMaxGap = parseInt(document.getElementById('batch-max-gap').value) || 45;
    const existingMinGap = parseInt(document.getElementById('existing-min-gap').value) || 7;
    const existingMaxGap = parseInt(document.getElementById('existing-max-gap').value) || 14;
    const randomnessFactor = parseInt(document.getElementById('randomness-factor').value) || 20;
    const respectExisting = document.getElementById('respect-existing').checked;

    scheduledDates = window.schedulingModule.generateSmartSchedule(
      videoCount,
      bulkStartDate,
      bulkEndDate,
      {
        batchMinGap,
        batchMaxGap,
        existingMinGap,
        existingMaxGap,
        randomnessFactor,
        respectExisting,
        allowedDays: bulkDays,
        startTime: bulkStartTime,
        endTime: bulkEndTime
      }
    );

    // Analyze and show quality metrics
    const quality = window.schedulingModule.analyzeScheduleQuality(
      scheduledDates,
      respectExisting ? window.schedulingModule.getExistingSchedule() : []
    );

    if (quality) {
      console.log('Schedule Quality Analysis:', quality);
    }
  } else {
    // Use old random scheduling
    for (let i = 0; i < videoCount; i++) {
      let randomDate;
      let attempts = 0;
      do {
        randomDate = new Date(bulkStartDate.getTime() + Math.random() * (bulkEndDate.getTime() - bulkStartDate.getTime()));
        attempts++;
      } while (bulkDays.length > 0 && !bulkDays.includes(randomDate.getDay().toString()) && attempts < 100);

      if (bulkStartTime && bulkEndTime) {
        const startTime = new Date(`1970-01-01T${bulkStartTime}`);
        const endTime = new Date(`1970-01-01T${bulkEndTime}`);
        const randomTime = new Date(startTime.getTime() + Math.random() * (endTime.getTime() - startTime.getTime()));
        randomDate.setHours(randomTime.getHours());
        randomDate.setMinutes(randomTime.getMinutes());
      }

      scheduledDates.push(randomDate);
    }

    scheduledDates.sort(() => Math.random() - 0.5);
  }

  // Apply to form
  videoSections.forEach((section, index) => {
    if (titlePool.length > 0 && titlePool[index]) {
      const selectedTitle = titlePool[index];
      const titleInput = section.querySelector('input[name^="title_"]');
      if (titleInput) {
        titleInput.value = selectedTitle;
      }

      const descriptionTextarea = section.querySelector('textarea[name^="description_"]');
      if (descriptionTextarea) {
        if (bulkDescription && bulkDescription.trim()) {
          descriptionTextarea.value = `${selectedTitle}\n\n\n${bulkDescription}`;
        } else {
          descriptionTextarea.value = `${selectedTitle}\n\n\n`;
        }
      }
    } else if (bulkDescription && bulkDescription.trim()) {
      const descriptionTextarea = section.querySelector('textarea[name^="description_"]');
      if (descriptionTextarea) {
        descriptionTextarea.value = bulkDescription;
      }
    }

    if (bulkTags && bulkTags.trim()) {
      const tagsInput = section.querySelector('input[name^="tags_"]');
      if (tagsInput) {
        tagsInput.value = bulkTags;
      }
    }

    const is18PlusCheckbox = section.querySelector('input[name^="is18Plus_"]');
    if (is18PlusCheckbox) {
      is18PlusCheckbox.checked = bulkIs18Plus;
    }

    if (scheduledDates[index]) {
      const formattedDate = scheduledDates[index].toISOString().slice(0, 16);
      const publishAtInput = section.querySelector('input[name^="publishAt_"]');
      if (publishAtInput) {
        publishAtInput.value = formattedDate;
      }
    }
  });

  const uniqueTitlesUsed = new Set(titlePool).size;
  let summaryMessage = 'Applied bulk settings!\n\n';

  if (titlePool.length > 0) {
    summaryMessage += `${uniqueTitlesUsed} unique title(s) assigned to ${videoCount} video(s)\n`;
    summaryMessage += 'Each title has been prefixed in the description with 2 empty lines\n\n';
    summaryMessage += 'Titles used:\n';
    titlePool.slice(0, Math.min(5, titlePool.length)).forEach((title, idx) => {
      summaryMessage += `  ${idx + 1}. ${title}\n`;
    });
    if (titlePool.length > 5) {
      summaryMessage += `  ... and ${titlePool.length - 5} more\n`;
    }
  } else {
    summaryMessage += 'Description applied to all videos\n';
  }

  if (bulkTags && bulkTags.trim()) {
    summaryMessage += '\nTags applied';
  }

  if (scheduledDates.length > 0) {
    summaryMessage += '\nPublish dates scheduled';

    if (useSmartSchedule) {
      const quality = window.schedulingModule.analyzeScheduleQuality(
        scheduledDates,
        respectExisting ? window.schedulingModule.getExistingSchedule() : []
      );

      if (quality) {
        summaryMessage += `\n\nSchedule Quality:`;
        if (quality.batchGaps) {
          summaryMessage += `\n📊 Between new videos:`;
          summaryMessage += `\n  Average gap: ${quality.batchGaps.average} days`;
          summaryMessage += `\n  Min gap: ${quality.batchGaps.min} days`;
          summaryMessage += `\n  Max gap: ${quality.batchGaps.max} days`;
        }
        if (quality.existingGaps) {
          summaryMessage += `\n📅 From existing videos:`;
          summaryMessage += `\n  Average gap: ${quality.existingGaps.average} days`;
          summaryMessage += `\n  Min gap: ${quality.existingGaps.min} days`;
          summaryMessage += `\n  Max gap: ${quality.existingGaps.max} days`;
        }
      }
    }
  }

  alert(summaryMessage);

  console.log('Bulk apply completed:', {
    videoCount,
    titlesProvided: bulkTitles.length,
    uniqueTitlesUsed,
    titlePool,
    scheduledDates: scheduledDates.length
  });
});

// Handle file selection
const videoInput = document.getElementById('video-input');
const videoFormsContainer = document.getElementById('video-forms-container');

videoInput.addEventListener('change', (e) => {
  videoFormsContainer.innerHTML = '';
  const files = e.target.files;

  Array.from(files).forEach((file, index) => {
    const formSection = document.createElement('div');
    formSection.classList.add('video-form-section');

    formSection.innerHTML = `
      <div class="video-header">
        <div class="video-number">Video ${index + 1}</div>
        <button type="button" class="btn btn-danger delete-btn">Delete</button>
      </div>

      <video class="video-preview" controls>
        <source src="${URL.createObjectURL(file)}" type="${file.type}">
      </video>

      <div class="input-group">
        <label>Title *</label>
        <input type="text" name="title_${index}" placeholder="Enter video title" required>
      </div>

      <div class="input-group">
        <label>Description *</label>
        <textarea name="description_${index}" placeholder="Enter video description" required></textarea>
      </div>

      <div class="input-group">
        <label>Tags</label>
        <input type="text" name="tags_${index}" placeholder="tag1, tag2, tag3">
      </div>

      <div class="input-group">
        <label>Publish Date & Time (optional)</label>
        <input type="datetime-local" name="publishAt_${index}" min="${now.toISOString().slice(0, 16)}">
      </div>

      <div class="checkbox-group">
        <input type="checkbox" name="is18Plus_${index}" id="is18Plus_${index}">
        <label for="is18Plus_${index}">Mark as 18+ (Age Restricted)</label>
      </div>

      <button type="button" class="btn btn-secondary change-video-btn">Change Video</button>
      <input type="file" accept="video/*" style="display: none;" class="change-video-input">
    `;

    formSection.querySelector('.delete-btn').addEventListener('click', () => {
      formSection.remove();
      if (videoFormsContainer.children.length === 0) {
        videoInput.value = '';
      }
    });

    const changeBtn = formSection.querySelector('.change-video-btn');
    const changeInput = formSection.querySelector('.change-video-input');
    changeBtn.addEventListener('click', () => changeInput.click());
    changeInput.addEventListener('change', (event) => {
      const newFile = event.target.files[0];
      if (newFile) {
        const videoPreview = formSection.querySelector('.video-preview');
        videoPreview.src = URL.createObjectURL(newFile);
      }
    });

    videoFormsContainer.appendChild(formSection);
  });
});

// Handle form submission
const form = document.getElementById('upload-form');
const loader = document.getElementById('loader');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  loader.classList.add('active');

  const formData = new FormData(form);

  try {
    const response = await fetch('/upload', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (response.ok) {
      let message = 'Videos uploaded successfully!';

      let warningHTML = '';

      if (result.warning && result.warning.videos && result.warning.videos.length > 0) {
        warningHTML = `
          <div class="warning-box">
            <h3>Manual Action Required</h3>
            <p><strong>${result.warning.count} video(s) marked as 18+ need age restriction set manually in YouTube Studio.</strong></p>
            <p>YouTube API does not support automatic age restriction. Please complete these steps:</p>
            <ul>
              ${result.warning.instructions.map(inst => `<li>${inst}</li>`).join('')}
            </ul>
            <h4 style="margin-top: 15px;">Videos requiring age restriction:</h4>
            ${result.warning.videos.map(v => `
              <div style="margin: 10px 0; padding: 10px; background: white; border-radius: 6px;">
                <strong>${v.title}</strong><br>
                Video ID: ${v.videoId}<br>
                <a href="${v.editUrl}" target="_blank" class="video-link">Open in YouTube Studio</a>
              </div>
            `).join('')}
          </div>
        `;

        const warningDiv = document.createElement('div');
        warningDiv.innerHTML = warningHTML;
        document.querySelector('.upload-section').appendChild(warningDiv);
      }

      alert(message);
      console.log(result);
      videoFormsContainer.innerHTML = '';
      videoInput.value = '';
    } else {
      alert(`Failed to upload videos: ${result.error}`);
    }
  } catch (error) {
    alert(`An error occurred: ${error.message}`);
  } finally {
    submitBtn.disabled = false;
    loader.classList.remove('active');
  }
});

// Video Stats
const urlParams = new URLSearchParams(window.location.search);
const accessToken = urlParams.get('access_token');

if (accessToken) {
  document.getElementById('access_token').value = accessToken;
  document.getElementById('access_token_stats').value = accessToken;
}

document.getElementById('stats-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const videoId = document.getElementById('video-id').value;
  const token = document.getElementById('access_token_stats').value;

  try {
    const response = await fetch(`/video-stats/${videoId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result = await response.json();

    if (response.ok) {
      document.getElementById('video-stats').innerHTML = `
        <div class="stats-display">
          <h3>${result.title || 'N/A'}</h3>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-label">Views</div>
              <div class="stat-value">${result.views || 0}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Likes</div>
              <div class="stat-value">${result.likes || 0}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Comments</div>
              <div class="stat-value">${result.comments || 0}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Engagement Rate</div>
              <div class="stat-value">${result.engagementRate?.toFixed(2) || 0}%</div>
            </div>
          </div>
          <div style="margin-top: 15px;">
            <strong>Tags:</strong> ${result.tags?.join(', ') || 'None'}
          </div>
        </div>
      `;
    } else {
      alert(`Failed to fetch video stats: ${result.error}`);
    }
  } catch (error) {
    alert(`An error occurred: ${error.message}`);
  }
});
