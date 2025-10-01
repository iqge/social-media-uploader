# Product Requirements Document: Social Media Uploader Enhancement

## 1. Overview

This document outlines the features and improvements for the Social Media Uploader project. The goal is to enhance the uploader with advanced YouTube API features, sophisticated scheduling capabilities, and a user-friendly interface to manage these settings.

## 2. Features

### Backend

- [x] **YouTube Service Enhancement:**
  - [x] Add `privacyStatus` (private, public, unlisted).
  - [x] Add `madeForKids` flag.
  - [x] Add age restriction (18+).

- [x] **Advanced Scheduling Service:**
  - [x] Restrict uploads to be at least X days apart.
  - [x] Allow scheduling only on specific days of the week.
  - [x] Allow scheduling only within a specific time range.

- [ ] **AI Features:**
  - [ ] TBD (pending user clarification).

### Frontend

- [x] **UI for YouTube Options:**
  - [x] Dropdown for `privacyStatus`.
  - [x] Checkbox for `madeForKids`.
  - [x] Checkbox for age restriction.

- [x] **UI for Advanced Scheduling:**
  - [x] Input for minimum days between uploads.
  - [x] Checkboxes/multi-select for days of the week.
  - [x] Time range selector.

## 3. Non-Goals

- Adding features for other social media platforms (this can be a future goal).
- Adding video cards and end screens (not supported by the YouTube API).
