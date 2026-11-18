# Open music collections and listening experiments

The [listening catalog](index.html) opens with Bach's D-minor fugue, BWV 851, and includes all fifteen Two-Part Inventions, BWV 772–786. Open the catalog in a browser to follow the upper voice, mute it, or slow the piece down and listen for the lower voice taking up its theme. The scores and instrument samples ship with the player and work offline.

The catalog combines two independently reusable resources. Mutopia volunteers encoded the notes and their timing. Alexander Holm recorded individual notes on a Yamaha C5 grand piano. The player can therefore change the tempo or isolate a written voice while retaining the sound of a recorded instrument. Each piece links to its edition, and the sample bank carries its own credit. [Mutopia](https://www.mutopiaproject.org/) · [Piano sample credits](bach-data/piano-credits.txt)

## Where to look next

Collection sizes below are approximate as of November 2026. A song, a movement, a scanned edition, and a manuscript catalog record represent different amounts of playable music. Collections also cover some of the same works.

| Collection | Material and reuse | What it makes possible |
| --- | --- | --- |
| Mutopia | 2,124 pieces with editable LilyPond, printable scores, and MIDI. Each edition identifies its public-domain status or license. [Collection and formats](https://www.mutopiaproject.org/) | Extend the existing player into the Sinfonias, canons, or cello suites. Inspect the encoded voices before assigning colors: a keyboard staff can contain multiple independent melodies. |
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

1. **Follow a motif.** Select six notes in an Invention. Search both voices for the same sequence of pitch intervals and relative durations, so a move to another key still matches. Play the original and each match back to back with measure and voice labels. Start here because the sixteen existing scores are enough to test whether the discoveries are interesting. Later, let the listener try rhythmic changes or an inversion.
2. **Sit inside a quartet.** Introduce the viola alone for two bars, then fade the other players back in. At a handoff, let the listener switch focus to the instrument that finishes the phrase. Start with one OpenScore movement and mark a few handoffs by ear.
3. **Hear a pianist's decision.** Align one cadence in Ishizaka's BWV 851 with its printed beats. Play the evenly timed score and the studio recording, then replay the sampled instrument using the pianist's timing to isolate the effect of timing from tone. Validate the beat alignment by listening before extending it to the whole work.

## Sheet music

The player shows one printed staff system at a time and highlights the current measure. The images in `bach-data/notation/` are cropped, losslessly compressed reproductions of the same Mutopia A4 editions credited on each player page, under their respective edition licenses. The full-score PDF link opens the original engraving. The highlight follows both repeats in BWV 777 and the opening pickup in BWV 774.
