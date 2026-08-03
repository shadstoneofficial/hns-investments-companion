# GFAVIP Cloud Sync Design

Status: Proposed

## Purpose

HNS Investments is local-first. User-created tags currently remain on the device in
`domain-tags.json`. Optional GFAVIP Cloud Sync would let a user back up, restore,
and manage domain metadata across the desktop application and an HNS Investments
web application.

Cloud sync must be optional, understandable, reversible, and independent of Bob
LearnHNS wallet access. The default for every installation is **No cloud sync**.

## Product Principles

- Local use remains fully functional without a GFAVIP account or internet access.
- A user explicitly selects one of three sync levels. Nothing is uploaded during
  installation, scanning, or GFAVIP sign-in alone.
- The consent screen states that syncing tags also uploads the domain names attached
  to those tags.
- Seed phrases, private keys, wallet passwords, signing capability, Bob files, and
  authentication credentials are never synced at any level.
- Changing to a more private level must offer deletion of data that is no longer in
  scope.
- Users can inspect, export, and delete their cloud data and revoke connected
  devices.

## The Three Sync Levels

| Level | User-facing name | Cloud data | Local behavior |
| --- | --- | --- | --- |
| 1 | **No cloud sync** (default) | Nothing is uploaded. | Tags remain in the local `domain-tags.json` store. The app does not require GFAVIP sign-in. |
| 2 | **Sync selected tags** | Only tag assignments the user explicitly selects, plus the domain names required for those assignments. | All other names and tags remain local-only. |
| 3 | **Sync full account** | All discovered domain names and all user-created tags, with the minimum portfolio metadata needed by the web application. | The local store remains the offline cache and changes sync in both directions. |

### Level 1: No cloud sync

This is the default for new and existing installations.

- No portfolio or tag data is sent to HNS Investments or GFAVIP.
- Existing local tagging, filtering, search, and exports continue unchanged.
- GFAVIP sign-in is not required.
- The user can still make manual backups of `domain-tags.json` or export CSV/JSON.
- If a user changes from a cloud level to this level, the app presents two explicit
  choices:
  - **Turn off sync and delete my cloud copy** (recommended)
  - **Pause sync and keep my cloud copy**

Pausing must not be described as deletion.

### Level 2: Sync selected tags

The user selects tag labels such as `AI agent`, `first name`, or `actions` from a
checklist. Only the selected tag assignments are synchronized.

Example:

- `alice` has the local tags `AI agent` and `first name`.
- The user enables cloud sync only for `AI agent`.
- The cloud receives `alice` + `AI agent`.
- The `first name` assignment remains local-only.

Rules:

- Adding a tag to the selected list queues its existing assignments for upload.
- Removing a tag from the selected list removes those assignments from the cloud
  after confirmation.
- A cloud domain record is removed when it no longer has a selected synced tag.
- The web application clearly identifies this as a partial view of the local
  portfolio.
- Tags created on the web are synced only if they are included in the selected sync
  list. Otherwise, the web application asks whether to add that tag to the list.

This level is intended for users who want online access to particular collections
without placing their complete domain inventory online.

### Level 3: Sync full account

This level synchronizes the complete HNS Investments portfolio metadata view:

- All discovered domain names
- All user-created tags and assignments
- Display-safe domain properties needed by the web experience, such as Unicode
  rendering, IDN/emoji traits, ownership status, and renewal height
- Optional wallet grouping only when the user separately enables **Sync wallet
  labels**

The following remain excluded:

- Seed phrases and private keys
- Wallet passwords or unlock material
- Bob LearnHNS files, bridge tokens, or API credentials
- Owner hashes and other identifiers not required by the web interface
- Transaction-signing capability
- HNS balances and financial history unless a separate future feature introduces
  its own explicit consent

“Full account” therefore means the full **HNS Investments domain portfolio
metadata**, not custody or a cloud copy of the underlying wallet.

## Settings and Consent Experience

The desktop application should add a **Cloud Sync** settings screen containing:

1. Current GFAVIP account and connection status
2. Current sync level
3. Plain-language description of data included and excluded
4. Tag checklist when Level 2 is selected
5. Optional wallet-label toggle when Level 3 is selected
6. Last successful sync and pending-change count
7. **Sync now**, **Disconnect this device**, **Export cloud data**, and
   **Delete cloud data** actions

Moving from Level 1 to Level 2 or 3 requires a preview before upload:

- Number of domain names
- Number of tag assignments
- Whether wallet labels are included
- Exact GFAVIP account receiving the data

Moving from Level 3 to Level 2 shows which cloud records will be deleted. No level
change should silently retain data outside the newly selected scope.

## GFAVIP Authentication and Device Pairing

Use the GFAVIP Wallet secure code flow:

1. The desktop application requests a short-lived pairing request from the HNS
   Investments backend.
2. The system browser opens an exact HNS Investments HTTPS pairing destination.
3. If necessary, the web application starts GFAVIP authorization using
   `flow=code` and a fixed, allowlisted callback.
4. The callback reads only the one-time code and exchanges it server-to-server with
   GFAVIP Wallet. Identity is taken only from the successful exchange response.
5. The user reviews and approves the named desktop device.
6. The backend issues a revocable, app-scoped device credential. The desktop app
   receives it through the pairing request, not through a reusable token in a URL.
7. The desktop stores the device credential using the operating-system credential
   store or Electron `safeStorage`, never in `domain-tags.json`.

