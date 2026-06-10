# Requirements: SlipStream iOS

**Defined:** 2026-06-10
**Core Value:** Users can open the app, see who's out driving nearby, and join a drive in minutes.

## v1 Requirements

### Authentication & Onboarding

- [ ] **AUTH-01**: User can sign in with Apple (native AuthenticationServices)
- [ ] **AUTH-02**: App exchanges Apple identity token for backend JWT (access + refresh)
- [ ] **AUTH-03**: App stores tokens securely in Keychain and refreshes automatically
- [ ] **ONBOARD-01**: New user creates username (unique handle)
- [ ] **ONBOARD-02**: New user uploads profile photo (camera or library)
- [ ] **ONBOARD-03**: New user adds first car (year, make, model, trim, color, photo)
- [ ] **ONBOARD-04**: User cannot access app until at least one car exists in garage

### Permissions & Location

- [ ] **PERM-01**: App requests location permission with clear purpose string
- [ ] **PERM-02**: App handles all permission states (granted, denied, restricted)
- [ ] **PERM-03**: App requests background location for driving mode
- [ ] **PERM-04**: Location updates are battery-efficient (adaptive rate per speed/motion)

### Network & Real-time

- [ ] **NET-01**: REST API client for all CRUD operations (users, cars, convoys, friends)
- [ ] **NET-02**: WebSocket client connects with JWT authentication
- [ ] **NET-03**: WebSocket sends location updates while in driving mode
- [ ] **NET-04**: WebSocket receives nearby driver positions in real-time
- [ ] **NET-05**: WebSocket handles convoy events (join, leave, chat, quick actions)
- [ ] **NET-06**: App gracefully handles offline/poor signal (queue updates, show stale indicator)

### Map - Explorer Mode

- [ ] **MAP-01**: Full-bleed dark-styled map as home screen
- [ ] **MAP-02**: User's own location shown with distinct marker
- [ ] **MAP-03**: Nearby drivers shown as circular markers (photo or initials)
- [ ] **MAP-04**: Marker border color indicates status (Cyan=Driving, Green=Parked, Blue=InConvoy, Orange=EnRoute)
- [ ] **MAP-05**: Active convoys shown as grouped/clustered markers
- [ ] **MAP-06**: Top HUD shows profile avatar, nearby stats, visibility toggle
- [ ] **MAP-07**: Filter bar with pills (All, Drivers, Convoys)
- [ ] **MAP-08**: Bottom controls: Drive button, Convoy button, Recenter button
- [ ] **MAP-09**: Tap driver marker shows info card (username, car, status, distance, actions)
- [ ] **MAP-10**: Tap convoy marker shows info card (name, destination, members, join option)
- [ ] **MAP-11**: Explorer camera: tilted 3D perspective, interactive pan/zoom

### Map - Driving Mode

- [ ] **DRIVE-01**: Tap "Drive" transitions to driving mode with smooth camera animation
- [ ] **DRIVE-02**: Camera follows user position with forward-looking pitch (~70°)
- [ ] **DRIVE-03**: Bearing follows heading (map rotates as user turns)
- [ ] **DRIVE-04**: Other drivers shown as compact, non-interactive markers
- [ ] **DRIVE-05**: Driving HUD: large speed gauge, speed limit indicator, road name pill
- [ ] **DRIVE-06**: Speed limit color-coded (green=under, orange=slightly over, red=over)
- [ ] **DRIVE-07**: Convoy status shown if in convoy (name, member count, chat access)
- [ ] **DRIVE-08**: Exit button returns to Explorer mode with smooth animation
- [ ] **DRIVE-09**: User status auto-changes to "Driving" when entering driving mode

### Navigation & Routes

- [ ] **NAV-01**: User can search for destination (address, place, POI)
- [ ] **NAV-02**: Route displayed on map with turn-by-turn directions
- [ ] **NAV-03**: Turn-by-turn navigation integrated in driving mode HUD
- [ ] **NAV-04**: User can drop waypoints by tapping map
- [ ] **NAV-05**: Route planning allows selecting specific roads (not just destinations)
- [ ] **NAV-06**: User status changes to "En Route" when navigating

### Convoys

