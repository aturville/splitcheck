'use client';

import { useState, useRef } from 'react';

interface Item {
  quantity: number;
  name: string;
  totalPrice: number;
  unitPrice: number;
}

interface Receipt {
  items: Item[];
  subtotal: number;
  tax: number;
  tip: number;
  serviceCharge: number;
  total: number;
}

export default function Home() {
  const [image, setImage] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [payerChoice, setPayerChoice] = useState<'me' | 'someone' | 'skip' | null>(null);
  const [payerName, setPayerName] = useState('');
  const [creating, setCreating] = useState(false);
  const [tipInput, setTipInput] = useState('');
  const [editingPrice, setEditingPrice] = useState<{ index: number; value: string } | null>(null);

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const canvas = document.createElement('canvas');
    const img = document.createElement('img');
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        const maxSize = 1200;
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) { height = (height / width) * maxSize; width = maxSize; }
          else { width = (width / height) * maxSize; height = maxSize; }
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        setImage(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const parseReceipt = async () => {
    if (!image) return;
    setLoading(true);
    try {
      const res = await fetch('/api/parse-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
      });
      if (!res.ok) {
        const err = await res.text();
        alert('Error: ' + err);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setReceipt(data);
      setTipInput(data.tip > 0 ? data.tip.toFixed(2) : '');
    } catch {
      alert('Failed to parse receipt. Please try again.');
    }
    setLoading(false);
  };

  // Tip is often handwritten on the signed copy, so let the user set it by hand
  const updateTip = (value: string) => {
    setTipInput(value);
    const tip = Math.max(0, parseFloat(value) || 0);
    setReceipt(prev => prev ? { ...prev, tip, total: prev.total - prev.tip + tip } : prev);
  };

  // Fix a misread price; the printed subtotal stays as the reference to check against
  const commitPrice = () => {
    if (!editingPrice) return;
    const price = Math.max(0, parseFloat(editingPrice.value) || 0);
    setReceipt(prev => {
      if (!prev) return prev;
      const items = prev.items.map((item, i) =>
        i === editingPrice.index ? { ...item, totalPrice: price, unitPrice: price / (item.quantity || 1) } : item
      );
      return { ...prev, items };
    });
    setEditingPrice(null);
  };

  const applyTipPercent = (pct: number) => {
    if (!receipt) return;
    updateTip((receipt.subtotal * pct / 100).toFixed(2));
  };

  const saveReceiptPhoto = async () => {
    if (!image) return;
    const blob = await (await fetch(image)).blob();
    const file = new File([blob], `receipt-${new Date().toLocaleDateString('en-CA')}.jpg`, { type: 'image/jpeg' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') alert('Could not save photo.');
      }
      return;
    }
    const a = document.createElement('a');
    a.href = image;
    a.download = file.name;
    a.click();
  };

  const buildPayer = () => {
    if (!payerChoice || payerChoice === 'skip' || !payerName.trim()) return null;
    return { name: payerName.trim() };
  };

  const createSession = async (): Promise<string | null> => {
    const res = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receipt, payer: buildPayer() }),
    });
    if (!res.ok) {
      alert('Could not create split: ' + (await res.text()));
      return null;
    }
    const { id } = await res.json();
    if (!id) {
      alert('Could not create split. Please try again.');
      return null;
    }
    return id;
  };

  const claimFirst = async () => {
    if (!receipt || creating) return;
    setCreating(true);
    try {
      const id = await createSession();
      if (!id) return;
      // If I paid, I'm also the one claiming, so skip asking my name again
      if (payerChoice === 'me' && payerName.trim()) {
        try { sessionStorage.setItem(`splitcheck:name:${id}`, payerName.trim()); } catch {}
      }
      window.location.href = `/split/${id}`;
    } catch (err) {
      console.error('claimFirst failed', err);
      alert('Could not create split. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const createSplit = async () => {
    if (!receipt || creating) return;
    setCreating(true);
    try {
      const id = await createSession();
      if (!id) return;
      const url = `${window.location.origin}/split/${id}`;
      if (navigator.share) {
        try {
          await navigator.share({ title: 'SplitCheck', text: 'Tap to claim your items!', url });
        } catch (err) {
          // User closed the share sheet; nothing to do
          if ((err as Error).name !== 'AbortError') throw err;
        }
      } else {
        await navigator.clipboard.writeText(url);
        alert('Link copied!');
      }
    } catch (err) {
      console.error('createSplit failed', err);
      alert('Could not create split. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const reset = () => {
    setImage(null);
    setReceipt(null);
    setPayerChoice(null);
    setPayerName('');
    setTipInput('');
  };

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="max-w-md mx-auto p-6 pt-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-green-100 rounded-2xl mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">SplitCheck</h1>
          <p className="text-gray-500 mt-2 text-sm">Snap a receipt. Split it fairly. Done.</p>
        </div>

        {!receipt && (
          <>
            <input
              ref={fileInputRef}
              id="receipt-file"
              type="file"
              accept="image/*"
              onChange={handleImage}
              className="hidden"
            />

            {image ? (
              <>
                <button
                  onClick={parseReceipt}
                  disabled={loading}
                  className="w-full bg-gray-900 text-white font-medium py-3 rounded-xl disabled:opacity-50 transition-opacity">
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Reading receipt... ~15 sec
                    </span>
                  ) : 'Parse Receipt'}
                </button>
                <div className="text-center mt-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 bg-white hover:bg-gray-50 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Replace photo
                  </button>
                </div>
                <div className="mt-4">
                  <img src={image} alt="Receipt" className="w-full rounded-xl border border-gray-200" />
                </div>
              </>
            ) : (
              <label htmlFor="receipt-file" className="block">
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center hover:border-gray-300 transition-colors cursor-pointer bg-gray-50">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 mx-auto mb-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  <p className="font-medium text-gray-700">Upload a receipt</p>
                  <p className="text-xs text-gray-500 mt-1">Tap to take a photo or choose from your library</p>
                </div>
              </label>
            )}
          </>
        )}

        {receipt && (
          <div>
            {(() => {
              const itemsTotal = receipt.items.reduce((sum, item) => sum + item.totalPrice, 0);
              const diff = receipt.subtotal - itemsTotal;
              if (Math.abs(diff) < 0.01) return null;
              return (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900">
                  <p className="font-medium">Items don&apos;t add up to the subtotal</p>
                  <p className="mt-1">
                    Items total ${itemsTotal.toFixed(2)} but the receipt subtotal is ${receipt.subtotal.toFixed(2)}
                    {' '}(${Math.abs(diff).toFixed(2)} {diff > 0 ? 'missing' : 'extra'}). Tap a price to fix it.
                  </p>
                </div>
              );
            })()}
            <ul className="space-y-2">
              {receipt.items.map((item, i) => (
                <li key={i} className="flex justify-between items-center border-b border-gray-100 pb-2">
                  <span className="text-sm">
                    <span className="font-medium">{item.quantity}x</span> {item.name}
                    {item.quantity > 1 && (
                      <span className="text-gray-400 text-xs ml-1">(${item.unitPrice.toFixed(2)} ea)</span>
                    )}
                  </span>
                  {editingPrice?.index === i ? (
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      autoFocus
                      onFocus={e => e.target.select()}
                      placeholder="0.00"
                      value={editingPrice.value}
                      onChange={e => setEditingPrice({ index: i, value: e.target.value })}
                      onBlur={commitPrice}
                      onKeyDown={e => { if (e.key === 'Enter') commitPrice(); }}
                      aria-label={`Price for ${item.name}`}
                      className="w-20 border rounded-md px-2 py-1 text-sm text-right"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingPrice({ index: i, value: item.totalPrice > 0 ? item.totalPrice.toFixed(2) : '' })}
                      aria-label={`Edit price for ${item.name}`}
                      className={`text-sm px-1 rounded border-b border-dashed ${item.totalPrice === 0 ? 'text-amber-700 bg-amber-50 border-amber-400' : 'border-gray-300'}`}>
                      ${item.totalPrice.toFixed(2)}
                    </button>
                  )}
                </li>
              ))}
            </ul>

            <div className="mt-4 space-y-1 text-sm text-gray-500">
              <div className="flex justify-between"><span>Subtotal</span><span>${receipt.subtotal.toFixed(2)}</span></div>
              {receipt.serviceCharge > 0 && <div className="flex justify-between"><span>Service Charge</span><span>${receipt.serviceCharge.toFixed(2)}</span></div>}
              {receipt.tax > 0 && <div className="flex justify-between"><span>Tax</span><span>${receipt.tax.toFixed(2)}</span></div>}
              <div className="flex justify-between items-center">
                <span className="pr-2">
                  Tip
                  <span className="block text-xs text-gray-400">Tip not on the receipt? Write what you paid here:</span>
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <span>$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={tipInput}
                    onChange={e => updateTip(e.target.value)}
                    aria-label="Tip amount"
                    className="w-20 border rounded-md px-2 py-1 text-right text-gray-900"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-1">
                <button
                  type="button"
                  onClick={() => updateTip('0.00')}
                  className={`px-2 py-1 border rounded-md text-xs ${tipInput === '0.00' ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                  No tip
                </button>
                {[18, 20, 22].map(pct => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => applyTipPercent(pct)}
                    className={`px-2 py-1 border rounded-md text-xs ${tipInput !== '' && tipInput === (receipt.subtotal * pct / 100).toFixed(2) ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                    {pct}%
                  </button>
                ))}
              </div>
              <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2 mt-2 text-base">
                <span>Total</span><span>${receipt.total.toFixed(2)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={saveReceiptPhoto}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 bg-white hover:bg-gray-50 transition-colors">
              Save receipt photo
            </button>

            <div className="mt-6 border-t border-gray-100 pt-5">
              <p className="text-sm font-medium text-gray-700 mb-3">Who paid the bill?</p>
              <div className="flex gap-2">
                {(['me', 'someone', 'skip'] as const).map(choice => (
                  <button
                    key={choice}
                    onClick={() => setPayerChoice(choice)}
                    className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${payerChoice === choice ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                    {choice === 'me' ? 'I paid' : choice === 'someone' ? 'Someone else' : 'Skip'}
                  </button>
                ))}
              </div>
              {(payerChoice === 'me' || payerChoice === 'someone') && (
                <div className="mt-3">
                  <input
                    placeholder={payerChoice === 'me' ? 'Your name' : 'Their name'}
                    value={payerName}
                    onChange={e => setPayerName(e.target.value)}
                    className="border rounded-xl px-3 py-2 w-full text-sm"
                  />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={claimFirst}
              disabled={creating}
              className="mt-6 w-full bg-gray-900 hover:bg-gray-800 text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-50">
              {creating ? 'Creating split...' : 'Claim My Items First'}
            </button>

            <button
              type="button"
              onClick={createSplit}
              disabled={creating}
              className="mt-2 w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-50">
              Share Split Link
            </button>

            <button
              onClick={reset}
              className="mt-2 w-full text-gray-500 text-sm py-2">
              Start over
            </button>
          </div>
        )}
      </div>
    </main>
  );
}