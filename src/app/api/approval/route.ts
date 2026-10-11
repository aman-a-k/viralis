import { NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/workspace';
import { errorResponse, badRequest } from '@/lib/http';
import { decideReview } from '@/services/pipeline';

export async function POST(req: Request) {
  try {
    const ctx = await requireWorkspace();
    const { id, action, reason } = await req.json().catch(() => ({}));
    if (action !== 'approve' && action !== 'reject') throw badRequest('Invalid action.');
    const result = await decideReview({ workspaceId: ctx.workspaceId, userId: ctx.userId, unlimited: ctx.isPlatformAdmin }, String(id || ''), action, reason);
    return NextResponse.json({ success: true, message: result.message });
  } catch (error) {
    return errorResponse(error, 'Could not update this item.', 'api/approval');
  }
}
