'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface Item {
  quantity: number;
  name: string;
  totalPrice: number;
  unitPrice: number;
}

interface Session {
  id: string;
  receipt: {
    items: Item[];
    subtotal: number;
    tax: number;
    serviceCharge: number;
    tip: number;
    total: number;
  };
  claims: Record<string, string>;
}

export default function SplitPage() {
  const { id } = useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [myName, setMyName] = useState('');
  const [nameSet, setNameSet] = useState(false);

  useEffect(() => {
    fetch(`/api/session?id=${id}`)
      .then(r => r.json())
      .then(setSession);
  }, [id]);

  const claimItem = async (index: number) => {
    if (!myName) return;
    const res = await fetch('/api/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, itemIndex: index, name: myName }),
    });
    const updated = await res.json();
    setSession(updated);
  };

  if (!session) return <div className="p-6">Loading...</div>;

  const myItems = session.receipt.items.filter((_, i) => session.claims[i] === myName);
  const mySubtotal = myItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const myShare = mySubtotal > 0 ? (mySubtotal / session.receipt.subtotal) * session.receipt.total : 0;

  if (!nameSet) {
    return (
      <main className="max-w-md mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">SplitCheck</h1>
        <p className="mb-4 text-gray-600">Enter your name to claim your items.</p>
        <input
          className="border rounded px-3 py-2 w-full mb-3"
          placeholder="Your name"
          value={myName}
          onChange={e => setMyName(e.target.value)}
        />
        <button
          onClick={() => setNameSet(true)}
          disabled={!myName}
          className="bg-black text-white px-4 py-2 rounded w-full disabled:opacity-50">
          Continue
        </button>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-1">SplitCheck</h1>
      <p className="text-gray-500 mb-4">Hi {myName} — tap items you ordered.</p>
      <ul className="space-y-2">
        {session.receipt.items.map((item, i) => {
          const claimedBy = session.claims[i];
          const isMine = claimedBy === myName;
          return (
            <li
              key={i}
              onClick={() => claimItem(i)}
              className={`flex justify-between border-b pb-2 cursor-pointer rounded px-2 py-1 ${isMine ? 'bg-green-100' : claimedBy ? 'bg-gray-100 opacity-50' : 'hover:bg-gray-50'}`}
            >
              <span>
                {item.quantity}x {item.name}
                {claimedBy && (
                  <span className="text-xs ml-2 text-gray-500">({claimedBy})</span>
                )}
              </span>
              <span>${item.totalPrice.toFixed(2)}</span>
            </li>
          );
        })}
      </ul>
      {myItems.length > 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Your items</span>
            <span>${mySubtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg">
            <span>Your total (with tax and fees)</span>
            <span>${myShare.toFixed(2)}</span>
          </div>
        </div>
      )}
    </main>
  );
}