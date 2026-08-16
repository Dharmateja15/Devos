'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import {
  apiFetch,
  previewCsvImportApi,
  executeCsvImportApi,
  CsvPreviewResponseDto,
  CsvExecuteResponseDto,
  ApiError,
} from '../../lib/api';
import Link from 'next/link';

interface CsvImportViewProps {
  initialJourneyId?: string;
}

export function CsvImportView({ initialJourneyId }: CsvImportViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accessToken } = useAuth();

  const journeyIdQuery = initialJourneyId || searchParams?.get('journeyId') || '';

  const [journeys, setJourneys] = useState<Array<{ id: string; title: string; category: string }>>([]);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>(journeyIdQuery);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  type ImportStep = 'UPLOAD' | 'PREVIEWING' | 'PREVIEW_READY' | 'EXECUTING' | 'SUCCESS';
  const [step, setStep] = useState<ImportStep>('UPLOAD');

  const [previewResult, setPreviewResult] = useState<CsvPreviewResponseDto | null>(null);
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [executeResult, setExecuteResult] = useState<CsvExecuteResponseDto | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [fileValidationError, setFileValidationError] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // Fetch available journeys for selection if not preselected
  useEffect(() => {
    if (accessToken) {
      apiFetch('/api/v1/journeys', { accessToken })
        .then((data) => {
          if (Array.isArray(data)) {
            setJourneys(data);
            if (!selectedJourneyId && data.length > 0) {
              setSelectedJourneyId(data[0].id);
            }
          }
        })
        .catch(() => {
          // Non-blocking: fail gracefully
        });
    }
  }, [accessToken, selectedJourneyId]);

  // Keep searchParam journeyId synced if provided
  useEffect(() => {
    if (journeyIdQuery) {
      setSelectedJourneyId(journeyIdQuery);
    }
  }, [journeyIdQuery]);

  const selectedJourney = journeys.find((j) => j.id === selectedJourneyId);

  const validateClientFile = (selectedFile: File): boolean => {
    setFileValidationError(null);
    setError(null);

    const nameLower = selectedFile.name.toLowerCase();
    if (!nameLower.endsWith('.csv') && selectedFile.type !== 'text/csv' && selectedFile.type !== 'application/vnd.ms-excel') {
      setFileValidationError('Please select a valid .csv file.');
      return false;
    }

    if (selectedFile.size === 0) {
      setFileValidationError('Selected CSV file is empty.');
      return false;
    }

    return true;
  };

  const handleFileSelect = (selectedFile: File | null) => {
    if (!selectedFile) {
      setFile(null);
      setFileValidationError(null);
      return;
    }

    if (validateClientFile(selectedFile)) {
      setFile(selectedFile);
    } else {
      setFile(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleGeneratePreview = async () => {
    if (!selectedJourneyId) {
      setError('Please select a target journey.');
      return;
    }

    if (!file) {
      setFileValidationError('Please select a CSV file to import.');
      return;
    }

    setError(null);
    setFileValidationError(null);
    setIsExpired(false);
    setStep('PREVIEWING');

    try {
      const result = await previewCsvImportApi(selectedJourneyId, file, accessToken);
      setPreviewResult(result);
      setPreviewToken(result.previewToken);
      setStep('PREVIEW_READY');
    } catch (err: any) {
      setStep('UPLOAD');
      const msg = err instanceof ApiError ? err.message : err?.message || 'Failed to generate preview. Check connectivity or CSV format.';
      setError(msg);
    }
  };

  const handleExecuteImport = async () => {
    if (!selectedJourneyId || !previewToken || isExecuting) {
      return;
    }

    setIsExecuting(true);
    setError(null);
    setIsExpired(false);
    setStep('EXECUTING');

    try {
      const result = await executeCsvImportApi(selectedJourneyId, previewToken, accessToken);
      setExecuteResult(result);
      setStep('SUCCESS');
      setIsExecuting(false);
      try {
        router.refresh();
      } catch {}
    } catch (err: any) {
      setIsExecuting(false);
      const statusCode = err instanceof ApiError ? err.status : 500;
      const msg = err instanceof ApiError ? err.message : err?.message || 'Failed to execute import.';

      if (statusCode === 400 && (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('previously executed'))) {
        setIsExpired(true);
        setPreviewToken(null);
        setError('This preview has expired or is no longer available. Please upload your CSV again.');
        setStep('PREVIEW_READY');
      } else if (statusCode === 400 && (msg.toLowerCase().includes('executing') || msg.toLowerCase().includes('locked'))) {
        setError('This import is currently being processed by another request. Please wait or check your journey.');
        setStep('PREVIEW_READY');
      } else if (statusCode === 403) {
        setError('You do not have permission to import into this journey.');
        setStep('PREVIEW_READY');
      } else {
        setError(msg);
        setStep('PREVIEW_READY');
      }
    }
  };

  const handleResetToUpload = () => {
    setFile(null);
    setPreviewResult(null);
    setPreviewToken(null);
    setExecuteResult(null);
    setError(null);
    setFileValidationError(null);
    setIsExpired(false);
    setIsExecuting(false);
    setStep('UPLOAD');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-indigo-400 uppercase mb-1">
            <span>DevOS Backend Phase 8B</span>
            <span>•</span>
            <span>Data Ingestion</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">CSV Task Import</h1>
          <p className="text-sm text-slate-400 mt-1">
            Import milestones and tasks directly into your DevOS Journey via server-validated CSV files.
          </p>
        </div>

        {selectedJourneyId && (
          <Link
            href={`/journeys/${selectedJourneyId}`}
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-lg border border-slate-700 transition-colors w-fit"
          >
            ← View Journey
          </Link>
        )}
      </div>

      {/* Stepper Navigation Indicator */}
      <div className="grid grid-cols-3 gap-2 p-1 bg-slate-900 border border-slate-800 rounded-xl text-center text-xs font-medium">
        <div
          className={`py-2 px-3 rounded-lg transition-colors ${
            step === 'UPLOAD'
              ? 'bg-indigo-600 text-white shadow-sm font-semibold'
              : 'text-slate-400 bg-slate-800/40'
          }`}
        >
          1. Upload CSV
        </div>
        <div
          className={`py-2 px-3 rounded-lg transition-colors ${
            step === 'PREVIEWING' || step === 'PREVIEW_READY'
              ? 'bg-indigo-600 text-white shadow-sm font-semibold'
              : 'text-slate-400 bg-slate-800/40'
          }`}
        >
          2. Review Preview
        </div>
        <div
          className={`py-2 px-3 rounded-lg transition-colors ${
            step === 'EXECUTING' || step === 'SUCCESS'
              ? 'bg-indigo-600 text-white shadow-sm font-semibold'
              : 'text-slate-400 bg-slate-800/40'
          }`}
        >
          3. Confirm & Execute
        </div>
      </div>

      {/* Global Error Alert Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-red-950/80 border border-red-800/80 text-red-200 text-sm flex items-start gap-3 shadow-lg">
          <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <p className="font-semibold text-red-100">Import Alert</p>
            <p className="mt-0.5">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-200 p-1 hover:bg-red-900/50 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Target Journey Selection Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
        <label htmlFor="journey-select" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Target Journey
        </label>
        {journeys.length > 0 ? (
          <select
            id="journey-select"
            value={selectedJourneyId}
            disabled={step !== 'UPLOAD'}
            onChange={(e) => setSelectedJourneyId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 text-slate-100 text-sm rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-60 transition-colors"
          >
            {journeys.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title} ({j.category})
              </option>
            ))}
          </select>
        ) : (
          <input
            id="journey-select"
            type="text"
            placeholder="Enter Target Journey UUID..."
            value={selectedJourneyId}
            disabled={step !== 'UPLOAD'}
            onChange={(e) => setSelectedJourneyId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 text-slate-100 text-sm rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono disabled:opacity-60 transition-colors"
          />
        )}
        {selectedJourney && (
          <p className="text-xs text-slate-400">
            Selected: <span className="text-indigo-300 font-semibold">{selectedJourney.title}</span> ({selectedJourney.category})
          </p>
        )}
      </div>

      {/* STEP 1: UPLOAD VIEW */}
      {step === 'UPLOAD' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-100">Step 1: Select CSV File</h2>
            <p className="text-xs text-slate-400">
              CSV columns required: <code className="text-indigo-300 font-mono bg-slate-950 px-1.5 py-0.5 rounded">title</code>,{' '}
              <code className="text-indigo-300 font-mono bg-slate-950 px-1.5 py-0.5 rounded">milestone</code>,{' '}
              <code className="text-indigo-300 font-mono bg-slate-950 px-1.5 py-0.5 rounded">priority</code> (LOW, MEDIUM, HIGH). Optional:{' '}
              <code className="text-slate-400 font-mono bg-slate-950 px-1.5 py-0.5 rounded">due_date</code>,{' '}
              <code className="text-slate-400 font-mono bg-slate-950 px-1.5 py-0.5 rounded">tags</code>. Max 500 rows.
            </p>
          </div>

          {/* Drag and Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 cursor-pointer ${
              dragOver
                ? 'border-indigo-500 bg-indigo-950/30'
                : file
                ? 'border-emerald-600/60 bg-emerald-950/20'
                : 'border-slate-700 hover:border-slate-500 bg-slate-950/50'
            }`}
            onClick={() => document.getElementById('csv-file-input')?.click()}
          >
            <input
              id="csv-file-input"
              type="file"
              accept=".csv,text/csv,application/vnd.ms-excel"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files ? e.target.files[0] : null)}
            />

            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="p-3 bg-slate-800 rounded-full text-indigo-400">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>

              {file ? (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-emerald-400 flex items-center justify-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {file.name}
                  </p>
                  <p className="text-xs text-slate-400">{formatFileSize(file.size)}</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-slate-200">
                    <span className="text-indigo-400 font-semibold hover:underline">Click to browse</span> or drag & drop CSV file here
                  </p>
                  <p className="text-xs text-slate-500 mt-1">UTF-8 .csv files up to 500 rows</p>
                </div>
              )}
            </div>
          </div>

          {/* Client File Validation Error */}
          {fileValidationError && (
            <p className="text-xs font-semibold text-red-400 bg-red-950/50 border border-red-800/50 p-3 rounded-lg">
              {fileValidationError}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            {file ? (
              <button
                type="button"
                onClick={() => handleFileSelect(null)}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                Clear file
              </button>
            ) : (
              <span />
            )}

            <button
              type="button"
              disabled={!file || !selectedJourneyId}
              onClick={handleGeneratePreview}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white text-sm font-semibold rounded-xl shadow-md transition-colors flex items-center gap-2"
            >
              <span>Generate Preview</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: PREVIEWING LOADING STATE */}
      {step === 'PREVIEWING' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
          <div className="inline-flex p-4 bg-indigo-950/60 rounded-full text-indigo-400 animate-spin">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-100">Validating & Analyzing CSV...</h3>
          <p className="text-xs text-slate-400">Server is checking row constraints and calculating milestone diffs.</p>
        </div>
      )}

      {/* STEP 3: PREVIEW READY & VALIDATION REVIEW */}
      {step === 'PREVIEW_READY' && previewResult && (
        <div className="space-y-6">
          {/* Validation Errors View */}
          {previewResult.errors && previewResult.errors.length > 0 ? (
            <div className="bg-slate-900/90 border border-red-900/80 rounded-2xl p-6 space-y-5 shadow-md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-950 rounded-lg text-red-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-red-200">Validation Errors Found ({previewResult.errors.length})</h2>
                  <p className="text-xs text-red-400">
                    No database writes were performed. Please fix the following row errors in your CSV file.
                  </p>
                </div>
              </div>

              {/* Error Table */}
              <div className="overflow-x-auto border border-red-900/60 rounded-xl bg-slate-950">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-red-950/60 text-red-300 uppercase tracking-wider font-semibold border-b border-red-900/60">
                    <tr>
                      <th className="px-4 py-3">Row #</th>
                      <th className="px-4 py-3">Column</th>
                      <th className="px-4 py-3">Error Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-950/60 font-mono">
                    {previewResult.errors.map((err, idx) => (
                      <tr key={idx} className="hover:bg-red-950/30">
                        <td className="px-4 py-2.5 font-bold text-red-400">Row {err.row}</td>
                        <td className="px-4 py-2.5 text-indigo-300">{err.column}</td>
                        <td className="px-4 py-2.5 text-slate-200">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleResetToUpload}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors"
                >
                  ← Re-upload Fixed CSV
                </button>
              </div>
            </div>
          ) : (
            /* Valid Preview & Confirmation View */
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-xl font-bold text-slate-100">Step 2: Review Preview & Confirm</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Server verified {previewResult.totalRows} data rows. Inspect milestone allocation before execution.
                  </p>
                </div>
                <span className="px-3 py-1 bg-emerald-950 border border-emerald-800 text-emerald-300 text-xs font-semibold rounded-full flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Preview Validated
                </span>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center">
                  <p className="text-xs text-slate-400 font-medium">Total Rows</p>
                  <p className="text-2xl font-extrabold text-slate-100 mt-1">{previewResult.totalRows}</p>
                </div>
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center">
                  <p className="text-xs text-slate-400 font-medium">Tasks to Create</p>
                  <p className="text-2xl font-extrabold text-indigo-400 mt-1">{previewResult.tasksToCreate}</p>
                </div>
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center">
                  <p className="text-xs text-slate-400 font-medium">New Milestones</p>
                  <p className="text-2xl font-extrabold text-emerald-400 mt-1">
                    {previewResult.milestonesToCreate?.length || 0}
                  </p>
                </div>
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center">
                  <p className="text-xs text-slate-400 font-medium">Reused Milestones</p>
                  <p className="text-2xl font-extrabold text-slate-300 mt-1">
                    {previewResult.milestonesExisting?.length || 0}
                  </p>
                </div>
              </div>

              {/* Milestone Breakdown */}
              <div className="space-y-4">
                {/* Milestones To Create */}
                {previewResult.milestonesToCreate && previewResult.milestonesToCreate.length > 0 && (
                  <div className="bg-emerald-950/20 border border-emerald-900/50 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">
                      New Milestones To Create ({previewResult.milestonesToCreate.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {previewResult.milestonesToCreate.map((mName, i) => (
                        <span key={i} className="px-2.5 py-1 bg-emerald-950 border border-emerald-800 text-emerald-200 text-xs font-medium rounded-lg">
                          + {mName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Existing Milestones Reused */}
                {previewResult.milestonesExisting && previewResult.milestonesExisting.length > 0 && (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Existing Milestones To Reuse ({previewResult.milestonesExisting.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {previewResult.milestonesExisting.map((mName, i) => (
                        <span key={i} className="px-2.5 py-1 bg-slate-900 border border-slate-700 text-slate-300 text-xs font-medium rounded-lg">
                          ↻ {mName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Confirmation Notice & Action Bar */}
              <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={handleResetToUpload}
                  className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
                >
                  ← Choose Different CSV
                </button>

                <button
                  type="button"
                  disabled={isExecuting || !previewToken || isExpired}
                  onClick={handleExecuteImport}
                  className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2"
                >
                  {isExecuting ? (
                    <>
                      <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <span>Executing Import...</span>
                    </>
                  ) : (
                    <>
                      <span>Confirm & Execute Import ({previewResult.tasksToCreate} Tasks)</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 4: EXECUTING STATE */}
      {step === 'EXECUTING' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
          <div className="inline-flex p-4 bg-emerald-950/60 rounded-full text-emerald-400 animate-spin">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-100">Executing Import in Database...</h3>
          <p className="text-xs text-slate-400">
            Inserting milestones and tasks inside a single atomic database transaction.
          </p>
        </div>
      )}

      {/* STEP 5: SUCCESS RESULT */}
      {step === 'SUCCESS' && executeResult && (
        <div className="bg-slate-900/90 border border-emerald-900/80 rounded-2xl p-8 text-center space-y-6 shadow-xl">
          <div className="inline-flex p-4 bg-emerald-950 border border-emerald-800 rounded-full text-emerald-400">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-slate-100">Import Completed Successfully!</h2>
            <p className="text-sm text-slate-400">
              All tasks and milestones have been saved to your target journey.
            </p>
          </div>

          {/* Authoritative Metrics Return */}
          <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
              <p className="text-xs text-slate-400 font-medium">Tasks Created</p>
              <p className="text-3xl font-black text-indigo-400 mt-1">{executeResult.tasksCreated}</p>
            </div>
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
              <p className="text-xs text-slate-400 font-medium">Milestones Created</p>
              <p className="text-3xl font-black text-emerald-400 mt-1">{executeResult.milestonesCreated}</p>
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              type="button"
              onClick={handleResetToUpload}
              className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
            >
              Import Another CSV
            </button>

            {selectedJourneyId && (
              <button
                type="button"
                onClick={() => router.push(`/journeys/${selectedJourneyId}`)}
                className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md transition-colors"
              >
                Go to Journey Details →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
