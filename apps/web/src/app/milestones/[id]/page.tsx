'use client';

import { useEffect, useState, use } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { apiFetch } from '../../../lib/api';
import Link from 'next/link';

export default function MilestoneDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { accessToken } = useAuth();
  const [milestone, setMilestone] = useState<any>(null);
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (accessToken) {
      apiFetch(`/api/v1/milestones/${id}`, { accessToken })
        .then(data => setMilestone(data))
        .catch(err => console.error('Failed to load milestone detail', err));
    }
  }, [accessToken, id]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newTask = await apiFetch(`/api/v1/milestones/${id}/tasks`, {
        method: 'POST',
        accessToken,
        body: JSON.stringify({ title }),
      });
      setMilestone({
        ...milestone,
        tasks: [...(milestone.tasks || []), newTask]
      });
      setTitle('');
    } catch (err) {
      console.error('Failed to create task', err);
    }
  };

  if (!milestone) return <div>Loading...</div>;

  return (
    <div style={{ padding: 20 }}>
      <Link href={`/journeys/${milestone.journeyId}`}>← Back to Journey</Link>
      <h1>{milestone.title}</h1>
      <p>Progress: {milestone.progress}% ({milestone.completedTasks}/{milestone.totalTasks} Tasks)</p>
      
      <h2>Tasks</h2>
      <ul>
        {milestone.tasks?.map((t: any) => (
          <li key={t.id}>
            <Link href={`/tasks/${t.id}`}>{t.title}</Link> ({t.status})
          </li>
        ))}
      </ul>

      <form onSubmit={handleCreateTask}>
        <input placeholder="New Task Title" value={title} onChange={e => setTitle(e.target.value)} required />
        <button type="submit">Add Task</button>
      </form>
    </div>
  );
}
