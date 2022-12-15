const dotenv = require('dotenv').config();
const express = require('express');
const app = express();
const port = 3000;
const ytdl = require('ytdl-core');
const cp = require('child_process');
const ffmpeg = require('ffmpeg-static');

const ffmpegProcess = cp.spawn(ffmpeg, [
    '-i', `pipe:3`,
    '-i', `pipe:4`,
    '-map', '0:v',
    '-map', '1:a',
    '-c:v', 'copy',
    '-c:a', 'libmp3lame',
    '-crf', '27',
    '-preset', 'veryfast',
    '-movflags', 'frag_keyframe+empty_moov',
    '-f', 'mp4',
    '-loglevel', 'error',
    '-'
], {
    stdio: [
        'pipe', 'pipe', 'pipe', 'pipe', 'pipe',
    ],
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.get('/youtube/', (req, res) => {
    if (req.query.url) {
        if (req.query.info == 'true') {
            ytdl.getInfo(req.query.url).then(info => {
                res.json({
                    title: info.videoDetails.title,
                    description: info.videoDetails.description,
                    duration: info.videoDetails.lengthSeconds,
                    url: info.videoDetails.video_url,
                    id: info.videoDetails.videoId,
                    published: info.videoDetails.publishDate,
                    views: info.videoDetails.viewCount,
                    // download: info.formats[0].url,
                    thumbnail: info.videoDetails.thumbnails[0].url,
                    owner: info.videoDetails.author.name,
                    owner_url: info.videoDetails.author.user_url,
                    owner_profile_picture: info.videoDetails.author.thumbnails[0].url,
                    owner_subscribers: info.videoDetails.author.subscriber_count,
                    owner_verified: info.videoDetails.author.verified,
                });
            });
        } else {
            if (req.query.type == 'audio') {
                ytdl(req.query.url, { filter: 'audioonly' }).pipe(res);
            } else if (req.query.type == 'video' || !req.query.type) {
                res.header('Content-Disposition', 'attachment; filename="video.mp4"');
                if (req.query.quality == 'low' || !req.query.quality) {
                    ytdl(req.query.url).pipe(res);
                } else if (req.query.quality == 'high') {
                    ytdl(req.query.url, { quality: 'highest' }).pipe(res);
                }
            } else if (req.query.type == 'both') {
                res.header('Content-Disposition', 'attachment; filename="video.mp4"');
                ytdl(req.query.url, { quality: 'highestvideo' }).pipe(ffmpegProcess.stdio[3]);
                ytdl(req.query.url, { filter: 'audioonly' }).pipe(ffmpegProcess.stdio[4]);
                ffmpegProcess.stdio[1].pipe(res);
            }
        }
    } else {
        res.send('No URL provided');
    }
});

app.listen(port, () => {
    // console.log(`Example app listening on port ${port}!`);
});