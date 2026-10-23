import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server'; export const maxDuration = 60;

const client = new Anthropic();

// Phone photos are often tilted, so a price can sit level with the line above its item.
// Spell out the receipt structure so prices are paired with items by order, not by row.
const RECEIPT_PROMPT = `Parse this receipt photo into JSON for splitting the bill.

How receipt lines are structured:
- Each purchased item starts on a line with a quantity and the item name, usually in capitals (e.g. "1 SHAKE", "2 JR. CHEESE KIDS MEAL-").
- Indented lines under an item are its modifiers (size, flavor, add-ons, "No Pickles"). They belong to that item and are never separate items.
- Each item has exactly one price in the price column, so the number of items equals the number of item prices.

The photo may be tilted or curled, so prices don't line up with their items row by row. Don't pair them yourself. Instead return two separate lists:
- "items": every item in order from top to bottom, with its quantity and name. Never create an item from a modifier line.
- "itemPrices": every item price in the price column, in order from top to bottom, stopping before the subtotal. Read the price column on its own, as one vertical list.
Both lists must have the same length. Before answering, check that itemPrices add up to the printed subtotal; if they don't, re-read the price column.

Name each item with its main name plus the modifiers that tell it apart, in title case, for example "Shake – Large Oreo" or "Jr. Cheese Kids Meal – No Pickles, No Mustard, Tomato". Keep names short enough to read on a phone.

Use 0 for tip or serviceCharge when the receipt doesn't print one.

Return ONLY valid JSON, no markdown, no backticks, no explanation. Format: {"items": [{"quantity": 1, "name": "Item Name"}], "itemPrices": [0.00], "subtotal": 0.00, "tax": 0.00, "tip": 0.00, "serviceCharge": 0.00, "total": 0.00}`;

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
      { type: 'text', text: RECEIPT_PROMPT }
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
  return { text: clean, parsed: pairPrices(JSON.parse(clean)) };
}

// Pair the price column with the items by position (the model reads them as two lists)
function pairPrices(raw: { items?: { quantity?: number; name: string; totalPrice?: number }[]; itemPrices?: number[]; subtotal: number }) {
  const prices = Array.isArray(raw.itemPrices) ? raw.itemPrices : null;
  const items = (raw.items ?? []).map((item, i) => {
    const quantity = Number(item.quantity) || 1;
    const totalPrice = Number(prices ? prices[i] : item.totalPrice) || 0;
    return { quantity, name: item.name, totalPrice, unitPrice: totalPrice / quantity };
  });
  const rest = { ...raw };
  delete rest.itemPrices;
  return { ...rest, items };
}

function sumItems(r: ParsedReceipt) {
  return (r.items ?? []).reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0);
}

function itemsGap(r: ParsedReceipt) {
  return Math.abs((Number(r.subtotal) || 0) - sumItems(r));
}