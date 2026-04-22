import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

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

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: finalMediaType as 'image/jpeg', data: finalBase64 } },
        { type: 'text', text: 'Parse this receipt. Return ONLY valid JSON, no markdown, no backticks, no explanation. Format: {"items": [{"quantity": 1, "name": "Item Name", "totalPrice": 0.00, "unitPrice": 0.00}], "subtotal": 0.00, "tax": 0.00, "tip": 0.00, "serviceCharge": 0.00, "total": 0.00}' }
      ]
    }]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const clean = text.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);
  return NextResponse.json(parsed);
}