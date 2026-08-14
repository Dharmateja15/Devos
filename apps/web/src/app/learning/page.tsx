"use client";

import { useEffect, useState } from 'react';

interface Recommendation {
  conceptId: string;
  title: string;
  reason: string;
  type: string;
  isBlocked: boolean;
}

export default function LearningDashboard() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  useEffect(() => {
    // In a real implementation, this would fetch from /api/learning/recommendations
    // Mock data for Phase 3B demonstration
    setRecommendations([
      { conceptId: '1', title: 'React Hooks', reason: 'Ready to Learn', type: 'LEARN', isBlocked: false },
      { conceptId: '2', title: 'Next.js Routing', reason: 'Needs Review based on previous evaluation', type: 'REVIEW', isBlocked: false }
    ]);
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Learning Intelligence</h1>
      <p className="mb-4 text-gray-600">DevOS recommendations are advisory. You have full autonomy over what you learn and when.</p>
      
      <div className="space-y-4">
        {recommendations.map(r => (
          <div key={r.conceptId} className="border p-4 rounded bg-white shadow">
            <h2 className="text-xl font-semibold">{r.title}</h2>
            <p className="text-sm text-blue-600">{r.type} - {r.reason}</p>
            <div className="mt-4 flex gap-2">
              <button className="bg-blue-500 text-white px-4 py-2 rounded">Start</button>
              <button className="bg-gray-200 px-4 py-2 rounded">Defer</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
