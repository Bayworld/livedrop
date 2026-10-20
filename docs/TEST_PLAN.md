# Pilot test plan (do this on the hosted site, with 3 real accounts: A creator, B fan, C fan)
1. Sign up each account (accept terms). Wrong password, existing email and Forgot password give clear messages. Refresh keeps you signed in.
2. A: Account & Settings -> Creator, set name + @username. Fan accounts do not see Create/Dashboard.
3. A: create a Drop. Open its link in a private window: correct creator name, real countdown, status "FUNDING".
4. B: Creators -> REQUEST A. A sees it in Demand Inbox. C backs it; A sees 2 fans backing.
5. C: pledge on A's Drop -> "PENDING, no money taken"; double-click makes one pledge. A cannot pledge to own Drop.
6. A: Edit the Drop (title/dates). Cancel it -> page shows DROP CANCELLED and pledging is disabled. Set a deadline in the past -> FUNDING CLOSED.
7. Two accounts with the same display name: each sees only its own Drops/requests.
8. Phone: pinned CONTRIBUTE button, WhatsApp share, Copy link.
9. Fan B requests "Some Unregistered Name" -> invite buttons appear. Open the invite link in a private window -> banner shows count; JOIN prefills name + Creator role.
10. A (creator) receives B's request -> Creator Dashboard tab shows a number badge; new creator sees Get started checklist.
11. Delivery: A saves session link in Edit Drop. C (pending) sees no access card. Mark C's pledge paid in SQL -> C sees YOUR ACCESS with Join + calendar. B (no pledge) sees nothing.
12. Phone: bottom tab bar switches pages; hidden on public Drop pages.

13. Phone (360-390px): home page shows hero, Drops and bottom bar (not a blank page). Every tab opens without sideways scroll.
14. Open `?creator=<your username>` in a private window: profile shows name, stats, active Drops. BACK THIS DROP opens that Drop. FOLLOW asks a signed-out visitor to sign in. SHARE copies the link.
15. Creators tab -> PROFILE opens the profile. On a Drop page, tap the creator name -> profile.
Run `python3 tests/static-audit.py` after any code change.

## Payments (Paystack TEST mode, after docs/PAYMENTS.md setup)
16. Fan C taps CONTRIBUTE -> redirected to Paystack. Pay with Paystack's documented test card (check their docs). Return to the Drop: "Payment received", raised amount up by one contribution, supporter count +1, YOUR ACCESS card appears if a session link exists.
17. Abandon a checkout: no charge, Drop totals unchanged. Start again: works (old attempt retired).
18. Same fan tries to pay again after paying: "already backing this Drop".
19. Creator cannot back own Drop. Closed/cancelled Drop: refused.
20. Fill the goal: Drop shows unlocked.
21. Webhook security: `curl -X POST <webhook url> -d '{}'` must return 401.
22. Cancel a paid Drop, run paystack-refund: contribution becomes `refunded` after the webhook; Paystack dashboard shows the refund.
23. In SQL: `update contributions set status='paid' where ...` from a normal user session must fail (no policy).

## Lifecycle + notifications (run after migration 011; payments OFF)
24. Fan B requests creator A. A signs in: bell shows 1 unread ("New fan request").
25. A taps ACCEPT. B (and any fan who backed it) gets "A accepted your request". A taps CREATE DROP FROM THIS: B gets "created a Drop for your request".
26. A declines a different request: that fan is notified.
27. Fan C follows A. A creates a Drop: C gets "A posted a new Drop". Tapping it opens the Drop.
28. C pledges (pending). A taps GO LIVE (confirm): Drop page shows LIVE NOW; C and followers are notified. A fan who does not own the Drop cannot call GO LIVE (run `select set_drop_phase('<uuid>','live')` as a fan: must fail).
29. A taps END SESSION: Drop shows COMPLETED, C gets a thank-you notification.
30. Bell: "Mark all read" clears the count; notifications of another user are never visible.

## Real-device checks (emulation cannot replace these; do on at least one iPhone and one Android phone)
31. Tap into EVERY form field (sign-in, request, create Drop, settings): the page must not zoom in. Rotate to landscape and repeat.
32. Open each pop-up (sign in, account, notifications) in landscape with the keyboard open: you can still scroll to the buttons.
33. Bottom nav sits above the iPhone home bar and is not covered by Safari's toolbar. Add to Home Screen and check again.
34. Pinch-zoom still works for accessibility (we deliberately do not disable it).
35. "I'M A CREATOR": signed out opens sign-up with Creator selected; a fan sees BECOME A CREATOR and is switched after confirming; a creator sees OPEN CREATOR DASHBOARD.
Run `python3 tests/mobile-audit.py` before every release (checks 5 screen sizes incl. landscape).

## v0.12.0 additions (run migration 013 first)
- Report: signed-in user taps Report on a Drop and on a creator profile -> toast 'Report sent'. Check a row in public.reports. Signed-out user is asked to sign in.
- Live room: creator opens own Drop -> sees LIVE ROOM with countdown. Fan with a PENDING pledge sees nothing; mark the pledge paid in SQL -> fan sees LIVE ROOM, can send a question; creator sees it and taps Answered.
- After creator ends session (status completed): paid fan sees star rating; creator sees the average.
- CSP: deploy with public/_headers and confirm the browser console shows no CSP violations.