- [ ] **CONVOY-01**: User can create convoy (name, public/private, optional destination)
- [ ] **CONVOY-02**: Creator becomes convoy leader
- [ ] **CONVOY-03**: Public convoys visible on map to nearby users
- [ ] **CONVOY-04**: User can request to join public convoy
- [ ] **CONVOY-05**: User can join friend's convoy directly
- [ ] **CONVOY-06**: User receives and can accept convoy invites
- [ ] **CONVOY-07**: Convoy lobby shows members with real-time status and distance
- [ ] **CONVOY-08**: Any member can set group route (all members see it)
- [ ] **CONVOY-09**: Leader can end convoy, remove members, toggle visibility
- [ ] **CONVOY-10**: User can leave convoy at any time
- [ ] **CONVOY-11**: User status changes to "In Convoy" when joining

### Quick Actions

- [ ] **QA-01**: Convoy members can send quick actions (Pull Over, Gas Stop, Slow Down, Regroup)
- [ ] **QA-02**: Quick actions appear as toast/banner on other members' driving HUD
- [ ] **QA-03**: Quick actions logged in convoy chat as system messages
- [ ] **QA-04**: Cooldown prevents spamming same action within 30 seconds

### Convoy Chat

- [ ] **CHAT-01**: Convoy has ephemeral group chat (text + system messages)
- [ ] **CHAT-02**: Messages appear in real-time via WebSocket
- [ ] **CHAT-03**: System messages for join/leave/route/quick actions
- [ ] **CHAT-04**: Chat accessible from convoy lobby and driving mode
- [ ] **CHAT-05**: Chat deleted when convoy ends

### Social

- [ ] **SOCIAL-01**: Social page accessible via tab/swipe from map
- [ ] **SOCIAL-02**: Friends list shows all friends with status and active car
- [ ] **SOCIAL-03**: Online friends sorted to top
- [ ] **SOCIAL-04**: Nearby drivers list (alternative to map discovery)
- [ ] **SOCIAL-05**: User can search for users by username
- [ ] **SOCIAL-06**: User can send friend request
- [ ] **SOCIAL-07**: User can accept/decline incoming friend requests
- [ ] **SOCIAL-08**: User can remove friends
- [ ] **SOCIAL-09**: Tap friend to view profile, invite to convoy, or find on map

### Profile & Garage

- [ ] **PROFILE-01**: Profile page shows photo, username, status, active car
- [ ] **PROFILE-02**: User can edit profile (photo, username)
- [ ] **GARAGE-01**: Garage shows all user's cars
- [ ] **GARAGE-02**: User can add new car to garage
- [ ] **GARAGE-03**: User can edit car details (year, make, model, trim, color, photo, mods)
- [ ] **GARAGE-04**: User can set any car as active (shown on map and profile)
- [ ] **GARAGE-05**: User can delete car (must keep at least one)

### Settings

- [ ] **SET-01**: Visibility toggle: On / Friends Only / Ghost Mode
- [ ] **SET-02**: Discovery radius preference (5/10/20/50 miles, default 15)
- [ ] **SET-03**: Speed units preference (mph/kph)
- [ ] **SET-04**: Notification toggles (friend requests, convoy invites, chat)
- [ ] **SET-05**: Sign out option
- [ ] **SET-06**: Delete account option

### Notifications

- [ ] **NOTIF-01**: Register device token with backend for push notifications
- [ ] **NOTIF-02**: Push notification for friend request received
- [ ] **NOTIF-03**: Push notification for convoy invite received
- [ ] **NOTIF-04**: Push notification for convoy chat when app backgrounded
- [ ] **NOTIF-05**: In-app notification banners for real-time events
- [ ] **NOTIF-06**: No notification sounds in driving mode (or subtle only)

## v2 Requirements (Deferred)

