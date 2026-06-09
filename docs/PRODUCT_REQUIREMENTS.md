# SlipStream — Product Requirements Document

> **Version**: 1.0 (Draft)
> **Last Updated**: June 2025
> **Platform**: iOS (Native Swift/SwiftUI)
> **Status**: MVP Definition

---

## 1. Product Vision

SlipStream is a real-time social driving app for car enthusiasts. It combines live location sharing, convoy coordination, and turn-by-turn navigation into a single experience — think "Forza Horizon online lobby, but in real life."

The app should become the **default navigation app** for car enthusiasts. If users open it every time they drive (not just when they're bored), it maximizes opportunities for organic social interaction — finding cool cars, meeting people, and joining spontaneous drives. This "always-on" usage pattern is critical to reaching the network density needed for the app to feel alive.

### Core Value Propositions

1. **Discovery** — See who else is out driving near you, what they drive, and what they're doing.
2. **Coordination** — Form convoys instantly with zero friction, like creating a multiplayer game lobby.
3. **Navigation** — Route together along specific roads (not just to destinations), with an experience purpose-built for drivers who care about the journey.
4. **Community** — Build a local car scene graph. Find your people based on shared car culture, not algorithms.

### The Feeling We're Creating

> "Open the app, see who's out, and join a drive in minutes."

The app should feel **live**, **fast**, and **car-culture-native**. It's not a generic social network with a map bolted on. Every interaction is designed around the act of driving and the identity of being a car person.

---

## 2. Target Users

### Primary Persona: The Local Enthusiast
- Owns a modified or enthusiast car (sports car, JDM, muscle, euro, etc.)
- Already part of a local car scene (group chats, meets, canyon runs)
- Frustrated by how hard it is to coordinate spontaneous drives
- Uses Instagram/Discord/group texts to find people to drive with
- Wants to know who's out driving RIGHT NOW

### Secondary Persona: The New-to-Scene Driver
- Recently got into cars, doesn't know many people yet
- Wants to find local drivers with similar interests
- Intimidated by closed Facebook groups and existing cliques
- Wants an easy, low-pressure way to discover and join drives

### Usage Patterns
- **Daily driver**: Uses SlipStream as their navigation app for commutes and errands; passively visible to friends
- **Weekend warrior**: Opens the app Saturday morning to see who's heading to the canyons
- **Convoy organizer**: Creates a convoy lobby, invites friends, sets a route, leads the group
- **Explorer**: Browses the map to spot cool cars and active convoys nearby

---

## 3. App Structure & Navigation

### Navigation Model

The app uses a **Snapchat-inspired navigation pattern**: the map is the home screen, with swipe gestures and a bottom tab/button row to access other pages.

### Primary Pages

| Page | Access | Purpose |
|------|--------|---------|
| **Map** (Home) | Default/center | Live map, driver discovery, convoy activity |
| **Social** | Tab or swipe | Friends list, nearby drivers list, friend search |
| **Chats** | Tab or swipe | Active convoy chats, direct messages (future) |
| **Profile / Garage** | Tab or swipe | Your profile, car garage, settings |

### Overlay States

The map page has two primary overlay states that affect the HUD and camera:

1. **Explorer Mode** — Full app chrome, zoomed-out tilted camera, interactive markers
2. **Driving Mode** — Minimal HUD, navigation-focused camera (pitched forward, following heading), non-interactive compact markers

Sheets and modals are used for:
- Convoy creation
- Convoy detail / lobby
- Driver profile (tapped from map or list)
- Route planning
- Settings / preferences

---

## 4. Screens & Features

---

### 4.1 Onboarding & Authentication

#### Sign Up / Sign In

**What the user sees:**
- Clean, dark-themed welcome screen with app branding
- Sign-in options: Apple, Google, Email/Phone
- New users proceed to profile creation; returning users go straight to the map

**Auth provider:** Supabase Auth

#### Profile Creation (First-Time Only)

**What the user sees:**
- Step-by-step onboarding flow
- Required fields before the user can access the app

**Required steps:**
1. **Username** — Unique handle (e.g., `@apexkai`)
2. **Profile photo** — Camera or library upload
3. **Add your first car** — Year, make, model, trim, color, photo(s), mods (optional)

**Behavior:**
- User cannot proceed without at least one car in their garage
- This ensures every user on the map has a real car identity
- The flow should feel quick (< 2 minutes) and not overly burdensome

---

### 4.2 Map (Home Screen) — Explorer Mode

This is the primary screen of the app. It is a full-bleed, dark-styled map showing the user's surroundings with live driver positions, active convoys, and contextual controls.

#### What the User Sees

**Map surface:**
- Full-screen map (dark style, tilted/3D perspective)
- User's own location marker (distinct from other drivers)
- Other drivers shown as circular markers (profile photo or colored circle with initials)
- Marker border/outline color indicates status:
  - **Driving** — Cyan/teal
  - **Parked** — Green
  - **In Convoy** — Blue
  - **En Route** — Orange
  - **Offline** — Not shown (unless friend, then gray/dimmed)
- Active convoys shown as grouped markers or convoy icons
- Markers are minimal by default; details shown on tap

**Top HUD:**
- Profile avatar button (navigates to Profile/Garage)
- App title or contextual label
- Nearby stats: "X drivers nearby | Y convoys live"
- Presence/visibility quick toggle

**Filter bar:**
- Horizontal scrolling pill buttons
- Default filters: All, Drivers, Convoys
- Advanced filtering (accessible via a filter icon/sheet):
  - By driver status (Driving, Parked, En Route)
  - By car make/model
  - By friends only

**Bottom controls:**
- **Drive button** — Enters driving mode (starts navigation session)
- **Convoy button** — Opens convoy creation flow
- **Recenter button** — Returns camera to user's location
- **Settings/filter button** — Opens additional controls

#### Interactions

| Action | Result |
|--------|--------|
| Tap a driver marker | Shows driver info card (username, car, status, distance). Options: Message, Invite to Convoy, Add Friend |
| Tap a convoy marker | Shows convoy info card (name, destination, member count, status). Options: Request to Join, View Details |
| Tap "Drive" | Transitions to Driving Mode with smooth camera animation |
| Tap "Convoy" | Opens Create Convoy sheet |
| Pan/zoom map | Free exploration; discovery radius is determined by user setting, not viewport |
| Long-press on map | Future: Drop pin for route planning |

#### Driver Info Card (Bottom Sheet on Tap)

**What the user sees:**
- Driver's profile photo and username
- Their active car (year/make/model, color, photo if available)
- Current status with icon
- Distance from you
- Mutual friends (if any)
- Action buttons: Add Friend, Invite to Convoy, Message (future)

#### Convoy Info Card (Bottom Sheet on Tap)

**What the user sees:**
- Convoy name
- Destination
- Member count and avatars
- Status (Active, Forming, En Route)
- Public/Private indicator
- Action buttons: Request to Join (public), View Lobby

---

### 4.3 Map — Driving Mode

Entered by tapping the "Drive" button. This mode optimizes the interface for active driving — minimal distractions, glanceable information, navigation-focused camera.

#### What the User Sees

**Map surface:**
- Camera follows user's position with forward-looking pitch (~70°)
- Bearing follows heading (map rotates as you turn)
- Higher zoom level (street-level detail)
- Other drivers shown as compact, non-interactive markers
- If in a convoy: convoy member positions visible
- Active route line shown on map (if navigating)

**Driving HUD (minimal overlay):**
- **Speed gauge** — Large, prominent current speed (mph/kph)
- **Speed limit indicator** — Current road speed limit with color-coded border:
  - Green: under limit
  - Orange: slightly over
  - Red: significantly over
- **Road name pill** — Current road/street name
- **Convoy status** (if in convoy) — Convoy name, member count, quick chat access
- **Exit button** — Returns to Explorer Mode

**Bottom controls (driving mode):**
- Recenter button (if user panned away)
- Chat button (if in convoy) — opens convoy chat
- Quick actions (if in convoy) — see Section 4.6

#### Behavior

- Driving mode can be entered **solo** (just you driving) or while **in a convoy**
- User's status automatically changes to "Driving" when entering this mode
- Exiting driving mode returns to Explorer with a smooth camera animation
- All map markers remain on the same map surface — only the camera, HUD, and marker style change

---

### 4.4 Navigation & Route Planning

Navigation is a **critical differentiator**. The goal is to make SlipStream good enough to replace Apple/Google Maps for enthusiasts. That means the navigation experience must be excellent, but also offer things those apps don't: route planning along specific roads, not just destinations.

#### Setting a Destination (Solo)

**How it works:**
- User can search for a destination (address, place name, POI)
- Route is generated and displayed on map
- User taps "Go" to begin turn-by-turn navigation in driving mode
- Standard navigation experience: upcoming turns, ETA, rerouting

#### Route Planning Along Specific Roads

**The problem we're solving:**
Car enthusiasts often care more about *which roads they drive* than where they end up. Current navigation apps (Apple Maps, Google Maps, Waze) optimize for fastest/shortest route and make it painful to force a route along a specific road.

**What the user sees:**
- A route creation interface that lets you:
  - Search and select specific roads/highways to include
  - Drop waypoints along a path by tapping the map
  - Drag the route line to adjust it through specific roads
  - Create loop routes (start and end at same place)
- The interface should minimize taps — route building should feel fluid, almost like drawing

**Behavior:**
- The app generates a navigable route through the selected roads/waypoints
- The route can be started immediately or shared to a convoy
- Routes created this way work with turn-by-turn just like destination routes

#### Convoy Group Route

**How it works:**
- Any member of a convoy can set a group destination/route
- When a group route is set, all convoy members see it on their map
- Each member gets individually-routed navigation from their current position to the destination
- Optional: "Meet up first" mode — routes everyone to a common starting point before proceeding to the destination together

**What each member sees:**
- A notification: "[Username] set a route: [Destination Name]"
- Their personal route line from their current location
- Option to accept/start navigation or dismiss

---

### 4.5 Convoys

Convoys are the core social unit of SlipStream — temporary, live driving lobbies (like multiplayer game parties). They are ephemeral; they exist while people are driving together and dissolve when done.

#### Creating a Convoy

**What the user sees:**
- A creation sheet with:
  - Convoy name (optional — defaults to something contextual like "Open Cruise")
  - Visibility: Public (anyone can request to join) or Private (invite only)
  - Destination (optional — can be set later or left open-ended)
- "Go Live" button — immediately creates the convoy and puts it on the map

**Behavior:**
- Creator becomes the convoy leader
- Convoy appears on the map as a visible entity for nearby users (if public)
- Creator's status changes to "In Convoy"

#### Joining a Convoy

**Methods of joining:**

| Method | Flow |
|--------|------|
| **Invite** | Convoy member sends invite → recipient gets notification → tap to accept |
| **Request** (public convoys) | User taps convoy on map → "Request to Join" → leader/members approve |
| **Friend's convoy** | User sees friend is in a convoy → tap to join directly |

**What happens when you join:**
- Your status changes to "In Convoy"
- You appear in the convoy's member list
- You gain access to the convoy group chat
- You can see all other convoy members' live positions
- If there's an active group route, you see it on your map

#### Convoy Lobby View

**What the user sees:**
- Convoy name and status (Forming / Active / En Route)
- Member list with:
  - Profile photo, username, car name
  - Real-time status (driving, parked, en route to group)
  - Distance from you or from group
- Group route info (if set): destination name, ETA
- Group chat (text, ephemeral)
- Quick action buttons
- "Leave Convoy" option

**Leader controls:**
- End convoy (dissolves it for everyone)
- Remove members
- Set group route
- Toggle public/private

**Member controls:**
- Leave convoy
- Set group route (any member can)
- Send quick actions
- Access group chat

#### Convoy on the Map

**How it appears to non-members:**
- A grouped/clustered marker showing the convoy exists
- Tap to see: convoy name, member count, public/private status
- If public: "Request to Join" button

**How it appears to members (in driving mode):**
- Each convoy member is visible as a live-position marker
- Route line visible if group route is active
- Compact member indicators (not full profiles — glanceable at speed)

---

### 4.6 Quick Actions (Convoy Feature)

Quick actions are predefined one-tap alerts that broadcast to all convoy members. They solve the problem of communicating simple, time-sensitive information while driving without typing.

#### Available Quick Actions (MVP)

| Action | Icon | Meaning |
|--------|------|---------|
| **Pulling Over** | 🅿️ | "I'm stopping on the side of the road" |
| **Gas Stop** | ⛽ | "I need fuel / let's stop for gas" |
| **Slow Down** | ⚠️ | "Reduce speed" |
| **Regrouping** | 🔄 | "Let's regroup / I'm waiting for the group" |

#### Behavior

- Tapping a quick action sends a notification to all other convoy members
- The notification appears as a brief toast/banner on their driving HUD
- Quick actions are also logged in the convoy group chat as system messages
- Cooldown period to prevent spam (e.g., can't send the same action within 30 seconds)

---

### 4.7 Social Page

A dedicated page for managing your social graph and discovering drivers. Accessed via tab/swipe from the map.

#### What the User Sees

**Sections:**

1. **Friend Requests** (if any pending)
   - Incoming requests with Accept/Decline
   - Profile preview (username, car, mutual friends)

2. **Friends List**
   - All friends with their current status and active car
   - Online friends sorted to top
   - Status indicators (Driving, Parked, In Convoy, Offline)
   - Tap a friend to view profile or find them on map

3. **Nearby Drivers**
   - List view of the same drivers visible on the map
   - Shows: username, car, status, distance
   - Tap to view profile or locate on map
   - Acts as an alternative to map-based discovery

4. **Search**
   - Search bar to find users by username
   - Results show profile preview with "Add Friend" button

#### Interactions

| Action | Result |
|--------|--------|
| Tap a friend | Opens their profile with options: Message (future), Invite to Convoy, View on Map |
| Tap "Add Friend" | Sends friend request |
| Tap nearby driver | Opens their profile card (same as tapping on map) |
| Swipe on friend | Quick actions: Invite to Convoy, Remove Friend |

---

### 4.8 Profile & Garage

Accessed via tab/swipe. This is where users manage their identity, cars, and preferences.

#### Profile View

**What the user sees:**
- Profile photo (editable)
- Username and handle
- Current status indicator
- Active car displayed prominently
- Stats (future): drives completed, convoys joined, friends count
- Edit profile button

#### Garage

**What the user sees:**
- List/grid of all cars in the user's garage
- Each car shows: photo, year/make/model/trim, color, mod count
- One car marked as "Active" (shown on map and in profile)
- "Add Car" button

**Car detail/edit view:**
- Year, Make, Model, Trim (structured fields, ideally with autocomplete/picker)
- Color (picker or custom)
- Photo(s) of the car (camera or library)
- Mods list (freeform tags or structured entries)
- "Set as Active" button
- Delete car option

**Behavior:**
- The active car is what other users see when they tap your marker
- Changing active car updates your appearance across the app immediately
- At least one car must remain in the garage at all times

---

### 4.9 Convoy Group Chat

Each active convoy has a built-in group chat. It is ephemeral — when the convoy ends, the chat history is gone.

#### What the User Sees

- Chat thread within the convoy lobby view
- Messages from all convoy members
- System messages for events:
  - "[User] joined the convoy"
  - "[User] left the convoy"
  - "[User] set a route to [Destination]"
  - Quick action alerts (e.g., "[User] — Gas Stop")
- Text input field at bottom
- Quick action button row above keyboard (or accessible via + button)

#### Behavior

- Messages are real-time (WebSocket/Supabase Realtime)
- Chat is only accessible while you're a member of the convoy
- When the convoy dissolves, the chat is deleted
- No message editing or deletion (keep it simple)
- No media/photo sharing for MVP (text + system messages only)

---

### 4.10 Settings & Preferences

Accessed from Profile page or a gear icon.

#### Settings Sections

**Visibility & Privacy:**
- Location sharing toggle: **On** / **Friends Only** / **Off (Ghost Mode)**
  - On: All nearby users can see you
  - Friends Only: Only friends see your position
  - Off: You're invisible on the map but can still see everyone else
- Discovery radius: Slider or preset options (5 mi / 10 mi / 20 mi / 50 mi)
  - Default: 15 miles

**Units & Preferences:**
- Speed units: MPH / KPH
- Distance units: Miles / Kilometers
- Map style preferences (if applicable)

**Notifications:**
- Friend requests: on/off
- Convoy invites: on/off
- Chat messages: on/off

**Account:**
- Edit email/phone
- Change password
- Sign out
- Delete account

---

### 4.11 Notifications

Notifications are triggered **only by direct user actions** — no algorithmic suggestions, no "you might like this" spam.

#### MVP Notification Types

| Trigger | Notification |
|---------|-------------|
| Someone sends you a friend request | "[Username] wants to be friends" |
| Someone accepts your friend request | "[Username] accepted your friend request" |
| You receive a convoy invite | "[Username] invited you to [Convoy Name]" |
| Someone requests to join your convoy | "[Username] wants to join your convoy" |
| New message in your active convoy chat | "[Username] in [Convoy Name]: [message preview]" |
| Quick action in your convoy | "[Username]: Pulling Over / Gas Stop / etc." |

#### Behavior

- Notifications respect system notification settings
- In-app: shown as banners/toasts
- Push: delivered when app is backgrounded
- No notification sounds while in driving mode (or subtle, non-distracting sounds only)

---

## 5. User Statuses & Presence System

The presence system is how users communicate what they're doing at a glance.

### Status Types

| Status | Meaning | Map Visibility | Marker Color |
|--------|---------|---------------|--------------|
| **Driving** | Actively on the road | Visible to all (per visibility setting) | Cyan |
| **Parked** | Stationary, car is stopped | Visible to all (per visibility setting) | Green |
| **In Convoy** | Currently in an active convoy | Visible to all (per visibility setting) | Blue |
| **En Route** | Navigating to a destination or convoy | Visible to all (per visibility setting) | Orange |
| **Offline** | Not sharing location | Visible to friends only (dimmed/gray marker) | Gray |

### Status Transitions

- **Entering driving mode** → Driving
- **Stopping for extended period** → Could auto-transition to Parked (or manual)
- **Joining a convoy** → In Convoy
- **Starting navigation to convoy/destination** → En Route
- **Closing app / toggling off** → Offline
- **Ghost mode** → Not visible to anyone (but user can still see the map)

---

## 6. Discovery & Filtering

### Discovery Radius

- User-configurable setting (default: 15 miles)
- Determines which drivers/convoys appear on your map and in your nearby list
- Does NOT change based on map zoom/viewport — it's a fixed radius from your position

### Map Filters

**Basic filters (always visible as pills):**
- All
- Drivers
- Convoys

**Advanced filters (accessible via filter sheet):**
- By status: Driving, Parked, En Route, In Convoy
- By car make (e.g., only show Toyotas, only show BMWs)
- By friends only (toggle)

### Sorting (Social/List View)

- Distance (nearest first) — default
- Status (driving first, then parked, then offline)
- Recently active

---

## 7. MVP Scope Definition

### In Scope (Must Ship)

| Feature | Notes |
|---------|-------|
| Auth (Apple, Google, Email/Phone) | Via Supabase |
| Profile creation with required car | Onboarding flow |
| Garage (multiple cars, active selection) | Add, edit, delete, swap active |
| Live map with nearby drivers | Real-time position updates |
| Visibility control (On / Friends Only / Ghost) | Simple three-tier |
| Driver presence & status | Driving, Parked, In Convoy, En Route, Offline |
| Map markers with status colors | Tap for details |
| Convoy creation & joining | Public/private, invite/request |
| Convoy group chat (ephemeral) | Text + system messages |
| Convoy group route | Set destination, individual navigation |
| Quick actions in convoy | Pull over, gas stop, slow down, regroup |
| Driving mode with HUD | Speed, road name, speed limit, convoy status |
| Turn-by-turn navigation | Integrated, not a redirect to another app |
| Route planning with waypoints | Build routes along specific roads |
| Friend system | Add, accept, remove, search by username |
| Social page with friends & nearby list | Alternative to map discovery |
| Advanced filtering | By status, car make, friends only |
| Push notifications | Friend requests, invites, messages, quick actions |
| Settings & preferences | Visibility, radius, units, notifications |

### Nice-to-Have (Ship If Time Allows)

| Feature | Notes |
|---------|-------|
| "Meet up first" convoy routing | Route everyone to common point before destination |
| Route line drag-to-adjust | More fluid route building UX |
| Loop route creation | Start and end at same place |
| Road name display on route preview | Show which roads the route follows |
| Convoy member distance/ETA to group | See how far away each person is |
| Auto status transitions | Auto-detect parked vs driving based on motion |

### Post-MVP (Documented for Future)

| Feature | Notes |
|---------|-------|
| 3D car models on map | Animated car matching user's actual vehicle |
| Proximity voice chat | Discord-style or walkie-talkie push-to-talk |
| Passenger mode | Merge into friend's marker, shared convoy access (Spotify Jam style) |
| Intelligent route discovery | Highlight curvy roads, road scoring, route recommendations |
| Route saving & sharing | Save routes, share with friends/community |
| Drive history & stats | Miles driven, drives completed, routes taken |
| Car verification system | Prove you own the car you claim |
| Meetup spots | User-created gathering points on map |
| Curated friend suggestions | Based on cars, mutuals, location (like Snapchat Quick Add) |
| DMs / direct messaging | 1-on-1 text conversations |
| Media in chat | Photos, voice messages in convoy chat |
| En-route convoy join | Smart routing to catch a moving convoy |
| Optimal meetup point calculation | Find closest common point for all members |
| Gamification | Badges, points, achievements |
| Event scheduling | Plan future drives/meets |
| Custom map themes | Personalized map styling |
| Social feed / car spotting | Content beyond real-time location |

---

## 8. Design Principles

### Visual Identity

- **Dark-first**: The app is always in dark mode. Car culture is nocturnal. Night drives, moody lighting, dark interiors.
- **Accent color**: Cyan/teal (current: `rgb(51, 209, 240)`) — high contrast against dark backgrounds, feels techy and automotive.
- **Typography**: Bold, heavy weights. The app should feel confident and high-energy, not soft or minimal.
- **Map style**: Dark/muted map tiles. The map is a backdrop for the social layer, not a bright distraction.

### Interaction Principles

- **Speed over ceremony**: Creating a convoy should take < 10 seconds. Joining should be one tap.
- **Glanceable while driving**: Driving mode must be safe. Large text, high contrast, minimal interaction required.
- **Live by default**: Everything should feel real-time. Markers move, statuses update, presence pulses.
- **Car identity is first-class**: Your car is as important as your face. It's prominently displayed everywhere.

### Safety Considerations

- No interactions in driving mode should require extended attention or complex input
- Speed/location data is never used to encourage speeding or reckless behavior
- Speed limit display is informational only — no "racing" features
- The app does not reward or gamify high speeds
- Ghost mode exists so users always have an escape valve from being tracked

---

## 9. Platform & Technical Constraints (Non-Functional)

These are constraints that affect feature design, not implementation details:

- **iOS only** for initial release
- **Location permission required** for core functionality (app is useless without it)
- **Background location** needed for driving mode to work when phone is locked
- **Battery efficiency** is critical — users will have the app running for extended drives
- **Offline tolerance** — the app should degrade gracefully in areas with poor signal (common on canyon roads)
- **Low-latency updates** — location sharing should feel real-time (< 3 second delay between actual position and what others see)

---

## 10. Success Metrics (What "Working" Looks Like)

For the MVP, we validate these behaviors:

| Metric | Signal |
|--------|--------|
| Users keep location sharing on | They trust the app and see value in being visible |
| Users create or join convoys | The coordination feature has real utility |
| Users use it for navigation | It's good enough to replace Apple/Google Maps |
| Users return more than once per week | It's not a novelty — it's a habit |
| Users add friends | The social graph is growing organically |
| Convoys have 3+ members | People actually drive together, not just solo |

---

## Appendix A: Screen Flow Diagram (Conceptual)

```
┌─────────────────────────────────────────────────┐
│                   APP LAUNCH                      │
└─────────────────────┬───────────────────────────┘
                      │
            ┌─────────▼─────────┐
            │  Auth Required?    │
            └─────────┬─────────┘
                      │
         ┌────────────┼────────────┐
         │ Yes                     │ No
         ▼                         ▼
┌─────────────────┐      ┌─────────────────┐
│  Sign In/Up     │      │                 │
│  + Onboarding   │      │                 │
│  (if new user)  │      │                 │
└────────┬────────┘      │                 │
         │               │                 │
         └───────────────┼─────────────────┘
                         │
                         ▼
          ┌──────────────────────────┐
          │      MAP (Home)          │
          │    Explorer Mode         │
          │                          │
          │  ┌────────────────────┐  │
          │  │ Tap marker         │──┼──▶ Driver/Convoy Info Card
          │  │ Tap "Drive"        │──┼──▶ Driving Mode
          │  │ Tap "Convoy"       │──┼──▶ Create Convoy Sheet
          │  │ Tap profile avatar │──┼──▶ Profile/Garage
          │  └────────────────────┘  │
          └──────────┬───────────────┘
                     │
          ┌──────────┼──────────┐
          │ Swipe/Tab│          │ Swipe/Tab
          ▼          │          ▼
┌──────────────┐     │   ┌──────────────┐
│   Social     │     │   │   Profile    │
│   Page       │     │   │   & Garage   │
└──────────────┘     │   └──────────────┘
                     │
                     ▼
          ┌──────────────────────────┐
          │     DRIVING MODE         │
          │                          │
          │  Speed, Road, Limit      │
          │  Convoy HUD (if active)  │
          │  Navigation (if routing) │
          │                          │
          │  Exit → back to Explorer │
          └──────────────────────────┘
```

---

## Appendix B: Convoy Lifecycle

```
┌────────────┐     ┌────────────┐     ┌────────────┐     ┌────────────┐
│  Created   │────▶│  Forming   │────▶│   Active   │────▶│ Dissolved  │
│            │     │            │     │            │     │            │
│ Leader     │     │ Members    │     │ Driving    │     │ Leader     │
│ creates    │     │ joining    │     │ together   │     │ ends -or-  │
│ lobby      │     │ route set  │     │ chat live  │     │ all leave  │
└────────────┘     └────────────┘     └────────────┘     └────────────┘
```

---

## Appendix C: Visibility Matrix

| Your Setting | Who sees you |
|-------------|-------------|
| **On** | All users within their discovery radius |
| **Friends Only** | Only users you've mutually friended |
| **Ghost Mode (Off)** | Nobody — you're invisible on the map |

In all cases, **you** can see everyone else who is visible. Ghost mode is one-directional — it hides you, it doesn't hide the world from you.

Friends who are **Offline** still appear to you (dimmed/gray marker) so you know they exist, but their position may not be live-updating.

---

*End of document. This is a living spec — update as decisions are made and features are validated with real users.*