Pairing state and return destinations must be one-use, short-lived, same-origin,
and stored in signed or server-side state. Reject absolute external return URLs,
protocol-relative URLs, malformed values, and expired state. After first login, the
user must return to the pairing or sync destination that initiated authentication,
not a generic dashboard.

Each connected device should have:

- A user-visible name
- Creation and last-seen timestamps
- A revocable device identifier
- No access to wallet or signing operations

## Web Application

The initial HNS Investments web application should provide:

- GFAVIP SSO sign-in and sign-out
- Searchable domain list based on the selected sync level
- Tag creation, editing, deletion, and filtering
- A visible indicator when the account uses selected-tag sync and therefore shows a
  partial portfolio
- Connected-device management
- Cloud data export
- Cloud data deletion and account-disconnection controls
- Privacy, retention, support, and account-deletion information

The final HTTPS host, callback URL, stable GFAVIP service ID, legal owner, support
contact, and catalog entry require owner confirmation before production onboarding.

## Data Model

Use server-owned identity from GFAVIP SSO and store sync data under the stable
GFAVIP user ID. Do not accept a user ID supplied by the desktop client.

A tag-assignment-oriented model supports multi-device merging:

```text
users
  gfavip_user_id
  selected_sync_level
  sync_preferences

devices
  user_id
  device_id
  display_name
  created_at
  last_seen_at
  revoked_at

domains
  user_id
  normalized_name
  display_metadata
  revision
  deleted_at

tag_assignments
  user_id
  normalized_name
  normalized_tag
  display_label
  present
  revision
  updated_at
```

Every API query must derive `user_id` from the authenticated session. Database
constraints must prevent one user from reading or changing another user’s records.

## Synchronization Behavior

- The desktop app writes locally first and queues an operation for cloud delivery.
- The backend assigns a monotonically increasing revision or cursor.
- Devices pull only changes after their last acknowledged cursor.
- Adds and removals are idempotent. Removals use tombstones long enough to prevent
  an offline device from resurrecting deleted tags.
- Distinct tags added on different devices merge naturally.
- Conflicting changes to the same tag assignment resolve using the server revision,
  with enough event metadata for diagnostics.
- Switching levels runs a scope-reconciliation job that removes cloud records no
  longer allowed by the selected level.
- Signing out does not imply deleting local metadata. The choice is stated
  explicitly.

## API Shape

Illustrative endpoints:

```text
POST   /api/v1/device-pairings
GET    /api/v1/device-pairings/{pairing_id}
POST   /api/v1/device-pairings/{pairing_id}/approve

GET    /api/v1/sync/preferences
PUT    /api/v1/sync/preferences
POST   /api/v1/sync/operations
GET    /api/v1/sync/changes?after={cursor}

GET    /api/v1/account/export
DELETE /api/v1/account/sync-data
GET    /api/v1/account/devices
DELETE /api/v1/account/devices/{device_id}
```

All mutating endpoints require authentication, CSRF protection where cookies are
used, bounded request sizes, schema validation, rate limits, and audit-safe logs that
exclude domain names and credentials by default.

## Privacy and Security Requirements

- TLS in transit and encryption at rest
- Explicit opt-in with Level 1 selected by default
- Data minimization enforced by the backend, not only hidden in the interface
- Secure, HTTP-only web sessions
- Revocable app-scoped desktop credentials
- No secrets, SSO tokens, domain names, or wallet evidence in application logs
- Cloud export and permanent deletion controls
- Defined deletion completion period and tombstone retention period
- Published privacy and retention policy before production launch
- Tests proving cross-account isolation
- Backup restoration tested without exposing one user’s data to another

End-to-end encryption could be offered later with a separate recovery key or
passphrase. It should not be advertised until the web and desktop clients can
encrypt, decrypt, recover, and rotate keys without the server receiving plaintext
keys.

## Delivery Phases

### Phase 1: Account and cloud backup

- GFAVIP SSO web application
- Secure desktop pairing
- Three-level consent UI
- Initial upload and restore to a second computer
- Device revocation, export, and cloud deletion

### Phase 2: Two-way synchronization

- Offline operation queue
- Incremental pull cursors
- Add/remove merging and tombstones
- Scope reconciliation when changing sync levels
- Web tag editing

### Phase 3: Expanded web portfolio

- Full-account browsing and filtering
- Optional wallet labels
- Additional display-safe portfolio metadata
- Any new data class requires separate privacy review and consent

## Acceptance Criteria

- A fresh installation starts at Level 1 and makes no cloud sync request.
- Signing into GFAVIP does not upload data until the user approves a sync level.
- Level 2 uploads only selected tag assignments and their required domain names.
- Level 3 uploads all domain portfolio metadata defined in this document, but no
  wallet secret or signing material.
- A second computer can restore the authorized sync scope after device approval.
- Offline edits synchronize after reconnection without duplicating assignments.
- Downgrading a level removes out-of-scope cloud data after confirmation.
- Revoking a device prevents further API access from that device.
- Export and permanent deletion work from both the web application and desktop
  settings.
- GFAVIP callback identity is derived only from server-side one-time code exchange.
- Cross-user authorization and deletion tests pass.

## Decisions Still Required

- Production web hostname and exact SSO callback URL
- Stable GFAVIP service ID and catalog identity
- Legal owner and public support/privacy contacts
- Whether Level 3 includes wallet display labels by default or keeps them separately
  opt-in as recommended here
- Cloud retention and deletion timing
- Backend hosting and database ownership
- Whether end-to-end encrypted sync should follow the initial release
