// main.js - Main application logic with multi-platform support

// ============================================================================
// PLATFORM STATE
// ============================================================================
let currentPlatform = 'youtube'; // 'youtube' | 'instagram' | 'facebook'

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Helper function to extract song name from filename
function extractSongName(filename) {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  const match = nameWithoutExt.match(/__([^_]+)__/);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}

// Helper function to substitute {song_name} in title template
function applyTitleTemplate(template, songName) {
  if (!songName) {
    return template;
  }
  return template.replace(/\{song_name\}/gi, songName);
}

// ============================================================================
// PLATFORM SWITCHING
// ============================================================================

function switchPlatform(platform) {
  currentPlatform = platform;
  document.getElementById('selected-platform').value = platform;

  // Update tab styles
  document.querySelectorAll('.platform-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.platform === platform);
  });

  // Show/hide platform-specific fields
  document.querySelectorAll('.platform-field').forEach(field => {
    const platforms = field.dataset.platforms.split(',');
    field.style.display = platforms.includes(platform) ? '' : 'none';
  });

  // Show/hide platform-specific content sections
  document.querySelectorAll('.platform-content').forEach(section => {
    const contentPlatform = section.dataset.platformContent;
    if (contentPlatform === 'youtube-stats') {
      section.classList.toggle('active', platform === 'youtube');
    } else if (contentPlatform === 'instagram-note') {
      section.classList.toggle('active', platform === 'instagram');
    }
  });

  // Update auth buttons
  const youtubeAuthBtn = document.getElementById('youtube-auth-btn');
  const metaAuthBtn = document.getElementById('meta-auth-btn');
  const metaStatus = document.getElementById('meta-status');

  if (platform === 'youtube') {
    youtubeAuthBtn.style.display = 'inline-block';
    metaAuthBtn.style.display = 'none';
    metaStatus.style.display = 'none';
  } else {
    youtubeAuthBtn.style.display = 'none';
    metaAuthBtn.style.display = 'inline-block';
    metaStatus.style.display = 'inline-block';
    checkMetaAuthStatus();
  }

  // Update smart schedule visibility (not for Instagram)
  const smartScheduleSection = document.getElementById('smart-schedule-section');
  if (platform === 'instagram') {
    smartScheduleSection.style.display = 'none';
  } else {
    smartScheduleSection.style.display = '';
  }

  // Update upload button text
  const uploadBtn = document.getElementById('upload-submit-btn');
  const platformNames = { youtube: 'YouTube', instagram: 'Instagram', facebook: 'Facebook' };
  uploadBtn.textContent = `Upload All Videos to ${platformNames[platform]}`;

  // Update section title
  const sectionTitle = document.getElementById('upload-section-title');
  sectionTitle.textContent = `Upload Videos to ${platformNames[platform]}`;

  // Update fetch schedule button behavior
  const fetchBtn = document.getElementById('fetch-schedule-btn');
  if (platform === 'instagram') {
    fetchBtn.style.display = 'none';
  } else {
    fetchBtn.style.display = '';
  }

  // Update loader text
  const loaderText = document.getElementById('loader-text');
  if (platform === 'instagram') {
    loaderText.textContent = 'Uploading Reels... This may take a while as Instagram processes each video.';
  } else {
    loaderText.textContent = 'Uploading videos... Please wait';
  }

  // Re-render video forms if any exist
  updateVideoFormsForPlatform();

  console.log(`Switched to platform: ${platform}`);
}

// Update existing video form sections when platform changes
function updateVideoFormsForPlatform() {
  const videoSections = document.querySelectorAll('.video-form-section');
  videoSections.forEach(section => {
    // Show/hide platform-specific fields within each video form
    section.querySelectorAll('.video-platform-field').forEach(field => {
      const platforms = field.dataset.platforms.split(',');
      field.style.display = platforms.includes(currentPlatform) ? '' : 'none';
    });
  });
}

