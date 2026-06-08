# Release Checklist

HNS Investments releases are public. Keep wallet data, local scan output, bridge tokens, Apple secrets, signed artifacts, and notarization logs out of git.

## Version

Current planned release: `v0.1.0`

Expected macOS release assets:

- `HNS-Investments-0.1.0-arm64.dmg`
- `HNS-Investments-0.1.0-x64.dmg`
- `SHA256SUMS.txt`

## Mike Machine Prep

Use Mike's machine for source review, tests, and unsigned packaging only.

```bash
npm ci
npm test
CSC_IDENTITY_AUTO_DISCOVERY=false npm run package-mac
git diff --check
git status -sb
```

Do not publish the release from Mike's machine.

## Janice Signing Machine

Janice's machine is the trusted Apple Developer ID signing/notarization machine.

```bash
cd /Users/janicejung/Documents/GitHub/hns-investments-companion
git fetch origin --tags
git checkout main
git pull --ff-only origin main
npm ci
npm test
```

Build signed, notarized, and stapled DMGs:

```bash
export NOTARY_KEYCHAIN_PROFILE="skyinclude-notary"
export MAC_ARCHES="arm64 x64"
npm run package-mac-notarized
```

If a keychain profile is unavailable, use Apple notarization environment variables outside the repo. Do not write Apple IDs, app-specific passwords, team IDs, `.p8`, `.p12`, or keychain material into repo files or release notes.

## Verification

Run on Janice's machine after packaging:

```bash
codesign --verify --deep --strict --verbose=2 "dist/mac-arm64/HNS Investments.app"
xcrun stapler validate "dist/mac-arm64/HNS Investments.app"
spctl --assess --type execute --verbose "dist/mac-arm64/HNS Investments.app"
codesign --verify --verbose=2 "dist/HNS-Investments-0.1.0-arm64.dmg"
xcrun stapler validate "dist/HNS-Investments-0.1.0-arm64.dmg"
spctl --assess --type open --context context:primary-signature --verbose "dist/HNS-Investments-0.1.0-arm64.dmg"
hdiutil verify "dist/HNS-Investments-0.1.0-arm64.dmg"
(cd dist && shasum -a 256 HNS-Investments-0.1.0-*.dmg > SHA256SUMS.txt)
cat dist/SHA256SUMS.txt
```

Repeat app and DMG verification for x64 before publishing if x64 is included.

## GitHub Release

Create a prerelease only after both DMGs are signed, notarized, stapled, verified, and checksummed.

```bash
gh release create v0.1.0 \
  dist/HNS-Investments-0.1.0-arm64.dmg \
  dist/HNS-Investments-0.1.0-x64.dmg \
  dist/SHA256SUMS.txt \
  --repo shadstoneofficial/hns-investments-companion \
  --title "HNS Investments v0.1.0" \
  --prerelease \
  --notes-file docs/RELEASE_NOTES_v0.1.0.md
```

Verify:

```bash
gh release view v0.1.0 --repo shadstoneofficial/hns-investments-companion --json tagName,targetCommitish,isPrerelease,url,assets
```

## Do Not Publish If

- The version does not match the tag.
- The release was built from an unknown commit.
- macOS notarization is still pending or failed.
- Stapling, Gatekeeper, codesign, or DMG verification fails.
- `dist/`, `.app`, `.dmg`, notarization scratch files, logs, bridge manifests, screenshots, wallet exports, or scan outputs are staged.
