import { NextResponse } from 'next/server';
import { RepurposingService } from '@/services/repurposingService';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('video') as File | null;
    const title = (formData.get('title') as string) || (file ? file.name.replace(/\.[^/.]+$/, '') : 'Uploaded Video Episode');

    if (!file) {
      return NextResponse.json({ success: false, error: 'No video file provided' }, { status: 400 });
    }

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const safeFilename = `upload_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
    const destinationPath = path.join(uploadsDir, safeFilename);

    const bytes = await file.arrayBuffer();
    fs.writeFileSync(destinationPath, Buffer.from(bytes));

    console.log(`[API /api/repurpose/upload] Video file uploaded: ${destinationPath} (${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB)`);

    const result = await RepurposingService.ingestVideo({
      title,
      uploadedFilePath: destinationPath,
      sourceType: 'upload',
    });

    return NextResponse.json({
      success: true,
      project: result.project,
      clips: result.clips,
      message: `Extracted and rendered ${result.clips.length} real video highlights!`,
    });
  } catch (error: any) {
    console.error('[API /api/repurpose/upload] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
