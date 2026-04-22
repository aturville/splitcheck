'use client';

import { useState } from 'react';

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
  const [splitUrl, setSplitUrl] = useState<string | null>(null);

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
    } catch (e) {
      alert('Failed to parse receipt. Please try again.');
    }
    setLoading(false);
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
    setSplitUrl(url);
    if (navigator.share) {
      await navigator.share({ title: 'SplitCheck', text: 'Tap to claim your items!', url });
    } else {
      await navigator.clipboard.writeText(url);
      alert('Link copied!');
    }
  };

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">SplitCheck</h1>
      <input type="file" accept="image/*" onChange={handleImage} className="mb-4" />
      {image && <img src={image} alt="Receipt" className="mb-4 w-full rounded" />}
      <button onClick={parseReceipt} disabled={!image || loading}
        className="bg-black text-white px-4 py-2 rounded disabled:opacity-50 w-full">
      {loading ? (
  <div className="text-center">
    <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
    Parsing receipt... this takes ~15 seconds
  </div>
) : 'Parse Receipt'}
      </button>

      {receipt && (
        <>
          <ul className="mt-6 space-y-2">
            {receipt.items.map((item, i) => (
              <li key={i} className="flex justify-between border-b pb-1">
                <span>{item.quantity}x {item.name} {item.quantity > 1 && <span className="text-gray-400 text-sm">(${item.unitPrice.toFixed(2)} each)</span>}</span>
                <span>${item.totalPrice.toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-1 text-sm text-gray-600">
            <div className="flex justify-between"><span>Subtotal</span><span>${receipt.subtotal.toFixed(2)}</span></div>
            {receipt.serviceCharge > 0 && <div className="flex justify-between"><span>Service Charge</span><span>${receipt.serviceCharge.toFixed(2)}</span></div>}
            {receipt.tax > 0 && <div className="flex justify-between"><span>Tax</span><span>${receipt.tax.toFixed(2)}</span></div>}
            {receipt.tip > 0 && <div className="flex justify-between"><span>Tip</span><span>${receipt.tip.toFixed(2)}</span></div>}
            <div className="flex justify-between font-bold text-black border-t pt-1"><span>Total</span><span>${receipt.total.toFixed(2)}</span></div>
          </div>
          <button onClick={createSplit}
            className="mt-6 bg-green-600 text-white px-4 py-2 rounded w-full">
            Share Split Link
          </button>
        </>
      )}

      
      )}
    </main>
  );
}