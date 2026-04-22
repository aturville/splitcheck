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
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const parseReceipt = async () => {
    if (!image) return;
    setLoading(true);
    const res = await fetch('/api/parse-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image }),
    });
    const data = await res.json();
    setReceipt(data);
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
    setSplitUrl(`${window.location.origin}/split/${id}`);
  };

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">SplitCheck</h1>
      <input type="file" accept="image/*" onChange={handleImage} className="mb-4" />
      {image && <img src={image} alt="Receipt" className="mb-4 w-full rounded" />}
      <button onClick={parseReceipt} disabled={!image || loading}
        className="bg-black text-white px-4 py-2 rounded disabled:opacity-50 w-full">
        {loading ? 'Parsing...' : 'Parse Receipt'}
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
            Create Split Link
          </button>
        </>
      )}

      {splitUrl && (
        <div className="mt-4 p-4 bg-gray-50 rounded">
          <p className="text-sm text-gray-600 mb-2">Share this link with your group:</p>
          <p className="font-mono text-sm break-all">{splitUrl}</p>
          <button onClick={() => navigator.clipboard.writeText(splitUrl)}
            className="mt-2 text-sm text-blue-600 underline">
            Copy link
          </button>
        </div>
      )}
    </main>
  );
}