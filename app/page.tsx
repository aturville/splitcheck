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
    } catch {
      alert('Failed to parse receipt. Please try again.');
    }
    setLoading(false);
  };

  const claimFirst = async () => {
    if (!receipt) return;
    const res = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(receipt),
    });
    const { id } = await res.json();
    window.location.href = `/split/${id}`;
  };

  const createSplit = async () => {
    if (!receipt) return;
    const res = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(receipt),
    });
    const { id } = await res.json();
    const url = `${window.location.origin}/split/${id}`;
    if (navigator.share) {
      await navigator.share({ title: 'SplitCheck', text: 'Tap to claim your items!', url });
    } else {
      await navigator.clipboard.writeText(url);
      alert('Link copied!');
    }
  };

  const reset = () => {
    setImage(null);
    setReceipt(null);
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
              <div className="text-center">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 bg-white hover:bg-gray-50 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Replace photo
                </button>
              </div>
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

            {image && (
              <button
                onClick={parseReceipt}
                disabled={loading}
                className="mt-4 w-full bg-gray-900 text-white font-medium py-3 rounded-xl disabled:opacity-50 transition-opacity">
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Reading receipt... ~15 sec
                  </span>
                ) : 'Parse Receipt'}
              </button>
            )}

            {image && (
              <div className="mt-4">
                <img src={image} alt="Receipt" className="w-full rounded-xl border border-gray-200" />
              </div>
            )}
          </>
        )}

        {receipt && (
          <div>
            <ul className="space-y-2">
              {receipt.items.map((item, i) => (
                <li key={i} className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-sm">
                    <span className="font-medium">{item.quantity}x</span> {item.name}
                    {item.quantity > 1 && (
                      <span className="text-gray-400 text-xs ml-1">(${item.unitPrice.toFixed(2)} ea)</span>
                    )}
                  </span>
                  <span className="text-sm">${item.totalPrice.toFixed(2)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-4 space-y-1 text-sm text-gray-500">
              <div className="flex justify-between"><span>Subtotal</span><span>${receipt.subtotal.toFixed(2)}</span></div>
              {receipt.serviceCharge > 0 && <div className="flex justify-between"><span>Service Charge</span><span>${receipt.serviceCharge.toFixed(2)}</span></div>}
              {receipt.tax > 0 && <div className="flex justify-between"><span>Tax</span><span>${receipt.tax.toFixed(2)}</span></div>}
              {receipt.tip > 0 && <div className="flex justify-between"><span>Tip</span><span>${receipt.tip.toFixed(2)}</span></div>}
              <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2 mt-2 text-base">
                <span>Total</span><span>${receipt.total.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={claimFirst}
              className="mt-6 w-full bg-gray-900 hover:bg-gray-800 text-white font-medium py-3 rounded-xl transition-colors">
              Claim My Items First
            </button>

            <button
              onClick={createSplit}
              className="mt-2 w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-xl transition-colors">
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