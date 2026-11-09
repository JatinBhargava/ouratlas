---
title: Tell your story out loud and Atlas writes it down
description: The Speak tab turns your voice, live or from a voice note you already have, into the written story of your magazine. How to use it, and what to know.
kind: spotlight
date: 2026-11-09
tags: [writing, family history, privacy]
keyword: voice note to written story
feature: 0.1.0
---

You can now tell Atlas your story instead of typing it. Open the Speak tab on the desk, press Start recording, and talk: your words appear under Write as you go, a few words behind you. If the story is already sitting on your phone as a voice note, a long one from a grandparent or a rambling one you sent from the train home, choose Or upload a recording and Atlas turns that voice note into the written story of your magazine, ready to set alongside your photographs.

Most people can tell a story far better than they can write one. Ask someone about the wedding and they will talk for twenty minutes, with the names, the jokes and the moment the power went out. Ask them to write it and you get three lines. The Speak tab is for closing that gap.

## How to record your story, step by step

Everything happens on the desk at [/create](/create), in the panel called The copy. It has two tabs, Write and Speak.

1. Press **Speak**. The panel reads "Talk it through", with a large microphone.
2. Press **Start recording**. Your browser asks for the microphone; allow it. The button says "Opening the microphone" while it connects.
3. Talk. Atlas moves you to the Write tab on its own, so you can watch the words land. A red bar above the text says "Recording" with a running clock, and "Listening…" while you are mid-sentence.
4. Press **Stop** when you have finished. The bar says "Setting the last words…" while the final phrase comes back, then the text is yours to edit like anything you typed.

To use a recording you already have:

1. Press **Speak**, then **Or upload a recording**.
2. Choose the file. Voice memos, MP3, M4A, WAV and WebM all work, and so does the sound from an MP4 or WebM video.
3. A green bar shows "Reading" and then "Transcribing" with the file's name, and for a long file a count such as "3 of 9" as each part is finished. The text arrives a part at a time, so you can start reading the beginning while the end is still being written down. **Stop** cancels it, and whatever has arrived stays.

If you already have words in the box, a new recording goes after them as a new paragraph, so you can type the opening, speak the middle, and type again. The one exception is the sample story offered under Write: a recording replaces that rather than following it, since it was only there for trying the press.

## Why it was built this way

**You see the words while you are still talking.** Atlas does not wait for you to finish and then hand back a block of text. It streams the sound as you speak and sets each phrase as soon as it is recognised. That turned out to need care: the transcription service only closes a phrase when it hears a pause, and a ceiling fan, traffic, or someone who barely stops for breath can hold a phrase open for minutes. So the desk also closes phrases itself, at the next small dip between words after about three seconds, and you are never left staring at the first word until you press Stop.

**Your voice goes to transcription and comes back as text, and that is all.** Recording is one of the few things on Atlas that sends anything out of your browser, so it says so on the panel: your voice is sent to OpenAI to be transcribed and comes back as text, and Atlas keeps neither the audio nor the words. For a live recording, the sound does not touch Atlas's server at all. The server hands your browser a one-use key that can open a single transcription session and expires within a minute if unused, and your browser talks to OpenAI directly with it. An uploaded file does pass through Atlas's server, one part at a time, held in memory only for as long as that part takes and never written down. Your photographs are not involved in any of this; they stay in your browser.

**A long voice note does not break.** A half-hour recording is too big to send in one go through the services between your browser and the transcriber. Your browser does the heavy lifting: it opens the file itself, cuts it into parts of about two minutes, and moves each cut back to the quietest moment in the seconds before it, usually a breath between sentences, so words are not sliced in half. The last words of each part travel with the next, which helps a sentence carry across the join instead of restarting with a capital letter.

**Nothing you typed can be lost under it.** While a recording or upload is running, the text box is read-only and the copy desk steps out of the way. Each update rewrites only the new paragraph, so a phrase that is corrected as it completes simply replaces its draft. When it ends, the box is yours again.

**There is nothing to install.** It works in the browser you are already using: Chrome, Edge, Firefox and Safari can all record. A browser that cannot says so on the panel instead of offering a button that does nothing.

## Who it is for

**Grandparents and the people who were there.** Family history usually lives in someone's voice. Sit with your nani and a phone, press Start recording, and let her tell the story of the house she grew up in. Or ask the relatives who could not come to send a voice note about the couple, and upload each one. The copy can then sit beside the photographs from that day in one issue.

**Weddings and their functions.** After a mehendi, a sangeet and a reception, nobody has the energy to write. Talking through the three days on the drive home is easier, and the details are fresher than they will be in a month.

**A baby's first year and first birthdays.** New parents rarely get both hands free. A few minutes of talking while the baby sleeps on you, once a month, becomes a year of words by the first birthday.

**Trips and festivals.** Voice notes from the road, recorded on a ghat at dawn or the night after Diwali, can be uploaded together when you are home and set as the feature of the issue.

**School annual days and reunions.** Several people can each record a memory, and you edit the copy into one piece under Write.

## What to know before you start

**It listens for English.** The transcriber is set to expect English, because left to guess, it misheard short English phrases as other languages. A story told mostly in another language will not come out well today.

**It is free to try, with daily limits.** You do not need an account to record or upload. To keep the cost fair, there are limits per person: ten recordings in any ten minutes and forty in a day, and about three hours of uploaded audio a day. An uploaded file can be up to an hour long and 200 MB; for anything longer, trim it to the part worth keeping.

**Your plan's word limit still applies.** The copy holds 5,000 words on the free Wanderer plan, 10,000 on Traveller and 15,000 on Cartographer, and the counter above the box shows where you are. Once the copy is full, recording is turned off until you trim it. About 500 words is enough for a full feature, and the desk tells you how many more you need.

**Spoken words read differently.** A transcript keeps every "and then" and every restart. Read it through under Write and cut the repeats; if your plan has copy-desk edits left, the copy desk can tidy a spoken draft into a finished piece. Its version replaces yours only if you press Keep this version.

## Try it this week

Pick one person whose story you would like to keep, and one occasion you have photographs of. Ask them to tell it to your phone for five minutes, in whatever order it comes. Then open [the desk](/create), upload the recording under Speak, add up to ten photographs from that day, and read what you have. If you would rather set those words in a ready-made design, [Atlas Studio](/blog/magazine-layout-with-your-own-photos) has layouts you can fill by hand. Every change Atlas has shipped is listed on [What's new](/whats-new).
