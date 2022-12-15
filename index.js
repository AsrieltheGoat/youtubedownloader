const dotenv = require('dotenv').config();
const express = require('express');
const app = express();
const port = 3000;
const ytdl = require('ytdl-core');

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.get('/youtube', (req, res) => {
    ytdl.getInfo(req.query.url).then(info => {
        res.json({
            title: info.videoDetails.title,
            description: info.videoDetails.description,
            duration: info.videoDetails.lengthSeconds,
            url: info.videoDetails.video_url,
            id: info.videoDetails.videoId,
            published: info.videoDetails.publishDate,
            views: info.videoDetails.viewCount,
            download: info.formats[0].url,
            thumbnail: info.videoDetails.thumbnails[0].url,
            owner: info.videoDetails.author.name,
            owner_url: info.videoDetails.author.user_url,
            owner_profile_picture: info.videoDetails.author.thumbnails[0].url,
            owner_subscribers: info.videoDetails.author.subscriber_count,
            owner_verified: info.videoDetails.author.verified,
        });
    });
});

app.get('/youtube/download', (req, res) => {
    if (req.query.url) {
        if (req.query.type == 'audio') {
            ytdl(req.query.url, { filter: 'audioonly' }).pipe(res);
        } else if (req.query.type == 'video' || !req.query.type) {
            if (req.query.quality == 'low') {
                ytdl(req.query.url).pipe(res);
            } else if (req.query.quality == 'high') {
                ytdl(req.query.url, { quality: 'highest' }).pipe(res);
            } else {
                res.send(`<p>Invalid quality</p><p>Valid qualities: low, high</p><p>Example: download?url=${req.query.url}&type=video&quality=high`);
            }
        } else if (req.query.type == 'both') {
            res.send('Not implemented yet')
        }
    } else {
        res.redirect(`/youtube/download?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ&quality=low&type=audio`)
    }
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}!`);
});