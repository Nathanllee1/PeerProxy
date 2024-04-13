const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

ffmpeg('public/test.mp4', { timeout: 432000 }).addOptions([
    '-profile:v baseline',
    '-level 3.0',
    '-start_number 0',
    '-hls_time 2',
    '-hls_list_size 0',
    '-f hls'
]).output('public/videos2/output2.m3u8').on('end', () => {
    console.log('end');
}).run();