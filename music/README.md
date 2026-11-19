# Open music collections and listening experiments

The [music catalog](index.html) includes five collections. Each uses the notation and sources available for its repertoire.

| Collection | Scope and playback |
| --- | --- |
| [Guqin](guqin/index.html) | All 64 titles in Zhu Quan’s 1425 handbook, with a facsimile and a playable demonstration of the opening gestures of entry 44. |
| [Korean jeongganbo](jeongganbo/index.html) | Three columns of *Cheongsanbyeolgok* transcribed from an early Joseon woodblock score. The cursor follows the melody on the facsimile. |
| [Carnatic kṛtis](carnatic/index.html) | Dīkṣitar’s five-element group, with lyrics and notation in the external Malayalam edition and timestamped performances by D. K. Jayaraman. All five entries include offline piano readings of the opening notes. The full vocal recordings and edition require internet access. |
| [Ottoman saz semâîsi](ottoman/index.html) | 39 complete timed transcriptions across 29 makams, playable offline with section navigation and 64 pages of locally bundled sheet music. The SymbTr-derived scores carry the source collection’s CC BY-NC-SA 4.0 license. |

## Johann Sebastian Bach

The Bach collection features the first movement of Brandenburg Concerto No. 5, Bach’s organ Toccata and Fugue, the Air from Orchestral Suite No. 3, two preludes, and the D-minor keyboard fugue. It includes all 24 prelude-and-fugue pairs from The Well-Tempered Clavier, Book I, alongside all fifteen Two-Part Inventions, BWV 772–786, and all fifteen Three-Part Sinfonias, BWV 787–801. Open the catalog in a browser to follow the upper voice, mute it, or slow the piece down and listen for the lower voice taking up its theme. The scores and instrument samples ship with the player and work offline.

