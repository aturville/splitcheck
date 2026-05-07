'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface Item {
  quantity: number;
  name: string;
  totalPrice: number;
  unitPrice: number;
}

interface Claim {
  name: string;
  quantity?: number;
  amount?: number;
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
  claims: Record<string, Claim[]>;
}

export default function SplitPage() {
  const { id } = useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [myName, setMyName] = useState('');
  const [nameSet, setNameSet] = useState(false);
  const [claimingIndex, setClaimingIndex] = useState<number | null>(null);
  const [claimQty, setClaimQty] = useState(1);
  const [claimAmount, setClaimAmount] = useState('');
  const [claimMode, setClaimMode] = useState<'quantity' | 'amount'>('quantity');

  useEffect(() => {
    const fetchSession = () => {
      fetch(`/api/session?id=${id}`)
        .then(r => r.json())
        .then(setSession);
    };
    fetchSession();
    const interval = setInterval(fetchSession, 3000);
    return () => clearInterval(interval);
  }, [id]);

  const submitClaim = async () => {
    if (claimingIndex === null) return;
    const item = session!.receipt.items[claimingIndex];
    const payload: { id: unknown; itemIndex: number; name: string; quantity?: number; amount?: number } = {
      id,
      itemIndex: claimingIndex,
      name: myName,
    };
    if (claimMode === 'amount') {
      payload.amount = parseFloat(claimAmount);
    } else {
      payload.quantity = claimQty;
    }
    await fetch('/api/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setClaimingIndex(null);
    setClaimQty(1);
    setClaimAmount('');
  };

  if (!session) return <div className="p-6">Loading...</div>;

  const totalMultiplier = session.receipt.subtotal > 0 ? session.receipt.total / session.receipt.subtotal : 1;

  const getMyTotal = () => {
    let total = 0;
    session.receipt.items.forEach((item, i) => {
      const itemClaims = session.claims[i] || [];
      const myClaim = itemClaims.find(c => c.name === myName);
      if (!myClaim) return;
      if (myClaim.amount) {
        total += myClaim.amount * totalMultiplier;
      } else if (myClaim.quantity) {
        total += item.unitPrice * myClaim.quantity * totalMultiplier;
      }
    });
    return total;
  };

  const getClaimedQty = (itemIndex: number) => {
    return (session.claims[itemIndex] || []).reduce((sum, c) => sum + (c.quantity || 0), 0);
  };

  const getClaimedAmount = (itemIndex: number) => {
    return (session.claims[itemIndex] || []).reduce((sum, c) => sum + (c.amount || 0), 0);
  };

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

  const myTotal = getMyTotal();
  const item = claimingIndex !== null ? session.receipt.items[claimingIndex] : null;

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-1">SplitCheck</h1>
      <p className="text-gray-500 mb-4">Hi {myName} — tap items you ordered.</p>

      {claimingIndex !== null && item && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h2 className="font-bold text-lg mb-1">{item.name}</h2>
            <p className="text-gray-500 text-sm mb-4">${item.unitPrice.toFixed(2)} each · {item.quantity} total</p>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setClaimMode('quantity')}
                className={`flex-1 py-2 rounded ${claimMode === 'quantity' ? 'bg-black text-white' : 'border'}`}>
                By quantity
              </button>
              <button
                onClick={() => setClaimMode('amount')}
                className={`flex-1 py-2 rounded ${claimMode === 'amount' ? 'bg-black text-white' : 'border'}`}>
                By amount
              </button>
            </div>
            {claimMode === 'quantity' ? (
              <div className="flex items-center gap-4 mb-4">
                <button onClick={() => setClaimQty(Math.max(1, claimQty - 1))} className="text-2xl px-3">−</button>
                <span className="text-xl font-bold">{claimQty}</span>
                <button onClick={() => setClaimQty(Math.min(item.quantity, claimQty + 1))} className="text-2xl px-3">+</button>
                <span className="text-gray-500">of {item.quantity}</span>
              </div>
            ) : (
              <input
                type="number"
                placeholder="Dollar amount (before tax)"
                value={claimAmount}
                onChange={e => setClaimAmount(e.target.value)}
                className="border rounded px-3 py-2 w-full mb-4"
              />
            )}
            <div className="flex gap-2">
              <button onClick={() => setClaimingIndex(null)} className="flex-1 border py-2 rounded">Cancel</button>
              <button onClick={submitClaim} className="flex-1 bg-black text-white py-2 rounded">Claim</button>
            </div>
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {session.receipt.items.map((item, i) => {
          const itemClaims = session.claims[i] || [];
          const claimedQty = getClaimedQty(i);
          const claimedAmt = getClaimedAmount(i);
          const myClaim = itemClaims.find(c => c.name === myName);
          const fullyClaimedByQty = claimedQty >= item.quantity;
          const isMine = !!myClaim;

          return (
            <li
              key={i}
              onClick={() => !fullyClaimedByQty && setClaimingIndex(i)}
              className={`border-b pb-2 rounded px-2 py-2 ${isMine ? 'bg-green-50' : fullyClaimedByQty ? 'bg-gray-100 opacity-50' : 'hover:bg-gray-50 cursor-pointer'}`}>
              <div className="flex justify-between">
                <span className="font-medium">{item.quantity}x {item.name}</span>
                <span>${item.totalPrice.toFixed(2)}</span>
              </div>
              {itemClaims.length > 0 && (
                <div className="mt-1 text-xs text-gray-500">
                  {itemClaims.map((c, j) => (
                    <span key={j} className="mr-2">
                      {c.name}: {c.quantity ? `${c.quantity}x` : `$${c.amount?.toFixed(2)}`}
                    </span>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {myTotal > 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded">
          <div className="flex justify-between font-bold text-lg">
            <span>Your total (with tax & fees)</span>
            <span>${myTotal.toFixed(2)}</span>
          </div>
        </div>
      )}
    </main>
  );
}