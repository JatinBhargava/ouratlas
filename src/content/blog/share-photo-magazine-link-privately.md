---
title: Share your photo magazine by a private, sealed link
description: How Save & share turns your Atlas issue into a private link for family, why the key never reaches our server, and how to invite people to read or edit.
kind: spotlight
date: 2026-11-23
tags: [privacy, weddings, photo albums]
keyword: share photo magazine link privately
feature: 0.1.0
---

When your issue is finished, Save & share is how you share a photo magazine link privately: press it, and Atlas gives you one address to send on WhatsApp or anywhere else. Whoever opens it turns through your magazine page by page, with no account and nothing to install. Before a single page leaves your browser it is sealed with a key made for that issue alone, and the key travels inside the link rather than through us. So the link is what opens it, and the people you send it to are the people who can read it.

## How to save and send it

Everything below happens on the desk at [/create](/create), once your photographs and story have been set as an issue.

1. Sign in with Google if you have not already. Composing works signed out; sending an issue out of the desk, as a file or as a link, is the one step that needs an account.
2. Press **Save & share**, beside Carousel and Export at the top of the proof.
3. Under **Keep it for**, choose how long the link should work: 1 day, 7 days, 30 days, or Forever.
4. Decide whether to **Keep in My magazines**. It is on unless you turn it off; what it changes is explained below.
5. If you want to change the issue after it is saved, turn on **Allow editing later**. It is off unless you ask for it.
6. Press **Save & get link**. You will see "Drawing page 3 of 18", then "Sealing and sending", while each page is drawn, locked and uploaded.

When it is done, the dialog says "Saved. Here is its link." Press **Copy**, or on a phone press **Share link** to open your phone's own share sheet and pick WhatsApp, a family group or an email. **Open it** shows you exactly what they will see. Underneath, the same panel can make pictures sized for an Instagram post or story, if you would rather share the pages themselves.

Pages you fill in [Atlas Studio](/blog/magazine-layout-with-your-own-photos) go through the same dialog and are sealed the same way.

## Why the link itself is the key

Most ways of sharing an album hand your pictures to a service that can look at them. Save & share is built so that it cannot.

When you press save, your browser makes a fresh 256-bit key for that one issue and seals every page with it, along with a small manifest holding the title and the short line beneath it. The sealed files go straight from your browser to a private storage bucket, through addresses that allow one upload each, so the pages never pass through Atlas's own server on the way.

The link that comes back looks like `/read?i=…#…`. The part after the `#` is the key. Browsers never send that part of an address to the website they are opening, so when your aunt taps the link, our server hands her browser a set of locked files, and her browser opens them with a key the server never saw. If a file were tampered with or cut short, it would fail to open rather than open wrong.

Two smaller choices follow from this, and the dialog says each one plainly.

- **Keep in My magazines** keeps a copy of the key on your account, so you can open the issue from My magazines on any device, copy the link again, take it down, or share it with named people. Turn it off and the key lives only in the link: nobody else can open the magazine, not even us, and neither can you if you lose the link.
- **Allow editing later** also keeps your photographs (made smaller) and your words, sealed with the same key, so the issue can be reopened in the editor that made it. Because editing needs the key on your account, turning this on keeps the issue in My magazines too.

Your photographs and story are otherwise never stored. What a saved issue keeps is pictures of its pages, locked, unless you choose to keep the editable copy as well.

## Sharing with the people who should have it

A link is enough for most occasions. For the ones where a family wants to work on a magazine together, My magazines lets the owner, and only the owner, decide who else has it.

- **Invite by email.** Type an address and choose whether they may read it or edit it. They find it in their own My magazines when they sign in with Google as that address.
- **Group code for this magazine.** Make a code with a password, choose the access it grants, and read it out to a room. Anyone who enters both joins that one magazine, and no other.

When someone with edit access changes the issue and presses **Save changes**, the new pages are uploaded in full before they replace the old ones, at the same link. A reader never opens a half-finished edit, and an editor working from an older copy cannot overwrite a newer one.

## Who it is for

The magazine that most needs a link is the one with the most people in it.

A wedding is the clearest case. The haldi, the mehendi and the reception each make their own pages, and the people who were there are spread across a dozen WhatsApp groups and three time zones. A link in each group reaches all of them at once, and a 30-day link suits a magazine meant for the week after.

It suits the issues families make together, too: a first birthday where grandparents add the captions, a Diwali at home where cousins send in their own pictures and one person sets them, a school annual day where a class teacher shares one issue with forty parents through a group code. A trip with friends works the same way: the person with the best photographs makes the issue, and everyone else reads it on the train home.

## What to know before you share

- **Signing in is needed**, and saving uses the same export as downloading the PDF. Saving and exporting the same issue counts once, not twice.
- **Forever is for paid plans.** On Wanderer, the free plan, a link can last 1, 7 or 30 days, and the Forever button is locked. Forever comes with Traveller and Cartographer; see [the plans](/pricing).
- **An expired issue is deleted**, not hidden. Once its time is up the link stops working and the pages are removed from storage at the next hourly sweep. A magazine you want to keep for good is best kept as a PDF as well.
- **The link is a key.** Anyone you forward it to can read the issue. Send it to the groups you mean to, and if a link travels further than you meant, take the issue down from My magazines and save it again for a new one.
- **Edits keep the original expiry.** Saving changes does not restart the clock.

## Try it this week

Take the issue you made last, or make one at [/create](/create) from ten photographs and a few hundred words. Save it for 7 days with Keep in My magazines on, press Open it to see what your family will see, then send it to one group. If they want the pages for their own phones, the Carousel button makes pictures of every page, and Export gives you the PDF to keep.
