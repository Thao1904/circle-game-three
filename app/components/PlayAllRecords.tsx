"use client";

import React, { useEffect, useState, useRef } from 'react';

type RecordItem = { id: string; url: string; createdAt?: string };

export default function PlayAllRecords() {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audiosRef = useRef<HTMLAudioElement[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/records');
        const json = await res.json();
        console.log('Fetched /api/records:', json);
        if (json.success) setRecords(json.records || []);
      } catch (e) {
        console.error('Failed to fetch records', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handlePlayAll = async () => {
    if (playing) return;
    audiosRef.current = [];
    try {
      console.log('Attempting to play all, count=', records.length);
      let playedAny = false;
      for (const r of records) {
        try {
          const a = new Audio(r.url);
          // don't set crossOrigin here — playback of simple media doesn't require CORS
          audiosRef.current.push(a);
          await a.play();
          playedAny = true;
        } catch (err) {
          console.warn('play individual failed for', r.url, err);
        }
      }
      if (playedAny) setPlaying(true);
    } catch (e) {
      console.error('Error playing all', e);
    }
  };

  const handleStopAll = () => {
    for (const a of audiosRef.current) {
      try {
        a.pause();
        a.currentTime = 0;
      } catch (e) {
        // ignore
      }
    }
    audiosRef.current = [];
    setPlaying(false);
  };

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3">
        <button
          onClick={handlePlayAll}
          disabled={loading || records.length === 0 || playing}
          className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          Play all ({records.length})
        </button>

        <button
          onClick={handleStopAll}
          disabled={!playing}
          className="bg-red-600 text-white px-3 py-2 rounded disabled:opacity-50"
        >
          Stop
        </button>
      </div>

      <div className="mt-3 text-sm text-gray-600">
        {loading ? 'Loading records…' : `${records.length} recordings available.`}
      </div>
    </div>
  );
}
