import fs from 'fs';
import { getReadableStream, videoInfo } from 'youtube-ext';

async function testDownload() {
  const url = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'; // "Me at the zoo"
  console.log('Fetching info for:', url);
  
  try {
    const info = await videoInfo(url);
    console.log('Title:', info.title);
    
    console.log('Downloading...');
    
    // In youtube-ext, to get a video stream:
    const streamInfo = { url: url };
    
    const readableStream = await getReadableStream(streamInfo);
    
    const writeStream = fs.createWriteStream('./test_vid.mp4');
    readableStream.pipe(writeStream);
    
    writeStream.on('finish', () => {
      console.log('Download complete: test_vid.mp4');
    });
    
    writeStream.on('error', (err) => {
      console.error('Download error:', err);
    });
    
  } catch (error) {
    console.error('Error fetching/downloading:', error);
  }
}

testDownload();
