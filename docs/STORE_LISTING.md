# Store listings and data-safety answers (draft)

Drafts for the Google Play and Apple App Store listings. Nothing here has been submitted. Items in square brackets are for the client to fill in. Check every answer against the live app before submitting; the data-safety forms are legal declarations.

## 1. Listing copy

**App name:** PollWise

**Short description (Google Play, 80 characters max):**
Short lessons and quick checks for election-day training.

**Subtitle (App Store, 30 characters max):**
Election-day training

**Full description:**
PollWise helps the people who run polling units and collation centres learn their job, one short lesson at a time.

Each course is made of short reading and video lessons, practice questions with instant feedback, and a module check. Pass the checks to open the next module. Finish a course and you receive a certificate you can download and share. Anyone can check a certificate on the PollWise website.

- Short lessons you can finish in a few minutes
- Practice questions with clear feedback after each answer
- Module checks, with the pass mark shown before you start
- Daily goals, a streak and a reminder at the time you choose
- Your progress on any phone you sign in on
- Certificates you can download and share

PollWise is training material. It is not affiliated with the Independent National Electoral Commission (INEC) or any political party, candidate or organisation. Courses are provided by [client name].

**Category:** Education
**Content rating:** Everyone (no violence, no user-generated content, no in-app purchases, no ads). Answer the IARC questionnaire (Google) and the age-rating questions (Apple) to match.

**Support contact:** [support email from Settings]
**Privacy policy URL:** [published privacy policy URL, see section 3]

## 2. Data-safety answers

### Google Play (Data safety form)

| Question | Answer |
| --- | --- |
| Does the app collect or share user data? | Collects: yes. Shares with third parties: no. |
| Is data encrypted in transit? | Yes (HTTPS only). |
| Can users request data deletion? | Yes, in the app (Profile, Delete my account). The app states that personal details are removed after seven days. |
| Does the app use ads? | No. |
| Does the app have third-party SDKs that collect data? | No analytics, crash reporting or advertising SDKs. The YouTube player loads lesson videos from YouTube when a learner plays one; YouTube's own privacy terms apply to that playback. |

| Data type | Collected | Shared | Purpose | Optional? |
| --- | --- | --- | --- | --- |
| Name | Yes | No | Account, certificates | Required |
| Email address | Yes | No | Account, password reset | Required |
| Phone number | Yes | No | Account, password reset | Required |
| Approximate location (state and local government area) | Yes | No | Course eligibility, reporting to the client | Required for onboarding; area is a choice from a list, not GPS |
| Other info (role, ward, polling unit) | Yes | No | Course eligibility, reporting | Ward and polling unit optional |
| User IDs | Yes | No | Account | Required |
| App activity (lessons completed, quiz answers, XP, streak) | Yes | No | Progress, certificates, reporting to the client | Required to learn |
| Device or other IDs | No | No | | |
| Photos, files, contacts, calendar, health, financial data | No | No | | |

Data is deleted when a learner asks to delete their account. Learning results are kept only as anonymous totals after the seven-day period.

### Apple (App Privacy, nutrition labels)

**Data used to track you:** None.

**Data linked to you:**
- Contact info: name, email address, phone number. Purpose: App functionality.
- Identifiers: user ID. Purpose: App functionality.
- Other data: state, local government area, role, ward, polling unit. Purpose: App functionality.
- Usage data: lessons completed, quiz answers, progress. Purpose: App functionality.

**Data not linked to you:** None declared (anonymous totals are created only after account deletion).

## 3. Draft privacy policy

> **DRAFT. Needs review by a qualified lawyer who knows the Nigeria Data Protection Act 2023 before publication.** Client details in brackets must be completed. Publish at a public HTTPS address and enter that address in Settings.

**PollWise privacy policy**

**Who we are.** PollWise is an education app provided by [client name], located at [address]. For questions about your data, contact [privacy contact email].

**What we collect.**
- Account details you give us: name, email address, phone number, password (stored only as a one-way hash).
- Where you work: state and local government area, your role, and optionally your ward and polling unit.
- Learning records: which lessons you finished, your practice answers, check results, XP, streak and certificates.
- Your settings: daily goal, reminder time (kept on your phone and on your account), sound and vibration.
- Technical records needed to keep the service secure, such as request logs. We do not log your password or tokens.

**Why we use it.** To run your course, record your progress, issue certificates, send password-reset codes, and give [client name] aggregate reports on training completion by state and area.

**Who we share it with.**
- We do not sell your information and do not show advertising.
- Video lessons are played through YouTube; YouTube's privacy terms apply to playback.
- Course images and documents are stored with Cloudinary.
- Password-reset codes and invitations are sent by email through [email provider].
- [client name] can see aggregate reports and, for its own staff with the right access, individual learning records needed to administer the training.

**How long we keep it.** While your account is active. If you ask us to delete your account, we remove your name and contact details after seven days, revoke your certificates, and keep only anonymous totals.

**Your rights.** Under the Nigeria Data Protection Act 2023 you can ask for a copy of your data, ask us to correct it, and ask us to delete it. You can change your details and delete your account from the app. For anything else, contact [privacy contact email]. You can also complain to the Nigeria Data Protection Commission.

**Security.** Data is sent over HTTPS and stored in an encrypted database. Access by staff is limited and logged.

**Children.** PollWise is for adults who work in elections. We do not knowingly collect data from children.

**Changes.** We will tell you in the app when this policy changes.

**Last updated:** [date]

## 4. Screenshots and assets

- Phone screenshots (Google Play needs at least two, Apple needs the sizes for the devices you target): the Learn path, a practice question with feedback, a module check result, the Progress tab, a certificate. Take them on a real phone, not a desktop emulator, and use the test course.
- Feature graphic (Google Play, 1024 × 500): the Tally mascot with the PollWise wordmark. Use only the brand files in `brand/`.
- App icon: already in `mobile/assets` (1024 × 1024).

## 5. Before submitting

1. Publish the privacy policy at a public HTTPS address and enter it in Settings.
2. Fill in the support email in Settings.
3. Complete the Google Play data-safety form and the content rating questionnaire, and the Apple App Privacy questions and age rating.
4. Create the store accounts under the client's name; EAS submit uses those credentials.
5. Build with the production profile (`docs/DEPLOY.md`, section 6) and test the build on a real phone before submitting.
