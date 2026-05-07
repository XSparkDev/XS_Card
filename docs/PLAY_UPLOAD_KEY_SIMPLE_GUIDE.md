# Google Play signing — simple guide (for anyone)

This guide explains **why** Google rejected your app file and **exact steps** to fix it by creating a **new upload key** when you no longer have the old one.

---

## Part 1 — What’s going on (no jargon)

Think of your app like a **parcel** you send to Google.

- **Google** keeps a special **master seal** (they call this the *app signing key*). That seal is what users’ phones ultimately trust when they install from the Play Store.
- **You** must seal each parcel **your way** first (they call this the *upload key*). Google checks that seal to know **you** are the real publisher. Then Google opens your parcel and re-seals it with their master seal for users.

You built an app file (`.aab`) sealed with the **wrong** key — like using a random house key instead of the key Google already knows belongs to you. So Play said: “This isn’t signed with the upload key we expect.”

**Good news:** If your app uses **Google Play App Signing** (most apps do today), you **do not** need to find the lost old key. You can ask Google to accept a **brand‑new** upload key. The master seal users rely on usually **stays the same**; only **your** “parcel sealing” key changes.

---

## Part 2 — Who must do what

| Role | What they do |
|------|----------------|
| **Play Developer account owner** (or someone with full signing permissions) | Starts the **upload key reset** in Google Play Console and works through Google’s steps. |
| **You or a developer** | Creates the **new key file** on a computer and keeps passwords **secret** and **backed up**. |

If you are not the owner, share this document with them and ask them to complete the Console steps while you (or your developer) create the key file.

---

## Part 3 — Step-by-step: create the new upload key (on a Mac)

These steps use tools that come with normal Android development. If you don’t have them, ask a developer to run this once — **you** still keep the passwords.

### Step A — Open Terminal

On Mac: **Applications → Utilities → Terminal**.

### Step B — Go to a safe folder

Example (creates a folder on your Desktop — adjust if you prefer):

```bash
mkdir -p ~/Desktop/XSCard-play-keys
cd ~/Desktop/XSCard-play-keys
```

**Important:** This folder will hold something as sensitive as a password vault. Don’t put it in Dropbox/email unless you trust encryption and access control.

### Step C — Create the new keystore file

Run this **once**. Replace the parts in `ALL_CAPS` with your choices:

```bash
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore upload-keystore-new.p12 \
  -alias YOUR_ALIAS_NAME \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

You will be asked for:

1. **Keystore password** — invent a strong password; **save it** in a password manager.
2. **Your name / organization** — can match your company (Google uses this for the certificate details).
3. **Key password** — can be the **same** as the keystore password (simplest) or different; **save it**.

This creates **`upload-keystore-new.p12`** in that folder. **That file plus those passwords is your new upload identity.** Lose them and you repeat this whole process.

### Step D — Export the certificate Google needs (public file)

Still in the same folder:

```bash
keytool -export -rfc \
  -keystore upload-keystore-new.p12 \
  -alias YOUR_ALIAS_NAME \
  -file upload_certificate.pem
```

Use the **same alias** as in Step C. Enter the keystore password when asked.

You now have **`upload_certificate.pem`**. This file is **safe to share with Google** — it proves which key you created; it does **not** contain your private password.

---

## Part 4 — Step-by-step: tell Google Play to accept your new key

Menus change slightly over time; look for words like **App signing**, **Upload key**, **Reset**.

1. Sign in to **[Google Play Console](https://play.google.com/console)** with an account that is **Owner** or has permission to manage **app signing**.
2. Select your app (**XS Card** / `com.p.zzles.xscard`).
3. Go to **Test and release** → **Setup** → **App signing**  
   (sometimes linked from **App integrity**).
4. Find the section about a **lost or compromised upload key** or **request upload key reset** / **register new upload key** — wording varies by region and UI updates.
5. Follow Google’s wizard: you typically **upload** `upload_certificate.pem` or paste certificate details as instructed.
6. Submit the request. **Google reviews it.** When approved, you’ll get confirmation (email / Console notice).

Until Google **finishes** approving the new upload key, uploads signed **only** with the new key may still fail — wait for their confirmation.

**Official Google help:** search for *“Use Play App Signing”* and *“Lost or compromised upload key”* in the Play Console Help Center, or open:  
https://support.google.com/googleplay/android-developer/answer/9842756  

---

## Part 5 — After Google approves: use the key for this project

Your codebase is already set up to read secrets from a **local** file that is **not** committed to Git.

1. Copy **`upload-keystore-new.p12`** (or convert/rename if you prefer `.jks`; PKCS12 is fine for Gradle) to:

   `XS_Card/android/app/play-upload.keystore`  

   *Or keep `.p12` path — see note below.*

2. Copy `XS_Card/android/keystore.properties.example` to **`XS_Card/android/keystore.properties`**.
3. Edit **`keystore.properties`**:
   - **`storeFile=`** — path relative to the **`android/`** folder, e.g. `app/play-upload.keystore` if you renamed the file to match.
   - **`storePassword`**, **`keyAlias`**, **`keyPassword`** — exactly what you used when creating the key.

If your file is still **`upload-keystore-new.p12`** inside **`android/app/`**, set:

```properties
storeFile=app/upload-keystore-new.p12
```

4. Build the release bundle again:

```bash
cd XS_Card/android
./gradlew bundleRelease
```

5. Upload **`android/app/build/outputs/bundle/release/app-release.aab`** to Play Console.

**If you use Expo EAS cloud builds:** someone with Expo project access must add this same keystore in **`eas credentials`** so Expo signs builds with the **new** upload key — otherwise Expo might still use an old key or fail.

---

## Part 6 — Backup checklist (do this immediately)

- [ ] **`upload-keystore-new.p12`** (or `.jks`) stored in **two** secure places (e.g. encrypted USB + password manager attachment — **not** only email).
- [ ] **Keystore password** and **key password** in a **password manager**.
- [ ] **Key alias** written down with those passwords.
- [ ] Confirm **`upload_certificate.pem`** fingerprint (optional technical check with `keytool -list -v`) matches what Play Console shows **after** reset.

---

## Part 7 — If anything goes wrong

| Situation | What it means |
|-----------|----------------|
| Play still says “wrong key” | Either Google hasn’t finished the reset yet, or you’re signing with an **old** keystore — double‑check `keystore.properties` and Expo credentials. |
| You’re not the Play account owner | Only someone with the right Console role can start the reset — escalate to them with this doc. |
| Google says your app **doesn’t** use Play App Signing | Rare for modern bundle apps; follow Play Console help or support — options differ from the upload‑key reset path above. |

---

## Short summary

1. **Create** a new keystore + passwords (**Steps Part 3**).  
2. **Export** `upload_certificate.pem`.  
3. **Owner** requests **upload key reset** in Play Console (**Part 4**).  
4. **Wait** for Google approval.  
5. **Point** this repo’s `keystore.properties` at the new file and **rebuild** the `.aab` (**Part 5**).  
6. **Back everything up** (**Part 6**).

You are **not** “logging into Expo to reset Play.” Expo only **stores** a copy of a keystore if you use cloud builds; the **authority** that accepts your new key is **Google Play**.