- Meet up first convoy routing (route everyone to common point)
- Route line drag-to-adjust
- Loop route creation
- Road name display on route preview
- Convoy member distance/ETA to group
- Auto status transitions (auto-detect parked vs driving)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Android app | iOS-only for MVP, focus resources |
| 3D car models on map | High complexity, post-MVP polish |
| Voice chat in convoys | Additional infrastructure needed |
| DMs / direct messaging | Convoy chat + friend system sufficient |
| Route saving/sharing | Build route planning first |
| Gamification (badges, points) | Not core value |
| Event scheduling | Focus on spontaneous drives |
| Media in chat (photos, voice) | Keep chat simple for MVP |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| ONBOARD-01 | Phase 1 | Pending |
| ONBOARD-02 | Phase 1 | Pending |
| ONBOARD-03 | Phase 1 | Pending |
| ONBOARD-04 | Phase 1 | Pending |
| PERM-01 | Phase 2 | Pending |
| PERM-02 | Phase 2 | Pending |
| PERM-03 | Phase 2 | Pending |
| PERM-04 | Phase 2 | Pending |
| NET-01 | Phase 2 | Pending |
| NET-02 | Phase 2 | Pending |
| NET-03 | Phase 2 | Pending |
| NET-04 | Phase 2 | Pending |
| NET-05 | Phase 2 | Pending |
| NET-06 | Phase 2 | Pending |
| MAP-01 | Phase 2 | Pending |
| MAP-02 | Phase 2 | Pending |
| MAP-03 | Phase 2 | Pending |
| MAP-04 | Phase 2 | Pending |
| MAP-05 | Phase 2 | Pending |
| MAP-06 | Phase 2 | Pending |
| MAP-07 | Phase 2 | Pending |
| MAP-08 | Phase 2 | Pending |
| MAP-09 | Phase 2 | Pending |
| MAP-10 | Phase 2 | Pending |
| MAP-11 | Phase 2 | Pending |
| DRIVE-01 | Phase 3 | Pending |
| DRIVE-02 | Phase 3 | Pending |
| DRIVE-03 | Phase 3 | Pending |
| DRIVE-04 | Phase 3 | Pending |
| DRIVE-05 | Phase 3 | Pending |
| DRIVE-06 | Phase 3 | Pending |
| DRIVE-07 | Phase 3 | Pending |
| DRIVE-08 | Phase 3 | Pending |
| DRIVE-09 | Phase 3 | Pending |
| NAV-01 | Phase 3 | Pending |
| NAV-02 | Phase 3 | Pending |
| NAV-03 | Phase 3 | Pending |
| NAV-04 | Phase 3 | Pending |
| NAV-05 | Phase 3 | Pending |
| NAV-06 | Phase 3 | Pending |
| CONVOY-01 | Phase 4 | Pending |
| CONVOY-02 | Phase 4 | Pending |
| CONVOY-03 | Phase 4 | Pending |
| CONVOY-04 | Phase 4 | Pending |
| CONVOY-05 | Phase 4 | Pending |
| CONVOY-06 | Phase 4 | Pending |
| CONVOY-07 | Phase 4 | Pending |
| CONVOY-08 | Phase 4 | Pending |
| CONVOY-09 | Phase 4 | Pending |
| CONVOY-10 | Phase 4 | Pending |
| CONVOY-11 | Phase 4 | Pending |
| QA-01 | Phase 4 | Pending |
| QA-02 | Phase 4 | Pending |
| QA-03 | Phase 4 | Pending |
| QA-04 | Phase 4 | Pending |
| CHAT-01 | Phase 4 | Pending |
| CHAT-02 | Phase 4 | Pending |
| CHAT-03 | Phase 4 | Pending |
| CHAT-04 | Phase 4 | Pending |
| CHAT-05 | Phase 4 | Pending |
| SOCIAL-01 | Phase 5 | Pending |
| SOCIAL-02 | Phase 5 | Pending |
| SOCIAL-03 | Phase 5 | Pending |
| SOCIAL-04 | Phase 5 | Pending |
| SOCIAL-05 | Phase 5 | Pending |
| SOCIAL-06 | Phase 5 | Pending |
| SOCIAL-07 | Phase 5 | Pending |
| SOCIAL-08 | Phase 5 | Pending |
| SOCIAL-09 | Phase 5 | Pending |
| PROFILE-01 | Phase 5 | Pending |
| PROFILE-02 | Phase 5 | Pending |
| GARAGE-01 | Phase 5 | Pending |
| GARAGE-02 | Phase 5 | Pending |
| GARAGE-03 | Phase 5 | Pending |
| GARAGE-04 | Phase 5 | Pending |
| GARAGE-05 | Phase 5 | Pending |
| SET-01 | Phase 5 | Pending |
| SET-02 | Phase 5 | Pending |
| SET-03 | Phase 5 | Pending |
| SET-04 | Phase 5 | Pending |
| SET-05 | Phase 5 | Pending |
| SET-06 | Phase 5 | Pending |
| NOTIF-01 | Phase 5 | Pending |
| NOTIF-02 | Phase 5 | Pending |
| NOTIF-03 | Phase 5 | Pending |
| NOTIF-04 | Phase 5 | Pending |
| NOTIF-05 | Phase 5 | Pending |
| NOTIF-06 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 77 total
- Mapped to phases: 77
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-10*
