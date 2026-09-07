# Android push notification release checklist

Before an Android EAS build, obtain `google-services.json` for Firebase project
`auratrack-87c36` from Firebase Console and place it at
`frontend/google-services.json`. It is gitignored and must not be committed.
Its Android application ID must be `com.abhijitreddy.auratrack`.

In Expo/EAS Credentials, upload an active Firebase Cloud Messaging V1 service
account for that same Firebase project. Do not add the service-account JSON to
this repository. If the key was rotated, upload the replacement to EAS, revoke
the old key in Google Cloud only after a successful push test, and rebuild the
APK.

The preview EAS profile creates an installable APK; production creates an AAB.
