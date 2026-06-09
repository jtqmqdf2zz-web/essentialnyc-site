# Hero videos

Drop loop footage here and it plays as the hero background on the matching page.

| Folder              | Page          |
|---------------------|---------------|
| `videos/home/`      | index.html    |
| `videos/practice/`  | practice.html |
| `videos/videos/`    | videos.html   |
| `videos/about/`     | about.html    |
| `videos/contact/`   | contact.html  |

## Naming

Name files `video_1.mp4`, `video_2.mp4`, `video_3.mp4`, … — a number on the end,
starting at 1, no gaps. The page plays them in order: it starts `video_1.mp4`
immediately and preloads the next while it plays, then advances on each clip's
end and loops back to the first. A single `video_1.mp4` just loops on its own.

An empty folder = a clean static hero (no video, no animation). The `.gitkeep`
file only keeps the empty folder in git; it is ignored by the player.

Use `.mp4` (H.264/AAC), muted-friendly. Keep clips reasonably small — the whole
file is fetched for seamless hand-off between clips.