// Check Meta authentication status
async function checkMetaAuthStatus() {
  try {
    const response = await fetch('/meta/status');
    const data = await response.json();

    const statusEl = document.getElementById('meta-status');
    if (data.authenticated) {
      statusEl.className = 'meta-status connected';
      statusEl.textContent = '🟢 Connected';
      if (data.pageId) {
        statusEl.title = `Page ID: ${data.pageId}${data.instagramAccountId ? ` | IG: ${data.instagramAccountId}` : ''}`;
      }
    } else {
      statusEl.className = 'meta-status disconnected';
      statusEl.textContent = '🔴 Not connected';
    }
  } catch (error) {
    console.error('Failed to check Meta auth status:', error);
  }
}

// ============================================================================
// CONFIGURATION MANAGEMENT - localStorage with Named Configs
// ============================================================================

const CONFIG_LIST_KEY = 'socialMediaUploaderConfigs';

function getSavedConfigNames() {
  try {
    const configs = localStorage.getItem(CONFIG_LIST_KEY);
    return configs ? JSON.parse(configs) : {};
  } catch (error) {
    console.error('Error reading configs:', error);
    return {};
  }
}

function saveAllConfigs(configs) {
  try {
    localStorage.setItem(CONFIG_LIST_KEY, JSON.stringify(configs));
  } catch (error) {
    console.error('Error saving configs:', error);
    throw error;
  }
}

function getCurrentConfig() {
  return {
    platform: currentPlatform,
    bulkTitle: document.getElementById('bulk-title').value,
    bulkCaption: document.getElementById('bulk-caption').value,
    bulkDescription: document.getElementById('bulk-description').value,
    bulkTags: document.getElementById('bulk-tags').value,
    bulkIs18Plus: document.getElementById('bulk-is-18-plus').checked,
    bulkShareToFeed: document.getElementById('bulk-share-to-feed').checked,
    bulkStartDate: document.getElementById('bulk-start-date').value,
    bulkEndDate: document.getElementById('bulk-end-date').value,
    bulkStartTime: document.getElementById('bulk-start-time').value,
    bulkEndTime: document.getElementById('bulk-end-time').value,
    enableSmartSchedule: document.getElementById('enable-smart-schedule').checked,
    batchMinGap: document.getElementById('batch-min-gap').value,
    batchMaxGap: document.getElementById('batch-max-gap').value,
    existingMinGap: document.getElementById('existing-min-gap').value,
    existingMaxGap: document.getElementById('existing-max-gap').value,
    randomnessFactor: document.getElementById('randomness-factor').value,
    respectExisting: document.getElementById('respect-existing').checked,
    selectedDays: Array.from(document.querySelectorAll('.day-btn.selected')).map(btn => btn.dataset.day),
    savedAt: new Date().toISOString()
  };
}

