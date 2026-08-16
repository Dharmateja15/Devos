import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ErrorBoundary from './error';
import * as sentryLib from '../lib/sentry';

jest.mock('../lib/sentry', () => ({
  captureFrontendError: jest.fn(),
}));

describe('Frontend Error Boundary Component', () => {
  const mockError = new Error('Test rendering crash');
  const mockReset = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render error fallback UI and capture telemetry error', () => {
    render(<ErrorBoundary error={mockError} reset={mockReset} />);

    expect(screen.getByText('Something went wrong!')).toBeInTheDocument();
    expect(sentryLib.captureFrontendError).toHaveBeenCalledWith(mockError);
  });

  it('should trigger reset when Try again button is clicked', () => {
    render(<ErrorBoundary error={mockError} reset={mockReset} />);

    const retryButton = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(retryButton);

    expect(mockReset).toHaveBeenCalledTimes(1);
  });
});
