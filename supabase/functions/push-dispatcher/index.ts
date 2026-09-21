// Supabase Deno Edge Function: push-dispatcher
// Handles incoming database webhooks, evaluates Quiet Hours,
// queues non-urgent alerts in PostgreSQL, and dispatches batched push notifications to Expo.

import { createClient } from '@supabase/supabase-js';

declare const Deno: any;

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

// ============================================================================
// TYPES
// ============================================================================
export type NotificationUrgency = 'CRITICAL' | 'NORMAL' | 'LOW';
export type NotificationDispatchAction = 'SEND_IMMEDIATELY' | 'QUEUE_FOR_LATER' | 'MUTE';

export interface RecipientNotificationSettings {
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  bypass_for_urgent: boolean;
  timezone?: string | null;
}

export interface RecipientNotificationPlan {
  action: NotificationDispatchAction;
  urgency: NotificationUrgency;
  isWithinQuietHours: boolean;
  scheduledFor?: string | null;
  reason: string;
}

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
  data?: Record<string, any>;
}

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

// ============================================================================
// PURE EVALUATION MATH ENGINE (SELF-CONTAINED)
// ============================================================================

export function parseTimeToSeconds(timeInput: string | Date): number {
  if (timeInput instanceof Date) {
    return (
      timeInput.getHours() * 3600 +
      timeInput.getMinutes() * 60 +
      timeInput.getSeconds()
    );
  }

  const str = timeInput.trim();
  const timePart = str.includes('T') ? str.split('T')[1].split('.')[0] : str;
  const parts = timePart.split(':');

  const hours = parseInt(parts[0] ?? '0', 10);
  const minutes = parseInt(parts[1] ?? '0', 10);
  const seconds = parts[2] ? parseFloat(parts[2]) : 0;

  return (hours % 24) * 3600 + (minutes % 60) * 60 + Math.floor(seconds % 60);
}

export function isWithinQuietHours(
  currentTime: string | Date,
  startTime: string | Date,
  endTime: string | Date
): boolean {
  const currentSec = parseTimeToSeconds(currentTime);
  const startSec = parseTimeToSeconds(startTime);
  const endSec = parseTimeToSeconds(endTime);

  if (startSec === endSec) return false;

  if (startSec < endSec) {
    return currentSec >= startSec && currentSec < endSec;
  }

  return currentSec >= startSec || currentSec < endSec;
}

export function determineNotificationUrgency(
  eventCategory: string,
  eventStatus?: string | null
): NotificationUrgency {
  const cat = (eventCategory || '').toLowerCase().trim();
  const status = (eventStatus || '').toLowerCase().trim();

  if (
    cat === 'cancellation' ||
    cat === 'class_cancellation' ||
    cat === 'delay' ||
    cat === 'class_delay' ||
    cat === 'room_move' ||
    cat === 'room_change' ||
    (cat === 'schedule_override' &&
      (status === 'cancelled' ||
        status === 'cancellation' ||
        status === 'delayed' ||
        status === 'delay' ||
        status === 'room_move' ||
        status === 'room_change' ||
        status === 'rescheduled'))
  ) {
    return 'CRITICAL';
  }

  if (
    cat === 'academic_task' ||
    cat === 'cohort_task' ||
    cat === 'task' ||
    cat === 'announcement' ||
    cat === 'broadcast' ||
    cat === 'assignment' ||
    cat === 'exam' ||
    cat === 'quiz' ||
    cat === 'project'
  ) {
    return 'NORMAL';
  }

  if (cat === 'attendance' || cat === 'reminder' || cat === 'routine') {
    return 'LOW';
  }

  return 'NORMAL';
}

export function getTimeInTimezone(date: Date, timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    return formatter.format(date);
  } catch (e) {
    return date.toISOString().split('T')[1].slice(0, 8);
  }
}

function getZonedDateParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  let year = 0, month = 0, day = 0, hour = 0, minute = 0, second = 0;

  for (const part of parts) {
    if (part.type === 'year') year = parseInt(part.value, 10);
    else if (part.type === 'month') month = parseInt(part.value, 10);
    else if (part.type === 'day') day = parseInt(part.value, 10);
    else if (part.type === 'hour') hour = parseInt(part.value, 10) % 24;
    else if (part.type === 'minute') minute = parseInt(part.value, 10);
    else if (part.type === 'second') second = parseInt(part.value, 10);
  }

  return { year, month, day, hour, minute, second };
}

