# Farm ambience recordings

All files are bundled locally and loaded only after sound is enabled.

The following MP3 files are unmodified SFXMint downloads, licensed under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
Source collection: https://sfxmint.com/sets/animal-calls

| Local file | Source slug |
| --- | --- |
| dog.mp3 | animal-dog-bark-25 |
| hen.mp3 | hen-cluck-02 |

Each original URL is `https://sfxmint.com/dl/<source-slug>.mp3`.
Downloaded files were checked against the SHA-256 hashes in the source API.

Playback applies a low-pass filter, soft fades, and stereo
placement.

## Individual animal calls

The following replacement files are actual animal recordings. Quiet leading
and trailing regions were removed; the donkey is a short excerpt from a longer
recording, ending at a low-energy point. Each retained excerpt plays at its original pitch
and speed. Files are downmixed to mono 24 kHz / 16-bit PCM WAV and normalized to
peak amplitude 0.25. Each derivative retains its source license. Short playback
fades preserve the onset and ending of the calls. Preview plays the full retained
excerpt.

| File | Author | Source / license | Retained source region |
| --- | --- | --- | --- |
| donkey-single.wav | Joseph Sardin | [Donkey, braying #1](https://bigsoundbank.com/donkey-braying-1-s1549.html), [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | 1.08–3.16 s; excludes later calls and horse breathing |
| cow.wav | Joseph Sardin | [Cow moos #5](https://bigsoundbank.com/cow-moos-5-s2385.html), CC0 | 1.38–3.29 s |
| sheep.wav | Joseph Sardin | [Sheep #1](https://bigsoundbank.com/sheep-1-s2343.html), CC0 | 0.06–0.87 s |
| horse-neigh.wav | DenisChardonnet | [Neighing of a Horse #1](https://bigsoundbank.com/neighing-of-a-horse-1-s0284.html), CC0 | 0.02–1.55 s |
| cat-skymary.wav | skymary | [cat meow short](https://freesound.org/people/skymary/sounds/412017/), CC0; HQ MP3 preview | Complete recording, 0–1.75 s |
| pig-calm.wav | JarredGibb | [Pig - Grunt 2 - 96kHz.wav](https://freesound.org/people/JarredGibb/sounds/233170/), CC0; HQ MP3 preview | 0–0.93 s |
| goat-single.wav | DenisChardonnet | [Bleating Goat #1](https://bigsoundbank.com/bleating-goat-1-s0279.html), CC0 | 0.18–1.05 s |
| duck-real.wav | Jonathon Jongsma | [Mallard XC62258](https://commons.wikimedia.org/wiki/File:Anas_platyrhynchos_-_Mallard_-_XC62258.ogg), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | 0–2.75 s |
| rooster.wav | Filo gèn' | [Rooster crowing](https://commons.wikimedia.org/wiki/File:Rooster_crowing.ogg), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | 0.90–2.71 s |

## Bird recordings

The four files under `birds/` are real field recordings from Wikimedia Commons.
They were excerpted, downmixed to mono, resampled to 22,050 Hz / 16-bit PCM WAV,
and peak-normalized to 0.4. Each derivative retains its source recording's license.
No generated bird tones are used.

| File | Author | Source and license | Excerpt |
| --- | --- | --- | --- |
| birds/blackbird.wav | Diana Tudor | [Common Blackbird song](https://commons.wikimedia.org/wiki/File:Common_Blackbird_song_(Turdus_merula).ogg), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 5–30 seconds |
| birds/tit.wav | Sander Pieterse | [Great Tit XC47356](https://commons.wikimedia.org/wiki/File:Parus_major_-_Great_Tit_XC47356.mp3), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | 0–13 seconds |
| birds/chaffinch.wav | Marie-Lan Taÿ Pamart | [Common Chaffinch XC475139](https://commons.wikimedia.org/wiki/File:Fringilla_coelebs_-_Common_Chaffinch_XC475139.mp3), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | 2–27 seconds |
| birds/sparrow.wav | QWerk | [House Sparrows chirping](https://commons.wikimedia.org/wiki/File:House_Sparrows_chirping.ogg), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | 0–9 seconds |
