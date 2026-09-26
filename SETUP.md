# Setting up Wanderly

Wanderly needs two free services before your friends can use it:

- **Firebase** (by Google) handles Google sign-in and stores the places, votes and chat.
- **GitHub Pages** puts the app on a public web address you can send to friends.

This takes about 15 minutes. You only do it once.

## 1. Create a Firebase project

1. Go to <https://console.firebase.google.com> and sign in with your Google account.
2. Click **Create a project** (or **Add project**).
3. Name it `wanderly` and click **Continue**.
4. Turn **Google Analytics** off (the app doesn't need it) and click **Create project**.

## 2. Turn on Google sign-in

1. In the left menu, open **Build → Authentication** and click **Get started**.
2. On the **Sign-in method** tab, click **Google**.
3. Switch **Enable** on, pick your email as the support email, and click **Save**.

## 3. Allow your website to use sign-in

1. Still in **Authentication**, open the **Settings** tab, then **Authorized domains**.
2. Click **Add domain** and enter `fazupin.github.io`.

`localhost` is already on the list, which lets you test on your own computer (see the last section).

## 4. Connect the app to your project

1. Click the gear icon next to **Project Overview**, then **Project settings**.
2. Under **Your apps**, click the web icon (`</>`).
3. Give it a nickname such as `wanderly-web`. Leave "Firebase Hosting" unticked and click **Register app**.
4. Firebase shows a block of code containing `const firebaseConfig = { ... }`.
5. Open [js/firebase-config.js](js/firebase-config.js) and replace each placeholder value with the matching value from Firebase (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`).

These values are safe to publish. They only say which project to talk to. The security rules in the next step decide who can read and write.

## 5. Create the database and its security rules

1. In the left menu, open **Build → Firestore Database** and click **Create database**.
2. For location, choose **asia-southeast1 (Singapore)**. You can't change this later.
3. Choose **Start in production mode** and click **Create**.
4. Open the **Rules** tab. Delete what's there, paste the whole of [firestore.rules](firestore.rules), and click **Publish**.

The rules make sure that:

- only signed-in people can see anything
- each person can only change their own votes
- chat messages are posted under the sender's real Google name and can't be edited
- anyone on the trip can delete a place, but only the person who added it can edit it

### Optional: only let your friends in

By default, anyone who has the link and a Google account can join. To limit it to your friends, edit this line in the rules (in Firebase and in `firestore.rules`) and click **Publish** again:

```
function guestList() { return ['you@gmail.com', 'friend1@gmail.com', 'friend2@gmail.com']; }
```

Include your own email. Anyone not on the list sees a message asking them to contact you.

## 6. Put the app online with GitHub Pages

1. Commit and push your changes to GitHub.
2. On GitHub, open your repository and go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**, pick the **main** branch and the **/ (root)** folder, then click **Save**.
4. After a minute or two, the page shows your link: `https://fazupin.github.io/Holiday-Planner/`

GitHub Pages is free for public repositories. For a private repository it needs a paid GitHub plan.

## 6b. Publish on Firebase Hosting (needed for sign-in on phones)

On iPhones, and on some Android browsers, Google sign-in fails with "Unable to save initial state" when the app is on a different website from Firebase's sign-in helper. Hosting the app on Firebase's own address, `https://wander-ly-50ea5.firebaseapp.com`, fixes this. A GitHub workflow in [.github/workflows/firebase-hosting.yml](.github/workflows/firebase-hosting.yml) publishes the site there every time `main` is pushed. It needs a key, which you set up once:

1. **Turn on Hosting.** In Firebase, open **Hosting & Serverless → Hosting** and click **Get started**. Click **Next** through the steps (you don't need to run any of the commands shown), then **Continue to console**.
2. **Create a publishing account.** Open <https://console.cloud.google.com/iam-admin/serviceaccounts?project=wander-ly-50ea5> and click **Create service account**.
   - Name: `github-deploy`, then **Create and continue**.
   - Add two roles: **Firebase Hosting Admin** and **API Keys Viewer**. Click **Continue**, then **Done**.
3. **Download its key.** Click the new `github-deploy` account, open the **Keys** tab, then **Add key → Create new key → JSON → Create**. A `.json` file downloads.
4. **Give the key to GitHub.** In your repo on GitHub, open **Settings → Secrets and variables → Actions → New repository secret**.
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Secret: open the downloaded `.json` file in Notepad, copy **everything**, and paste it in.
   - Click **Add secret**.
5. **Delete the downloaded `.json` file** from your computer. Never put it in the project folder or share it. It lets anyone publish to your site.
6. **Publish.** On GitHub, open **Actions → Deploy to Firebase Hosting → Run workflow**. Wait for the green tick, then open <https://wander-ly-50ea5.firebaseapp.com>.

From then on, every push publishes automatically. Share the **firebaseapp.com** link with friends. The GitHub Pages link still works, but sign-in may fail on phones.

## 7. Invite your friends

1. Open the app and sign in. Create a project for your trip (for example "Singapore with uni friends").
2. Open the **Project** tab and tap **Copy link**.
3. Send that invite link to your friends. When they open it and tap **Sign in with Google**, they join the project. They don't need any other account.

Each project has its own map, votes and chat, so you can run different trips with different groups. When a project's map is empty, you can tap **Add 9 popular places** to start with a list of well-known Singapore spots.

## 8. Privacy and safety settings

These match what the [Privacy Policy](privacy.html) and [Terms of Use](terms.html) promise.

### Always: publish the latest rules
Whenever `firestore.rules` changes, paste it into **Firestore → Rules** and click **Publish**.

### Show "Wanderly" on the Google sign-in screen
1. In Firebase, click the gear icon, then **Project settings → General**.
2. Set **Public-facing name** to `Wanderly` and save.
3. Optional, for a more polished sign-in screen: in the Google Cloud console (<https://console.cloud.google.com>, same Google account and project), open **Google Auth Platform → Branding**. Add:
   - App home page: `https://wander-ly-50ea5.firebaseapp.com/`
   - Privacy policy: `https://wander-ly-50ea5.firebaseapp.com/privacy.html`
   - Terms of service: `https://wander-ly-50ea5.firebaseapp.com/terms.html`

### Delete data automatically after 12 months
Everything the app saves has an `expireAt` date 12 months ahead. Opening a project pushes its date back. To make Firebase delete expired data:

1. In the Google Cloud console, open **Firestore → Time-to-live (TTL)**.
2. Create a policy for each of these collection groups, all using the timestamp field `expireAt`:
   - `projects`
   - `places`
   - `votes`
   - `messages`
   - `itinerary`
   - `reservations`

If Google asks you to upgrade to a paid plan for this, skip it and tell me. We can remove old projects another way.

### Stop bots (App Check), optional
1. Go to <https://www.google.com/recaptcha/admin> and create a **reCAPTCHA v3** key. Add the domain `wander-ly-50ea5.firebaseapp.com`, and `localhost` if you test locally.
2. In Firebase, open **App Check**, register your web app with **reCAPTCHA v3**, and paste the **secret key**.
3. Send the **site key** to Claude, or paste it into `window.APP_CHECK_SITE_KEY` in [js/firebase-config.js](js/firebase-config.js).
4. After a few days, check that App Check's request graph shows most requests as verified. Then click **Enforce** for Cloud Firestore and Authentication.

### Costs and budget alerts
On the free **Spark** plan you can't be charged. If usage runs out, the app just stops working until the next day. Budget alerts only matter if you ever upgrade to the paid **Blaze** plan. In that case, set one up under **Usage and billing**.

## Testing on your own computer

Google sign-in doesn't work if you double-click `index.html`, because it has to run on a web address. To test before publishing, start a small local web server in the project folder. For example, if you have Python installed:

```
python -m http.server 8000
```

Then open <http://localhost:8000>.

## Costs

Firebase's free plan allows 50,000 reads and 20,000 writes a day. A group of friends voting and chatting uses a tiny fraction of that. The map and place search use OpenStreetMap, which is free.
