// Supabase Deno Edge Function: push-dispatcher
// Webhook listener for database events and scheduled queue dispatches.

declare const Deno: any;

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

export interface DatabaseWebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE' | 'CRON_QUEUE' | 'MANUAL';
  table?: string;
  schema?: string;
  record?: Record<string, any>;
  old_record?: Record<string, any>;
  queue_items?: Array<{
    id: string;
    user_id: string;
    payload: Record<string, any>;
    scheduled_for: string;
  }>;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 1. Verify Authentication via X-Webhook-Secret
  const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
  const incomingSecret = req.headers.get('x-webhook-secret');

  if (webhookSecret && incomingSecret !== webhookSecret) {
    console.error('⛔ [PushDispatcher] Unauthorized: Invalid or missing X-Webhook-Secret');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const rawBody = await req.text();
    if (!rawBody) {
      return new Response(JSON.stringify({ message: 'Empty body received' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload: DatabaseWebhookPayload = JSON.parse(rawBody);
    console.log(`📩 [PushDispatcher] Received webhook event type=${payload.type}, table=${payload.table ?? 'n/a'}`);

    return new Response(
      JSON.stringify({
        status: 'acknowledged',
        eventType: payload.type,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('❌ [PushDispatcher] Error processing webhook request:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