function applyConfig(config) {
  // Switch platform if saved
  if (config.platform) {
    switchPlatform(config.platform);
  }

  if (config.bulkTitle !== undefined) document.getElementById('bulk-title').value = config.bulkTitle;
  if (config.bulkCaption !== undefined) document.getElementById('bulk-caption').value = config.bulkCaption;
  if (config.bulkDescription !== undefined) document.getElementById('bulk-description').value = config.bulkDescription;
  if (config.bulkTags !== undefined) document.getElementById('bulk-tags').value = config.bulkTags;
  if (config.bulkIs18Plus !== undefined) document.getElementById('bulk-is-18-plus').checked = config.bulkIs18Plus;
  if (config.bulkShareToFeed !== undefined) document.getElementById('bulk-share-to-feed').checked = config.bulkShareToFeed;
  if (config.bulkStartDate !== undefined) document.getElementById('bulk-start-date').value = config.bulkStartDate;
  if (config.bulkEndDate !== undefined) document.getElementById('bulk-end-date').value = config.bulkEndDate;
  if (config.bulkStartTime !== undefined) document.getElementById('bulk-start-time').value = config.bulkStartTime;
  if (config.bulkEndTime !== undefined) document.getElementById('bulk-end-time').value = config.bulkEndTime;

  if (config.enableSmartSchedule !== undefined) {
    const smartScheduleCheckbox = document.getElementById('enable-smart-schedule');
    smartScheduleCheckbox.checked = config.enableSmartSchedule;
    smartScheduleCheckbox.dispatchEvent(new Event('change'));
  }
  if (config.batchMinGap !== undefined) document.getElementById('batch-min-gap').value = config.batchMinGap;
  if (config.batchMaxGap !== undefined) document.getElementById('batch-max-gap').value = config.batchMaxGap;
  if (config.existingMinGap !== undefined) document.getElementById('existing-min-gap').value = config.existingMinGap;
  if (config.existingMaxGap !== undefined) document.getElementById('existing-max-gap').value = config.existingMaxGap;
  if (config.randomnessFactor !== undefined) document.getElementById('randomness-factor').value = config.randomnessFactor;
  if (config.respectExisting !== undefined) document.getElementById('respect-existing').checked = config.respectExisting;

  if (config.selectedDays && Array.isArray(config.selectedDays)) {
    document.querySelectorAll('.day-btn').forEach(btn => {
      if (config.selectedDays.includes(btn.dataset.day)) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    });
  }

  toggleScheduleOptions();
  document.getElementById('bulk-title').dispatchEvent(new Event('input'));
}

function saveConfiguration() {
  const configName = prompt('Enter a name for this configuration:');
  if (!configName || configName.trim() === '') {
    alert('⚠️ Configuration name cannot be empty');
    return;
  }

  const trimmedName = configName.trim();
  try {
    const allConfigs = getSavedConfigNames();
    const config = getCurrentConfig();

    if (allConfigs[trimmedName]) {
      if (!confirm(`Configuration "${trimmedName}" already exists. Overwrite?`)) {
        return;
      }
    }

    allConfigs[trimmedName] = config;
    saveAllConfigs(allConfigs);
    alert(`✅ Configuration "${trimmedName}" saved successfully!`);
    updateConfigList();
  } catch (error) {
    alert('❌ Error saving configuration: ' + error.message);
  }
}

function loadConfiguration(configName) {
  try {
    const allConfigs = getSavedConfigNames();
    const config = allConfigs[configName];
    if (!config) {
      alert(`❌ Configuration "${configName}" not found`);
      return;
    }
    applyConfig(config);
    alert(`✅ Configuration "${configName}" loaded successfully!`);
  } catch (error) {
    alert('❌ Error loading configuration: ' + error.message);
  }
}

function deleteConfiguration(configName) {
  if (!confirm(`Are you sure you want to delete "${configName}"?`)) {
    return;
  }
  try {
    const allConfigs = getSavedConfigNames();
    delete allConfigs[configName];
    saveAllConfigs(allConfigs);
    alert(`✅ Configuration "${configName}" deleted successfully!`);
    updateConfigList();
  } catch (error) {
    alert('❌ Error deleting configuration: ' + error.message);
  }
}

