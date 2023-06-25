const ytdl = require("ytdl-core");
const cp = require("child_process");
const ffmpeg = require("ffmpeg-static");
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const port = 3000;

const tempDir = path.join(__dirname, "public", "temp");

// TODO: Figure out how to add video length to the output of the ffmpeg

// Create the temporary directory if it doesn't exist
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

// Save res (stream) to file using a temporary file saver
const saveFileToTemp = async (stream, filename) => {
    const filePath = path.join(tempDir, filename);
    if (fs.existsSync(filePath)) {
        throw new Error("File already exists");
    }
    const fileStream = fs.createWriteStream(filePath);
    stream.pipe(fileStream);
    return new Promise((resolve, reject) => {
        fileStream.on("finish", resolve);
        fileStream.on("error", reject);
    });
};

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/index.html");
});

app.get("/download/:filename", (req, res) => {
    const filename = decodeURIComponent(req.params.filename);
    const filePath = path.join(tempDir, filename);
    res.download(filePath, (err) => {
        if (err) {
            console.error("Error downloading file:", err);
            return res.status(500).send("Error downloading file");
        }
        // Delete the file after successful download
        fs.unlink(filePath, (unlinkErr) => {
            if (unlinkErr) {
                console.error("Error deleting file:", unlinkErr);
            }
        });
    });
});

app.get("/youtube", async (req, res) => {
    const url = req.query.url;
    const info = req.query.info;
    const format = req.query.format;
    const quality = req.query.quality;

    if (ytdl.validateURL(url) || ytdl.validateID(url)) {
        if (info === "true") {
            const info = await ytdl.getInfo(url);
            return res.send(info);
        }

        if (format) {
            if (
                quality === "highest" ||
                quality === "lowest" ||
                quality === "highestvideo" ||
                quality === "lowestvideo"
            ) {
                const info = await ytdl.getInfo(url);
                const videoName = info.videoDetails.title;
                const videoLength = info.videoDetails.lengthSeconds;

                if (format === "audio") {
                    const audio = ytdl(url, {
                        filter: "audioonly",
                        quality: quality,
                        highWaterMark: 1 << 25,
                    });

                    const ffmpegProcess = cp.spawn(ffmpeg, [
                        "-i",
                        "pipe:0",
                        "-acodec",
                        "libmp3lame",
                        "-f",
                        "mp3",
                        "-ab",
                        "192000",
                        "-vn", // Delete video, only keep audio
                        "-loglevel",
                        "error",
                        "pipe:1",
                    ]);

                    audio.pipe(ffmpegProcess.stdin);

                    ffmpegProcess.on("error", (err) => {
                        // Handle the error by sending it to the response object
                        res.send(err.toString());
                    });

                    res.on("close", () => {
                        ffmpegProcess.kill("SIGKILL");
                    });

                    try {
                        // Check if the file already exists
                        const downloadLink = `/download/${encodeURIComponent(
                            `${videoName}.mp3`
                        )}`;

                        const filePath = path.join(tempDir, `${videoName}.mp3`);
                        if (fs.existsSync(filePath)) {
                            return res.redirect(downloadLink);
                        }

                        await saveFileToTemp(
                            ffmpegProcess.stdout,
                            `${videoName}.mp3`
                        );

                        return res.redirect(downloadLink);
                    } catch (error) {
                        console.error("Error saving file:", error);
                        return res.status(500).send("Error saving file");
                    }
                }

                if (format === "video") {
                    const video = ytdl(url, {
                        filter: "videoonly",
                        quality: quality,
                        highWaterMark: 1 << 25,
                    });

                    const audio = ytdl(url, {
                        filter: "audioonly",
                        quality: quality,
                        highWaterMark: 1 << 25,
                    });

                    const ffmpegProcess = cp.spawn(
                        ffmpeg,
                        [
                            "-i",
                            `pipe:3`,
                            "-i",
                            `pipe:4`,
                            "-ss",
                            "00:00:00",
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
                            //stdin (standard input), stdout, stderr (standard error), pipe 3 (video input), pipe 4 (audio input), and pipe 5 (video length input)
                            stdio: [
                                "pipe",
                                "pipe",
                                "pipe",
                                "pipe",
                                "pipe",
                                "pipe",
                            ],
                        }
                    );

                    video.pipe(ffmpegProcess.stdio[3]);
                    audio.pipe(ffmpegProcess.stdio[4]);
                
                    ffmpegProcess.on("error", (err) => {
                        // Handle the error by sending it to the response object
                        res.send(err.toString());
                    });

                    res.on("close", () => {
                        ffmpegProcess.kill("SIGKILL");
                    });

                    try {
                        // Check if the file already exists
                        const downloadLink = `/download/${encodeURIComponent(
                            `${videoName}.mp4`
                        )}`;

                        const filePath = path.join(tempDir, `${videoName}.mp4`);
                        if (fs.existsSync(filePath)) {
                            return res.redirect(downloadLink);
                        }

                        await saveFileToTemp(
                            ffmpegProcess.stdout,
                            `${videoName}.mp4`
                        );

                        return res.redirect(downloadLink);
                    } catch (error) {
                        console.error("Error saving file:", error);
                        return res.status(500).send("Error saving file");
                    }
                }
            } else {
                return res.status(400).send("Invalid quality parameter");
            }
        } else {
            return res.status(400).send("Missing format parameter");
        }
    } else {
        return res.status(400).send("Invalid YouTube URL or ID");
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
