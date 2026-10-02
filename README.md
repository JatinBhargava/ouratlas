# Atlas

**Your photos and your own words, set as a magazine you can keep.**

Atlas ([ouratlas.co.in](https://ouratlas.co.in)) turns a memory into a printed-style magazine. A person brings up to ten photographs and tells the story in their own words, typed or spoken. Atlas lays it out as a real magazine issue, with a cover, a contents page, the story, full-page photographs and page numbers. They download it as a PDF to keep, print or send.

## The problem it solves

Most people's best memories sit in a camera roll of thousands of photos that nobody looks at again. Photo books take hours to design, and social posts disappear in a day. Atlas sits in between. In a few minutes it turns a handful of photos and a story into something that looks and feels like a keepsake, and the person never has to know anything about design.

## Who it is for

Anyone with a memory worth keeping:

- **Trips**: a weekend in the hills, a family holiday, a first trip abroad.
- **Weddings** and their many functions.
- **Birthdays**, anniversaries and a baby's first year.
- **Festivals** and family gatherings.
- **School and college** magazines, farewells and reunions.
- **An ordinary day** worth remembering.

Atlas is built India-first, with prices in rupees, and it works in any modern browser on a phone or a computer.

## How it works

1. **Add your photos**: up to ten, straight from your phone or computer.
2. **Tell the story**: type it, paste it, or speak it aloud and watch the words appear.
3. **Get your magazine**: Atlas sets every page. Change the look, the order or the cover, then download the PDF.

No account is needed to make a magazine. Signing in (with Google) is asked for only when downloading a magazine from the desk, saving one to share, or using the copy desk.

## What you can do

### Make a magazine in minutes

- **Automatic layout.** Atlas flows the story across as many pages as it needs, gives the photos full-page plates, and adds a cover, a contents page and page numbers. Long stories never spill off the page.
- **Themes.** Choose the look of the whole issue in one tap, from quiet and classic to bold and graphic.
- **Make it yours.** Move boxes on any page, change type and colours, or draw your own page layout.
- **Download as a PDF.** The file looks exactly like the screen, ready to keep, print at a local shop or send on.
- **Pictures for social media.** Every page also comes out as a picture sized for Instagram and WhatsApp.

### Help when you want it (optional AI)

- **The editor** looks at the photos and the story and suggests a theme, a cover, the best order for the photos, captions and a title. One tap undoes it.
- **The copy desk** tidies up a story, or turns rough notes into a finished piece.
- **Speak instead of typing.** Tell the story out loud, or upload a voice note, and the words appear as you speak.

### Atlas Studio: over 200 ready-made layouts

- A library of magazine pages drawn by the Atlas editors: covers, contents pages, photo spreads, pull quotes, one-page magazines in a dozen moods, and complete ten-page issues in house styles such as Swiss, Gazette, Riviera, Garden and Noir.
- **Fill any layout** with your own photos and words. Drag each photo to frame it, zoom in, change the font, size, alignment and colour of any text, and delete anything you don't need (undo brings it back).
- Download as a PDF or picture with no account, or save it to share as a link.

### Editor in Chief: design every page yourself

- A free-form page designer for a whole magazine: text, photos and shapes placed exactly where you want them, with fonts, colours and alignment.
- **Start any page from an Atlas Studio layout.** Every element comes in ready to move, restyle or delete. Switch a page to a different layout at any time, straight from the page strip.
- **The next page follows the theme.** After a page from a themed issue, the next page offered is that issue's next layout, and page numbers update themselves as pages are added, moved or deleted.
- **Frame each photo.** Double-click a photo and drag it inside its frame.
- **Preview** the finished magazine as it will read in print, then download the PDF.

### One-page poster

A single page designed by hand, for an invitation, an announcement or a wall print, downloaded as a PDF or picture.

### Layouts from the community

Readers can browse page designs made by other Atlas users, like their favourites, start from any of them, or send in their own for the editors to review.

### Save & share

- Save a magazine and share it as a private link, including straight to WhatsApp, Instagram and other apps.
- **Only people with the link can open it.** The magazine is locked in the person's own browser before it is saved, and the key to open it travels inside the link, never to Atlas.
- **My magazines** keeps a person's saved issues together, on any device they sign in to.
- Free saves last up to 30 days. Paid plans can keep a magazine for as long as they like.

### The Atlas Journal

A blog at [ouratlas.co.in/blog](https://ouratlas.co.in/blog). A new post every week covers design, art, the media industry and technology, and spotlights new Atlas features and why they are worth using.

### Android app

An Atlas app for Android is in testing, so people can make a magazine from the photos already on their phone.

## Privacy

This is central to the product, and worth stating exactly:

- **Photos and stories are never stored by Atlas.** The magazine is put together inside the person's own browser.
- They leave the device only when the person chooses a tool that needs it: the AI editor, the copy desk or voice transcription. Even then Atlas passes them to the AI service for that one task and keeps no copy.
- **Saving a magazine to share is also the person's choice.** The pages are locked before they leave the device, so Atlas cannot open them.
- Beyond the locked magazines people choose to save, Atlas stores only what an account needs (an email address, the plan and a record of payments) and the page layouts people choose to send in to the community, with the words and photos taken out.

## Plans

| | **Wanderer** | **Traveller** | **Cartographer** |
|---|---|---|---|
| Price | Free | ₹99 a month | ₹199 a month |
| Photos per story | 10 | 10 | 10 |
| Story length | Up to 5,000 words | Up to 10,000 words | Up to 15,000 words |
| AI editor designs a month | 2 | 5 | 12 |
| Copy-desk edits a month | 2 | 5 | 15 |
| Stories | One at a time | Unlimited | Unlimited |
| Magazine downloads | 3 a month | Unlimited | Unlimited |
| Themes | Two | All | All |
| Also includes | | Print-quality PDF, voice transcription | Everything in Traveller, custom fonts and palettes, editable page layouts, bulk export, priority support |

Atlas Studio, the one-page poster and Editor in Chief can be used and downloaded free.

## Run it on your computer

You need a Mac, Windows or Linux computer and about ten minutes.

1. **Install Bun**, the tool that runs Atlas, from [bun.sh](https://bun.sh). On a Mac or Linux:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```
2. **Get the code** and open the folder:
   ```bash
   git clone https://github.com/JatinBhargava/ouratlas.git
   cd ouratlas
   ```
3. **Install** everything Atlas needs:
   ```bash
   bun install
   ```
4. **Start it**:
   ```bash
   bun dev
   ```
5. **Open [http://localhost:3000](http://localhost:3000)** in your browser.

That is enough to make a magazine and to use Atlas Studio, Editor in Chief and the poster.

**Turning on the optional parts.** Sign-in, saving and sharing, the AI helpers, voice and payments each need an account with an outside service. To switch any of them on, copy the file `.env.example` to `.env` and fill in the keys it describes, then restart. Anything left blank simply stays switched off, and the rest of Atlas keeps working. When Atlas starts, it lists which parts are on and which are off.

## Learn more

- **What's new**: [ouratlas.co.in/whats-new](https://ouratlas.co.in/whats-new) lists every release in plain words.
- **The Journal**: [ouratlas.co.in/blog](https://ouratlas.co.in/blog).
- **For engineers**: how Atlas is built and configured is in [docs/engineering.md](docs/engineering.md).
