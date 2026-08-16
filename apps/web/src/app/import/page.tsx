'use client';

import React, { Suspense } from 'react';
import { CsvImportView } from '../../components/import/CsvImportView';

function ImportPageContent() {
  return <CsvImportView />;
}

export default function ImportPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading import workspace...</div>}>
      <ImportPageContent />
    </Suspense>
  );
}
