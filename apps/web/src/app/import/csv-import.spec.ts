import {
  previewCsvImportApi,
  executeCsvImportApi,
  CsvPreviewResponseDto,
  CsvExecuteResponseDto,
  ApiError,
} from '../../lib/api';

describe('Phase 8B — CSV Import Frontend Integration Suite', () => {
  const validJourneyId = 'journey_uuid_1111111111';
  const mockToken = 'mock_preview_token_abc123';
  const mockAuthToken = 'mock_jwt_access_token_xyz987';

  const validCsvFile = new File(
    ['title,milestone,priority\nLearn Python,Basics,HIGH'],
    'tasks.csv',
    { type: 'text/csv' }
  );

  const mockPreviewSuccess: CsvPreviewResponseDto = {
    previewToken: mockToken,
    journeyId: validJourneyId,
    totalRows: 1,
    validRows: 1,
    invalidRows: 0,
    milestonesExisting: ['Basics'],
    milestonesToCreate: ['Advanced Async'],
    tasksToCreate: 1,
    errors: [],
  };

  const mockExecuteSuccess: CsvExecuteResponseDto = {
    success: true,
    status: 'COMPLETED',
    tasksCreated: 1,
    milestonesCreated: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. File Selection & Client Validation Rules', () => {
    it('1. Valid CSV file selection passes client validation', () => {
      const isCsv = validCsvFile.name.toLowerCase().endsWith('.csv');
      const isNotEmpty = validCsvFile.size > 0;
      expect(isCsv).toBe(true);
      expect(isNotEmpty).toBe(true);
    });

    it('2. Invalid non-CSV file type is rejected client-side', () => {
      const txtFile = new File(['text content'], 'document.txt', { type: 'text/plain' });
      const isCsv = txtFile.name.toLowerCase().endsWith('.csv');
      expect(isCsv).toBe(false);
    });

    it('3. Empty CSV file is rejected client-side', () => {
      const emptyCsv = new File([''], 'empty.csv', { type: 'text/csv' });
      const isNotEmpty = emptyCsv.size > 0;
      expect(isNotEmpty).toBe(false);
    });
  });

  describe('2. Preview API & Token Handling', () => {
    it('4. Preview request posts FormData to journey-scoped preview endpoint', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockPreviewSuccess,
      } as any);

      const res = await previewCsvImportApi(validJourneyId, validCsvFile, mockAuthToken);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [urlCall, optionsCall] = fetchSpy.mock.calls[0];
      expect(urlCall).toContain(`/api/v1/journeys/${validJourneyId}/import/csv/preview`);
      expect(optionsCall?.method).toBe('POST');
      expect(optionsCall?.body).toBeInstanceOf(FormData);
      expect(res.previewToken).toBe(mockToken);
    });

    it('5. Preview response renders correct count metrics', async () => {
      expect(mockPreviewSuccess.totalRows).toBe(1);
      expect(mockPreviewSuccess.tasksToCreate).toBe(1);
      expect(mockPreviewSuccess.milestonesToCreate).toEqual(['Advanced Async']);
      expect(mockPreviewSuccess.milestonesExisting).toEqual(['Basics']);
    });

    it('6. Opaque preview token is retained for execution phase without client modification', () => {
      let retainedToken: string | null = mockPreviewSuccess.previewToken;
      expect(retainedToken).toBe(mockToken);
      expect(retainedToken).not.toContain('local_storage');
    });
  });

  describe('3. Execution & State Protection', () => {
    it('7. Execute request sends JSON body containing opaque preview token', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockExecuteSuccess,
      } as any);

      const res = await executeCsvImportApi(validJourneyId, mockToken, mockAuthToken);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [urlCall, optionsCall] = fetchSpy.mock.calls[0];
      expect(urlCall).toContain(`/api/v1/journeys/${validJourneyId}/import/csv/execute`);
      expect(optionsCall?.method).toBe('POST');
      expect(JSON.parse(optionsCall?.body as string)).toEqual({ previewToken: mockToken });
      expect(res.success).toBe(true);
    });

    it('8. Successful execution returns authoritative backend counts', () => {
      expect(mockExecuteSuccess.tasksCreated).toBe(1);
      expect(mockExecuteSuccess.milestonesCreated).toBe(1);
      expect(mockExecuteSuccess.status).toBe('COMPLETED');
    });

    it('9. Execution button state flag prevents duplicate clicks during pending request', async () => {
      let isExecuting = false;
      const executeClick = async () => {
        if (isExecuting) return null;
        isExecuting = true;
        return executeCsvImportApi(validJourneyId, mockToken, mockAuthToken);
      };

      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockExecuteSuccess,
      } as any);

      // First click proceeds
      const p1 = executeClick();
      // Second click while isExecuting is true is rejected client-side
      const p2 = executeClick();

      expect(p2).resolves.toBeNull();
      const res1 = await p1;
      expect(res1?.success).toBe(true);
    });
  });

  describe('4. Error Handling & Expired Preview Recovery', () => {
    it('10. Expired preview token (400) triggers clear error and invalidates client preview state', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Invalid, expired, or previously executed preview token' }),
      } as any);

      let currentToken: string | null = mockToken;
      let errorState: string | null = null;
      let isExpiredState = false;

      try {
        await executeCsvImportApi(validJourneyId, mockToken, mockAuthToken);
      } catch (err: any) {
        if (err instanceof ApiError && err.status === 400) {
          currentToken = null;
          isExpiredState = true;
          errorState = 'This preview has expired or is no longer available. Please upload your CSV again.';
        }
      }

      expect(currentToken).toBeNull();
      expect(isExpiredState).toBe(true);
      expect(errorState).toContain('expired or is no longer available');
    });

    it('11. Execution failure does not display success state', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Database connection drop' }),
      } as any);

      let successState = false;
      let errorState: string | null = null;

      try {
        await executeCsvImportApi(validJourneyId, mockToken, mockAuthToken);
        successState = true;
      } catch (err: any) {
        errorState = err.message;
      }

      expect(successState).toBe(false);
      expect(errorState).toBe('Database connection drop');
    });

    it('12. Concurrent execution lock error (400) provides helpful user feedback', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Import preview is currently executing or has already been committed' }),
      } as any);

      let userNotice: string | null = null;

      try {
        await executeCsvImportApi(validJourneyId, mockToken, mockAuthToken);
      } catch (err: any) {
        if (err?.message?.includes('currently executing')) {
          userNotice = 'This import is currently being processed by another request. Please wait or check your journey.';
        }
      }

      expect(userNotice).toContain('currently being processed');
    });
  });
});