export function calculateNextQuietHoursEnd(
  currentTime: Date,
  quietHoursEnd: string,
  timezone: string
): Date {
  const targetTz = timezone || 'UTC';
  const endSec = parseTimeToSeconds(quietHoursEnd);
  const endHours = Math.floor(endSec / 3600);
  const endMinutes = Math.floor((endSec % 3600) / 60);
  const endSeconds = endSec % 60;

  const currentParts = getZonedDateParts(currentTime, targetTz);
  const currentSec = currentParts.hour * 3600 + currentParts.minute * 60 + currentParts.second;

  const targetDayOffset = currentSec >= endSec ? 1 : 0;

  const baseUtc = new Date(
    Date.UTC(
      currentParts.year,
      currentParts.month - 1,
      currentParts.day + targetDayOffset,
      endHours,
      endMinutes,
      endSeconds
    )
  );

  const zonedParts = getZonedDateParts(baseUtc, targetTz);
  const zonedAsUtc = new Date(
    Date.UTC(
      zonedParts.year,
      zonedParts.month - 1,
      zonedParts.day,
      zonedParts.hour,
      zonedParts.minute,
      zonedParts.second
    )
  );
  const offsetMs = zonedAsUtc.getTime() - baseUtc.getTime();

  return new Date(baseUtc.getTime() - offsetMs);
}

export function evaluateRecipientNotificationPlan(
  recipientSettings: RecipientNotificationSettings | null | undefined,
  eventCategory: string,
  eventStatus?: string | null,
  timestamp?: string | Date
): RecipientNotificationPlan {
  const urgency = determineNotificationUrgency(eventCategory, eventStatus);

  if (!recipientSettings || !recipientSettings.quiet_hours_enabled) {
    return {
      action: 'SEND_IMMEDIATELY',
      urgency,
      isWithinQuietHours: false,
      scheduledFor: null,
      reason: 'Quiet hours are disabled by recipient',
    };
  }

  const tz = recipientSettings.timezone || 'UTC';
  const evalDate = timestamp ? new Date(timestamp) : new Date();
  const currentLocalTime = getTimeInTimezone(evalDate, tz);
  const inQuietHours = isWithinQuietHours(
    currentLocalTime,
    recipientSettings.quiet_hours_start,
    recipientSettings.quiet_hours_end
  );

  if (!inQuietHours) {
    return {
      action: 'SEND_IMMEDIATELY',
      urgency,
      isWithinQuietHours: false,
      scheduledFor: null,
      reason: 'Recipient is currently outside quiet hours',
    };
  }

  // Inside Quiet Hours
  if (urgency === 'CRITICAL') {
    if (recipientSettings.bypass_for_urgent !== false) {
      return {
        action: 'SEND_IMMEDIATELY',
        urgency,
        isWithinQuietHours: true,
        scheduledFor: null,
        reason: 'Critical urgent notification bypassed quiet hours',
      };
    } else {
      const scheduledDate = calculateNextQuietHoursEnd(
        evalDate,
        recipientSettings.quiet_hours_end,
        tz
      );
      return {
        action: 'QUEUE_FOR_LATER',
        urgency,
        isWithinQuietHours: true,
        scheduledFor: scheduledDate.toISOString(),
        reason: 'Critical alert queued because recipient disabled urgent bypass',
      };
    }
  }

  if (urgency === 'NORMAL') {
    const scheduledDate = calculateNextQuietHoursEnd(
      evalDate,
      recipientSettings.quiet_hours_end,
      tz
    );
    return {
      action: 'QUEUE_FOR_LATER',
      urgency,
      isWithinQuietHours: true,
      scheduledFor: scheduledDate.toISOString(),
      reason: 'Quiet hours active; notification queued for morning dispatch',
    };
  }

  return {
    action: 'MUTE',
    urgency,
    isWithinQuietHours: true,
    scheduledFor: null,
    reason: 'Quiet hours active; low priority notification muted',
  };
}

// ============================================================================
// EXPO PUSH CHUNKING & DISPATCH
// ============================================================================

export function chunkArray<T>(array: T[], size = 100): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export async function sendExpoPushChunks(messages: ExpoPushMessage[]): Promise<any[]> {
  if (messages.length === 0) return [];

  const chunks = chunkArray(messages, 100);
  const results: any[] = [];

  for (const chunk of chunks) {
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(chunk),
      });

      const data = await response.json();
      results.push(data);
      console.log(`🚀 [PushDispatcher] Dispatched chunk of ${chunk.length} push tickets to Expo. Status: ${response.status}`);
    } catch (err) {
      console.error('❌ [PushDispatcher] Failed to send push chunk to Expo:', err);
      results.push({ error: String(err) });
    }
  }

  return results;
}