The catalog combines two independently reusable resources. Mutopia volunteers encoded the notes and their timing. Alexander Holm recorded individual notes on a Yamaha C5 grand piano. The player can therefore change the tempo or isolate a written voice while retaining the sound of a recorded instrument. Each piece links to its edition, and the instrument recordings carry their own credits. The organ, solo cello line, and orchestral strings use CC0 Versilian samples. [Mutopia](https://www.mutopiaproject.org/) · [Piano sample credits](bach-data/piano-credits.txt) · [Organ and string credits](bach-data/ensemble-credits.txt)

## Where to look next

Collection sizes below are approximate as of November 2026. A song, a movement, a scanned edition, and a manuscript catalog record represent different amounts of playable music. Collections also cover some of the same works.

| Collection | Material and reuse | What it makes possible |
| --- | --- | --- |
| Mutopia | 2,124 pieces with editable LilyPond, printable scores, and MIDI. Each edition identifies its public-domain status or license. [Collection and formats](https://www.mutopiaproject.org/) | Extend the existing player into the canons or cello suites. Inspect the encoded voices before assigning colors: a keyboard staff can contain multiple independent melodies. |
| OpenScore | Roughly 1,500 songs, 700 movements across 200 string quartets, and 100 orchestral movements, under CC0. [OpenScore collections](https://fourscoreandmore.org/openscore/) | Follow four named instruments through a quartet, or investigate what the piano does under a particular word in a song. |
| Kimiko Ishizaka's open Bach projects | The Goldberg Variations and Book I of The Well-Tempered Clavier have public-domain scores and studio performances. [Open Goldberg Variations](https://opengoldbergvariations.org/) · [Open Well-Tempered Clavier](https://welltemperedclavier.org/kimiko-ishizaka-releases-open-well-tempered-clavier.html) | Pair the existing D-minor fugue with Ishizaka's interpretation. Mapping beats to timestamps would let a listener switch versions at the same phrase. |
| Annotated Beethoven Corpus | Expert harmonic analyses of all Beethoven string quartets, with machine-readable notes, keys, and chords. CC BY-NC-SA 4.0. [Dataset and license](https://github.com/DCMLab/ABC) | Build a noncommercial listening guide in which selecting a labeled modulation plays its musical context. |
| MAESTRO | About 200 hours of piano audio aligned to performed MIDI within roughly 3 milliseconds, including key velocities and pedal positions. CC BY-NC-SA 4.0. [Dataset and license](https://magenta.tensorflow.org/datasets/maestro) | Use the performed notes to compare timing, dynamics, or pedaling while changing one element at a time. |
| IMSLP | Over 260,000 works and 890,000 scores at the time of research. Many files are scanned pages. Reuse depends on the edition, file, and jurisdiction. [IMSLP library](https://imslp.org/wiki/Main_Page) | Locate a historical edition and compare it against a transcription. Budget for transcription and proofreading when the source is a scan. |
| RISM | Over 1.5 million records describing musical sources. The catalog data is CC BY 3.0. Some records include an encoded opening melody, called an incipit. [Data services](https://rism.info/community/data-services.html) · [Incipit search API](https://rism.online/docs/api/incipit-search/) | Search a short melodic opening and trace the surviving manuscript sources. Check the holding library's terms for any images. |

## What can travel with the player?

Track the **composition, digital edition, annotations, and recorded sound** separately. Bach's composition is in the public domain. The volunteer who typeset a particular edition and the pianist who recorded it may each have chosen different terms.

CC0 and public-domain materials are good starting points for a redistributable catalog. CC BY permits commercial reuse with attribution. CC BY-SA also permits commercial use and requires shared adaptations of the licensed material to retain the applicable license. NC collections are a separate option for noncommercial projects. For a new piece, keep the edition URL, contributor, license, and a description of the conversion alongside its note data. [Creative Commons license guide](https://creativecommons.org/cc-licenses/)

Four Invention editions in this catalog credit jeff covey under CC BY-SA 3.0 (BWV 772, 777, 780, and 783). Their converted score data retain that license. The other included Invention editions and the Stelios Samelis fugue edition are marked public domain. Catalog playback uses Holm's sampled instrument. Ishizaka's complete performances are a possible future addition. [Invention edition records](bach-data/scores.js) · [Fugue edition](https://www.mutopiaproject.org/ftp/BachJS/BWV851/bwv851_fugue06/bwv851_fugue06.ly)

## Listening experiments to try

1. **Follow a motif.** Select six notes in an Invention. Search both voices for the same sequence of pitch intervals and relative durations, so a move to another key still matches. Play the original and each match back to back with measure and voice labels. Start here because the existing scores are enough to test whether the discoveries are interesting. Later, let the listener try rhythmic changes or an inversion.
2. **Sit inside a quartet.** Introduce the viola alone for two bars, then fade the other players back in. At a handoff, let the listener switch focus to the instrument that finishes the phrase. Start with one OpenScore movement and mark a few handoffs by ear.
3. **Hear a pianist's decision.** Align one cadence in Ishizaka's BWV 851 with its printed beats. Play the evenly timed score and the studio recording, then replay the sampled instrument using the pianist's timing to isolate the effect of timing from tone. Validate the beat alignment by listening before extending it to the whole work.

The Sinfonias use Olivier Vermersch’s public-domain Mutopia editions. Playback preserves the three melodic voices across staff changes. Each player links to its LilyPond source and the corresponding engraved PDF.

## Sheet music

The player shows one printed staff system at a time and highlights the current measure. The Brandenburg engraving comes from the same MusicXML as the player. The Mutopia images in `bach-data/notation/` are cropped, losslessly compressed reproductions of the same Mutopia A4 editions credited on each player page, under their respective edition licenses. The full-score PDF link opens the original engraving. The highlight follows both repeats in BWV 777 and the opening pickup in BWV 774.

## Selected works

The “Selected works” section includes three familiar instrumental colors: organ, strings, and piano. ChartMasters lists individual recordings of the G-major Cello Suite Prelude and C-major keyboard Prelude at the top of its Bach streaming table. Multiple recordings can represent one composition, so the shelf is an editorial selection. [ChartMasters Bach dashboard](https://chartmasters.org/artist/bach-baroque/)

Both featured preludes are complete movements. BWV 1007 uses Andreas Scherer's public-domain cello edition, played with recorded cello samples. BWV 846 uses the public-domain keyboard edition maintained by Tobias Erbsland. The catalog's BWV 851 fugue belongs to Book I of The Well-Tempered Clavier. The familiar organ Toccata and Fugue in D minor is a separate work, BWV 565. [Cello edition](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=517) · [Keyboard edition](https://www.mutopiaproject.org/ftp/BachJS/BWV846/wtk1-prelude1/wtk1-prelude1.ly)

The complete BWV 565 follows the timing of the Mutopia MIDI edition (quarter note = 60). The three paths correspond to right hand, left hand, and pedal. The Air uses jeff covey’s CC BY-SA 3.0 edition, including the printed repeats and alternate endings. Its two violins, viola, and continuo bass can be muted independently. The local staff images are cropped reproductions of the credited editions. [Organ edition](https://www.mutopiaproject.org/ftp/BachJS/BWV565/ToccataFugue/ToccataFugue.ly) · [Air edition](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=242)

## Brandenburg Concerto No. 5

The opening Allegro uses Geof Pawlicki’s public-domain MusicXML edition. Playback follows the edition’s 120 quarter notes per minute. Trills and mordents are shown in the notation and left unembellished in playback. Seven controls cover flute, solo violin, ripieno violin, viola, cello, violone, and the two harpsichord staves. The violone line uses a modern contrabass sample. Measure 154 starts the harpsichord cadenza, and the ensemble returns in measure 219. [Score edition](https://www.gutenberg.org/ebooks/5190) · [Concerto sample credits](bach-data/concerto-credits.txt)


## The Well-Tempered Clavier, Book I

The catalog lists BWV 846–869 in the order of the book, with a separate player for each movement. The C-major Prelude and D-minor Fugue retain their Mutopia editions and original links. The other 46 movements use Knute Snortum’s LilyPond edition, release v0.3. Each player links to the individual source and full engraved PDF. [Edition and releases](https://github.com/ksnortum/bach-well-tempered-1/releases/tag/v0.3)

The timing and pitch arrays in `bach-data/wtc1.js` were compiled from the edition’s written parts on separate MIDI tracks. Playback uses the edition’s tempo changes and the local sampled piano. Written-out ornaments play as encoded. Ornament symbols and dynamic markings remain visible in the engraving. The score images in `bach-data/notation/wtc1/` are cropped reproductions of the individual PDFs. The new score data and engraving crops are adaptations of Knute Snortum’s work, distributed under CC BY-SA 4.0. [Source and license statement](https://github.com/ksnortum/bach-well-tempered-1/tree/v0.3#license) · [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
