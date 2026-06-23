# Supabase authentication email templates

The registration flow sends the selected UI locale in `user_metadata.locale`.
The confirmation template uses that value to render Finnish, English, Swedish,
Norwegian, or Estonian content and displays Supabase's six-digit `{{ .Token }}`.

To publish the template in a hosted Supabase project:

1. Open **Authentication → Email Templates → Confirm signup**.
2. Copy `confirmation-subject.txt` into **Subject**.
3. Copy `confirmation.html` into **Message body**.
4. Save the template.

If the project uses **Magic Link** for registration retries, use the same subject
and body for that template as well.

For multilingual password recovery emails, publish `recovery-subject.txt` and
`recovery.html` under **Authentication → Email Templates → Reset password**.
