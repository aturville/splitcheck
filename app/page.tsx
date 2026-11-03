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

// Strings while editing so a half-typed number like "8." isn't lost
interface RowDraft {
  index: number;
  name: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
}

type SummaryKey = 'subtotal' | 'serviceCharge' | 'tax' | 'total';

const SUMMARY_LABELS: Record<SummaryKey, string> = {
  subtotal: 'Subtotal',
  serviceCharge: 'Service Charge',
  tax: 'Tax',
  total: 'Total',
};

const toMoney = (value: string) => Math.max(0, Math.round((parseFloat(value) || 0) * 100) / 100);

function PencilIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
    </svg>
  );
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
  const [editingRow, setEditingRow] = useState<RowDraft | null>(null);
  const [editingField, setEditingField] = useState<{ key: SummaryKey; value: string } | null>(null);

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

  // Low ink or misreads: let the host fix rows before sharing
  const startEditRow = (index: number) => {
    if (!receipt) return;
    const item = receipt.items[index];
    setEditingRow({
      index,
      name: item.name,
      quantity: String(item.quantity),
      unitPrice: item.unitPrice > 0 ? item.unitPrice.toFixed(2) : '',
      totalPrice: item.totalPrice > 0 ? item.totalPrice.toFixed(2) : '',
    });
  };

  // Keep total = quantity × unit price whichever one the user changes
  const updateDraft = (field: 'name' | 'quantity' | 'unitPrice' | 'totalPrice', value: string) => {
    setEditingRow(prev => {
      if (!prev) return prev;
      const next = { ...prev, [field]: value };
      const qty = parseInt(next.quantity) || 0;
      if ((field === 'quantity' || field === 'unitPrice') && qty > 0 && next.unitPrice !== '') {
        next.totalPrice = (toMoney(next.unitPrice) * qty).toFixed(2);
      } else if (field === 'totalPrice' && qty > 0 && value !== '') {
        next.unitPrice = (toMoney(value) / qty).toFixed(2);
      }
      return next;
    });
  };

  const saveRow = () => {
    if (!editingRow) return;
    const quantity = Math.max(1, parseInt(editingRow.quantity) || 1);
    const totalPrice = toMoney(editingRow.totalPrice);
    const item = {
      name: editingRow.name.trim() || 'Item',
      quantity,
      totalPrice,
      unitPrice: totalPrice / quantity,
    };
    setReceipt(prev => prev ? { ...prev, items: prev.items.map((it, i) => (i === editingRow.index ? item : it)) } : prev);
    setEditingRow(null);
  };

  const deleteRow = (index: number) => {
    setReceipt(prev => prev ? { ...prev, items: prev.items.filter((_, i) => i !== index) } : prev);
    setEditingRow(null);
  };

  const addRow = () => {
    if (!receipt) return;
    const index = receipt.items.length;
    setReceipt({ ...receipt, items: [...receipt.items, { name: '', quantity: 1, totalPrice: 0, unitPrice: 0 }] });
    setEditingRow({ index, name: '', quantity: '1', unitPrice: '', totalPrice: '' });
  };

  // Fees move the total with them, like tip; editing the total sets it directly
  const saveField = () => {
    if (!editingField) return;
    const value = toMoney(editingField.value);
    const { key } = editingField;
    setReceipt(prev => {
      if (!prev) return prev;
      if (key === 'total') return { ...prev, total: value };
      return { ...prev, [key]: value, total: Math.round((prev.total - prev[key] + value) * 100) / 100 };
    });
    setEditingField(null);
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
    setEditingRow(null);
    setEditingField(null);
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
                    {' '}(${Math.abs(diff).toFixed(2)} {diff > 0 ? 'missing' : 'extra'}). Tap an item to fix it, or add a missing one.
                  </p>
                </div>
              );
            })()}
            <ul className="space-y-2">
              {receipt.items.map((item, i) => (
                <li key={i} className="border-b border-gray-100 pb-2">
                  {editingRow?.index === i ? (
                    <div className="space-y-2 py-1">
                      <input
                        autoFocus
                        placeholder="Item name"
                        value={editingRow.name}
                        onChange={e => updateDraft('name', e.target.value)}
                        aria-label="Item name"
                        className="w-full border rounded-md px-2 py-2 text-sm"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <label className="text-xs text-gray-500">
                          Qty
                          <input
                            type="number"
                            inputMode="numeric"
                            min="1"
                            step="1"
                            value={editingRow.quantity}
                            onChange={e => updateDraft('quantity', e.target.value)}
                            onFocus={e => e.target.select()}
                            className="mt-0.5 w-full border rounded-md px-2 py-2 text-sm text-gray-900"
                          />
                        </label>
                        <label className="text-xs text-gray-500">
                          Each $
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={editingRow.unitPrice}
                            onChange={e => updateDraft('unitPrice', e.target.value)}
                            onFocus={e => e.target.select()}
                            className="mt-0.5 w-full border rounded-md px-2 py-2 text-sm text-gray-900"
                          />
                        </label>
                        <label className="text-xs text-gray-500">
                          Total $
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={editingRow.totalPrice}
                            onChange={e => updateDraft('totalPrice', e.target.value)}
                            onFocus={e => e.target.select()}
                            className="mt-0.5 w-full border rounded-md px-2 py-2 text-sm text-gray-900"
                          />
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={saveRow} className="flex-1 bg-gray-900 text-white py-2 rounded-md text-sm">Done</button>
                        <button type="button" onClick={() => deleteRow(i)} className="flex-1 border border-red-300 text-red-600 py-2 rounded-md text-sm">Delete</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEditRow(i)}
                      aria-label={`Edit ${item.name || 'item'}`}
                      className="w-full flex justify-between items-center gap-2 text-left">
                      <span className="text-sm">
                        <span className="font-medium">{item.quantity}x</span> {item.name || <span className="text-gray-400">Unnamed item</span>}
                        {item.quantity > 1 && (
                          <span className="text-gray-400 text-xs ml-1">(${item.unitPrice.toFixed(2)} ea)</span>
                        )}
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className={`text-sm px-1 rounded ${item.totalPrice === 0 ? 'text-amber-700 bg-amber-50' : ''}`}>
                          ${item.totalPrice.toFixed(2)}
                        </span>
                        <span className="text-gray-400 p-1"><PencilIcon /></span>
                      </span>
                    </button>
                  )}
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={addRow}
              className="mt-2 w-full py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              + Add item
            </button>

            <div className="mt-4 space-y-1 text-sm text-gray-500">
              {(['subtotal', 'serviceCharge', 'tax'] as const).map(key => (
                <div key={key} className="flex justify-between items-center min-h-8">
                  <span>{SUMMARY_LABELS[key]}</span>
                  {editingField?.key === key ? (
                    <span className="flex items-center gap-1">
                      <span>$</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        autoFocus
                        onFocus={e => e.target.select()}
                        placeholder="0.00"
                        value={editingField.value}
                        onChange={e => setEditingField({ key, value: e.target.value })}
                        onBlur={saveField}
                        onKeyDown={e => { if (e.key === 'Enter') saveField(); }}
                        aria-label={SUMMARY_LABELS[key]}
                        className="w-20 border rounded-md px-2 py-1 text-right text-gray-900"
                      />
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingField({ key, value: receipt[key] > 0 ? receipt[key].toFixed(2) : '' })}
                      aria-label={`Edit ${SUMMARY_LABELS[key]}`}
                      className="flex items-center gap-2">
                      <span>${receipt[key].toFixed(2)}</span>
                      <span className="text-gray-400 p-1"><PencilIcon /></span>
                    </button>
                  )}
                </div>
              ))}
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
              <div className="flex justify-between items-center font-bold text-gray-900 border-t border-gray-200 pt-2 mt-2 text-base">
                <span>Total</span>
                {editingField?.key === 'total' ? (
                  <span className="flex items-center gap-1">
                    <span>$</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      autoFocus
                      onFocus={e => e.target.select()}
                      value={editingField.value}
                      onChange={e => setEditingField({ key: 'total', value: e.target.value })}
                      onBlur={saveField}
                      onKeyDown={e => { if (e.key === 'Enter') saveField(); }}
                      aria-label="Total"
                      className="w-24 border rounded-md px-2 py-1 text-right font-normal"
                    />
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingField({ key: 'total', value: receipt.total.toFixed(2) })}
                    aria-label="Edit Total"
                    className="flex items-center gap-2">
                    <span>${receipt.total.toFixed(2)}</span>
                    <span className="text-gray-400 p-1 font-normal"><PencilIcon /></span>
                  </button>
                )}
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