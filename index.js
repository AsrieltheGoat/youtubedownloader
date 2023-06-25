const ytdl = require("ytdl-core");
const cp = require("child_process");
const ffmpeg = require("ffmpeg-static");

// Set up express server
const express = require("express");
const app = express();
const port = 3000;

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/index.html");
});

// Url, info=true/false, format=audio/video, quality=highest/lowest/highestvideo/lowestvideo
// TODO: Save res (stream) to file using a temporary file saver (On ChatGPT)
app.get("/youtube", async (req, res) => {
    const url = req.query.url;
    const info = req.query.info;
    const format = req.query.format;
    const quality = req.query.quality;

    if (ytdl.validateURL(url) || ytdl.validateID(url)) {
        if (info == "true") {
            // Get video info
            const info = await ytdl.getInfo(url);
            return res.send(info);
        }

        if (format) {
            // check if quality is highest, lowest, highestvideo, lowestvideo
            if (
                quality == "highest" ||
                quality == "lowest" ||
                quality == "highestvideo" ||
                quality == "lowestvideo"
            ) {
                // Get the video name
                const info = await ytdl.getInfo(url);
                const videoName = info.videoDetails.title;

                if (format == "audio") {
                    // Pipe audio to ffmpeg
                    const audio = ytdl(url, {
                        filter: "audioonly",
                        quality: quality,
                        highWaterMark: 1 << 25,
                    });

                    // Set the content disposition header to force download
                    res.setHeader(
                        "Content-Disposition",
                        `attachment; filename="${encodeURIComponent(
                            `${videoName}.mp3`
                        )}"`
                    );

                    // Pipe audio to ffmpeg
                    const ffmpegProcess = cp.spawn(ffmpeg, [
                        "-i",
                        "pipe:0",
                        "-acodec",
                        "libmp3lame",
                        "-f",
                        "mp3",
                        "-ab",
                        "192000",
                        "-vn",
                        "pipe:1",
                    ]);

                    // Pipe ffmpeg output to response
                    audio.pipe(ffmpegProcess.stdin);
                    ffmpegProcess.stdout.pipe(res); // Output of the ffmpeg

                    // Kill ffmpeg process if the user closes the connection
                    res.on("close", () => {
                        ffmpegProcess.kill("SIGKILL");
                    });

                    return;
                }

                if (format == "video") {
                    // Pipe video to ffmpeg
                    const video = ytdl(url, {
                        filter: "videoonly",
                        quality: quality,
                        highWaterMark: 1 << 25,
                    });

                    // Pipe audio to ffmpeg
                    const audio = ytdl(url, {
                        filter: "audioonly",
                        quality: quality,
                        highWaterMark: 1 << 25,
                    });

                    // Set the content disposition header to force download
                    res.setHeader(
                        "Content-Disposition",
                        `attachment; filename="${encodeURIComponent(
                            `${videoName}.mp3`
                        )}"`
                    );

                    // Pipe ffmpeg output to response
                    const ffmpegProcess = cp.spawn(
                        ffmpeg,
                        [
                            "-i",
                            `pipe:3`,
                            "-i",
                            `pipe:4`,
                            "-map",
                            "0:v",
                            "-map",
                            "1:a",
                            "-c:v",
                            "libx264",
                            "-c:a",
                            "aac",
                            "-crf",
                            "27",
                            "-preset",
                            "veryfast",
                            "-movflags",
                            "frag_keyframe+empty_moov",
                            "-f",
                            "mp4",
                            "-loglevel",
                            "error",
                            "-",
                        ],
                        {
                            stdio: ["pipe", "pipe", "pipe", "pipe", "pipe"],
                        }
                    );

                    video.pipe(ffmpegProcess.stdio[3]);
                    audio.pipe(ffmpegProcess.stdio[4]);
                    ffmpegProcess.stdio[1].pipe(res); // Pipe ffmpeg output to response

                    let ffmpegLogs = "";

                    ffmpegProcess.stdio[2].on("data", (chunk) => {
                        ffmpegLogs += chunk.toString();
                    });

                    ffmpegProcess.on("exit", (exitCode) => {
                        if (exitCode === 1) {
                            console.error(ffmpegLogs);
                        }
                    });

                    return;
                }
                return res
                    .status(400)
                    .send(
                        "Invalid quality<br/>Valid qualities: highest, lowest, highestvideo, lowestvideo"
                    );
            }
        }
        return res
            .status(400)
            .send("Invalid format<br/>Valid formats: audio, video");
    }
    return res
        .status(400)
        .send(
            "Invalid URL<br/>Enter an valid YouTube URL/ID<br/>Example: https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        );
});

app.listen(port, () => {
    console.log(`Listening on port ${port}!`);
});
