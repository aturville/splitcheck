import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server'; export const maxDuration = 60;

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { image } = await req.json();
  const base64 = image.split(',')[1];
  const mediaType = image.split(';')[0].split(':')[1];

  let finalBase64 = base64;
  let finalMediaType = mediaType;

  if (mediaType === 'image/heic' || mediaType === 'image/heif') {
    const heicConvert = (await import('heic-convert')).default;
    const inputBuffer = Buffer.from(base64, 'base64');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const converted = await heicConvert({ buffer: inputBuffer as any, format: 'JPEG', quality: 0.9 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    finalBase64 = Buffer.from(converted as any).toString('base64');
    finalMediaType = 'image/jpeg';
  }

  const firstTurn: Anthropic.MessageParam = {
    role: 'user',
    content: [
      { type: 'image', source: { type: 'base64', media_type: finalMediaType as 'image/jpeg', data: finalBase64 } },
      { type: 'text', text: 'Parse this receipt. Return ONLY valid JSON, no markdown, no backticks, no explanation. Format: {"items": [{"quantity": 1, "name": "Item Name", "totalPrice": 0.00, "unitPrice": 0.00}], "subtotal": 0.00, "tax": 0.00, "tip": 0.00, "serviceCharge": 0.00, "total": 0.00}' }
    ]
  };

  const first = await askClaude([firstTurn]);
  let parsed = first.parsed;

  // Misread items (often shown as $0) make the items not add up to the subtotal; re-read once
  const gap = itemsGap(parsed);
  if (gap > 0.01) {
    try {
      const retry = await askClaude([
        firstTurn,
        { role: 'assistant', content: first.text },
        {
          role: 'user',
          content: `Your items add up to $${sumItems(parsed).toFixed(2)}, but the subtotal is $${Number(parsed.subtotal).toFixed(2)}. Look at the receipt again: find any item you missed or priced wrong (no item should be $0.00 unless the receipt says so). Return the corrected JSON in the same format, ONLY the JSON.`,
        },
      ]);
      if (itemsGap(retry.parsed) < gap) parsed = retry.parsed;
    } catch (err) {
      console.error('Receipt re-read failed', err);
    }
  }

  return NextResponse.json(parsed);
}

interface ParsedReceipt {
  items: { totalPrice: number }[];
  subtotal: number;
}

async function askClaude(messages: Anthropic.MessageParam[]) {
  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages,
  });
  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const clean = text.replace(/```json|```/g, '').trim();
  return { text: clean, parsed: JSON.parse(clean) };
}

function sumItems(r: ParsedReceipt) {
  return (r.items ?? []).reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0);
}

function itemsGap(r: ParsedReceipt) {
  return Math.abs((Number(r.subtotal) || 0) - sumItems(r));
}