// ============================================================================
// MAIN DENO EDGE FUNCTION HANDLER
// ============================================================================

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 1. Authenticate via X-Webhook-Secret
  const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
  const incomingSecret = req.headers.get('x-webhook-secret');

  if (webhookSecret && incomingSecret !== webhookSecret) {
    console.error('⛔ [PushDispatcher] Unauthorized: Invalid or missing X-Webhook-Secret');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 2. Initialize Supabase Admin Client
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ [PushDispatcher] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return new Response(JSON.stringify({ error: 'Edge function environment misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const rawBody = await req.text();
    if (!rawBody) {
      return new Response(JSON.stringify({ message: 'Empty body received' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload: DatabaseWebhookPayload = JSON.parse(rawBody);
    console.log(`📩 [PushDispatcher] Event type=${payload.type}, table=${payload.table ?? 'n/a'}`);

    const immediateMessages: ExpoPushMessage[] = [];
    const queuedItems: Array<{
      user_id: string;
      payload: Record<string, any>;
      scheduled_for: string;
      status: string;
    }> = [];

    // ========================================================================
    // MODE A: CRON QUEUE PROCESSOR (pg_cron delayed batch dispatch)
    // ========================================================================
    if (payload.type === 'CRON_QUEUE' || payload.table === 'notification_queue') {
      console.log('⏰ [PushDispatcher] Processing pending notifications from notification_queue...');

      // Fetch pending items scheduled for now or earlier
      const { data: queueRecords, error: fetchErr } = await supabase
        .from('notification_queue')
        .select('id, user_id, payload, scheduled_for')
        .eq('status', 'pending')
        .lte('scheduled_for', new Date().toISOString())
        .limit(200);

      if (fetchErr) {
        throw new Error(`Failed to query notification_queue: ${fetchErr.message}`);
      }

      if (!queueRecords || queueRecords.length === 0) {
        console.log('ℹ️ [PushDispatcher] No pending notifications due for delivery.');
        return new Response(JSON.stringify({ status: 'success', processed: 0 }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const queueIds = queueRecords.map((r: any) => r.id);

      // Mark status as 'processing'
      await supabase
        .from('notification_queue')
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .in('id', queueIds);

      // Gather active push tokens for users in the queue
      const userIds = Array.from(new Set(queueRecords.map((r: any) => r.user_id)));
      const { data: tokens } = await supabase
        .from('user_push_tokens')
        .select('user_id, expo_push_token')
        .in('user_id', userIds)
        .eq('is_active', true);

      const userTokensMap: Record<string, string[]> = {};
      (tokens || []).forEach((t: any) => {
        if (!userTokensMap[t.user_id]) userTokensMap[t.user_id] = [];
        userTokensMap[t.user_id].push(t.expo_push_token);
      });

      const cronPushMessages: ExpoPushMessage[] = [];
      for (const record of queueRecords) {
        const userTokens = userTokensMap[record.user_id] || [];
        const content = record.payload || {};

        for (const token of userTokens) {
          cronPushMessages.push({
            to: token,
            title: content.title || 'ClassSync Alert',
            body: content.body || '',
            sound: 'default',
            channelId: content.channelId || 'default',
            priority: 'normal',
            data: content.data || { url: '/(tabs)' },
          });
        }
      }

      // Dispatch batched messages to Expo
      await sendExpoPushChunks(cronPushMessages);

      // Update processed queue items to 'sent'
      await supabase
        .from('notification_queue')
        .update({ status: 'sent', updated_at: new Date().toISOString() })
        .in('id', queueIds);

      console.log(`✅ [PushDispatcher] Completed dispatch for ${queueRecords.length} queued items.`);
      return new Response(
        JSON.stringify({
          status: 'success',
          processed: queueRecords.length,
          messagesSent: cronPushMessages.length,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // ========================================================================
    // MODE B: REALTIME WEBHOOK DISPATCHER (Schedule Overrides & Cohort Tasks)
    // ========================================================================
    const record = payload.record;
    if (!record) {
      return new Response(JSON.stringify({ message: 'No record in payload to process' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sectionId = record.section_id;
    if (!sectionId) {
      return new Response(JSON.stringify({ message: 'Missing section_id in record' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine event classification and copy
    let eventCategory = 'general';
    let eventStatus: string | null = null;
    let notificationTitle = 'ClassSync Notification';
    let notificationBody = 'Your class schedule has been updated.';
    let deepLinkUrl = '/(tabs)';

    if (payload.table === 'schedule_overrides') {
      eventCategory = 'schedule_override';
      eventStatus = record.override_type || 'cancellation';
      const overrideType = (record.override_type || '').toLowerCase();

      if (overrideType === 'cancelled') {
        notificationTitle = '🚨 Class Cancelled';
        notificationBody = `Class on ${record.original_date} has been cancelled.${record.reason ? ' Reason: ' + record.reason : ''}`;
      } else if (overrideType === 'rescheduled') {
        notificationTitle = '⚠️ Class Rescheduled';
        notificationBody = `Class moved to ${record.new_date ?? record.original_date} at ${record.new_start_time ?? 'updated time'}.`;
      } else if (overrideType === 'makeup') {
        notificationTitle = '📅 Makeup Class Scheduled';
        notificationBody = `Makeup class scheduled on ${record.new_date} at ${record.new_start_time}.`;
      } else {
        notificationTitle = '📌 Schedule Notice';
        notificationBody = record.reason || 'An update was posted to your class schedule.';
      }

      deepLinkUrl = '/(tabs)';
    } else if (payload.table === 'academic_tasks') {
      eventCategory = 'academic_task';
      eventStatus = record.task_type || 'assignment';

      notificationTitle = `📋 New Task: ${record.title}`;
      notificationBody = `Due: ${record.due_datetime ? new Date(record.due_datetime).toLocaleString() : 'Soon'}`;
      deepLinkUrl = '/(tabs)/tasks';
    }

    // Fetch enrolled students in this section
    const { data: members, error: membersErr } = await supabase
      .from('section_members')
      .select('user_id')
      .eq('section_id', sectionId);

    if (membersErr) {
      throw new Error(`Failed to fetch section members: ${membersErr.message}`);
    }

    const recipientUserIds = (members || []).map((m: any) => m.user_id);
    if (recipientUserIds.length === 0) {
      return new Response(JSON.stringify({ message: 'No enrolled students in section' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch quiet hours settings for all recipients
    const { data: allSettings } = await supabase
      .from('user_notification_settings')
      .select('user_id, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, bypass_for_urgent, timezone')
      .in('user_id', recipientUserIds);

    const settingsMap: Record<string, RecipientNotificationSettings> = {};
    (allSettings || []).forEach((s: any) => {
      settingsMap[s.user_id] = s;
    });

    // Fetch active push tokens for all recipients
    const { data: allTokens } = await supabase
      .from('user_push_tokens')
      .select('user_id, expo_push_token')
      .in('user_id', recipientUserIds)
      .eq('is_active', true);

    const tokensMap: Record<string, string[]> = {};
    (allTokens || []).forEach((t: any) => {
      if (!tokensMap[t.user_id]) tokensMap[t.user_id] = [];
      tokensMap[t.user_id].push(t.expo_push_token);
    });

    // Evaluate each recipient
    const now = new Date();
    for (const userId of recipientUserIds) {
      const userSettings = settingsMap[userId];
      const userTokens = tokensMap[userId] || [];

      // No active devices registered for this user
      if (userTokens.length === 0) continue;

      const plan = evaluateRecipientNotificationPlan(
        userSettings,
        eventCategory,
        eventStatus,
        now
      );

      if (plan.action === 'SEND_IMMEDIATELY') {
        const isCritical = plan.urgency === 'CRITICAL';
        for (const token of userTokens) {
          immediateMessages.push({
            to: token,
            title: notificationTitle,
            body: notificationBody,
            sound: 'default',
            channelId: isCritical ? 'urgent' : 'default',
            priority: isCritical ? 'high' : 'normal',
            data: {
              url: deepLinkUrl,
              urgency: plan.urgency,
              eventCategory,
              table: payload.table,
              recordId: record.id,
            },
          });
        }
      } else if (plan.action === 'QUEUE_FOR_LATER') {
        queuedItems.push({
          user_id: userId,
          payload: {
            title: notificationTitle,
            body: notificationBody,
            data: {
              url: deepLinkUrl,
              urgency: plan.urgency,
              eventCategory,
              table: payload.table,
              recordId: record.id,
            },
            channelId: 'default',
          },
          scheduled_for: plan.scheduledFor || now.toISOString(),
          status: 'pending',
        });
      }
      // If plan.action === 'MUTE', do nothing
    }

    // 1. Insert Queued Items into notification_queue
    if (queuedItems.length > 0) {
      const { error: insertQueueErr } = await supabase
        .from('notification_queue')
        .insert(queuedItems);

      if (insertQueueErr) {
        console.error('❌ [PushDispatcher] Failed to insert items into notification_queue:', insertQueueErr);
      } else {
        console.log(`📦 [PushDispatcher] Queued ${queuedItems.length} notifications during quiet hours.`);
      }
    }

    // 2. Dispatch Immediate Push Messages in batches of 100
    if (immediateMessages.length > 0) {
      await sendExpoPushChunks(immediateMessages);
    }

    return new Response(
      JSON.stringify({
        status: 'success',
        immediateSent: immediateMessages.length,
        queued: queuedItems.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('❌ [PushDispatcher] Unhandled error during dispatch:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