function updateConfigList() {
  const listContainer = document.getElementById('config-list');
  if (!listContainer) return;

  const allConfigs = getSavedConfigNames();
  const configNames = Object.keys(allConfigs);

  if (configNames.length === 0) {
    listContainer.innerHTML = '<p style="color: #666; font-style: italic; padding: 10px;">No saved configurations</p>';
    return;
  }

  listContainer.innerHTML = configNames.map(name => {
    const config = allConfigs[name];
    const savedDate = config.savedAt ? new Date(config.savedAt).toLocaleString() : 'Unknown';
    const platformLabel = config.platform ? ` (${config.platform})` : '';

    return `
      <div class="config-item">
        <div class="config-item-info">
          <strong>${name}${platformLabel}</strong>
          <small style="color: #666;">Saved: ${savedDate}</small>
        </div>
        <div class="config-item-actions">
          <button type="button" class="btn-small btn-load" onclick="loadConfiguration('${name.replace(/'/g, "\\'")}')">
            📂 Load
          </button>
          <button type="button" class="btn-small btn-delete" onclick="deleteConfiguration('${name.replace(/'/g, "\\'")}')">
            🗑️ Delete
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================================================
// END CONFIGURATION MANAGEMENT
// ============================================================================

// Set minimum date for datetime inputs to now
const now = new Date();
now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
document.getElementById('bulk-start-date').min = now.toISOString().slice(0, 16);
document.getElementById('bulk-end-date').min = now.toISOString().slice(0, 16);

// Platform tab click handlers
document.querySelectorAll('.platform-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    switchPlatform(tab.dataset.platform);
  });
});

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
  if (currentPlatform === 'youtube') {
    window.schedulingModule.fetchExistingSchedule();
  } else if (currentPlatform === 'facebook') {
    fetchFacebookSchedule();
  }
});

// Fetch Facebook schedule
async function fetchFacebookSchedule() {
  const btn = document.getElementById('fetch-schedule-btn');
  btn.disabled = true;
  btn.textContent = 'Fetching Facebook schedule...';

  try {
    const response = await fetch('/facebook/existing-schedule');
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch schedule');
    }

    const scheduledDates = data.scheduledDates ? data.scheduledDates.map(d => new Date(d)) : [];
    const display = document.getElementById('schedule-display');

    if (scheduledDates.length > 0) {
      scheduledDates.sort((a, b) => a.getTime() - b.getTime());

      const gaps = [];
      for (let i = 1; i < scheduledDates.length; i++) {
        const gapDays = (scheduledDates[i] - scheduledDates[i - 1]) / (1000 * 60 * 60 * 24);
        gaps.push(gapDays.toFixed(1));
      }

      display.innerHTML = `
        <div class="schedule-display">
          <h4>📅 You have ${data.count} Facebook post(s) scheduled</h4>
          <div class="schedule-list">
            ${scheduledDates.map((date, i) => `
              <div class="schedule-item" style="border-left-color: #1877F2;">
                <span class="schedule-number" style="background: #1877F2;">#${i + 1}</span>
                <span class="schedule-date">${date.toLocaleString()}</span>
                ${i > 0 ? `<span style="color: #666; font-size: 12px;">(+${gaps[i-1]} days)</span>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      display.innerHTML = `
        <div class="schedule-display">
          <p>✅ No scheduled Facebook posts found. You can schedule freely!</p>
        </div>
      `;
    }
  } catch (error) {
    alert(`❌ Failed to fetch Facebook schedule: ${error.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = '🔄 Fetch Current Schedule';
  }
}

// Save Configuration button
document.getElementById('save-config-btn')?.addEventListener('click', () => {
  saveConfiguration();
});

// Load Configuration button - show list
document.getElementById('load-config-btn')?.addEventListener('click', () => {
  updateConfigList();
  const modal = document.getElementById('config-modal');
  if (modal) {
    modal.classList.add('active');
  }
});

// Close config modal
document.getElementById('close-config-modal')?.addEventListener('click', () => {
  const modal = document.getElementById('config-modal');
  if (modal) {
    modal.classList.remove('active');
  }
});

// Click outside modal to close
document.getElementById('config-modal')?.addEventListener('click', function(e) {
  if (e.target === this) {
    this.classList.remove('active');
  }
});

// Initialize config list on page load
document.addEventListener('DOMContentLoaded', () => {
  updateConfigList();

  // Check for Meta auth callback params
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('meta_auth') === 'success') {
    alert('✅ Successfully authenticated with Meta (Facebook/Instagram)!');
    // Clean URL
    window.history.replaceState({}, document.title, '/');
    // Switch to the platform they likely want
    switchPlatform('facebook');
  }
  if (urlParams.get('meta_error')) {
    alert(`❌ Meta authentication error: ${urlParams.get('meta_error')}`);
    window.history.replaceState({}, document.title, '/');
  }
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
  const videoSections = document.querySelectorAll('.video-form-section');
  const videoCount = videoSections.length;

  if (videoCount === 0) {
    alert('⚠️ Please select videos first');
    return;
  }

  if (currentPlatform === 'instagram') {
    applyBulkInstagram(videoSections, videoCount);
  } else {
    applyBulkYouTubeFacebook(videoSections, videoCount);
  }
});

// Apply bulk settings for Instagram
function applyBulkInstagram(videoSections, videoCount) {
  const bulkCaption = document.getElementById('bulk-caption').value;
  const bulkShareToFeed = document.getElementById('bulk-share-to-feed').checked;

  videoSections.forEach((section) => {
    const captionTextarea = section.querySelector('textarea[name^="caption_"]');
    if (captionTextarea && bulkCaption) {
      captionTextarea.value = bulkCaption;
    }

    const shareToFeedCheckbox = section.querySelector('input[name^="shareToFeed_"]');
    if (shareToFeedCheckbox) {
      shareToFeedCheckbox.checked = bulkShareToFeed;
    }
  });

  alert(`✅ Applied caption and settings to ${videoCount} Reel(s)!`);
}

// Apply bulk settings for YouTube and Facebook
function applyBulkYouTubeFacebook(videoSections, videoCount) {
  const bulkTitleText = document.getElementById('bulk-title').value;
  const bulkDescription = document.getElementById('bulk-description').value;
  const bulkTags = document.getElementById('bulk-tags').value;
  const bulkIs18Plus = document.getElementById('bulk-is-18-plus').checked;
  const bulkStartDate = new Date(document.getElementById('bulk-start-date').value);
  const bulkEndDate = new Date(document.getElementById('bulk-end-date').value);
  const bulkDays = getSelectedDays();
  const bulkStartTime = document.getElementById('bulk-start-time').value;
  const bulkEndTime = document.getElementById('bulk-end-time').value;

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

  // Create title pool
  let titleTemplates = [];
  if (bulkTitles.length > 0) {
    while (titleTemplates.length < videoCount) {
      titleTemplates = titleTemplates.concat([...bulkTitles]);
    }
    titleTemplates.sort(() => Math.random() - 0.5);
    titleTemplates = titleTemplates.slice(0, videoCount);
  }

  // Generate schedule
  let scheduledDates = [];
  const useSmartSchedule = document.getElementById('enable-smart-schedule').checked;
  const respectExisting = document.getElementById('respect-existing')?.checked || false;

  if (useSmartSchedule) {
    const batchMinGap = parseInt(document.getElementById('batch-min-gap').value) || 30;
    const batchMaxGap = parseInt(document.getElementById('batch-max-gap').value) || 45;
    const existingMinGap = parseInt(document.getElementById('existing-min-gap').value) || 7;
    const existingMaxGap = parseInt(document.getElementById('existing-max-gap').value) || 14;
    const randomnessFactor = parseInt(document.getElementById('randomness-factor').value) || 20;

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

    const quality = window.schedulingModule.analyzeScheduleQuality(
      scheduledDates,
      respectExisting ? window.schedulingModule.getExistingSchedule() : []
    );

    if (quality) {
      console.log('Schedule Quality Analysis:', quality);
    }
  } else {
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
    const originalFilename = section.dataset.originalFilename;
    const songName = originalFilename ? extractSongName(originalFilename) : null;

    if (titleTemplates.length > 0 && titleTemplates[index]) {
      const titleTemplate = titleTemplates[index];
      const finalTitle = applyTitleTemplate(titleTemplate, songName);

      const titleInput = section.querySelector('input[name^="title_"]');
      if (titleInput) {
        titleInput.value = finalTitle;
      }

      const descriptionTextarea = section.querySelector('textarea[name^="description_"]');
      if (descriptionTextarea) {
        if (bulkDescription && bulkDescription.trim()) {
          descriptionTextarea.value = `${finalTitle}\n\n\n${bulkDescription}`;
        } else {
          descriptionTextarea.value = `${finalTitle}\n\n\n`;
        }
      }
    } else if (bulkDescription && bulkDescription.trim()) {
      const descriptionTextarea = section.querySelector('textarea[name^="description_"]');
      if (descriptionTextarea) {
        descriptionTextarea.value = bulkDescription;
      }
    }

    if (currentPlatform === 'youtube' && bulkTags && bulkTags.trim()) {
      const tagsInput = section.querySelector('input[name^="tags_"]');
      if (tagsInput) {
        tagsInput.value = bulkTags;
      }
    }

    if (currentPlatform === 'youtube') {
      const is18PlusCheckbox = section.querySelector('input[name^="is18Plus_"]');
      if (is18PlusCheckbox) {
        is18PlusCheckbox.checked = bulkIs18Plus;
      }
    }

    if (scheduledDates[index]) {
      const formattedDate = scheduledDates[index].toISOString().slice(0, 16);
      const publishAtInput = section.querySelector('input[name^="publishAt_"]');
      if (publishAtInput) {
        publishAtInput.value = formattedDate;
      }
    }
  });

  const uniqueTitlesUsed = new Set(titleTemplates).size;
  let summaryMessage = 'Applied bulk settings!\n\n';

  if (titleTemplates.length > 0) {
    summaryMessage += `${uniqueTitlesUsed} unique title template(s) assigned to ${videoCount} video(s)\n`;
    if (titleTemplates.some(t => t.includes('{song_name}'))) {
      summaryMessage += '🎵 Song names will be substituted from filenames\n';
    }
    summaryMessage += 'Each title has been prefixed in the description with 2 empty lines\n\n';
    summaryMessage += 'Title templates used:\n';
    titleTemplates.slice(0, Math.min(5, titleTemplates.length)).forEach((title, idx) => {
      summaryMessage += `  ${idx + 1}. ${title}\n`;
    });
    if (titleTemplates.length > 5) {
      summaryMessage += `  ... and ${titleTemplates.length - 5} more\n`;
    }
  } else {
    summaryMessage += 'Description applied to all videos\n';
  }

  if (currentPlatform === 'youtube' && bulkTags && bulkTags.trim()) {
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
    platform: currentPlatform,
    videoCount,
    titlesProvided: bulkTitles.length,
    uniqueTitlesUsed,
    titleTemplates,
    scheduledDates: scheduledDates.length
  });
});

// Handle file selection with platform-aware form generation
const videoInput = document.getElementById('video-input');
const videoFormsContainer = document.getElementById('video-forms-container');

videoInput.addEventListener('change', (e) => {
  videoFormsContainer.innerHTML = '';
  const files = e.target.files;

  Array.from(files).forEach((file, index) => {
    const songName = extractSongName(file.name);
    const formSection = document.createElement('div');
    formSection.classList.add('video-form-section');
    formSection.dataset.originalFilename = file.name;

    formSection.innerHTML = generateVideoFormHTML(index, file, songName);

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

        const newSongName = extractSongName(newFile.name);
        const videoNumber = formSection.querySelector('.video-number');
        const existingSongDisplay = videoNumber.querySelector('span');

        if (newSongName) {
          if (existingSongDisplay) {
            existingSongDisplay.textContent = `🎵 "${newSongName}"`;
          } else {
            const songSpan = document.createElement('span');
            songSpan.style.cssText = 'color: #667eea; font-size: 0.9em; font-weight: 500; margin-left: 10px;';
            songSpan.textContent = `🎵 "${newSongName}"`;
            videoNumber.appendChild(songSpan);
          }
        } else if (existingSongDisplay) {
          existingSongDisplay.remove();
        }

        formSection.dataset.originalFilename = newFile.name;
      }
    });

    videoFormsContainer.appendChild(formSection);
  });
});

// Generate platform-specific video form HTML
function generateVideoFormHTML(index, file, songName) {
  const isYouTube = currentPlatform === 'youtube';
  const isInstagram = currentPlatform === 'instagram';
  const isFacebook = currentPlatform === 'facebook';

  let html = `
    <div class="video-header">
      <div class="video-number">
        Video ${index + 1}
        ${songName ? `<span style="color: #667eea; font-size: 0.9em; font-weight: 500; margin-left: 10px;">
          🎵 "${songName}"
        </span>` : ''}
      </div>
      <button type="button" class="btn btn-danger delete-btn">Delete</button>
    </div>

    <video class="video-preview" controls>
      <source src="${URL.createObjectURL(file)}" type="${file.type}">
    </video>
  `;

  if (isInstagram) {
    // Instagram: Caption + Share to Feed
    html += `
      <div class="input-group">
        <label>Caption</label>
        <textarea name="caption_${index}" placeholder="Enter caption for this Reel" rows="3"></textarea>
      </div>

      <div class="checkbox-group">
        <input type="checkbox" name="shareToFeed_${index}" id="shareToFeed_${index}" checked>
        <label for="shareToFeed_${index}">Share to Feed</label>
      </div>
    `;
  } else {
    // YouTube & Facebook: Title + Description
    html += `
      <div class="input-group">
        <label>Title *</label>
        <input type="text" name="title_${index}" placeholder="Enter video title" required>
        ${isYouTube && songName ? `<small style="color: #666; display: block; margin-top: 3px;">
          🎵 Detected song: "${songName}" - Use {song_name} in title to auto-substitute
        </small>` : ''}
      </div>

      <div class="input-group">
        <label>Description ${isYouTube ? '*' : ''}</label>
        <textarea name="description_${index}" placeholder="Enter video description" ${isYouTube ? 'required' : ''}></textarea>
      </div>
    `;

    // YouTube-only: Tags
    if (isYouTube) {
      html += `
        <div class="input-group video-platform-field" data-platforms="youtube">
          <label>Tags</label>
          <input type="text" name="tags_${index}" placeholder="tag1, tag2, tag3">
        </div>
      `;
    }

    // YouTube & Facebook: Publish date
    html += `
      <div class="input-group">
        <label>Publish Date & Time (optional)</label>
        <input type="datetime-local" name="publishAt_${index}" min="${now.toISOString().slice(0, 16)}">
      </div>
    `;

    // YouTube-only: 18+ checkbox
    if (isYouTube) {
      html += `
        <div class="checkbox-group video-platform-field" data-platforms="youtube">
          <input type="checkbox" name="is18Plus_${index}" id="is18Plus_${index}">
          <label for="is18Plus_${index}">Mark as 18+ (Age Restricted)</label>
        </div>
      `;
    }
  }

  html += `
    <button type="button" class="btn btn-secondary change-video-btn">Change Video</button>
    <input type="file" accept="video/*" style="display: none;" class="change-video-input">
  `;

  return html;
}

// Handle form submission - platform-aware
const form = document.getElementById('upload-form');
const loader = document.getElementById('loader');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  loader.classList.add('active');

  const formData = new FormData(form);

  // Determine upload endpoint based on platform
  let uploadUrl;
  switch (currentPlatform) {
    case 'instagram':
      uploadUrl = '/instagram/upload';
      break;
    case 'facebook':
      uploadUrl = '/facebook/upload';
      break;
    case 'youtube':
    default:
      uploadUrl = '/upload';
      break;
  }

  try {
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (response.ok) {
      let message = `Videos uploaded to ${currentPlatform} successfully!`;

      if (currentPlatform === 'instagram') {
        message += `\n\n${result.successCount} Reel(s) published.`;
        if (result.failureCount > 0) {
          message += `\n${result.failureCount} failed.`;
        }
        if (result.note) {
          message += `\n\n${result.note}`;
        }
      }

      // YouTube 18+ warning handling
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

// Video Stats (YouTube)
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
