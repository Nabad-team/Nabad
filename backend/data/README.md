# Common passwords

`common-passwords.txt` is the UK NCSC list of the 100,000 most-used passwords found in breaches
(`PwnedPasswordsTop100k`, built from Have I Been Pwned data), taken unchanged from SecLists
(`Passwords/Common-Credentials/100k-most-used-passwords-NCSC.txt`, MIT licence).

Signup and password reset reject any password that matches an entry, ignoring case
(see `src/passwordPolicy.js`). Most entries are shorter than the 12-character minimum; the
roughly 1,300 that are not are also copied into `frontend/lib/commonPasswords.js` for the live
checklist. After replacing this file, run `node frontend/scripts/generate-common-passwords.js`.
