import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@priovex/database';

// Server-Sent Events endpoint for real-time search progress
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return new Response('Not found', { status: 404 });

  const search = await prisma.search.findFirst({
    where: { id, userId: user.id },
  });

  if (!search) return new Response('Search not found', { status: 404 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const send = (data: object) => {
        if (!closed) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        }
      };

      // Send initial state
      const initialSearch = await prisma.search.findUnique({
        where: { id },
        include: {
          progressLogs: { orderBy: { timestamp: 'asc' }, take: 100 },
        },
      });

      send({ type: 'state', data: initialSearch });

      // Poll every 2 seconds
      const interval = setInterval(async () => {
        if (closed) {
          clearInterval(interval);
          return;
        }

        try {
          const current = await prisma.search.findUnique({
            where: { id },
            include: {
              progressLogs: { orderBy: { timestamp: 'asc' }, take: 100 },
            },
          });

          if (!current) {
            clearInterval(interval);
            controller.close();
            return;
          }

          send({ type: 'state', data: current });

          // Close stream when terminal state reached
          const terminalStatuses = ['COMPLETED', 'FAILED', 'CANCELLED'];
          if (terminalStatuses.includes(current.status)) {
            clearInterval(interval);
            setTimeout(() => {
              if (!closed) {
                closed = true;
                controller.close();
              }
            }, 1000);
          }
        } catch {
          clearInterval(interval);
          if (!closed) {
            closed = true;
            controller.close();
          }
        }
      }, 2000);

      // Handle client disconnect
      req.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
